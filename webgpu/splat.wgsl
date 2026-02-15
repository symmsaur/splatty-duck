
struct VertexInput {
    @location(0) position: vec3f,
    @location(1) quad_pos: vec2f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
}


@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var position = in.position + in.quad_pos;
    var out : VertexOutput;
    out.position = position;
    return out;
}

@fragment
fn main() -> @location(0) vec4f {
    return vec4(1.0, 0.0, 0.0, 1.0);
}
