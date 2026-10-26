// Rest-finished alert: vibration (Android/Chrome; no-op on iOS Safari) + short Web Audio beep.
let ctx: AudioContext | undefined;

/** Call from a user gesture (e.g. checking a set) so iOS allows audio later. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* audio unavailable */ }
}

export function beep() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1320 : 880;
    const t = t0 + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

export function restDoneAlert() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* unsupported */ }
  beep();
}
