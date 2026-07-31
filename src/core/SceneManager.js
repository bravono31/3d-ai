/**
 * 章シーンの生成と切り替え。
 * シーンは初回表示時に build し、以降は保持する（全9章ぶんでも十分軽く、
 * スクロールを行き来しても同じ絵に戻ることが保証できる）。
 */
export class SceneManager {
  constructor(ctx, factories) {
    this.ctx = ctx;
    this.factories = factories; // [{ id, create }]
    this.instances = new Array(factories.length).fill(null);
    this.activeIndex = -1;
  }

  get active() {
    return this.activeIndex >= 0 ? this.instances[this.activeIndex] : null;
  }

  ensure(index) {
    if (index < 0 || index >= this.factories.length) return null;
    if (!this.instances[index]) {
      const s = this.factories[index].create(this.ctx);
      s.ensureBuilt();
      s.resize(this.ctx.width, this.ctx.height, this.ctx.shift);
      this.instances[index] = s;
    }
    return this.instances[index];
  }

  setActive(index) {
    if (index === this.activeIndex) return false;
    this.ensure(index);
    this.activeIndex = index;
    return true;
  }

  /** 次に来る章を先に用意しておき、切り替え時のカクつきを避ける */
  prefetch(index) {
    if (index >= 0 && index < this.factories.length && !this.instances[index]) {
      this.ensure(index);
    }
  }

  /**
   * 空き時間を使って全章のシーンを先に組み立てる。
   * 初回の build() はジオメトリ生成と文字テクスチャの焼き込みで数十msかかるため、
   * スクロール中に走らせるとそこで1フレーム固まる。
   */
  prebuildAll() {
    const idle =
      window.requestIdleCallback ||
      ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 60));

    let i = 0;
    const step = (deadline) => {
      // 1回のアイドルにつき、残り時間がある間だけ組み立てる
      while (i < this.factories.length && deadline.timeRemaining() > 6) {
        if (!this.instances[i]) this.ensure(i);
        i++;
      }
      if (i < this.factories.length) idle(step);
    };
    idle(step);
  }

  resize(w, h, shift) {
    this.ctx.width = w;
    this.ctx.height = h;
    this.ctx.shift = shift;
    this.instances.forEach((s) => s && s.resize(w, h, shift));
  }

  update(p, beatFloat, dt, time) {
    this.active?.update(p, beatFloat, dt, time);
  }

  render(renderer) {
    const s = this.active;
    if (!s) return;
    renderer.render(s.scene, s.camera);
  }
}
