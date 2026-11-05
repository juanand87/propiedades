import { createHash } from 'node:crypto';
export function demoId(key: string) {
  const h = createHash('sha256')
    .update(`propiedades-examples-v1:${key}`)
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export const DEMO_ADVERTISER_ID = demoId('advertiser');
export const DEMO_USER_ID = demoId('user');
export const DEMO_SLUG = 'propiedades-de-ejemplo';
export function exampleProperty(i: number) {
  const types = ['house', 'apartment', 'plot'];
  const type = types[i % 3];
  const titles = [
    'Casa luminosa con jardín',
    'Departamento con terraza',
    'Parcela para imaginar tu próximo lugar',
    'Casa familiar con patio',
    'Departamento cerca de todo',
  ];
  const title =
    type === 'plot'
      ? titles[2]
      : type === 'apartment'
        ? titles[i % 2 ? 1 : 4]
        : titles[i % 2 ? 3 : 0];
  return {
    id: demoId(`property-${i}`),
    code: `DEMO-${String(i + 1).padStart(3, '0')}`,
    slug: `ejemplo-propiedad-${String(i + 1).padStart(2, '0')}`,
    title: `${title} · Ejemplo ${i + 1}`,
    type,
    price: 1800 + i * 315,
    bedrooms: type === 'plot' ? null : 2 + (i % 4),
    bathrooms: type === 'plot' ? null : 1 + (i % 3),
    built: type === 'plot' ? null : 65 + i * 9,
    land:
      type === 'plot' ? 5000 + i * 100 : type === 'house' ? 180 + i * 14 : null,
  };
}
export function exampleSvg(i: number, view: number) {
  const p = exampleProperty(i),
    tint = ['#214d59', '#5e765b', '#ad795c', '#415f85', '#84745b'][i % 5];
  const building =
    p.type === 'plot'
      ? '<path d="M0 520L420 290L800 490L1280 260V800H0Z" fill="#789b73"/><path d="M0 690L1280 420" stroke="#d9d2b7" stroke-width="70"/><path d="M400 650L520 370L980 310L1090 560Z" fill="none" stroke="#faf5dc" stroke-width="8" stroke-dasharray="18 14"/>'
      : p.type === 'apartment'
        ? `<rect x="490" y="100" width="530" height="560" rx="5" fill="#eee5d4"/>${Array.from({ length: 5 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<rect x="${520 + c * 120}" y="${135 + r * 100}" width="85" height="60" fill="${tint}"/><path d="M${510 + c * 120} ${205 + r * 100}h105" stroke="#b5aa95" stroke-width="8"/>`).join('')).join('')}`
        : `<rect x="400" y="335" width="700" height="300" fill="#ede3d1"/><path d="M350 345L740 135L1150 345Z" fill="${tint}"/><rect x="465" y="405" width="165" height="120" fill="#8fb4b8"/><rect x="880" y="405" width="155" height="120" fill="#8fb4b8"/><rect x="700" y="420" width="110" height="215" fill="${tint}"/><path d="M635 800L700 635H810L960 800Z" fill="#d4c8af"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#c7dfe8"/><stop offset="1" stop-color="#eef2e6"/></linearGradient></defs><rect width="1280" height="800" fill="url(#sky)"/><circle cx="${1060 - view * 180}" cy="120" r="75" fill="#f5d996"/><path d="M0 580L1280 500V800H0Z" fill="#a9bc96"/><g transform="translate(${view * -70} ${view * 15})">${building}</g><path d="M175 660V410" stroke="#6d7653" stroke-width="14"/><ellipse cx="175" cy="360" rx="100" ry="140" fill="${tint}"/><rect x="28" y="28" width="390" height="48" rx="24" fill="#ffffffdd"/><text x="50" y="60" font-family="Arial" font-size="24" fill="#203e38">EJEMPLO ${i + 1} · IMAGEN ILUSTRATIVA</text><rect y="746" width="1280" height="54" fill="#102b50cc"/><text x="30" y="780" font-family="Arial" font-size="22" fill="white">Datos ficticios · No corresponde a una oferta inmobiliaria real</text></svg>`;
}
