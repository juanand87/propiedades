import { BadRequestException } from '@nestjs/common';

export const dictationFields = [
  'title',
  'description',
  'type_id',
  'operation_type',
  'price_amount',
  'price_unit',
  'bedrooms',
  'bathrooms',
  'parking',
  'built_area',
  'land_area',
  'neighborhood',
  'address',
  'summary',
  'latitude',
  'longitude',
  'usable_area',
  'storage_rooms',
  'construction_year',
  'floors',
  'floor_number',
  'condition_type',
  'common_expenses',
  'contributions',
  'expense_unit',
  'contributions_period',
] as const;
export type DictationCatalog = {
  types: { id: string; name: string }[];
  amenities?: { id: string; name: string }[];
  regions: { id: number; name: string }[];
  communes: { id: number; region_id: number; name: string }[];
};
export const nullableString = { type: ['string', 'null'] };
export function dictationSchema(types: string[], amenities: string[] = []) {
  const properties: Record<string, unknown> = Object.fromEntries(
    [...dictationFields, 'region_name', 'commune_name'].map((key) => [
      key,
      nullableString,
    ]),
  );
  properties.type_id = { type: ['string', 'null'], enum: [...types, null] };
  properties.operation_type = {
    type: ['string', 'null'],
    enum: ['sale', 'rent', null],
  };
  properties.price_unit = {
    type: ['string', 'null'],
    enum: ['CLP', 'UF', null],
  };
  properties.condition_type = {
    type: ['string', 'null'],
    enum: ['new', 'used', 'renovated', 'project', 'unknown', null],
  };
  properties.expense_unit = {
    type: ['string', 'null'],
    enum: ['CLP', 'UF', null],
  };
  properties.contributions_period = {
    type: ['string', 'null'],
    enum: ['monthly', 'quarterly', 'yearly', null],
  };
  properties.amenities = {
    type: 'object',
    properties: Object.fromEntries(
      amenities.map((id) => [id, { type: ['boolean', 'null'] }]),
    ),
    required: amenities,
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['fields', 'warnings'],
    additionalProperties: false,
  };
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^region\s+(de\s+|del\s+)?/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export function normalizeDictation(value: unknown, catalog: DictationCatalog) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('fields' in value) ||
    !(value as any).fields ||
    typeof (value as any).fields !== 'object'
  )
    throw new BadRequestException(
      'No se pudo interpretar la propuesta. Intenta con una descripción más clara.',
    );
  const fieldNames: Record<string, string> = {
    bedrooms: 'dormitorios',
    bathrooms: 'baños',
    parking: 'estacionamientos',
    price_amount: 'precio',
    built_area: 'superficie construida',
    land_area: 'superficie de terreno',
    usable_area: 'superficie útil',
    storage_rooms: 'bodegas',
    construction_year: 'año de construcción',
    floors: 'pisos de la propiedad',
    floor_number: 'piso de la unidad',
    latitude: 'latitud',
    longitude: 'longitud',
    common_expenses: 'gastos comunes',
    contributions: 'contribuciones',
  };
  const source = (value as any).fields,
    fields: Record<string, string> = {},
    warnings: string[] = [];
  if (Array.isArray((value as any).warnings))
    warnings.push(
      ...(value as any).warnings
        .filter((v: unknown) => typeof v === 'string')
        .slice(0, 10)
        .map((v: string) => v.slice(0, 240)),
    );
  for (const key of dictationFields) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw !== 'string') {
      warnings.push(`Revisa ${fieldNames[key] || key}: el valor no es válido.`);
      continue;
    }
    const text = raw.trim();
    if (!text) continue;
    if (
      [
        'bedrooms',
        'bathrooms',
        'parking',
        'storage_rooms',
        'floors',
        'construction_year',
      ].includes(key)
    ) {
      if (
        !/^\d{1,4}$/.test(text) ||
        Number(text) >
          (key === 'construction_year'
            ? new Date().getUTCFullYear() + 10
            : 1000)
      ) {
        warnings.push(`Revisa ${fieldNames[key] || key}: cantidad inválida.`);
        continue;
      }
    } else if (key === 'floor_number') {
      if (
        !/^-?\d{1,3}$/.test(text) ||
        Number(text) < -20 ||
        Number(text) > 200
      ) {
        warnings.push(
          'Piso de la unidad fuera de rango. Revísalo manualmente.',
        );
        continue;
      }
    } else if (key === 'latitude' || key === 'longitude') {
      if (
        !/^-?\d{1,3}(\.\d{1,7})?$/.test(text) ||
        Math.abs(Number(text)) > (key === 'latitude' ? 90 : 180)
      ) {
        warnings.push('Coordenadas fuera de rango. Revísalas manualmente.');
        continue;
      }
    } else if (
      [
        'price_amount',
        'built_area',
        'land_area',
        'usable_area',
        'common_expenses',
        'contributions',
      ].includes(key)
    ) {
      if (
        !/^\d{1,14}(\.\d{1,4})?$/.test(text) ||
        (['common_expenses', 'contributions'].includes(key)
          ? Number(text) < 0
          : Number(text) <= 0) ||
        (key === 'price_amount' &&
          source.price_unit === 'CLP' &&
          !Number.isInteger(Number(text))) ||
        (['common_expenses', 'contributions'].includes(key) &&
          source.expense_unit === 'CLP' &&
          !Number.isInteger(Number(text)))
      ) {
        warnings.push(
          `Revisa ${fieldNames[key] || key}: usa un valor numérico sin separador de miles.`,
        );
        continue;
      }
    } else if (key === 'type_id' && !catalog.types.some((t) => t.id === text))
      continue;
    else if (key === 'operation_type' && !['sale', 'rent'].includes(text))
      continue;
    else if (
      ['price_unit', 'expense_unit'].includes(key) &&
      !['CLP', 'UF'].includes(text)
    )
      continue;
    else if (
      key === 'condition_type' &&
      !['new', 'used', 'renovated', 'project', 'unknown'].includes(text)
    )
      continue;
    else if (
      key === 'contributions_period' &&
      !['monthly', 'quarterly', 'yearly'].includes(text)
    )
      continue;
    fields[key] = text.slice(
      0,
      key === 'description'
        ? 30000
        : key === 'summary'
          ? 400
          : key === 'address'
            ? 255
            : key === 'neighborhood'
              ? 120
              : 180,
    );
  }
  if (fields.price_amount && !fields.price_unit) {
    delete fields.price_amount;
    warnings.push(
      'No se identificó la moneda del precio. Completa precio y moneda manualmente.',
    );
  }
  if (!fields.expense_unit) {
    for (const key of ['common_expenses', 'contributions'])
      if (fields[key] && Number(fields[key]) !== 0) {
        delete fields[key];
        warnings.push(
          'No se identificó la moneda de los gastos y contribuciones. Complétala manualmente.',
        );
      }
  }
  if (
    fields.contributions &&
    Number(fields.contributions) !== 0 &&
    !fields.contributions_period
  ) {
    delete fields.contributions;
    warnings.push(
      'No se identificó la periodicidad de las contribuciones. Complétala manualmente.',
    );
  }
  if ((fields.latitude !== undefined) !== (fields.longitude !== undefined)) {
    delete fields.latitude;
    delete fields.longitude;
    warnings.push(
      'Las coordenadas necesitan latitud y longitud juntas. Complétalas manualmente.',
    );
  }
  const flags = source.amenities;
  if (flags && typeof flags === 'object' && !Array.isArray(flags))
    for (const amenity of catalog.amenities || [])
      if (
        Object.prototype.hasOwnProperty.call(flags, amenity.id) &&
        typeof flags[amenity.id] === 'boolean'
      )
        fields['amenity:' + amenity.id] = String(flags[amenity.id]);
  const regionName =
    typeof source.region_name === 'string' ? source.region_name.trim() : '';
  const communeName =
    typeof source.commune_name === 'string' ? source.commune_name.trim() : '';
  const regions = regionName
    ? catalog.regions.filter((r) => normalize(r.name) === normalize(regionName))
    : [];
  if (regions.length === 1) fields.region_id = String(regions[0].id);
  else if (regionName)
    warnings.push(`Región por revisar: ${regionName.slice(0, 100)}.`);
  if (communeName) {
    const communes = catalog.communes.filter(
      (c) =>
        normalize(c.name) === normalize(communeName) &&
        (!fields.region_id || String(c.region_id) === fields.region_id),
    );
    if (communes.length === 1) {
      fields.commune_id = String(communes[0].id);
      fields.region_id = String(communes[0].region_id);
    } else
      warnings.push(
        `Comuna ambigua o no encontrada en la región: ${communeName.slice(0, 100)}. Selecciónala manualmente.`,
      );
  }
  if (fields.address && normalize(fields.address).length >= 6) {
    for (const key of ['title', 'summary', 'description'])
      if (
        fields[key] &&
        normalize(fields[key]).includes(normalize(fields.address))
      ) {
        delete fields[key];
        warnings.push(
          'La propuesta incluía la dirección exacta en un texto público. Completa ese texto manualmente sin la dirección.',
        );
      }
  }
  if (fields.latitude !== undefined && fields.longitude !== undefined) {
    for (const key of ['title', 'summary', 'description'])
      if (
        fields[key] &&
        (/latitud|longitud|coordenadas|\bGPS\b/i.test(fields[key]) ||
          (fields[key].replaceAll(',', '.').includes(fields.latitude) &&
            fields[key].replaceAll(',', '.').includes(fields.longitude)))
      ) {
        delete fields[key];
        warnings.push(
          'La propuesta incluía coordenadas en un texto público. Completa ese texto manualmente sin coordenadas.',
        );
      }
  }
  if (fields.title && fields.title.length < 8)
    warnings.push(
      'El título necesita al menos 8 caracteres. Complétalo en el formulario antes de guardar.',
    );
  if (fields.description && fields.description.length < 40)
    warnings.push(
      'La descripción necesita al menos 40 caracteres. Complétala en el formulario antes de guardar.',
    );
  return { fields, warnings: [...new Set(warnings)].slice(0, 15) };
}
