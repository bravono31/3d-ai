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
