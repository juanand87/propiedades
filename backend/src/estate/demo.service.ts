import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import { Actor, admin, choice } from './rules';
import {
  DEMO_ADVERTISER_ID,
  DEMO_USER_ID,
  DEMO_SLUG,
  demoId,
  exampleProperty,
  exampleSvg,
} from './demo-properties';

@Injectable()
export class DemoService {
  constructor(private db: DataSource) {}
  private ids = Array.from({ length: 20 }, (_, i) => exampleProperty(i).id);
  private condition = `advertiser_id=? AND id IN (${this.ids.map(() => '?').join(',')})`;
  private guard(u: Actor) {
    admin(u);
    if (String(this.db.options.database) !== 'propiedades')
      throw new BadRequestException(
        'Los ejemplos solo se instalan en propiedades.',
      );
  }
  async status(u: Actor) {
    this.guard(u);
    const [r] = await this.db.query(
      `SELECT COUNT(*) total,COALESCE(SUM(publication_status='published'),0) published FROM properties WHERE ${this.condition}`,
      [DEMO_ADVERTISER_ID, ...this.ids],
    );
    return {
      total: Number(r.total),
      published: Number(r.published),
      expected: 20,
      ready: true,
    };
  }
  async install(u: Actor, body: any) {
    this.guard(u);
    const mode = choice(body?.mode, ['draft', 'published']);
    const current = await this.status(u);
    if (current.total === 20) return { ...current, created: 0, existing: 20 };
    const assets = new Map<string, Buffer>();
    for (let i = 0; i < 20; i++)
      for (let v = 0; v < 3; v++)
        assets.set(
          demoId(`media-${i}-${v}`),
          await sharp(Buffer.from(exampleSvg(i, v)))
            .webp({ quality: 82 })
            .toBuffer(),
        );
    const password = await bcrypt.hash(
      randomBytes(48).toString('base64url'),
      12,
    );
    let created = 0;
    await this.db.transaction(async (tx) => {
      // Serialize installations through an existing project row; no settings are changed.
      const [settings] = await tx.query(
        'SELECT id FROM estate_settings WHERE id=1 FOR UPDATE',
      );
      if (!settings)
        throw new BadRequestException(
          'Primero inicializa el esquema de Propiedades.',
        );
      const [user] = await tx.query('SELECT id,email FROM users WHERE id=?', [
        DEMO_USER_ID,
      ]);
      if (user && user.email !== 'ejemplos@propiedades.invalid')
        throw new ConflictException(
          'El identificador de ejemplos ya está ocupado.',
        );
      if (!user)
        await tx.query(
          "INSERT INTO users(id,email,password,firstName,lastName,role,isActive) VALUES (?,?,?,?,?,'customer',1)",
          [
            DEMO_USER_ID,
            'ejemplos@propiedades.invalid',
            password,
            'Propiedades',
            'de ejemplo',
          ],
        );
      const [a] = await tx.query(
        'SELECT id,user_id,slug FROM advertisers WHERE id=?',
        [DEMO_ADVERTISER_ID],
      );
      if (a && (a.user_id !== DEMO_USER_ID || a.slug !== DEMO_SLUG))
        throw new ConflictException('El perfil de ejemplos ya está ocupado.');
      if (!a)
        await tx.query(
          "INSERT INTO advertisers(id,user_id,slug,display_name,description,kind,status) VALUES (?,?,?,?,?,'agency','approved')",
          [
            DEMO_ADVERTISER_ID,
            DEMO_USER_ID,
            DEMO_SLUG,
            'Propiedades de ejemplo',
            'Catálogo ficticio para probar el sitio. No son ofertas reales ni un anunciante comercial.',
          ],
        );
      const communes = await tx.query(
        'SELECT id,region_id FROM estate_communes ORDER BY id',
      );
      if (!communes.length)
        throw new BadRequestException(
          'Faltan las regiones y comunas del esquema.',
        );
      const types = await tx.query(
        'SELECT id FROM property_types WHERE active=1',
      );
      if (
        !['house', 'apartment', 'plot'].every((t) =>
          types.some((x: any) => x.id === t),
        )
      )
        throw new BadRequestException(
          'Activa Casa, Departamento y Parcela para instalar los ejemplos.',
        );
      for (let i = 0; i < 20; i++) {
        const p = exampleProperty(i),
          c = communes[(i * 17) % communes.length];
        const [existing] = await tx.query(
          'SELECT advertiser_id FROM properties WHERE id=?',
          [p.id],
        );
        if (existing) {
          if (existing.advertiser_id !== DEMO_ADVERTISER_ID)
            throw new ConflictException(
              'Un identificador de ejemplo ya está ocupado.',
            );
          continue;
        }
        await tx.query(
          `INSERT INTO properties(id,advertiser_id,created_by,code,slug,title,summary,description,type_id,price_amount,price_unit,region_id,commune_id,neighborhood,built_area,land_area,bedrooms,bathrooms,parking,publication_status,availability,featured,reviewed_by,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,'UF',?,?,?,?,?,?,?,?,?,'available',?,?,${mode === 'published' ? 'NOW()' : 'NULL'})`,
          [
            p.id,
            DEMO_ADVERTISER_ID,
            u.id,
            p.code,
            p.slug,
            p.title,
            'Propiedad de demostración con imágenes ilustrativas.',
            'EJEMPLO: datos ficticios para probar el marketplace y el recorrido vertical. Esta publicación no corresponde a una oferta real y no admite consultas ni visitas.',
            p.type,
            p.price,
            c.region_id,
            c.id,
            'Sector de ejemplo',
            p.built,
            p.land,
            p.bedrooms,
            p.bathrooms,
            p.type === 'plot' ? null : 1,
            mode,
            i < 3 ? 1 : 0,
            u.id,
          ],
        );
        for (let v = 0; v < 3; v++) {
          const id = demoId(`media-${i}-${v}`),
            buffer = assets.get(id)!;
          const [media] = await tx.query(
            'SELECT owner_id FROM estate_media WHERE id=?',
            [id],
          );
          if (media && media.owner_id !== DEMO_USER_ID)
            throw new ConflictException(
              'Una imagen de ejemplo ya está ocupada.',
            );
          if (!media)
            await tx.query(
              "INSERT INTO estate_media(id,owner_id,name,mime,content,size_bytes) VALUES (?,?,?,'image/webp',?,?)",
              [
                id,
                DEMO_USER_ID,
                `Ejemplo ${i + 1} · Vista ${v + 1}.webp`,
                buffer,
                buffer.length,
              ],
            );
          await tx.query(
            'INSERT INTO property_media(property_id,media_id,sort_order,alt_text) VALUES (?,?,?,?)',
            [p.id, id, v, `Ilustración de ${p.title}, vista ${v + 1}`],
          );
        }
        await tx.query(
          'INSERT INTO property_status_history(id,property_id,actor_id,next_status,note) VALUES (?,?,?,?,?)',
          [
            randomUUID(),
            p.id,
            u.id,
            mode,
            'Instalación de ejemplo ficticio desde el panel.',
          ],
        );
        created++;
      }
    });
    return { ...(await this.status(u)), created, existing: 20 - created };
  }
  async pause(u: Actor) {
    this.guard(u);
    await this.db.transaction(async (tx) => {
      const rows = await tx.query(
        `SELECT id FROM properties WHERE ${this.condition} AND publication_status='published' FOR UPDATE`,
        [DEMO_ADVERTISER_ID, ...this.ids],
      );
      for (const r of rows) {
        await tx.query(
          "UPDATE properties SET publication_status='paused',revision=revision+1 WHERE id=? AND advertiser_id=?",
          [r.id, DEMO_ADVERTISER_ID],
        );
        await tx.query(
          "INSERT INTO property_status_history(id,property_id,actor_id,previous_status,next_status,note) VALUES (?,?,?,'published','paused',?)",
          [
            randomUUID(),
            r.id,
            u.id,
            'Despublicar únicamente ejemplos ficticios.',
          ],
        );
      }
    });
    return this.status(u);
  }
  async publish(u: Actor) {
    this.guard(u);
    await this.db.transaction(async (tx) => {
      const rows = await tx.query(
        `SELECT id,publication_status FROM properties WHERE ${this.condition} AND publication_status IN ('draft','paused') FOR UPDATE`,
        [DEMO_ADVERTISER_ID, ...this.ids],
      );
      for (const r of rows) {
        await tx.query(
          "UPDATE properties SET publication_status='published',published_at=NOW(),reviewed_by=?,revision=revision+1 WHERE id=? AND advertiser_id=?",
          [u.id, r.id, DEMO_ADVERTISER_ID],
        );
        await tx.query(
          'INSERT INTO property_status_history(id,property_id,actor_id,previous_status,next_status,note) VALUES (?,?,?,?,?,?)',
          [
            randomUUID(),
            r.id,
            u.id,
            r.publication_status,
            'published',
            'Publicar ejemplo ficticio desde su instalador.',
          ],
        );
      }
    });
    return this.status(u);
  }
}
