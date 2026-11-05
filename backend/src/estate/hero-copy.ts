import { BadRequestException } from '@nestjs/common';
export type HeroCopy = { title: string; subtitle: string };
export function validateHeroCopy(value: unknown): HeroCopy | null {
  if (value == null) return null;
  const v = value as HeroCopy;
  if (
    typeof v !== 'object' ||
    Array.isArray(v) ||
    typeof v.title !== 'string' ||
    !v.title.trim() ||
    v.title.trim().length > 180 ||
    typeof v.subtitle !== 'string' ||
    v.subtitle.trim().length > 400
  )
    throw new BadRequestException(
      'Revisa los textos de portada: título obligatorio de hasta 180 caracteres y descripción de hasta 400.',
    );
  return { title: v.title.trim(), subtitle: v.subtitle.trim() };
}
