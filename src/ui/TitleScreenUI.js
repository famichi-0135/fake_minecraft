/**
 * タイトル画面（ワールド選択・作成）のUI制御
 */
export class TitleScreenUI {
  /**
   * @param {import('../storage/SaveManager.js').SaveManager} saveManager
   * @param {function(string): void} onWorldSelected ワールド選択時に呼ばれるコールバック
   */
  constructor(saveManager, onWorldSelected) {
    this.saveManager = saveManager;
    this.onWorldSelected = onWorldSelected;

    this.container = document.getElementById("title-screen");
    this.worldListEl = document.getElementById("world-list");
    this.newWorldInput = document.getElementById("new-world-name");
    this.btnCreateWorld = document.getElementById("btn-create-world");

    // イベントリスナー登録
    this.btnCreateWorld.addEventListener("click", () =>
      this._handleCreateWorld(),
    );
    // Enter キーでも作成可能に
    this.newWorldInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._handleCreateWorld();
    });
  }

  show() {
    this.container.style.display = "flex";
    this._renderWorldList();
  }

  hide() {
    this.container.style.display = "none";
  }

  _renderWorldList() {
    this.worldListEl.innerHTML = "";
    const worlds = this.saveManager.listWorlds();

    if (worlds.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "empty-world-msg";
      emptyLi.innerText = "No worlds found. Create a new one!";
      this.worldListEl.appendChild(emptyLi);
      return;
    }

    worlds.forEach((worldName) => {
      const li = document.createElement("li");
      li.className = "world-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "world-name";
      nameSpan.innerText = worldName;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "world-actions";

      // プレイボタン
      const btnPlay = document.createElement("button");
      btnPlay.className = "btn-primary";
      btnPlay.innerText = "▶ Play";
      btnPlay.addEventListener("click", () => {
        this.saveManager.setCurrentWorld(worldName);
        this.onWorldSelected(worldName);
      });

      // 削除ボタン
      const btnDelete = document.createElement("button");
      btnDelete.className = "btn-danger";
      btnDelete.innerText = "🗑 Delete";
      btnDelete.addEventListener("click", () => {
        if (confirm(`ワールド '${worldName}' を本当に削除しますか？`)) {
          this.saveManager.deleteWorld(worldName);
          this._renderWorldList(); // 再描画
        }
      });

      actionsDiv.appendChild(btnPlay);
      actionsDiv.appendChild(btnDelete);

      li.appendChild(nameSpan);
      li.appendChild(actionsDiv);
      this.worldListEl.appendChild(li);
    });
  }

  _handleCreateWorld() {
    const worldName = this.newWorldInput.value.trim();
    if (!worldName) return;

    // 同名ワールドのチェック
    const existingWorlds = this.saveManager.listWorlds();
    if (existingWorlds.includes(worldName)) {
      alert(
        `ワールド '${worldName}' は既に存在します！別の名前を入力してください。`,
      );
      return;
    }

    // 新規ワールド作成フローへ
    this.saveManager.setCurrentWorld(worldName);
    this.onWorldSelected(worldName);
  }
}
