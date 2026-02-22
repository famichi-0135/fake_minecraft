import * as THREE from "three";
import { CHUNK_SIZE, BOTTOM_Y } from "../core/Constants.js";

// 十字面（クロスモデル）の方向定義（草、花、松明など）
const CROSS_FACES = [
  {
    // Diagonal 1: Front-Left to Back-Right (Front side)
    dir: [0.707, 0, 0.707],
    corners: [
      [0, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Diagonal 1: (Back side)
    dir: [-0.707, 0, -0.707],
    corners: [
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Diagonal 2: Front-Right to Back-Left (Front side)
    dir: [-0.707, 0, 0.707],
    corners: [
      [1, 0, 1],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Diagonal 2: (Back side)
    dir: [0.707, 0, -0.707],
    corners: [
      [0, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
];

const FACES = [
  {
    // Right (+x)
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Left (-x)
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Top (+y)
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Bottom (-y)
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Front (+z)
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Back (-z)
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
];

const SLAB_FACES = [
  {
    // Right (+x)
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 0.5, 0],
      [1, 0.5, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Left (-x)
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 0.5, 1],
      [0, 0.5, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Top (+y) - half height
    dir: [0, 1, 0],
    corners: [
      [0, 0.5, 1],
      [1, 0.5, 1],
      [1, 0.5, 0],
      [0, 0.5, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Bottom (-y)
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Front (+z)
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0.5, 1],
      [0, 0.5, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Back (-z)
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0.5, 0],
      [1, 0.5, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
];

const STAIR_FACES = [
  {
    // Bottom (-y)
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Top Upper (+y)
    dir: [0, 1, 0],
    corners: [
      [0, 1, 0.5],
      [1, 1, 0.5],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Top Lower (+y)
    dir: [0, 1, 0],
    corners: [
      [0, 0.5, 1],
      [1, 0.5, 1],
      [1, 0.5, 0.5],
      [0, 0.5, 0.5],
    ],
    uvs: [
      [0, 0.5],
      [1, 0.5],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Back (-z)
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Front (+z) Lower
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0.5, 1],
      [0, 0.5, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Front (+z) Upper (Middle)
    dir: [0, 0, 1],
    corners: [
      [0, 0.5, 0.5],
      [1, 0.5, 0.5],
      [1, 1, 0.5],
      [0, 1, 0.5],
    ],
    uvs: [
      [0, 0.5],
      [1, 0.5],
      [1, 1],
      [0, 1],
    ],
  },
  {
    // Left (-x) Lower
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 0.5, 1],
      [0, 0.5, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Left (-x) Upper
    dir: [-1, 0, 0],
    corners: [
      [0, 0.5, 0],
      [0, 0.5, 0.5],
      [0, 1, 0.5],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0.5],
      [0.5, 0.5],
      [0.5, 1],
      [0, 1],
    ],
  },
  {
    // Right (+x) Lower
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 0.5, 0],
      [1, 0.5, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
  },
  {
    // Right (+x) Upper
    dir: [1, 0, 0],
    corners: [
      [1, 0.5, 0.5],
      [1, 0.5, 0],
      [1, 1, 0],
      [1, 1, 0.5],
    ],
    uvs: [
      [0.5, 0.5],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
    ],
  },
];

export class ChunkMeshBuilder {
  constructor(chunk, materialFactory, blockRegistry) {
    this.chunk = chunk;
    this.materialFactory = materialFactory;
    this.blockRegistry = blockRegistry;
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let indexOffset = 0;

    const groups = {
      0: [], // opaque
      1: [], // transparent
    };

    const faceMetadata = [];
    const uvMap = this.materialFactory.textureAtlas.getUVMap();

    const startX = this.chunk.startX;
    const startZ = this.chunk.startZ;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let ly = 0; ly <= this.chunk.maxY - BOTTOM_Y; ly++) {
          const idx = this.chunk.getIndex(lx, ly, lz);
          const intType = this.chunk.blockData[idx];
          if (intType === 0) continue;

          const type = this.blockRegistry.getBlockName(intType);
          const isTransparent = this.blockRegistry.isTransparent(type);
          const blockDef = this.blockRegistry.get(type);
          if (!blockDef) continue;

          const isCrossModel = blockDef.model === "cross";
          const isSlabModel = blockDef.model === "slab";
          const isStairModel = blockDef.model === "stair";

          let facesToIterate = FACES;
          if (isCrossModel) facesToIterate = CROSS_FACES;
          else if (isSlabModel) facesToIterate = SLAB_FACES;
          else if (isStairModel) facesToIterate = STAIR_FACES;

          const x = startX + lx;
          const z = startZ + lz;
          const y = BOTTOM_Y + ly;

          for (let f = 0; f < facesToIterate.length; f++) {
            const face = facesToIterate[f];
            let isVisible = false;

            if (isCrossModel || isStairModel) {
              // 階段とクロスモデルは複雑なので常に全面を描画する（見えない面を消す最適化を省略）
              isVisible = true;
            } else {
              const nlx = lx + face.dir[0];
              const nly = ly + face.dir[1];
              const nlz = lz + face.dir[2];

              let neighborIntType = 0;
              let isNeighborOut = false;
              if (
                nlx >= 0 &&
                nlx < CHUNK_SIZE &&
                nlz >= 0 &&
                nlz < CHUNK_SIZE &&
                nly >= 0 &&
                nly < 256
              ) {
                neighborIntType =
                  this.chunk.blockData[this.chunk.getIndex(nlx, nly, nlz)];
              } else {
                isNeighborOut = true;
              }

              let neighborType = "air";
              if (!isNeighborOut) {
                neighborType = this.blockRegistry.getBlockName(neighborIntType);
              } else if (type === "water") {
                neighborType = "water";
              }

              let neighborDef = this.blockRegistry.get(neighborType);

              if (!neighborType || neighborType === "air") {
                isVisible = true;
              } else if (
                this.blockRegistry.isTransparent(neighborType) ||
                (neighborDef &&
                  neighborDef.model &&
                  neighborDef.model !== "cube")
              ) {
                // 隣が透明、もしくは特殊形状（slab, crossなどフルキューブじゃない）場合は面を描画する
                if (isTransparent && type === neighborType && !isSlabModel) {
                  isVisible = false;
                } else {
                  isVisible = true;
                }
              } else if (isSlabModel && face.dir[1] === 1) {
                // 自分がSlabで上面の場合は、上のブロックが何であれ上面を描画する(ハーフなので隙間ができる)
                isVisible = true;
              }
            }

            if (isVisible) {
              let texKey = blockDef.iconTex;
              // 階段モデルもキューブのように各面テクスチャを割り当てる
              if (blockDef.faces && !isCrossModel) {
                // face.dir で面を判定
                if (face.dir[1] === 1) texKey = blockDef.faces.top;
                else if (face.dir[1] === -1) texKey = blockDef.faces.bottom;
                else texKey = blockDef.faces.sides;
              }

              const groupIndex = isTransparent ? 1 : 0;
              const uvData = uvMap[texKey] || { u: 0, v: 0, size: 1 };

              for (let i = 0; i < 4; i++) {
                const corner = face.corners[i];
                positions.push(
                  x + corner[0] - 0.5,
                  y + corner[1] - 0.5,
                  z + corner[2] - 0.5,
                );
                normals.push(...face.dir);

                const baseU = face.uvs[i][0];
                const baseV = face.uvs[i][1];
                uvs.push(
                  uvData.u + baseU * uvData.size,
                  uvData.v + baseV * uvData.size,
                );
              }

              const startIndex = indices.length;
              indices.push(
                indexOffset,
                indexOffset + 1,
                indexOffset + 2,
                indexOffset,
                indexOffset + 2,
                indexOffset + 3,
              );
              indexOffset += 4;

              groups[groupIndex].push({ start: startIndex, count: 6 });

              faceMetadata.push({ x, y, z, type, normal: face.dir });
              faceMetadata.push({ x, y, z, type, normal: face.dir });
            }
          }
        }
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

    const optimizedIndices = [];
    const metaMap = new Map();
    let triIndex = 0;

    for (const m in groups) {
      if (groups[m].length === 0) continue;
      const groupStart = optimizedIndices.length;
      let groupCount = 0;

      const matIndex = parseInt(m);
      for (const face of groups[m]) {
        for (let j = 0; j < face.count; j++) {
          optimizedIndices.push(indices[face.start + j]);
        }
        groupCount += face.count;

        const originalFaceIndex = face.start / 3;
        metaMap.set(triIndex++, faceMetadata[originalFaceIndex]);
        metaMap.set(triIndex++, faceMetadata[originalFaceIndex + 1]);
      }

      geometry.addGroup(groupStart, groupCount, matIndex);
    }

    geometry.setIndex(optimizedIndices);

    const materials = this.materialFactory.getAtlasMaterials();
    return { geometry, materials, metaMap };
  }
}
