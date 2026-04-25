struct VertexInput {
    @builtin(instance_index) instance_index: u32,
    @location(0) position: vec2f,
    @location(1) color: vec4f,
    // @location(2) opacity: f32,
    @location(3) quad_pos: vec2f,
    @location(4) eigen: vec4f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
    @location(1) uv: vec2f,
}

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var eigen_mat = 1 * mat2x2f(in.eigen.xy, in.eigen.zw);
    var position = in.position + eigen_mat * in.quad_pos;

    var out : VertexOutput;
    out.position = vec4f(position, 0.5, 1.0);
    out.color = in.color; //vec4f(in.color, .05 * 1 / (1 + exp(-in.opacity)));
    out.uv = in.quad_pos / 2.0 + 0.5;
    return out;
}
