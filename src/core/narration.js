/**
 * Web Speech API による日本語ナレーション。
 * ブラウザ内蔵のTTSを使うので、APIコストもトークン消費も発生しない。
 * 声・速さ・高さは利用者が選べるようにし、選択は localStorage に残す。
 */

const KEY_VOICE = '3dai.voice';
const KEY_RATE = '3dai.rate';
const KEY_PITCH = '3dai.pitch';

/** 落ち着いた読み上げになりやすい声を優先する（環境によって入っている声が違う） */
const CALM_FIRST = [/\breed\b/i, /otoya/i, /hattori/i, /o-?ren/i, /nanami/i, /keita/i];

const load = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* 保存できなくても読み上げは動く */
  }
};

export class Narrator {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.enabled = false;
    this.voices = [];
    this.voice = null;
    this.ready = false;
    /** 既定はやや遅め・やや低めの、落ち着いた読み上げ */
    this.rate = Number(load(KEY_RATE, 0.94)) || 0.94;
    this.pitch = Number(load(KEY_PITCH, 0.92)) || 0.92;
    this.onReady = null;

    this._timer = null;
    this._last = null;
    this._keepAlive = null;

    if (this.supported) this._initVoices();
  }

  _initVoices() {
    const pick = () => {
      const all = speechSynthesis.getVoices();
      if (!all.length) return false;

      this.voices = all.filter((v) => (v.lang || '').toLowerCase().startsWith('ja'));
      if (!this.voices.length) return false;

      const saved = load(KEY_VOICE, null);
      this.voice =
        (saved && this.voices.find((v) => v.name === saved)) ||
        CALM_FIRST.map((re) => this.voices.find((v) => re.test(v.name))).find(Boolean) ||
        this.voices.find((v) => v.default) ||
        this.voices[0];

      this.ready = true;
      this.onReady?.(this.voices, this.voice);
      return true;
    };

    if (!pick()) {
      speechSynthesis.addEventListener('voiceschanged', pick);
      // voiceschanged が飛ばない環境向けのフォールバック
      setTimeout(pick, 400);
      setTimeout(pick, 1200);
    }
  }

  get available() {
    return this.supported && !!this.voice;
  }

  setVoice(name) {
    const v = this.voices.find((x) => x.name === name);
    if (!v) return;
    this.voice = v;
    save(KEY_VOICE, name);
  }

  setRate(r) {
    this.rate = Math.min(1.4, Math.max(0.6, Number(r) || 1));
    save(KEY_RATE, this.rate);
  }

  setPitch(p) {
    this.pitch = Math.min(1.4, Math.max(0.6, Number(p) || 1));
    save(KEY_PITCH, this.pitch);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) {
      this.stop();
      return;
    }
    // Chrome は長い発話を途中で止めてしまうことがあるので保険をかける
    clearInterval(this._keepAlive);
    this._keepAlive = setInterval(() => {
      if (this.enabled && speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 8000);
  }

  _utter(text) {
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang || 'ja-JP';
    u.rate = this.rate;
    u.pitch = this.pitch;
    u.volume = 1.0;
    return u;
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
      const u = this._utter(text);
      // cancel 直後の speak が無視される環境があるため一拍おく
      setTimeout(() => speechSynthesis.speak(u), 30);
    }, 260);
  }

  /** 声を選ぶときの試聴。音声トグルが OFF でも鳴らす。 */
  preview(text = 'これは読み上げの試聴です。落ち着いた速さで再生しています。') {
    if (!this.supported || !this.voice) return;
    clearTimeout(this._timer);
    speechSynthesis.cancel();
    this._last = null;
    setTimeout(() => speechSynthesis.speak(this._utter(text)), 30);
  }

  stop() {
    clearTimeout(this._timer);
    clearInterval(this._keepAlive);
    if (this.supported) speechSynthesis.cancel();
  }
}
