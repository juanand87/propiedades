type Load = { start: number; ready?: number };
export type PlaybackSample = {
  event: "source_ready" | "visible_frame";
  milliseconds: number;
  prepared?: boolean;
  predecoded?: boolean;
};
const loads = new WeakMap<object, Load>();
const samples: PlaybackSample[] = [];
function record(sample: PlaybackSample) {
  samples.push(sample);
  if (samples.length > 200) samples.shift();
  console.info("[ProppixPlayback]", JSON.stringify(sample));
}
export function beginVideoLoad(player: object) {
  loads.set(player, { start: performance.now() });
}
export function videoSourceReady(player: object) {
  const load = loads.get(player);
  if (load && load.ready === undefined) {
    load.ready = performance.now();
    record({
      event: "source_ready",
      milliseconds: Math.round(load.ready - load.start),
    });
  }
}
export function beginVideoDisplay(player: object, ready = false) {
  return {
    start: performance.now(),
    prepared: ready || loads.get(player)?.ready !== undefined,
    finished: false,
  };
}
export function videoFrameVisible(
  display: ReturnType<typeof beginVideoDisplay>,
  predecoded = false,
) {
  if (display.finished) return;
  display.finished = true;
  record({
    event: "visible_frame",
    milliseconds: Math.round(performance.now() - display.start),
    prepared: display.prepared,
    predecoded,
  });
}
export function playbackMeasurements() {
  return samples.map((sample) => ({ ...sample }));
}

export function playbackSummary() {
  const stats = (rows: PlaybackSample[]) => {
    const sorted = rows.map((r) => r.milliseconds).sort((a, b) => a - b);
    return sorted.length
      ? `${sorted[Math.floor(sorted.length / 2)]} ms (${sorted.length} muestras)`
      : "sin muestras todavía";
  };
  return [
    "Primer fotograma desde la activación: " +
      stats(samples.filter((s) => s.event === "visible_frame")),
    "Con precarga: " +
      stats(samples.filter((s) => s.event === "visible_frame" && s.prepared)),
    "Sin precarga: " +
      stats(samples.filter((s) => s.event === "visible_frame" && !s.prepared)),
    "Preparación del reproductor: " +
      stats(samples.filter((s) => s.event === "source_ready")),
    "Son medianas locales de este dispositivo. Un fotograma ya preparado puede registrar 0 ms; no es una medición de toda la red.",
  ].join("\n\n");
}
