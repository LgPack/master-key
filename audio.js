// Аудио-генератор и плеер на основе Web Audio API (работает офлайн без внешних тяжелых MP3)
// Также поддерживает воспроизведение локальных аудиофайлов пользователя (MP3/WAV/FLAC)

class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.currentMode = 'alpha'; // 'alpha', 'theta', 'rain', 'silence', 'custom'
    this.isPlaying = false;
    this.volume = 0.7;
    this.customAudioElement = null;
    this.customAudioUrl = null;
    this.hasCustomFile = false;
    
    // Синтезаторы Web Audio API
    this.oscillators = [];
    this.gainNode = null;
    this.noiseNode = null;
  }

  getAudioEl() {
    if (!this.customAudioElement) {
      this.customAudioElement = document.getElementById('userAudioElement') || new Audio();
      this.customAudioElement.loop = true;
      this.customAudioElement.volume = this.volume;
    }
    return this.customAudioElement;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.gainNode.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(val) {
    this.volume = parseFloat(val);
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
    const el = this.getAudioEl();
    if (el) {
      el.volume = this.volume;
    }
  }

  setSoundMode(mode) {
    this.currentMode = mode;
    const el = this.getAudioEl();
    
    // При переключении на стандартный звук останавливаем кастомный трек
    if (mode !== 'custom' && el) {
      el.pause();
    }

    if (this.isPlaying) {
      this.stopSynthesizer();
      this.play();
    }
  }

  loadCustomFile(file) {
    const el = this.getAudioEl();
    if (this.customAudioUrl) {
      URL.revokeObjectURL(this.customAudioUrl);
    }
    this.customAudioUrl = URL.createObjectURL(file);
    el.src = this.customAudioUrl;
    el.loop = true;
    el.volume = this.volume;
    el.load();
    this.hasCustomFile = true;
    this.currentMode = 'custom';
  }

  toggleCustomPlay() {
    this.initContext();
    const el = this.getAudioEl();
    if (!this.hasCustomFile || !el.src) return false;

    // Всегда останавливаем синтезаторы
    this.stopSynthesizer();
    this.currentMode = 'custom';

    if (el.paused) {
      const p = el.play();
      if (p !== undefined) {
        p.catch(e => console.warn('Play error:', e));
      }
      this.isPlaying = true;
      return true;
    } else {
      el.pause();
      this.isPlaying = false;
      return false;
    }
  }

  removeCustomFile() {
    const el = this.getAudioEl();
    if (this.customAudioUrl) {
      URL.revokeObjectURL(this.customAudioUrl);
      this.customAudioUrl = null;
    }
    if (el) {
      el.pause();
      el.src = '';
    }
    this.hasCustomFile = false;
    this.currentMode = 'alpha';
    this.isPlaying = false;
  }

  play() {
    this.initContext();
    this.isPlaying = true;
    const el = this.getAudioEl();

    if (this.currentMode === 'custom' && this.hasCustomFile) {
      this.stopSynthesizer();
      if (el) {
        el.play().catch(e => console.warn('Auto-play blocked:', e));
      }
      return;
    }

    if (this.currentMode === 'silence') {
      return;
    }

    if (this.currentMode === 'alpha') {
      // 432 Гц несущая + 10 Гц бинауральный альфа-ритм
      this.createBinauralBeat(216, 226);
    } else if (this.currentMode === 'theta') {
      // 200 Гц несущая + 6 Гц глубокая медитация тета
      this.createBinauralBeat(197, 203);
    } else if (this.currentMode === 'rain') {
      this.createPinkNoise();
    }
  }

  stop() {
    this.isPlaying = false;
    this.stopSynthesizer();
    if (this.customAudioElement) {
      this.customAudioElement.pause();
    }
  }

  stopSynthesizer() {
    this.oscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch (e) {}
    });
    this.oscillators = [];

    if (this.noiseNode) {
      try { this.noiseNode.disconnect(); } catch (e) {}
      this.noiseNode = null;
    }
  }

  createBinauralBeat(leftFreq, rightFreq) {
    this.stopSynthesizer();
    if (!this.audioCtx) return;

    const merger = this.audioCtx.createChannelMerger(2);

    // Левое ухо
    const oscLeft = this.audioCtx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(leftFreq, this.audioCtx.currentTime);
    oscLeft.connect(merger, 0, 0);

    // Правое ухо
    const oscRight = this.audioCtx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(rightFreq, this.audioCtx.currentTime);
    oscRight.connect(merger, 0, 1);

    // Мягкий фильтр низких частот
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, this.audioCtx.currentTime);

    merger.connect(filter);
    filter.connect(this.gainNode);

    oscLeft.start();
    oscRight.start();
    this.oscillators.push(oscLeft, oscRight);
  }

  createPinkNoise() {
    this.stopSynthesizer();
    if (!this.audioCtx) return;

    const bufferSize = this.audioCtx.sampleRate * 2;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.gainNode);
    whiteNoise.start();

    this.noiseNode = whiteNoise;
  }

  playBell() {
    this.initContext();
    if (!this.audioCtx) return;

    // Гонг / мягкий колокольчик тибетской чаши
    const osc = this.audioCtx.createOscillator();
    const bellGain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, this.audioCtx.currentTime); // Частота трансформации 528 Гц
    osc.frequency.exponentialRampToValueAtTime(264, this.audioCtx.currentTime + 3);

    bellGain.gain.setValueAtTime(0.5 * this.volume, this.audioCtx.currentTime);
    bellGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 3.5);

    osc.connect(bellGain);
    bellGain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 3.6);
  }
}

const audioMgr = new AudioManager();
