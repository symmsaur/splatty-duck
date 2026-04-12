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

async function getDevice() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
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
        code: await (await fetch('vertex.wgsl')).text(),
      }),
      buffers: [
        {
          // splats
          arrayStride: splatSizeByte,
          stepMode: "instance",
          attributes: [
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
        {
          // computed position
          arrayStride: 2 * 4, // vec2f
          stepMode: "instance",
          attributes: [
            {
              // vertex positions
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
        {
          // eigen vectors
          arrayStride: 2 * 2 * 4, // mat2f
          stepMode: "instance",
          attributes: [
            {
              // vertex positions
              shaderLocation: 4,
              offset: 0,
              format: "float32x4",
            },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: await (await fetch('fragment.wgsl')).text(),
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

  // const splatData = [
  //   0.5, //property float x
  //   0.0, //property float y
  //   1.0, //property float z
  //   0.0, //property float nx
  //   0.0, //property float ny
  //   0.0, //property float nz
  //   1.0, //property float f_dc_0
  //   0.0, //property float f_dc_1
  //   1.0, //property float f_dc_2
  //   1.0, //property float opacity
  //   -0.69, //property float scale_0
  //   -0.69, //property float scale_1
  //   -0.69, //property float scale_2
  //   1.0 / Math.sqrt(2.0), //property float rot_0
  //   1.0 / Math.sqrt(2.0), //property float rot_1
  //   0.0, //property float rot_2
  //   0.0, //property float rot_3
  // ];

  const splatData = await downloadPLY();
  const duckCenterOfMass = centerOfMass(splatData);

  const numSplats = splatData.length / splatSize;

  const splatBuffer = device.createBuffer({
    size: splatSizeByte * numSplats,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
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

  var computeShader = await fetch('compute.wgsl');
  var computeShader = await computeShader.text();
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({
        code: computeShader
      })
    }
  });

  const computeOutPosition = device.createBuffer({
    size: numSplats * 2 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX ,
    mappedAtCreation: false,
  });

  const computeOutEigen = device.createBuffer({
    size: 2 * numSplats * 2 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX ,
    mappedAtCreation: false,
  });
  
  const computeOutDebug = device.createBuffer({
    size: numSplats * 4 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: false,
  });

  const computeOutDebugRead = device.createBuffer({
    size: numSplats*4*4,
    usage:GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: splatBuffer },
      { binding: 1, resource: computeOutPosition },
      { binding: 2, resource: transformBuffer },
      { binding: 3, resource: computeOutDebug },
      { binding: 4, resource: computeOutEigen },
    ],
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: splatTexture.createView() },
    ],
  });

  function getTransform(time) {
    var to_center_of_mass = translationMatrix([
      -duckCenterOfMass[0],
      -duckCenterOfMass[1],
      -duckCenterOfMass[2],
    ]);
    var m = rotationMatrix(0.5 * time, 0.2 * time, time);
    var t = translationMatrix([
      0, 0, 0.7
    ]);
    var p = projectionMatrix();
    return multiply(p, multiply(t, multiply(m, to_center_of_mass)));
  }

  async function frame() {
    var time = new Date().getTime() / 1000;
    var transform = getTransform(time);
    const transformLength = 4 * 4;
    var transformf32 = new Float32Array(transformLength);
    for (let i = 0; i < 4; ++i) {
      for (let j = 0; j < 4; ++j) {
        transformf32[i * 4 + j] = transform[j][i];
      }
    }
    device.queue.writeBuffer(transformBuffer, 0, transformf32, 0, transformLength);

    const commandEncoder = device.createCommandEncoder();

    const computePassEncoder = commandEncoder.beginComputePass({});
    computePassEncoder.setPipeline(computePipeline);
    computePassEncoder.setBindGroup(0, computeBindGroup);
    computePassEncoder.dispatchWorkgroups(Math.floor(numSplats / 256), 1, 1);
    computePassEncoder.end();

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: [0.0, 0, 0, 1.0],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, splatBuffer);
    passEncoder.setVertexBuffer(1, quadVertexBuffer);
    passEncoder.setVertexBuffer(2, computeOutPosition);
    passEncoder.setVertexBuffer(3, computeOutEigen);
    passEncoder.draw(6, numSplats);
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(computeOutDebug, 0, computeOutDebugRead, 0, numSplats * 4 * 4);

    device.queue.submit([commandEncoder.finish()]);

    await computeOutDebugRead.mapAsync(GPUMapMode.READ);
    var debugOut = computeOutDebugRead.getMappedRange();
    var debugOutFloat = new Float32Array(debugOut, 0, numSplats * 4);
    // console.log(debugOutFloat);
    computeOutDebugRead.unmap();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
