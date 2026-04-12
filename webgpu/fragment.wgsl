@group(0) @binding(0) var linearSampler : sampler;
@group(0) @binding(1) var gaussianTexture : texture_2d<f32>;

@fragment
fn fs_main(
    @location(0) color: vec4f,
    @location(1) fragUV: vec2f,
) -> @location(0) vec4f {
    return textureSample(gaussianTexture, linearSampler, fragUV) * color;
}
