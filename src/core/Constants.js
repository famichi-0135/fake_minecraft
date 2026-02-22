// ワールド生成定数
export const CHUNK_SIZE = 16;
export const RENDER_DISTANCE = 24;
export const WATER_LEVEL = 0;
export const BOTTOM_Y = -50;

// プレイヤー物理定数
export const WALK_SPEED = 40.0;
export const RUN_SPEED = 70.0;
export const JUMP_VELOCITY = 10;
export const GRAVITY = 9.8 * 3.0;
export const FRICTION = 10.0;
export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HEIGHT = 1.5;
export const PLAYER_HEAD_MARGIN = 0.3;

// レンダリング定数
export const SKY_COLOR = 0x87ceeb;

// インタラクション定数
export const REACH_DISTANCE = 6;
export const PICKUP_RADIUS = 3.5;
export const ABSORB_RADIUS = 1.0;
export const ABSORB_SPEED = 12;
export const MAX_DROP_ITEMS = 60;

// ドロップアイテム変換テーブル (破壊時に別アイテムをドロップ)
export const DROP_CONVERSION = {
  stone: "cobblestone",
};

// セーブデータと設定のキー
export const WORLDS_LIST_KEY = "voxelWorldsList"; // ワールド名の配列を保存するキー
export const SETTINGS_KEY = "voxelSettings"; // ゲーム設定を保存するキー

// デフォルトゲーム設定
export const DEFAULT_SETTINGS = {
  mouseSensitivity: 0.002,
  renderDistance: RENDER_DISTANCE, // TODO: 現状は定数に依存している部分が多いため、適用時に再読み込みが必要になる可能性あり
  fov: 75,
  masterVolume: 0.3,
};

// ホットバー初期構成
export const DEFAULT_HOTBAR = [
  "grass",
  "dirt",
  "wood",
  "stone",
  "cobblestone",
  "sand",
  "planks",
  "glass",
  "brick",
  "coal_ore",
];
