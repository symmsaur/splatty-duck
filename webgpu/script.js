// CORS fail or smth
// import splatWgsl from "./splat.wgsl";

function transpose(M) {
  var MR = create2dArray();
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      MR[i][j] = M[j][i];
    }
  }
  return MR;
}

function multiply(M1, M2) {
  var M3 = create2dArray();
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      for (var k = 0; k < 4; k++) {
        M3[i][j] += M1[i][k] * M2[k][j];
      }
    }
  }
  return M3;
}

function multiplyVertex(transformation, vertex) {
  var M = transformation;
  var outv = [0, 0, 0, 0];
  for (var j = 0; j < 4; j++) {
    for (var k = 0; k < 4; k++) {
      outv[j] += M[j][k] * vertex[k];
    }
  }
  return outv;
}

function multiplyVertices(transformation, vertices) {
  var M = transformation;
  var outv = new Array(vertices.length);
  for (var i in vertices) {
    var v = vertices[i];
    outv[i] = [0, 0, 0, 0];
    for (var j = 0; j < 4; j++) {
      for (var k = 0; k < 4; k++) {
        outv[i][j] += M[j][k] * v[k];
      }
    }
  }
  return outv;
}

function create2dArray() {
  var arr = new Array(4);
  for (var i = 0; i < 4; i++) {
    //arr[i] = new Array(4)
    arr[i] = [0, 0, 0, 0];
  }
  return arr;
}

function translationMatrix(vec) {
  var M = [
    [1, 0, 0, vec[0]],
    [0, 1, 0, vec[1]],
    [0, 0, 1, vec[2]],
    [0, 0, 0, 1],
  ];
  return M;
}

function projectionMatrix() {
  var M = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
  ];
  return M;
}

function identityMatrix() {
  var M = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  return M;
}

function rotationMatrix(phi, theta, rho) {
  var M = multiply(rotZMat(rho), rotYMat(theta));
  M = multiply(M, rotXMat(phi));
  return M;
}

function rotXMat(phi) {
  var M = [
    [1, 0, 0, 0],
    [0, Math.cos(phi), -Math.sin(phi), 0],
    [0, Math.sin(phi), Math.cos(phi), 0],
    [0, 0, 0, 1],
  ];
  return M;
}

function rotYMat(phi) {
  var M = [
    [Math.cos(phi), 0, Math.sin(phi), 0],
    [0, 1, 0, 0],
    [-Math.sin(phi), 0, Math.cos(phi), 0],
    [0, 0, 0, 1],
  ];
  return M;
}
function rotZMat(phi) {
  var M = [
    [Math.cos(phi), -Math.sin(phi), 0, 0],
    [Math.sin(phi), Math.cos(phi), 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  return M;
}

const splatVertexWgsl = `

struct Uniform {
    transform: mat4x4f
}

@group(0) @binding(0) var<uniform> transform : Uniform;
struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec3f,
    @location(2) opacity: f32,
    @location(3) quad_pos: vec2f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
    @location(1) uv: vec2f,
}


@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var pos = transform.transform * vec4f(in.position, 1.0);
    var position = pos.xyz + 0.5 * vec3f(in.quad_pos, 0.0) + vec3f(0,0,0.5);
    var out : VertexOutput;
    out.position = vec4f(position, 1.0);
    out.color = vec4f(in.color, 0.3 * in.opacity);
    out.uv = in.quad_pos / 2.0 + 0.5;
    return out;
}`;

const splatFragmentWgsl = `
@group(0) @binding(1) var linearSampler : sampler;
@group(0) @binding(2) var gaussianTexture : texture_2d<f32>;

@fragment
fn fs_main(
    @location(0) color: vec4f,
    @location(1) fragUV: vec2f
) -> @location(0) vec4f {
    return textureSample(gaussianTexture, linearSampler, fragUV) * color;
}
`;
async function getDevice() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  console.log(device);
  return device;
}

async function downloadPLY() {
  const response = await fetch("67p.ply.ply");
  const buffer = await response.arrayBuffer();
  const buffer_uint8 = new Uint8Array(buffer);
  const needle = new TextEncoder().encode("end_header\n");
  let header_end = 0;
  outer: for (let i = 0; i < 1000; i++) {
    let j = 0;
    for (; j < needle.length; j++) {
      if (buffer_uint8[i + j] != needle[j]) {
        continue outer;
      }
    }
    if (j == needle.length) {
      header_end = i + j;
      break outer;
    }
  }
  if (!response.ok) {
    console.log(response);
  }
  const buffer_f32 = new Float32Array(buffer.slice(header_end));
  return buffer_f32;
}

function centerOfMass(ply_buffer_f32) {
  let x = 0;
  let y = 0;
  let z = 0;
  let n_splats = ply_buffer_f32.length / 17;
  for (let i = 0; i < ply_buffer_f32.length / 17; i += 17) {
    x += ply_buffer_f32[i];
    y += ply_buffer_f32[i + 1];
    z += ply_buffer_f32[i + 2];
  }
  return [x / n_splats, y / n_splats, z / n_splats];
}

async function main() {
  const device = await getDevice();
  const canvas = document.querySelector("canvas");
  const context = canvas.getContext("webgpu");
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: "rgba8unorm",
    tonemapping: {
      mode: "standard",
    },
  });

  const splatSize = 17;
  const splatSizeByte = splatSize * 4;

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: splatVertexWgsl,
      }),
      buffers: [
        {
          // splats
          arrayStride: splatSizeByte,
          stepMode: "instance",
          attributes: [
            {
              // position
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
            {
              // color
              shaderLocation: 1,
              offset: 6 * 4,
              format: "float32x3",
            },
            {
              // opacity
              shaderLocation: 2,
              offset: 9 * 4,
              format: "float32",
            },
          ],
        },
        {
          // quad
          arrayStride: 2 * 4, // vec2f
          stepMode: "vertex",
          attributes: [
            {
              // vertex positions
              shaderLocation: 3,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: splatFragmentWgsl,
      }),
      targets: [
        {
          blend: {
            alpha: {
              dstFactor: "one",
              srcFactor: "one",
              operation: "add",
            },
            color: {
              dstFactor: "one",
              srcFactor: "src-alpha",
              operation: "add",
            },
          },
          format: "rgba8unorm",
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  const splatImage = await createImageBitmap(
    await (await fetch("assets/gauss.png")).blob(),
  );

  splatTexture = device.createTexture({
    size: [splatImage.width, splatImage.height, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: splatImage },
    { texture: splatTexture },
    [splatImage.width, splatImage.height],
  );

  const splatData = [
    0.0, //property float x
    0.0, //property float y
    0.0, //property float z
    0.0, //property float nx
    0.0, //property float ny
    0.0, //property float nz
    1.0, //property float f_dc_0
    0.0, //property float f_dc_1
    1.0, //property float f_dc_2
    1.0, //property float opacity
    1.0, //property float scale_0
    2.0, //property float scale_1
    3.0, //property float scale_2
    0.0, //property float rot_0
    0.0, //property float rot_1
    0.0, //property float rot_2
    0.0, //property float rot_3
  ];

  // const splatData = await downloadPLY();
  const duckCenterOfMass = centerOfMass(splatData);
  console.log(duckCenterOfMass);

  // Assumes splatData is in bytes
  const numSplats = splatData.length / splatSize;

  const splatBuffer = device.createBuffer({
    size: splatSizeByte * numSplats,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });

  new Float32Array(splatBuffer.getMappedRange()).set(splatData);
  splatBuffer.unmap();

  const quadVertexBuffer = device.createBuffer({
    size: 6 * 2 * 4, // 6x vec2f
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  const quadVertexData = [
    -1.0, -1.0, +1.0, -1.0, -1.0, +1.0, -1.0, +1.0, +1.0, -1.0, +1.0, +1.0,
  ];

  new Float32Array(quadVertexBuffer.getMappedRange()).set(quadVertexData);
  quadVertexBuffer.unmap();

  const transformBuffer = device.createBuffer({
    size: 4 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: transformBuffer },
      { binding: 1, resource: sampler },
      { binding: 2, resource: splatTexture.createView() },
    ],
  });

  function getTransform(time) {
    var to_center_of_mass = translationMatrix([
      -duckCenterOfMass[0],
      -duckCenterOfMass[1],
      -duckCenterOfMass[2],
    ]);
    var m = rotationMatrix(0.5 * time, 0.2 * time, time);
    return multiply(m, to_center_of_mass);
  }

  function frame() {
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: [0.0, 0, 0, 1.0],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    var time = new Date().getTime() / 1000;
    var transform = getTransform(time);
    var transformf32 = new Float32Array(4 * 4);
    for (let i = 0; i < 4; ++i) {
      for (let j = 0; j < 4; ++j) {
        transformf32[i * 4 + j] = transform[j][i];
      }
    }
    const transformByteLength = 4 * 4 * 4;
    device.queue.writeBuffer(transformBuffer, 0, transformf32, 0, 4 * 4);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, splatBuffer);
    passEncoder.setVertexBuffer(1, quadVertexBuffer);
    passEncoder.draw(6, numSplats);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
