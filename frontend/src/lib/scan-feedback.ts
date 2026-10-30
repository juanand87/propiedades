let context: AudioContext | null = null;

export function prepareScanSound(): void {
  try {
    const Audio = window.AudioContext || (window as any).webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === "closed") context = new Audio();
    if (context?.state === "suspended") void context.resume().catch(() => {});
  } catch {
    /* Sound must never prevent barcode scanning. */
  }
}

export function playScanBeep(): void {
  try {
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1200, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + 0.13);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  } catch {
    /* Silent devices and unavailable audio do not affect the count. */
  }
}
