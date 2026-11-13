import { DEMO_ADVERTISER_ID } from './demo-properties';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Actor, decimal, text, uuid } from './rules';
import {
  propertyFilters,
  publicPropertyConditions,
  publicPropertyJoins,
} from './property-filters';

export function normalizeSavedFilters(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Filtros inválidos.');
  const source = input as Record<string, unknown>,
    result: Record<string, string> = {};
  const allowed = [
    'search',
    'type_id',
    'operation_type',
    'bedrooms',
    'price_unit',
    'min_price',
    'max_price',
  ];
  if (Object.keys(source).some((key) => !allowed.includes(key)))
    throw new BadRequestException('La búsqueda contiene filtros no admitidos.');
  for (const key of allowed) {
    const value = source[key];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string')
      throw new BadRequestException('Filtros inválidos.');
    if (key === 'search') {
      const search = text(value, 100);
      if (search) result.search = search;
    } else if (key === 'type_id') {
      if (!/^[a-z_]{1,30}$/.test(value))
        throw new BadRequestException('Tipo inválido.');
      result[key] = value;
    } else if (key === 'operation_type') {
      if (!['sale', 'rent'].includes(value))
        throw new BadRequestException('Operación inválida.');
      result[key] = value;
    } else if (key === 'price_unit') {
      if (!['CLP', 'UF'].includes(value))
        throw new BadRequestException('Moneda inválida.');
      result[key] = value;
    } else if (key === 'bedrooms') {
      if (!/^[1-9][0-9]?$/.test(value))
        throw new BadRequestException('Dormitorios inválidos.');
      result[key] = String(Number(value));
    } else
      result[key] = decimal(value, key, false)!
        .replace(/^0+(?=\d)/, '')
        .replace(/(\.\d*?)0+$/, '$1')
        .replace(/\.$/, '');
  }
  if (result.min_price || result.max_price) {
    if (!result.price_unit)
      throw new BadRequestException('Selecciona CLP o UF.');
  } else delete result.price_unit;
  if (
    result.min_price &&
    result.max_price &&
    Number(result.min_price) > Number(result.max_price)
  )
    throw new BadRequestException(
      'El máximo debe ser mayor o igual al mínimo.',
    );
  if (!Object.keys(result).length)
    throw new BadRequestException(
      'Selecciona al menos un filtro antes de guardar.',
    );
  return result;
}
type SavedRow = {
  id: string;
  user_id: string;
  name: string;
  filters_json: string;
  enabled: number;
  starts_at: string;
};
@Injectable()
export class SavedSearchService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private db: DataSource,
    private config: ConfigService,
  ) {}
  async available(db: Pick<DataSource, 'query'> | EntityManager = this.db) {
    const [row] = await db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_saved_searches','estate_search_matches','estate_search_push_deliveries')",
    );
    return Number(row.n) === 3;
  }
  private async guard() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'Búsquedas guardadas está pendiente de configurar.',
      );
  }
  private item(row: SavedRow) {
    const { filters_json, ...rest } = row;
    return {
      ...rest,
      enabled: !!Number(row.enabled),
      filters: JSON.parse(filters_json) as Record<string, string>,
    };
  }
  async list(actor: Actor) {
    await this.guard();
    return {
      items: (
        await this.db.query<SavedRow[]>(
          'SELECT * FROM estate_saved_searches WHERE user_id=? ORDER BY created_at DESC,id',
          [actor.id],
        )
      ).map((row) => this.item(row)),
    };
  }
  async get(actor: Actor, id: string) {
    await this.guard();
    const [row] = await this.db.query<SavedRow[]>(
      'SELECT * FROM estate_saved_searches WHERE id=? AND user_id=?',
      [uuid(id), actor.id],
    );
    if (!row) throw new NotFoundException('Búsqueda no disponible.');
    return this.item(row);
  }
  private async baseline(
    tx: EntityManager,
    id: string,
    filters: Record<string, string>,
  ) {
    const f = propertyFilters(filters);
    await tx.query(
      `INSERT IGNORE INTO estate_search_matches(search_id,property_id,is_baseline,read_at) SELECT ?,p.id,1,UTC_TIMESTAMP(3) ${publicPropertyJoins} WHERE ${publicPropertyConditions} AND p.advertiser_id<>'${DEMO_ADVERTISER_ID}' ${f.where.length ? 'AND ' + f.where.join(' AND ') : ''}`,
      [id, ...f.params],
    );
  }
  async create(
    actor: Actor,
    body: { name?: unknown; filters?: unknown; enabled?: unknown },
  ) {
    await this.guard();
    const filters = normalizeSavedFilters(body.filters),
      name = text(body.name, 80);
    if (!name)
      throw new BadRequestException('Escribe un nombre para la búsqueda.');
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean')
      throw new BadRequestException('Estado inválido.');
    const raw = JSON.stringify(filters),
      hash = createHash('sha256').update(raw).digest('hex');
    const id = await this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [actor.id]);
      const [existing] = await tx.query<{ id: string }[]>(
        'SELECT id FROM estate_saved_searches WHERE user_id=? AND filter_hash=?',
        [actor.id, hash],
      );
      if (existing) return existing.id;
      const [count] = await tx.query<{ n: number }[]>(
        'SELECT COUNT(*) n FROM estate_saved_searches WHERE user_id=?',
        [actor.id],
      );
      if (Number(count.n) >= 50)
        throw new BadRequestException(
          'Ya tienes 50 búsquedas guardadas. Elimina una para agregar otra.',
        );
      const id = randomUUID();
      await tx.query(
        'INSERT INTO estate_saved_searches(id,user_id,name,filters_json,filter_hash,enabled,starts_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())',
        [id, actor.id, name, raw, hash, body.enabled === false ? 0 : 1],
      );
      await this.baseline(tx, id, filters);
      return id;
    });
    return this.get(actor, id);
  }
  async update(actor: Actor, id: string, body: { enabled?: unknown }) {
    await this.guard();
    if (typeof body.enabled !== 'boolean')
      throw new BadRequestException('Estado inválido.');
    await this.db.transaction(async (tx) => {
      const [row] = await tx.query<SavedRow[]>(
        'SELECT * FROM estate_saved_searches WHERE id=? AND user_id=? FOR UPDATE',
        [uuid(id), actor.id],
      );
      if (!row) throw new NotFoundException('Búsqueda no disponible.');
      if (body.enabled && !Number(row.enabled)) {
        await this.baseline(
          tx,
          id,
          JSON.parse(row.filters_json) as Record<string, string>,
        );
        await tx.query(
          'UPDATE estate_saved_searches SET starts_at=UTC_TIMESTAMP(),checked_at=NULL WHERE id=?',
          [id],
        );
      }
      await tx.query('UPDATE estate_saved_searches SET enabled=? WHERE id=?', [
        body.enabled ? 1 : 0,
        id,
      ]);
      if (!body.enabled)
        await tx.query(
          "UPDATE estate_search_push_deliveries d JOIN estate_search_matches m ON m.id=d.match_id SET d.status='done' WHERE m.search_id=? AND d.status='pending'",
          [id],
        );
    });
    return this.get(actor, id);
  }
  async remove(actor: Actor, id: string) {
    await this.guard();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.query<{ id: string }[]>(
        'SELECT id FROM estate_saved_searches WHERE id=? AND user_id=? FOR UPDATE',
        [uuid(id), actor.id],
      );
      if (!row) throw new NotFoundException('Búsqueda no disponible.');
      await tx.query(
        'DELETE d FROM estate_search_push_deliveries d JOIN estate_search_matches m ON m.id=d.match_id WHERE m.search_id=?',
        [id],
      );
      await tx.query('DELETE FROM estate_search_matches WHERE search_id=?', [
        id,
      ]);
      await tx.query(
        'DELETE FROM estate_saved_searches WHERE id=? AND user_id=?',
        [id, actor.id],
      );
    });
    return { success: true };
  }
  async matches(actor: Actor, before?: string) {
    await this.guard();
    if (before && !/^[1-9][0-9]{0,18}$/.test(before))
      throw new BadRequestException('Cursor inválido.');
    const rows = await this.db.query<Record<string, unknown>[]>(
      `SELECT CAST(m.id AS CHAR) id,m.property_id,m.read_at,m.created_at,s.name search_name,p.title,p.price_amount,p.price_unit,c.name commune_name ${publicPropertyJoins} JOIN estate_search_matches m ON m.property_id=p.id JOIN estate_saved_searches s ON s.id=m.search_id WHERE s.user_id=? AND m.is_baseline=0 AND ${publicPropertyConditions} ${before ? 'AND m.id<?' : ''} ORDER BY m.id DESC LIMIT 21`,
      [actor.id, ...(before ? [before] : [])],
    );
    return {
      items: rows.slice(0, 20),
      next_cursor: rows.length > 20 ? String(rows[19].id) : null,
    };
  }
  async readMatch(actor: Actor, id: string) {
    await this.guard();
    if (!/^[1-9][0-9]{0,18}$/.test(id))
      throw new BadRequestException('Aviso inválido.');
    await this.db.query(
      'UPDATE estate_search_matches m JOIN estate_saved_searches s ON s.id=m.search_id SET m.read_at=COALESCE(m.read_at,UTC_TIMESTAMP(3)) WHERE m.id=? AND s.user_id=?',
      [id, actor.id],
    );
    return { success: true };
  }
  onModuleInit() {
    if (
      this.config.get('NODE_ENV') !== 'production' ||
      this.config.get('PROPERTY_ALERTS_ENABLED') === 'false'
    )
      return;
    this.timer = setInterval(() => void this.scan().catch(() => {}), 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async scan() {
    if (!(await this.available())) return;
    const runner = this.db.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const [lock] = (await runner.query(
        "SELECT GET_LOCK('proppix-search-alerts',0) locked",
      )) as { locked: number }[];
      if (!lock.locked) return;
      locked = true;
      const searches = await this.db.query<{ id: string }[]>(
        'SELECT s.id FROM estate_saved_searches s JOIN users u ON u.id=s.user_id AND u.isActive=1 WHERE s.enabled=1 ORDER BY s.checked_at,s.id LIMIT 25',
      );
      for (const search of searches)
        await this.db.transaction(async (tx) => {
          const [row] = await tx.query<SavedRow[]>(
            'SELECT * FROM estate_saved_searches WHERE id=? AND enabled=1 FOR UPDATE',
            [search.id],
          );
          if (!row) return;
          const f = propertyFilters(
            JSON.parse(row.filters_json) as Record<string, string>,
          );
          const matches = await tx.query<{ id: string }[]>(
            `SELECT p.id ${publicPropertyJoins} WHERE ${publicPropertyConditions} AND p.advertiser_id<>'${DEMO_ADVERTISER_ID}' AND p.availability='available' AND p.published_at>=? ${f.where.length ? 'AND ' + f.where.join(' AND ') : ''} AND NOT EXISTS(SELECT 1 FROM estate_search_matches m WHERE m.search_id=? AND m.property_id=p.id) ORDER BY p.published_at,p.id LIMIT 100`,
            [row.starts_at, ...f.params, row.id],
          );
          for (const match of matches) {
            await tx.query(
              'INSERT IGNORE INTO estate_search_matches(search_id,property_id) VALUES (?,?)',
              [row.id, match.id],
            );
            await tx.query(
              `INSERT IGNORE INTO estate_search_push_deliveries(match_id,token,user_id) SELECT m.id,d.token,d.user_id FROM estate_search_matches m JOIN estate_push_devices d ON d.user_id=? AND d.updated_at>UTC_TIMESTAMP()-INTERVAL 90 DAY WHERE m.search_id=? AND m.property_id=?`,
              [row.user_id, row.id, match.id],
            );
          }
          await tx.query(
            'UPDATE estate_saved_searches SET checked_at=UTC_TIMESTAMP(3) WHERE id=?',
            [row.id],
          );
        });
    } finally {
      if (locked)
        await runner
          .query("SELECT RELEASE_LOCK('proppix-search-alerts')")
          .catch(() => {});
      await runner.release();
    }
  }
}
