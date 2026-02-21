import { TerrainGenerator } from "./TerrainGenerator.js";
import { BlockRegistry } from "./BlockRegistry.js";
import { CHUNK_SIZE, BOTTOM_Y } from "../core/Constants.js";
import blocksData from "../data/blocks.json"; // Worker内での直接ロード

// Workerスレッド内での初期化
const blockRegistry = new BlockRegistry();
// Worker内では MaterialFactory は使えない(THREE.js依存のため)、かわりに blocks.json の情報からマテリアルIDやUVの判断を行うことは可能。
// しかし、Phase1の実装では Material の UUID ベースでグループ分けしていました。
// Workerでは、マテリアルのUUIDはわからないため、代わりにブロックID（textureKey）ベースで面をグループ化します。

const terrainGenerator = new TerrainGenerator();

// 面の方向定義
const FACES = [
  {
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
  }, // Right
  {
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
  }, // Left
  {
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
  }, // Top
  {
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
  }, // Bottom
  {
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
  }, // Front
  {
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
  }, // Back
];

let uvMap = null;

self.onmessage = function (e) {
  if (e.data.type === "init") {
    uvMap = e.data.uvMap;
    return;
  }

  if (!uvMap) {
    console.error("[ChunkWorker] uvMap is not initialized!");
    return;
  }

  const { cx, cz, lod, modifiedBlocksBase } = e.data;
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;

  // ブロックデータの構築: Map をやめて 16x256x16 の Uint8Array を使用 (64KB)
  // BOTTOM_Y(-50) を 0 とし、高さ 256 までをサポート
  const blockDataArray = new Uint8Array(256 * CHUNK_SIZE * CHUNK_SIZE);
  let maxY = -Infinity;

  // ローカル座標からインデックスを計算するヘルパー
  const getIndex = (lx, ly, lz) =>
    ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;

  // TerrainGenerator による生成
  terrainGenerator.generateTerrain(
    startX,
    startZ,
    CHUNK_SIZE,
    (bx, by, bz, type) => {
      const key = `${bx},${by},${bz}`;
      // 上書き確認
      if (modifiedBlocksBase[key] !== undefined) {
        type = modifiedBlocksBase[key];
      }
      if (type !== "air") {
        const lx = bx - startX;
        const lz = bz - startZ;
        const ly = by - BOTTOM_Y;
        if (
          ly >= 0 &&
          ly < 256 &&
          lx >= 0 &&
          lx < CHUNK_SIZE &&
          lz >= 0 &&
          lz < CHUNK_SIZE
        ) {
          blockDataArray[getIndex(lx, ly, lz)] =
            blockRegistry.getBlockIntId(type);
        }
        if (by > maxY) maxY = by;
      }
    },
  );

  // 完全な外部チャンク境界の上書き適用 (隣接チャンクからの浸食など)
  for (const key in modifiedBlocksBase) {
    const [bx, by, bz] = key.split(",").map(Number);
    if (
      bx >= startX &&
      bx < startX + CHUNK_SIZE &&
      bz >= startZ &&
      bz < startZ + CHUNK_SIZE
    ) {
      const type = modifiedBlocksBase[key];
      if (type !== "air") {
        const lx = bx - startX;
        const lz = bz - startZ;
        const ly = by - BOTTOM_Y;
        if (
          ly >= 0 &&
          ly < 256 &&
          lx >= 0 &&
          lx < CHUNK_SIZE &&
          lz >= 0 &&
          lz < CHUNK_SIZE
        ) {
          blockDataArray[getIndex(lx, ly, lz)] =
            blockRegistry.getBlockIntId(type);
        }
        if (by > maxY) maxY = by;
      } else {
        const lx = bx - startX;
        const lz = bz - startZ;
        const ly = by - BOTTOM_Y;
        if (
          ly >= 0 &&
          ly < 256 &&
          lx >= 0 &&
          lx < CHUNK_SIZE &&
          lz >= 0 &&
          lz < CHUNK_SIZE
        ) {
          // 空気化
          blockDataArray[getIndex(lx, ly, lz)] = 0;
        }
      }
    }
  }

  // --- メッシュビルダー (ChunkMeshBuilder の Worker 版) ---
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let indexOffset = 0;

  // アトラス化によりマテリアルは opaque(0) と transparent(1) の2つのみになる
  const groups = {
    0: [], // opaque
    1: [], // transparent
  };

  // LOD(0:1, 1:2, 2:4) に応じて頂点を作成する間隔(ブロック単位)を変える
  const step = lod === 0 ? 1 : lod === 1 ? 2 : 4;

  for (let x = startX; x < startX + CHUNK_SIZE; x += step) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z += step) {
      for (let y = BOTTOM_Y; y <= maxY; y += step) {
        const lx = x - startX;
        const lz = z - startZ;
        const ly = y - BOTTOM_Y;

        let intType = 0;
        if (ly >= 0 && ly < 256) {
          intType = blockDataArray[getIndex(lx, ly, lz)];
        }

        if (intType === 0) continue; // 0 is air
        const type = blockRegistry.getBlockName(intType);

        const isTransparent = blockRegistry.isTransparent(type);
        const blockDef = blockRegistry.get(type);
        if (!blockDef) continue;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];

          // 隣接ブロックの確認先も step 分だけ離した座標
          const nx = x + face.dir[0] * step;
          const ny = y + face.dir[1] * step;
          const nz = z + face.dir[2] * step;

          const nlx = nx - startX;
          const nlz = nz - startZ;
          const nly = ny - BOTTOM_Y;

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
            neighborIntType = blockDataArray[getIndex(nlx, nly, nlz)];
          } else {
            // チャンク外の場合は modifiedBlocksBase を見る（近景生成時など）か、仮に空気とする
            // チャンク描画の性質上、隣のチャンクデータを持っていない場合は空気として描画する
            const nKey = `${nx},${ny},${nz}`;
            if (modifiedBlocksBase[nKey] !== undefined) {
              neighborIntType = blockRegistry.getBlockIntId(
                modifiedBlocksBase[nKey],
              );
            } else {
              isNeighborOut = true;
            }
          }

          let neighborType = "air";
          if (!isNeighborOut) {
            neighborType = blockRegistry.getBlockName(neighborIntType);
          }

          let isVisible = false;

          if (!neighborType || neighborType === "air") {
            isVisible = true;
          } else if (blockRegistry.isTransparent(neighborType)) {
            if (isTransparent && type === neighborType) {
              isVisible = false;
            } else {
              isVisible = true;
            }
          }

          if (isVisible) {
            // テクスチャ(ブロック種ごとの面)の特定
            let texKey = blockDef.iconTex;
            if (blockDef.faces) {
              if (f === 2) texKey = blockDef.faces.top;
              else if (f === 3) texKey = blockDef.faces.bottom;
              else texKey = blockDef.faces.sides;
            }

            const groupIndex = isTransparent ? 1 : 0;
            const uvData = uvMap[texKey] || { u: 0, v: 0, size: 1 }; // 未知の場合はフォールバック

            for (let i = 0; i < 4; i++) {
              const corner = face.corners[i];
              positions.push(
                x + corner[0] * step - 0.5,
                y + corner[1] * step - 0.5,
                z + corner[2] * step - 0.5,
              );
              normals.push(...face.dir);

              const baseU = face.uvs[i][0];
              const baseV = face.uvs[i][1];
              // step(LOD)に依存せず、常に1枚のテクスチャをアトラスから参照する
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
          }
        }
      }
    }
  }

  // --- グループのソートとバッファ構築 ---
  const optimizedIndices = [];
  const finalGroups = [];

  for (const m in groups) {
    if (groups[m].length === 0) continue;
    const groupStart = optimizedIndices.length;
    let groupCount = 0;

    for (let i = 0; i < groups[m].length; i++) {
      const g = groups[m][i];
      for (let j = 0; j < g.count; j++) {
        optimizedIndices.push(indices[g.start + j]);
      }
      groupCount += g.count;
    }
    finalGroups.push({
      start: groupStart,
      count: groupCount,
      materialIndex: parseInt(m), // m is string key from `for...in`
    });
  }

  // TypedArrayへの変換
  const positionsArray = new Float32Array(positions);
  const normalsArray = new Float32Array(normals);
  const uvsArray = new Float32Array(uvs);
  const indicesArray = new Uint32Array(optimizedIndices);

  // Bounding Sphereの計算 (Frustum Culling用)
  const actualMaxY = maxY > BOTTOM_Y ? maxY : BOTTOM_Y + 1;
  const centerX = startX + CHUNK_SIZE / 2;
  const centerZ = startZ + CHUNK_SIZE / 2;
  const centerY = BOTTOM_Y + (actualMaxY - BOTTOM_Y) / 2;
  const radius = Math.sqrt(
    Math.pow(CHUNK_SIZE / 2, 2) * 2 + Math.pow((actualMaxY - BOTTOM_Y) / 2, 2),
  );

  self.postMessage(
    {
      cx,
      cz,
      positions: positionsArray,
      normals: normalsArray,
      uvs: uvsArray,
      indices: indicesArray,
      groups: finalGroups,
      blockDataArray: blockDataArray, // Transfer!!
      maxY,
      boundingSphere: {
        center: [centerX, centerY, centerZ],
        radius: radius,
      },
    },
    [
      positionsArray.buffer,
      normalsArray.buffer,
      uvsArray.buffer,
      indicesArray.buffer,
      blockDataArray.buffer, // Transferable
    ],
  );
};
