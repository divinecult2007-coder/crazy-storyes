// Premium 3D Click Sound & Subtle Haptic Feedback Utility

let audioCtx: AudioContext | null = null;

export interface FeedbackSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  soundVolume: number; // 0.0 to 1.0 (default 0.15 - very low)
}

export function getFeedbackSettings(): FeedbackSettings {
  const soundEnabled = localStorage.getItem('cs_sound_enabled') !== 'false';
  const hapticEnabled = localStorage.getItem('cs_haptic_enabled') !== 'false';
  const savedVol = localStorage.getItem('cs_sound_volume');
  const soundVolume = savedVol !== null ? Math.min(1, Math.max(0, Number(savedVol))) : 0.15;
  return { soundEnabled, hapticEnabled, soundVolume };
}

export function saveFeedbackSettings(settings: Partial<FeedbackSettings>) {
  if (settings.soundEnabled !== undefined) {
    localStorage.setItem('cs_sound_enabled', String(settings.soundEnabled));
  }
  if (settings.hapticEnabled !== undefined) {
    localStorage.setItem('cs_haptic_enabled', String(settings.hapticEnabled));
  }
  if (settings.soundVolume !== undefined) {
    localStorage.setItem('cs_sound_volume', String(settings.soundVolume));
  }
}

export function trigger3DClickFeedback() {
  // Respect reduced motion preference
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const { soundEnabled, hapticEnabled, soundVolume } = getFeedbackSettings();

  // Subtle haptic feedback on supported mobile devices
  if (hapticEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      // Ignore if unsupported
    }
  }

  // Soft, deep, smooth mechanical 3D button click sound
  if (soundEnabled && soundVolume > 0 && typeof window !== 'undefined') {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.045);

      gain.gain.setValueAtTime(soundVolume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore audio policy errors
    }
  }
}
