import { useCallback, useRef, useEffect, useState } from 'react';

// Audio context singleton
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

export const useSoundAlerts = () => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('soundAlertsEnabled');
    return stored !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('soundAlertsEnabled', String(soundEnabled));
  }, [soundEnabled]);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
    if (!soundEnabled) return;
    
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [soundEnabled]);

  const playPriceAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    
    // Two-tone alert sound (ascending)
    playTone(880, 0.15, 'sine', 0.4);
    setTimeout(() => playTone(1100, 0.2, 'sine', 0.4), 150);
    setTimeout(() => playTone(1320, 0.25, 'sine', 0.3), 350);
  }, [soundEnabled, playTone]);

  const playMarketMovementSound = useCallback((isPositive: boolean) => {
    if (!soundEnabled) return;
    
    if (isPositive) {
      // Ascending happy tone for positive movement
      playTone(523, 0.1, 'sine', 0.2);
      setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 100);
    } else {
      // Descending tone for negative movement
      playTone(440, 0.1, 'sine', 0.2);
      setTimeout(() => playTone(349, 0.15, 'sine', 0.25), 100);
    }
  }, [soundEnabled, playTone]);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    // Simple ping sound
    playTone(1000, 0.1, 'sine', 0.2);
  }, [soundEnabled, playTone]);

  const playNewsAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    
    // News alert - attention grabbing
    playTone(600, 0.1, 'triangle', 0.3);
    setTimeout(() => playTone(800, 0.1, 'triangle', 0.3), 120);
    setTimeout(() => playTone(600, 0.1, 'triangle', 0.3), 240);
  }, [soundEnabled, playTone]);

  return {
    soundEnabled,
    setSoundEnabled,
    playPriceAlertSound,
    playMarketMovementSound,
    playNotificationSound,
    playNewsAlertSound
  };
};
