import type { ValueTransformer } from 'typeorm';

export const clpTransformer: ValueTransformer = {
  to(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount) : null;
  },
  from(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount) : null;
  },
};
