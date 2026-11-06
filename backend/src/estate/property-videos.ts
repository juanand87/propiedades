import { BadRequestException, NotFoundException } from '@nestjs/common';

// This prototype deliberately cannot run against a hosted database or production.
export function assertLocalVideos(env: Record<string, any>) {
  if (
    env.PROPERTY_VIDEOS_ENABLED !== 'true' ||
    !['test', 'development'].includes(env.NODE_ENV) ||
    env.PROJECT_ID !== 'propiedades' ||
    env.DB_DATABASE !== 'propiedades' ||
    !['127.0.0.1', 'localhost', '::1'].includes(env.DB_HOST) ||
    !['3317', '3327'].includes(String(env.DB_PORT))
  )
    throw new NotFoundException('Videos de pruebas no disponibles.');
}

export function assertPropertyVideos(
  env: Record<string, any>,
  spacesEnabled: boolean,
) {
  if (env.NODE_ENV === 'production') {
    if (
      env.PROPERTY_VIDEOS_ENABLED !== 'true' ||
      env.PROJECT_ID !== 'propiedades' ||
      env.DB_DATABASE !== 'propiedades' ||
      !spacesEnabled
    )
      throw new NotFoundException('Videos no disponibles.');
    return;
  }
  assertLocalVideos(env);
}

export function videoTitle(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160)
    throw new BadRequestException('Escribe un título de hasta 160 caracteres.');
  return value.trim();
}

export function recordingLimit(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!['15', '30', '45'].includes(String(value)))
    throw new BadRequestException('Selecciona 15, 30 o 45 segundos.');
  return Number(value);
}

export function validateVideoProbe(probe: any, limit: number | null) {
  const videos = Array.isArray(probe?.streams)
    ? probe.streams.filter((s: any) => s.codec_type === 'video')
    : [];
  const video = videos[0];
  const duration = Math.max(
    Number(probe?.format?.duration) || 0,
    Number(video?.duration) || 0,
  );
  if (
    videos.length !== 1 ||
    video.codec_name !== 'h264' ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > (limit ?? 45) + 0.75 ||
    !(video.width > 0 && video.height > 0) ||
    video.width * video.height > 3840 * 2160
  )
    throw new BadRequestException(
      `Utiliza un MP4/H.264 válido de 1 a ${limit ?? 45} segundos.`,
    );
  return Math.round(duration * 1000);
}

export function validateMp4(file: any) {
  const b = file?.buffer;
  if (
    !Buffer.isBuffer(b) ||
    b.length < 32 ||
    b.length > 50 * 1024 * 1024 ||
    file.mimetype !== 'video/mp4' ||
    b.toString('ascii', 4, 8) !== 'ftyp' ||
    !['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(
      b.toString('ascii', 8, 12),
    )
  )
    throw new BadRequestException(
      'Selecciona un video MP4 compatible de hasta 50 MB.',
    );
}

export function videoRange(header: string | undefined, size: number) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) return false;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1]
    ? m[2]
      ? Math.min(Number(m[2]), size - 1)
      : size - 1
    : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= size
  )
    return false;
  return { start, end };
}
