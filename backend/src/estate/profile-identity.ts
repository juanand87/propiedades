import { BadRequestException } from '@nestjs/common';
export type ProfileKind = 'person' | 'company';
export function profileIdentity(body: {
  profile_kind?: unknown;
  username?: unknown;
  display_name?: unknown;
}) {
  if (body.profile_kind !== 'person' && body.profile_kind !== 'company')
    throw new BadRequestException('Elige Persona o Empresa.');
  const username =
    typeof body.username === 'string'
      ? body.username.trim().replace(/^@/, '').toLowerCase()
      : '';
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(username))
    throw new BadRequestException(
      'El @usuario debe tener entre 3 y 30 letras sin tildes, números, puntos o guiones bajos.',
    );
  const display_name =
    typeof body.display_name === 'string' ? body.display_name.trim() : '';
  if (display_name.length < 2 || display_name.length > 100)
    throw new BadRequestException(
      body.profile_kind === 'company'
        ? 'Escribe el nombre de la empresa (2 a 100 caracteres).'
        : 'Escribe tu nombre visible (2 a 100 caracteres).',
    );
  return {
    profile_kind: body.profile_kind as ProfileKind,
    username,
    display_name,
  };
}
