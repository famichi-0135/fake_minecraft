import * as THREE from "three";
import { CHUNK_SIZE, BOTTOM_Y } from "../core/Constants.js";

/**
 * チャンクのメッシュを BufferGeometry で構築する
 * (単純なFace Culling版。完全なGreedy Meshingへの第一歩)
 */
export class ChunkMeshBuilder {
  /**
   * @param {import('./Chunk.js').Chunk} chunk
   * @param {import('../rendering/MaterialFactory.js').MaterialFactory} materialFactory
   * @param {import('./BlockRegistry.js').BlockRegistry} blockRegistry
   */
  constructor(chunk, materialFactory, blockRegistry) {
    this.chunk = chunk;
    this.materialFactory = materialFactory;
    this.blockRegistry = blockRegistry;

    // 面の向きと頂点オフセット
    // 順番: [+x, -x, +y, -y, +z, -z] (MaterialFactoryの配列順と一致させる)
    this.FACES = [
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
  }

  /**
   * チャンクデータからグループ化されたBufferGeometryを生成
   * @returns {{ geometry: THREE.BufferGeometry, materials: THREE.Material[], blockPositions: Object }}
   */
  build() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let indexOffset = 0;

    // マテリアルの管理
    // materialIndexList[マテリアルのハッシュ] = index
    const materialIndexMap = new Map();
    const materials = [];
    const groups = {}; // { matIndex: { start, count } }

    // Raycast用のメタデータ（faceIndex -> block position）
    // Array of { x, y, z, type }
    const faceMetadata = [];

    for (let x = this.chunk.startX; x < this.chunk.startX + CHUNK_SIZE; x++) {
      for (let z = this.chunk.startZ; z < this.chunk.startZ + CHUNK_SIZE; z++) {
        for (let y = BOTTOM_Y; y <= this.chunk.maxY; y++) {
          const type = this.chunk.blockData.get(`${x},${y},${z}`);
          if (!type || type === "air") continue;

          const isTransparent = this.blockRegistry.isTransparent(type);
          const matConfig = this.materialFactory.get(type);
          const isMultiMaterial = Array.isArray(matConfig);

          // 6方向の面をチェック
          for (let f = 0; f < 6; f++) {
            const face = this.FACES[f];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            const neighborType = this.chunk.blockData.get(`${nx},${ny},${nz}`);
            let isVisible = false;

            // カリング判定
            if (!neighborType || neighborType === "air") {
              isVisible = true; // 隣が空なら見える
            } else if (this.blockRegistry.isTransparent(neighborType)) {
              if (isTransparent && type === neighborType) {
                // 水ブロック同士などは境界を描画しない
                isVisible = false;
              } else {
                isVisible = true; // 隣が透明ブロックなら見える
              }
            }

            if (isVisible) {
              // マテリアルのインデックスを解決
              const mat = isMultiMaterial ? matConfig[f] : matConfig;
              let matIndex = materialIndexMap.get(mat.uuid);
              if (matIndex === undefined) {
                matIndex = materials.length;
                materials.push(mat);
                materialIndexMap.set(mat.uuid, matIndex);
                groups[matIndex] = []; // グループ分け用
              }

              // 頂点データの追加
              for (let i = 0; i < 4; i++) {
                const corner = face.corners[i];
                positions.push(
                  x + corner[0] - 0.5,
                  y + corner[1] - 0.5,
                  z + corner[2] - 0.5,
                );
                normals.push(...face.dir);
                uvs.push(...face.uvs[i]);
              }

              // インデックスの追加 (2ポリゴン = 6頂点)
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

              groups[matIndex].push({ start: startIndex, count: 6 });

              // Raycastメタデータ (2ポリゴン分 = faceIndex 2つ進む)
              faceMetadata.push({ x, y, z, type, normal: face.dir });
              faceMetadata.push({ x, y, z, type, normal: face.dir });
            }
          }
        }
      }
    }

    // Geometryに属性をセット
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // グループ（マテリアルごと）をGeometryに適用
    // 注意: BufferGeometry.groups は連続したインデックスである必要があるためソートしてまとめる
    let currentStartIndex = 0;
    const sortedIndices = [];
    const flatGroups = [];

    // ※現時点の実装では groups をマテリアルごとに独立したインデックスブロックとして再構築するか、
    // 追加順序に頼る必要がある。ここでは単純化のため、全ポリゴンを一度のマテリアル描画呼出にするのではなく
    // 追加された順に細片化されたグループを登録する (Three.jsのデフォルト挙動に合わせる)。
    // 最適化: 同じマテリアルの面を連続させるようインデックスバッファを構築する。

    // より最適化されたインデックスバッファ構築
    const optimizedIndices = [];
    let optOffset = 0;
    for (let m = 0; m < materials.length; m++) {
      const matFaces = groups[m];
      if (!matFaces || matFaces.length === 0) continue;

      const groupStart = optimizedIndices.length;
      let groupCount = 0;

      for (const face of matFaces) {
        for (let i = 0; i < face.count; i++) {
          optimizedIndices.push(indices[face.start + i]);
        }
        groupCount += face.count;
      }
      geometry.addGroup(groupStart, groupCount, m);
    }
    geometry.setIndex(optimizedIndices);

    // Metadataの順番もoptimizedIndicesに合わせる必要があるが、
    // ここではRaycasterで使うための情報として「faceIndex(三角形インデックス) -> voxelData」のマッピングを作る。
    const metaMap = new Map();
    let triIndex = 0;
    for (let m = 0; m < materials.length; m++) {
      const matFaces = groups[m];
      if (!matFaces) continue;
      for (const face of matFaces) {
        // face.start は元のindices配列のインデックス。
        // 元の配列で 6 インデックス (= 2ポリゴン) に対応していた
        const originalFaceIndex = face.start / 3;
        metaMap.set(triIndex++, faceMetadata[originalFaceIndex]);
        metaMap.set(triIndex++, faceMetadata[originalFaceIndex + 1]);
      }
    }

    return { geometry, materials, metaMap };
  }
}
