struct Uniform {
    transform: mat4x4f
}

@group(0) @binding(0) var<storage, read> ply: array<f32>;
@group(0) @binding(5) var<storage, read> order: array<u32>;
@group(0) @binding(1) var<storage, read_write> out_position: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> out_eigen: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> out_debug: array<vec4f>;
@group(0) @binding(2) var<uniform> transform : Uniform;

@compute @workgroup_size(256, 1, 1) fn computeShader(
    @builtin(global_invocation_id) id: vec3<u32>
) {
    var ply_idx = id.x * 17;
    // FIXME: Shold this be used?
    // if(ply_idx > arrayLength(ply)) {
    //     return;
    // }

    // Extract data from the raw ply input.
    var ply_position = vec3f(
        ply[ply_idx],
        ply[ply_idx + 1],
        ply[ply_idx + 2]
    );
    var scale = vec3f(
        ply[ply_idx + 10],
        ply[ply_idx + 11], 
        ply[ply_idx + 12]
    );
    var quat = vec4f(
        ply[ply_idx + 13],
        ply[ply_idx + 14],
        ply[ply_idx + 15],
        ply[ply_idx + 16]
    );

    // x y z pos in clip space is relative to camera "regular" coordinates
    var clip_pos = transform.transform * vec4f(ply_position, 1.0);

    // scale is log in ply file
    var sx = vec3(exp(scale.x), 0, 0);
    var sy = vec3(0, exp(scale.y), 0);
    var sz = vec3(0, 0, exp(scale.z));

    // // https://en.wikipedia.org/wiki/Euler%E2%80%93Rodrigues_formula
    sx = sx + 2.0 * quat.x * cross(quat.yzw, sx) + 2 * (cross(quat.yzw, cross(quat.yzw, sx)));
    sy = sy + 2.0 * quat.x * cross(quat.yzw, sy) + 2 * (cross(quat.yzw, cross(quat.yzw, sy)));
    sz = sz + 2.0 * quat.x * cross(quat.yzw, sz) + 2 * (cross(quat.yzw, cross(quat.yzw, sz)));
  
    // Focal length, i.e. how far back the pinhole camera is compared to the image plane.
    var l = 1.0;
    var x = clip_pos.x;
    var y = clip_pos.y;
    var z = clip_pos.z;

    // Local ortographic projection
    var local_ortho = mat3x3(
        vec3(l/z, 0, 0),
        vec3(0, l/z, 0),
        vec3(-l*x/(z*z), -l*y/(z*z), 1)
    );

    var camera_transform = mat3x3(
        transform.transform[0].xyz,
        transform.transform[1].xyz,
        transform.transform[2].xyz
    );

    var covariance = mat3x3(sx, sy, sz);

    var clip_covariance = local_ortho * camera_transform * covariance *
        transpose(camera_transform) * transpose(local_ortho);

    // take 2x2 submatrix marginalizing the covariance to 2d
    var a = clip_covariance[0].x;
    var b = clip_covariance[1].x;
    var c = clip_covariance[0].y;
    var d = clip_covariance[1].y;

    // eigenvalues
    var lambda1 = (a + d) / 2 + sqrt( ((a+d)/2) * ((a+d)/2) + b*c - a*d );
    var lambda2 = (a + d) / 2 - sqrt( ((a+d)/2) * ((a+d)/2) + b*c - a*d );

    // eigenvectors
    var v1 = vec2(b, lambda1 - a);
    // sqrt for stddev instead of variance
    v1 = sqrt(lambda1) * v1 / sqrt(dot(v1, v1));
    var v2 = vec2(b, lambda2 - a);
    // sqrt for stddev instead of variance
    v2 = sqrt(lambda2) * v2 / sqrt(dot(v2, v2));

    var out_idx = order[id.x];
    out_position[out_idx] = clip_pos.xy / clip_pos.w;
    out_debug[out_idx] = clip_pos;
    out_eigen[2 * out_idx] = v1;
    out_eigen[2 * out_idx + 1] = v2;
}
