/**
 * Haunted Web Audio Engine
 * Procedurally generates eerie spooky atmospheric music, haunted drone,
 * theremin wails, and ghostly presence effects without requiring external audio files.
 */
class SpookyAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isPlaying = false;
    this.masterGain = null;
    
    // Nodes for ambient drone
    this.droneGain = null;
    this.droneOscs = [];
    this.droneFilter = null;
    this.lfo = null;

    // Nodes for Ghostly Wail (Theremin)
    this.ghostWailGain = null;
    this.wailOsc = null;
    this.wailVibrato = null;
    this.wailFilter = null;

    // Nodes for wind / spectral whisper
    this.windGain = null;
    this.noiseNode = null;
    this.windFilter = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API not supported on this browser.");
      return;
    }

    this.ctx = new AudioContextClass();
    
    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.setupDrone();
    this.setupGhostWail();
    this.setupSpectralWind();
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Creepy ambient dark drone (low dissonant minor second / tritone drone)
   */
  setupDrone() {
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    this.droneFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    // LFO to slowly sweep filter
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(100, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(this.droneFilter.frequency);
    lfo.start();

    // Dissonant frequencies: D2 (73.42Hz), Eb2 (77.78Hz), Ab2 (103.83Hz - tritone), D3 (146.83Hz)
    const freqs = [73.42, 77.78, 103.83, 146.83];
    this.droneOscs = freqs.map((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      // Small detune
      osc.detune.setValueAtTime((idx - 1.5) * 6, this.ctx.currentTime);
      osc.connect(this.droneFilter);
      osc.start();
      return osc;
    });

    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
  }

  /**
   * Eerie Ghostly Theremin / spectral singing voice
   */
  setupGhostWail() {
    this.ghostWailGain = this.ctx.createGain();
    this.ghostWailGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.wailFilter = this.ctx.createBiquadFilter();
    this.wailFilter.type = 'bandpass';
    this.wailFilter.frequency.setValueAtTime(440, this.ctx.currentTime);
    this.wailFilter.Q.setValueAtTime(6.0, this.ctx.currentTime);

    this.wailOsc = this.ctx.createOscillator();
    this.wailOsc.type = 'sine';
    this.wailOsc.frequency.setValueAtTime(330, this.ctx.currentTime); // E4

    // Vibrato
    this.wailVibrato = this.ctx.createOscillator();
    this.wailVibrato.frequency.setValueAtTime(5.5, this.ctx.currentTime); // 5.5 Hz vibrato
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(14, this.ctx.currentTime);
    this.wailVibrato.connect(vibGain);
    vibGain.connect(this.wailOsc.frequency);
    this.wailVibrato.start();

    this.wailOsc.connect(this.wailFilter);
    this.wailFilter.connect(this.ghostWailGain);
    this.ghostWailGain.connect(this.masterGain);
    this.wailOsc.start();

    // Subtle pitch drifting for spookiness
    this.startGhostWailDrift();
  }

  startGhostWailDrift() {
    const notes = [293.66, 311.13, 329.63, 349.23, 392.00, 440.00, 466.16, 523.25]; // D minor / eerie scale
    setInterval(() => {
      if (this.isPlaying && this.ctx && this.wailOsc) {
        const targetFreq = notes[Math.floor(Math.random() * notes.length)];
        const glideTime = 1.2 + Math.random() * 1.5;
        this.wailOsc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + glideTime);
        if (this.wailFilter) {
          this.wailFilter.frequency.exponentialRampToValueAtTime(targetFreq * 1.2, this.ctx.currentTime + glideTime);
        }
      }
    }, 2400);
  }

  /**
   * Spectral Wind / Ghostly Howl using filtered noise buffer
   */
  setupSpectralWind() {
    // Generate 4 seconds of white noise
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(7.0, this.ctx.currentTime);

    // Wind modulation
    const windLfo = this.ctx.createOscillator();
    windLfo.frequency.setValueAtTime(0.2, this.ctx.currentTime);
    const windLfoGain = this.ctx.createGain();
    windLfoGain.gain.setValueAtTime(180, this.ctx.currentTime);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(this.windFilter.frequency);
    windLfo.start();

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    whiteNoise.start();
  }

  /**
   * Sudden ghostly appearance sting (e.g. screech / bell chime)
   */
  playSummonSting() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(220, now + 1.2); // plunge downward

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.3);
    } catch (e) {
      console.warn("Could not play summon sting:", e);
    }
  }

  /**
   * Start Spooky Music (Called when Ghost Appears / Palm Closed)
   */
  startSpookyMusic() {
    this.ensureContext();
    if (!this.ctx || this.isPlaying) return;

    this.isPlaying = true;
    const now = this.ctx.currentTime;

    // Fade in spooky drone
    if (this.droneGain) {
      this.droneGain.gain.cancelScheduledValues(now);
      this.droneGain.gain.setValueAtTime(Math.max(this.droneGain.gain.value, 0.0001), now);
      this.droneGain.gain.linearRampToValueAtTime(0.4, now + 0.8);
    }

    // Fade in ghostly theremin wail
    if (this.ghostWailGain) {
      this.ghostWailGain.gain.cancelScheduledValues(now);
      this.ghostWailGain.gain.setValueAtTime(Math.max(this.ghostWailGain.gain.value, 0.0001), now);
      this.ghostWailGain.gain.linearRampToValueAtTime(0.28, now + 0.6);
    }

    // Fade in howling wind
    if (this.windGain) {
      this.windGain.gain.cancelScheduledValues(now);
      this.windGain.gain.setValueAtTime(Math.max(this.windGain.gain.value, 0.0001), now);
      this.windGain.gain.linearRampToValueAtTime(0.25, now + 1.0);
    }

    this.playSummonSting();
  }

  /**
   * Stop Spooky Music (Called when Ghost Disappears / Palm Open)
   */
  stopSpookyMusic() {
    if (!this.ctx || !this.isPlaying) return;

    this.isPlaying = false;
    const now = this.ctx.currentTime;
    const fadeOutDuration = 0.7;

    if (this.droneGain) {
      this.droneGain.gain.cancelScheduledValues(now);
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
      this.droneGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);
    }

    if (this.ghostWailGain) {
      this.ghostWailGain.gain.cancelScheduledValues(now);
      this.ghostWailGain.gain.setValueAtTime(this.ghostWailGain.gain.value, now);
      this.ghostWailGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);
    }

    if (this.windGain) {
      this.windGain.gain.cancelScheduledValues(now);
      this.windGain.gain.setValueAtTime(this.windGain.gain.value, now);
      this.windGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);
    }
  }

  toggleMute() {
    this.ensureContext();
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

// Global audio singleton
window.spookyAudio = new SpookyAudioEngine();

