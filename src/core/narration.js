/**
 * Web Speech API による日本語ナレーション。
 * ブラウザ内蔵のTTSを使うので、APIコストもトークン消費も発生しない。
 */
export class Narrator {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.enabled = false;
    this.voice = null;
    this.ready = false;
    this.onReady = null;
    this._timer = null;
    this._last = null;
    this._keepAlive = null;

    if (this.supported) this._initVoices();
  }

  _initVoices() {
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return false;
      // 日本語音声を優先度つきで探す（macOS: Kyoko / Windows: Nanami / Chrome: Google 日本語）
      const ja = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ja'));
      this.voice =
        ja.find((v) => /kyoko|o-ren|google/i.test(v.name)) || ja[0] || null;
      this.ready = true;
      this.onReady?.(this.voice);
      return true;
    };

    if (!pick()) {
      speechSynthesis.addEventListener('voiceschanged', pick, { once: false });
      // voiceschanged が飛ばない環境向けのフォールバック
      setTimeout(pick, 400);
      setTimeout(pick, 1200);
    }
  }

  get available() {
    return this.supported && !!this.voice;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) {
      this.stop();
    } else {
      // Chrome は長い発話を止めてしまうことがあるので保険をかける
      clearInterval(this._keepAlive);
      this._keepAlive = setInterval(() => {
        if (this.enabled && speechSynthesis.speaking && !speechSynthesis.paused) {
          speechSynthesis.pause();
          speechSynthesis.resume();
        }
      }, 8000);
    }
  }

  /** ビートが変わったら呼ぶ。速いスクロールで発話が詰まらないようデバウンスする。 */
  speak(text) {
    if (!this.supported || !text) return;
    if (text === this._last && speechSynthesis.speaking) return;
    this._last = text;
    clearTimeout(this._timer);
    if (!this.enabled) return;

    this._timer = setTimeout(() => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = 'ja-JP';
      u.rate = 1.05;
      u.pitch = 1.0;
      u.volume = 1.0;
      // cancel 直後の speak が無視される環境があるため一拍おく
      setTimeout(() => speechSynthesis.speak(u), 30);
    }, 260);
  }

  stop() {
    clearTimeout(this._timer);
    clearInterval(this._keepAlive);
    if (this.supported) speechSynthesis.cancel();
  }
}
