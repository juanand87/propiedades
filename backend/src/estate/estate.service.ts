import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import { readDesign, validateDesign } from './site-design';
import {
  Actor,
  admin,
  choice,
  decimal,
  email,
  integer,
  isAdmin,
  ownership,
  slugify,
  text,
  transition,
  uuid,
} from './rules';

const selection = `SELECT p.*,a.display_name,a.slug advertiser_slug,a.phone,a.whatsapp,a.public_email,r.name region_name,c.name commune_name FROM properties p JOIN advertisers a ON a.id=p.advertiser_id JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id AND owner.isActive=1 LEFT JOIN estate_regions r ON r.id=p.region_id LEFT JOIN estate_communes c ON c.id=p.commune_id`;
const numericFields = [
  'bedrooms',
  'bathrooms',
  'parking',
  'storage_rooms',
  'construction_year',
  'floors',
  'floor_number',
];
const decimalFields = [
  'price_amount',
  'built_area',
  'usable_area',
  'land_area',
  'common_expenses',
  'contributions',
];
const publicFields = [
  'id',
  'code',
  'slug',
  'title',
  'summary',
  'description',
  'type_id',
  'operation_type',
  'price_amount',
  'price_unit',
  'region_id',
  'commune_id',
  'region_name',
  'commune_name',
  'neighborhood',
  'show_exact_address',
  'built_area',
  'usable_area',
  'land_area',
  'bedrooms',
  'bathrooms',
  'parking',
  'storage_rooms',
  'construction_year',
  'condition_type',
  'floors',
  'floor_number',
  'common_expenses',
  'contributions',
  'expense_unit',
  'contributions_period',
  'availability',
  'featured',
  'published_at',
  'created_at',
  'updated_at',
];

@Injectable()
export class EstateService {
  constructor(
    readonly db: DataSource,
    private jwt: JwtService,
  ) {}
  private attempts = new Map<string, { n: number; reset: number }>();
  private readonly unknownPasswordHash = bcrypt.hashSync(
    'estate-auth-timing-sentinel',
    12,
  );
  throttle(key: string, maximum = 8, window = 15 * 60_000) {
    const now = Date.now();
    if (this.attempts.size > 10000)
      for (const [k, v] of this.attempts)
        if (v.reset < now) this.attempts.delete(k);
    const entry = this.attempts.get(key);
    if (!entry || entry.reset < now) {
      this.attempts.set(key, { n: 1, reset: now + window });
      return;
    }
    if (++entry.n > maximum)
      throw new BadRequestException(
        'Demasiados intentos. Espera unos minutos.',
      );
  }
  async health() {
    try {
      const rows = await this.db.query(
        "SELECT version FROM estate_migrations WHERE version IN ('001_real_estate','002_locations','003_identity')",
      );
      return { service: 'propiedades', schemaReady: rows.length === 3 };
    } catch {
      return { service: 'propiedades', schemaReady: false };
    }
  }
  async ready() {
    const h = await this.health();
    if (!h.schemaReady)
      throw new ServiceUnavailableException(
        'Esquema inmobiliario pendiente. Ejecuta el SQL de actualización.',
      );
    return h;
  }
  async actor(id: string): Promise<Actor> {
    const [u] = await this.db.query(
      'SELECT u.id,u.email,u.role,u.firstName,a.id advertiser_id,a.status advertiser_status FROM users u LEFT JOIN advertisers a ON a.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE u.id=? AND u.isActive=1',
      [id],
    );
    if (!u) throw new UnauthorizedException('La cuenta no está activa.');
    return u;
  }
  async login(body: any, ip: string, panel = false) {
    this.throttle(`login:${ip}`, 12);
    const address = email(body.email);
    const [u] = await this.db.query(
      'SELECT id,password,isActive,role FROM users WHERE email=?',
      [address],
    );
    const valid = await bcrypt
      .compare(
        typeof body.password === 'string' ? body.password.slice(0, 200) : '',
        u?.password || this.unknownPasswordHash,
      )
      .catch(() => false);
    if (!u || !valid || !u.isActive || (panel && u.role !== 'admin'))
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    const actor = await this.actor(u.id);
    return {
      access_token: this.jwt.sign({ sub: u.id, aud: 'estate-session' }),
      user: actor,
    };
  }
  async register(body: any, ip: string) {
    this.throttle(`register:${ip}`, 5, 3600_000);
    const address = email(body.email),
      firstName = text(body.firstName, 100),
      lastName = text(body.lastName, 100);
    if (
      !firstName ||
      !lastName ||
      typeof body.password !== 'string' ||
      body.password.length < 10 ||
      Buffer.byteLength(body.password) > 72
    )
      throw new BadRequestException(
        'Completa nombre, apellido y una contraseña de 10 a 72 bytes.',
      );
    const id = randomUUID(),
      password = await bcrypt.hash(body.password, 12);
    try {
      await this.db.query(
        "INSERT INTO users(id,email,password,firstName,lastName,role,isActive,requirePasswordChange,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,'customer',1,0,'self-registration',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        [id, address, password, firstName, lastName],
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY')
        throw new ConflictException('Ese correo ya tiene una cuenta.');
      throw e;
    }
    return {
      access_token: this.jwt.sign({ sub: id, aud: 'estate-session' }),
      user: await this.actor(id),
    };
  }
  async changePassword(u: Actor, b: any) {
    const [row] = await this.db.query('SELECT password FROM users WHERE id=?', [
      u.id,
    ]);
    if (!(await bcrypt.compare(String(b.currentPassword || ''), row.password)))
      throw new BadRequestException('Contraseña actual incorrecta.');
    if (
      typeof b.newPassword !== 'string' ||
      b.newPassword.length < 10 ||
      Buffer.byteLength(b.newPassword) > 72
    )
      throw new BadRequestException(
        'La nueva contraseña debe tener de 10 a 72 bytes.',
      );
    await this.db.query(
      'UPDATE users SET password=?,requirePasswordChange=0,tempPassword=NULL WHERE id=?',
      [await bcrypt.hash(b.newPassword, 12), u.id],
    );
    return { success: true };
  }
  async catalog() {
    const [types, amenities, regions, communes] = await Promise.all([
      this.db.query('SELECT * FROM property_types ORDER BY name'),
      this.db.query('SELECT * FROM amenities ORDER BY name'),
      this.db.query('SELECT * FROM estate_regions ORDER BY id'),
      this.db.query('SELECT * FROM estate_communes ORDER BY name'),
    ]);
    return { types, amenities, regions, communes };
  }
  async settings() {
    const [row] = await this.db.query(
      'SELECT * FROM estate_settings WHERE id=1',
    );
    const design = readDesign(row?.design_json);
    const { design_json, ...publicSettings } = row || {};
    return {
      ...publicSettings,
      design_ready:
        !!row &&
        Object.hasOwn(row, 'design_json') &&
        Object.hasOwn(row, 'design_revision'),
      design_revision: Number(row?.design_revision || 1),
      design: {
        ...design,
        logo_url: design.logo_media_id
          ? this.mediaUrl(design.logo_media_id)
          : null,
        hero_url: design.hero_media_id
          ? this.mediaUrl(design.hero_media_id)
          : null,
      },
    };
  }
  async saveDesign(u: Actor, b: any) {
    admin(u);
    const design = validateDesign(b.design);
    await this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        'SELECT * FROM estate_settings WHERE id=1 FOR UPDATE',
      );
      if (
        !row ||
        !Object.hasOwn(row, 'design_json') ||
        !Object.hasOwn(row, 'design_revision')
      )
        throw new ServiceUnavailableException(
          'Primero ejecuta database/004_diseno_sitio.sql en la BD propiedades.',
        );
      if (b.revision !== Number(row.design_revision))
        throw new ConflictException(
          'Otra sesión modificó el diseño. Recarga el diseño guardado antes de continuar.',
        );
      const previousDesign = readDesign(row.design_json);
      for (const id of [design.logo_media_id, design.hero_media_id].filter(
        Boolean,
      )) {
        const [media] = await tx.query(
          'SELECT owner_id FROM estate_media WHERE id=? FOR UPDATE',
          [id],
        );
        if (
          !media ||
          (media.owner_id !== u.id &&
            previousDesign.logo_media_id !== id &&
            previousDesign.hero_media_id !== id)
        )
          throw new ForbiddenException(
            'Selecciona imágenes de tu biblioteca de administrador.',
          );
      }
      await tx.query(
        'UPDATE estate_settings SET design_json=?,design_revision=design_revision+1 WHERE id=1',
        [JSON.stringify(design)],
      );
    });
    return this.settings();
  }
  async saveSettings(u: Actor, b: any) {
    admin(u);
    await this.db.query(
      'UPDATE estate_settings SET site_name=?,tagline=?,contact_email=?,about_text=?,homepage_title=?,index_enabled=? WHERE id=1',
      [
        text(b.site_name, 100) || 'Propiedades',
        text(b.tagline, 200),
        b.contact_email ? email(b.contact_email) : null,
        text(b.about_text, 10000),
        text(b.homepage_title, 180) ||
          'Un nuevo lugar para tu próxima historia.',
        b.index_enabled === true || b.index_enabled === 1 ? 1 : 0,
      ],
    );
    return this.settings();
  }
  async saveCatalog(u: Actor, b: any) {
    admin(u);
    const group = choice(b.group, [
      'types',
      'amenities',
      'regions',
      'communes',
    ]);
    const name = text(b.name, 100);
    if (!name) throw new BadRequestException('Falta el nombre.');
    if (group === 'types' || group === 'amenities') {
      const id = slugify(text(b.id, 40) || name);
      if (!id || id.length > (group === 'types' ? 30 : 40))
        throw new BadRequestException('Código inválido.');
      await this.db.query(
        `INSERT INTO ${group === 'types' ? 'property_types' : 'amenities'}(id,name,active) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),active=VALUES(active)`,
        [id, name, b.active === false ? 0 : 1],
      );
    } else if (group === 'regions') {
      const id = integer(b.id, 999);
      if (!id)
        throw new BadRequestException('Falta el código numérico de región.');
      await this.db.query(
        'INSERT INTO estate_regions(id,name,code) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [id, name, text(b.code, 10) || String(id)],
      );
    } else {
      const regionId = integer(b.region_id, 999);
      const [region] = await this.db.query(
        'SELECT id FROM estate_regions WHERE id=?',
        [regionId],
      );
      if (!region) throw new BadRequestException('Región inválida.');
      await this.db.query(
        'INSERT INTO estate_communes(region_id,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [regionId, name],
      );
    }
    return this.catalog();
  }
  async advertiser(u: Actor) {
    const [a] = await this.db.query(
      'SELECT * FROM advertisers WHERE user_id=?',
      [u.id],
    );
    return a || null;
  }
  async saveAdvertiser(u: Actor, b: any) {
    const name = text(b.display_name, 160);
    if (!name) throw new BadRequestException('Falta el nombre público.');
    const kind = choice(b.kind, ['owner', 'broker', 'agency'], 'owner');
    let a = await this.advertiser(u);
    if (!a) {
      const id = randomUUID(),
        slug = `${slugify(name).slice(0, 140) || 'anunciante'}-${id.slice(0, 8)}`;
      await this.db.query(
        'INSERT INTO advertisers(id,user_id,slug,display_name,kind,status) VALUES (?,?,?,?,?,?)',
        [id, u.id, slug, name, kind, isAdmin(u) ? 'approved' : 'pending'],
      );
      a = await this.advertiser(u);
    }
    const phone = text(b.phone, 40),
      whatsapp = text(b.whatsapp, 40);
    if ([phone, whatsapp].some((v) => v && !/^[+\d ()-]{6,40}$/.test(v)))
      throw new BadRequestException('Teléfono inválido.');
    let logo: string | null = null;
    if (b.logo_media_id) {
      const [m] = await this.db.query(
        'SELECT id FROM estate_media WHERE id=? AND owner_id=?',
        [uuid(b.logo_media_id), u.id],
      );
      if (!m) throw new ForbiddenException('Logo ajeno.');
      logo = m.id;
    }
    await this.db.query(
      'UPDATE advertisers SET display_name=?,kind=?,description=?,phone=?,whatsapp=?,public_email=?,legal_name=?,tax_id=?,logo_media_id=? WHERE id=?',
      [
        name,
        kind,
        text(b.description, 4000),
        phone || null,
        whatsapp || null,
        b.public_email ? email(b.public_email) : null,
        text(b.legal_name, 180) || null,
        text(b.tax_id, 30) || null,
        logo,
        a.id,
      ],
    );
    return this.advertiser(u);
  }
  async advertisers(u?: Actor) {
    if (u) admin(u);
    return this.db.query(
      u
        ? 'SELECT a.*,u.email account_email FROM advertisers a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC'
        : "SELECT a.id,a.slug,a.display_name,a.kind,a.description,a.phone,a.whatsapp,a.public_email,a.logo_media_id FROM advertisers a JOIN users u ON u.id=a.user_id AND u.isActive=1 WHERE a.status='approved' ORDER BY a.display_name",
    );
  }
  async publicAdvertiser(slug: string) {
    const [a] = await this.db.query(
      "SELECT a.id,a.slug,a.display_name,a.kind,a.description,a.phone,a.whatsapp,a.public_email,a.logo_media_id FROM advertisers a JOIN users u ON u.id=a.user_id AND u.isActive=1 WHERE a.slug=? AND a.status='approved'",
      [text(slug, 180)],
    );
    if (!a) throw new NotFoundException('Anunciante no disponible.');
    return a;
  }
  async moderateAdvertiser(u: Actor, id: string, b: any) {
    admin(u);
    const status = choice(b.status, ['pending', 'approved', 'suspended']);
    await this.db.query('UPDATE advertisers SET status=? WHERE id=?', [
      status,
      uuid(id),
    ]);
    if (status === 'approved')
      await this.db.query(
        "UPDATE users u JOIN advertisers a ON a.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci SET u.role='vendor' WHERE a.id=? AND u.role='customer'",
        [id],
      );
    return { success: true };
  }
  async list(q: any, u?: Actor) {
    const params: any[] = [],
      where: string[] = [];
    if (!u)
      where.push("p.publication_status='published'", "a.status='approved'");
    else if (!isAdmin(u)) {
      if (!u.advertiser_id) return { items: [], total: 0, page: 1, pages: 0 };
      where.push('p.advertiser_id=?');
      params.push(u.advertiser_id);
    }
    if (q.status && u) {
      where.push('p.publication_status=?');
      params.push(
        choice(q.status, [
          'draft',
          'pending_review',
          'published',
          'paused',
          'rejected',
          'archived',
        ]),
      );
    }
    if (q.search) {
      where.push(
        '(p.title LIKE ? OR p.description LIKE ? OR c.name LIKE ? OR p.code=?)',
      );
      const term = `%${text(q.search, 100)}%`;
      params.push(term, term, term, text(q.search, 100));
    }
    for (const key of [
      'type_id',
      'region_id',
      'commune_id',
      'advertiser_id',
      'price_unit',
      'availability',
    ])
      if (q[key]) {
        where.push(`p.${key}=?`);
        params.push(text(q[key], 100));
      }
    for (const [key, operator, col] of [
      ['min_price', '>=', 'price_amount'],
      ['max_price', '<=', 'price_amount'],
      ['min_area', '>=', 'built_area'],
      ['max_area', '<=', 'built_area'],
      ['bedrooms', '>=', 'bedrooms'],
      ['bathrooms', '>=', 'bathrooms'],
    ] as const)
      if (q[key] !== undefined && q[key] !== '') {
        if (col === 'price_amount' && !['CLP', 'UF'].includes(q.price_unit))
          throw new BadRequestException(
            'Selecciona CLP o UF para comparar precios.',
          );
        where.push(`p.${col}${operator}?`);
        params.push(decimal(q[key], key));
      }
    if (q.featured === 'true') where.push('p.featured=1');
    for (const a of text(q.amenities, 500)
      .split(',')
      .filter(Boolean)
      .slice(0, 20)) {
      where.push(
        'EXISTS(SELECT 1 FROM property_amenities pa WHERE pa.property_id=p.id AND pa.amenity_id=?)',
      );
      params.push(a);
    }
    const sorts: Record<string, string> = {
      recent: 'p.featured DESC,p.created_at DESC,p.id',
      oldest: 'p.created_at ASC,p.id',
      price_asc: 'p.price_amount ASC,p.id',
      price_desc: 'p.price_amount DESC,p.id',
    };
    const sort = Object.hasOwn(sorts, text(q.sort, 20))
      ? sorts[text(q.sort, 20)]
      : sorts.recent;
    if (
      String(q.sort || '').startsWith('price_') &&
      !['CLP', 'UF'].includes(q.price_unit)
    )
      throw new BadRequestException('Ordena precios dentro de CLP o UF.');
    const page = integer(q.page || 1, 100000) || 1,
      limit = Math.min(integer(q.limit || 12, 48) || 12, 48);
    const suffix = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const [count] = await this.db.query(
      'SELECT COUNT(*) total FROM (' + selection + suffix + ') matched',
      params,
    );
    const rows = await this.db.query(
      selection + suffix + ` ORDER BY ${sort} LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    const items = await Promise.all(rows.map((r) => this.hydrate(r, u)));
    return {
      items,
      total: Number(count.total),
      page,
      pages: Math.ceil(Number(count.total) / limit),
    };
  }
  async get(identifier: string, u?: Actor) {
    const [row] = await this.db.query(
      selection + ' WHERE (p.id=? OR p.slug=?)',
      [text(identifier, 220), text(identifier, 220)],
    );
    if (!row) throw new NotFoundException('Propiedad no encontrada.');
    if (u) ownership(u, row.advertiser_id);
    else {
      const [a] = await this.db.query(
        'SELECT status FROM advertisers WHERE id=?',
        [row.advertiser_id],
      );
      if (row.publication_status !== 'published' || a.status !== 'approved')
        throw new NotFoundException('La publicación no está disponible.');
    }
    return this.hydrate(row, u);
  }
  private async hydrate(row: any, u?: Actor) {
    const result: any = u
      ? { ...row }
      : Object.fromEntries(publicFields.map((k) => [k, row[k]]));
    result.advertiser = {
      id: row.advertiser_id,
      name: row.display_name,
      slug: row.advertiser_slug,
      phone: row.phone,
      whatsapp: row.whatsapp,
      email: row.public_email,
    };
    result.amenities = await this.db.query(
      'SELECT a.id,a.name FROM amenities a JOIN property_amenities pa ON pa.amenity_id=a.id WHERE pa.property_id=?',
      [row.id],
    );
    const media = await this.db.query(
      'SELECT pm.media_id id,pm.alt_text,pm.sort_order,m.name FROM property_media pm JOIN estate_media m ON m.id=pm.media_id WHERE pm.property_id=? ORDER BY pm.sort_order,pm.media_id',
      [row.id],
    );
    result.media = media.map((m) => ({ ...m, url: this.mediaUrl(m.id, u) }));
    if (u || row.show_exact_address) {
      const [location] = await this.db.query(
        'SELECT address,latitude,longitude FROM property_private_locations WHERE property_id=?',
        [row.id],
      );
      result.location = location || {};
    } else result.location = null;
    return result;
  }
  private publisher(u: Actor) {
    if (!u.advertiser_id)
      throw new BadRequestException(
        'Completa tu perfil de anunciante antes de publicar.',
      );
    if (u.advertiser_status === 'suspended')
      throw new ForbiddenException('Tu cuenta de anunciante está suspendida.');
    return u.advertiser_id;
  }
  async saveProperty(u: Actor, b: any, id?: string) {
    const advertiserId = id
      ? undefined
      : isAdmin(u) && b.advertiser_id
        ? uuid(b.advertiser_id)
        : this.publisher(u);
    return this.db.transaction(async (manager) => {
      let row: any;
      if (id) {
        [row] = await manager.query(
          'SELECT * FROM properties WHERE id=? FOR UPDATE',
          [uuid(id)],
        );
        if (!row) throw new NotFoundException();
        ownership(u, row.advertiser_id);
        if (!isAdmin(u) && u.advertiser_status === 'suspended')
          throw new ForbiddenException();
      }
      if (row) {
        if (b.revision !== undefined && Number(b.revision) !== row.revision)
          throw new ConflictException(
            'La publicación cambió. Recarga antes de guardar para no sobrescribir otra edición.',
          );
        const [location] = await manager.query(
          'SELECT address,latitude,longitude FROM property_private_locations WHERE property_id=?',
          [id],
        );
        const savedMedia =
          b.media_ids === undefined
            ? (
                await manager.query(
                  'SELECT media_id FROM property_media WHERE property_id=? ORDER BY sort_order',
                  [id],
                )
              ).map((m) => m.media_id)
            : b.media_ids;
        const savedAmenities =
          b.amenity_ids === undefined
            ? (
                await manager.query(
                  'SELECT amenity_id FROM property_amenities WHERE property_id=?',
                  [id],
                )
              ).map((a) => a.amenity_id)
            : b.amenity_ids;
        b = {
          ...row,
          ...(location || {}),
          ...b,
          media_ids: savedMedia,
          amenity_ids: savedAmenities,
        };
      }
      const typeId = text(b.type_id, 30) || 'house';
      const [propertyType] = await manager.query(
        'SELECT id FROM property_types WHERE id=? AND active=1',
        [typeId],
      );
      if (!propertyType)
        throw new BadRequestException('Tipo de propiedad no disponible.');
      if (!id) {
        const [a] = await manager.query(
          'SELECT id FROM advertisers WHERE id=?',
          [advertiserId],
        );
        if (!a) throw new BadRequestException('Anunciante inexistente.');
      }
      const data: any = {
        title: text(b.title, 180),
        summary: text(b.summary, 400) || null,
        description: text(b.description, 30000),
        type_id: typeId,
        operation_type: 'sale',
        price_unit: choice(b.price_unit, ['CLP', 'UF'], 'CLP'),
        region_id: integer(b.region_id, 999),
        commune_id: integer(b.commune_id, 99999),
        neighborhood: text(b.neighborhood, 120) || null,
        show_exact_address:
          b.show_exact_address === true || b.show_exact_address === 1 ? 1 : 0,
        condition_type: choice(
          b.condition_type,
          ['new', 'used', 'renovated', 'project', 'unknown'],
          'unknown',
        ),
        expense_unit: choice(b.expense_unit, ['CLP', 'UF'], 'CLP'),
        contributions_period: choice(
          b.contributions_period,
          ['monthly', 'quarterly', 'yearly'],
          'quarterly',
        ),
      };
      for (const f of decimalFields) data[f] = decimal(b[f], f);
      for (const f of numericFields) {
        if (
          f === 'floor_number' &&
          b[f] !== '' &&
          b[f] !== null &&
          b[f] !== undefined
        ) {
          if (
            !/^-?\d+$/.test(String(b[f])) ||
            Number(b[f]) < -20 ||
            Number(b[f]) > 200
          )
            throw new BadRequestException('Piso de la unidad fuera de rango.');
          data[f] = Number(b[f]);
        } else
          data[f] = integer(
            b[f],
            f === 'construction_year' ? new Date().getUTCFullYear() + 10 : 1000,
          );
      }
      if (
        data.price_unit === 'CLP' &&
        data.price_amount &&
        /\.[0-9]*[1-9]/.test(data.price_amount)
      )
        throw new BadRequestException(
          'El precio en CLP debe expresarse en pesos enteros.',
        );
      if (data.construction_year !== null && data.construction_year < 1800)
        throw new BadRequestException('Año de construcción inválido.');
      if (data.commune_id) {
        const [commune] = await manager.query(
          'SELECT id FROM estate_communes WHERE id=? AND region_id=?',
          [data.commune_id, data.region_id],
        );
        if (!commune)
          throw new BadRequestException(
            'Selecciona una comuna perteneciente a la región.',
          );
      }
      if (['plot', 'land'].includes(data.type_id)) {
        for (const f of [
          'bedrooms',
          'bathrooms',
          'floors',
          'floor_number',
          'built_area',
          'usable_area',
        ])
          data[f] = null;
      }
      if (!row) {
        id = randomUUID();
        const code = 'P-' + id.slice(0, 8).toUpperCase();
        await manager.query(
          'INSERT INTO properties(id,advertiser_id,created_by,code,slug,title,description) VALUES (?,?,?,?,?,?,?)',
          [
            id,
            advertiserId,
            u.id,
            code,
            `${slugify(data.title).slice(0, 150) || 'propiedad'}-${id.slice(0, 8)}`,
            data.title,
            data.description,
          ],
        );
        row = { publication_status: 'draft' };
      }
      const next = ['published', 'pending_review'].includes(
        row.publication_status,
      )
        ? 'pending_review'
        : row.publication_status;
      await manager.query(
        `UPDATE properties SET ${Object.keys(data)
          .map((k) => `${k}=?`)
          .join(
            ',',
          )},publication_status=?,revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?`,
        [...Object.values(data), next, id],
      );
      const address = text(b.address ?? b.location?.address, 255) || null;
      let lat: any = null,
        lng: any = null;
      if (
        b.latitude !== '' &&
        b.latitude !== null &&
        b.latitude !== undefined
      ) {
        if (
          b.longitude === '' ||
          b.longitude === null ||
          b.longitude === undefined
        )
          throw new BadRequestException(
            'Completa ambas coordenadas o deja ambas vacías.',
          );
        lat = Number(b.latitude);
        lng = Number(b.longitude);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180
        )
          throw new BadRequestException('Coordenadas inválidas.');
      }
      await manager.query(
        'INSERT INTO property_private_locations(property_id,address,latitude,longitude) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE address=VALUES(address),latitude=VALUES(latitude),longitude=VALUES(longitude)',
        [id, address, lat, lng],
      );
      const amenities = Array.isArray(b.amenity_ids)
        ? [...new Set(b.amenity_ids.map((v) => text(v, 40)))].slice(0, 30)
        : [];
      for (const aid of amenities) {
        const [a] = await manager.query(
          'SELECT id FROM amenities WHERE id=? AND active=1',
          [aid],
        );
        if (!a) throw new BadRequestException('Característica inválida.');
      }
      await manager.query(
        'DELETE FROM property_amenities WHERE property_id=?',
        [id],
      );
      for (const aid of amenities)
        await manager.query(
          'INSERT INTO property_amenities(property_id,amenity_id) VALUES (?,?)',
          [id, aid],
        );
      const images = Array.isArray(b.media_ids)
        ? [...new Set(b.media_ids.map((v) => uuid(v)))]
        : [];
      if (images.length > 20)
        throw new BadRequestException('Máximo 20 fotografías.');
      for (const mid of images) {
        const [m] = await manager.query(
          'SELECT owner_id FROM estate_media WHERE id=?',
          [mid],
        );
        if (!m || (!isAdmin(u) && m.owner_id !== u.id))
          throw new ForbiddenException('Imagen ajena o inexistente.');
      }
      await manager.query('DELETE FROM property_media WHERE property_id=?', [
        id,
      ]);
      for (let i = 0; i < images.length; i++)
        await manager.query(
          'INSERT INTO property_media(property_id,media_id,sort_order,alt_text) VALUES (?,?,?,?)',
          [id, images[i], i, data.title || 'Fotografía de la propiedad'],
        );
      if (next !== row.publication_status)
        await this.history(
          manager,
          id!,
          u.id,
          row.publication_status,
          next,
          'Edición enviada nuevamente a revisión.',
        );
      return { id };
    });
  }
  private history(
    m: EntityManager,
    id: string,
    actor: string,
    previous: string,
    next: string,
    note: string,
  ) {
    return m.query(
      'INSERT INTO property_status_history(id,property_id,actor_id,previous_status,next_status,note) VALUES (?,?,?,?,?,?)',
      [randomUUID(), id, actor, previous, next, note || null],
    );
  }
  async setStatus(u: Actor, id: string, b: any) {
    return this.db.transaction(async (m) => {
      const [p] = await m.query(
        'SELECT p.*,a.status advertiser_status FROM properties p JOIN advertisers a ON a.id=p.advertiser_id WHERE p.id=? FOR UPDATE',
        [uuid(id)],
      );
      if (!p) throw new NotFoundException();
      ownership(u, p.advertiser_id);
      if (b.revision !== undefined && Number(b.revision) !== p.revision)
        throw new ConflictException(
          'La publicación cambió. Recarga la lista antes de revisarla.',
        );
      if (!isAdmin(u) && u.advertiser_status === 'suspended')
        throw new ForbiddenException();
      const next = choice(b.status, [
        'draft',
        'pending_review',
        'published',
        'paused',
        'rejected',
        'archived',
      ]);
      transition(p.publication_status, next, u);
      if (['pending_review', 'published'].includes(next)) {
        const [media] = await m.query(
          'SELECT COUNT(*) n FROM property_media WHERE property_id=?',
          [id],
        );
        if (
          p.title.length < 8 ||
          p.description.length < 40 ||
          !p.price_amount ||
          !p.commune_id ||
          !Number(media.n)
        )
          throw new BadRequestException(
            'Completa título (8 caracteres), descripción (40), precio, ubicación y al menos una imagen.',
          );
        if (
          ['house', 'apartment'].includes(p.type_id) &&
          (!p.built_area || p.bedrooms === null || p.bathrooms === null)
        )
          throw new BadRequestException(
            'Completa superficie construida, dormitorios y baños.',
          );
        if (['plot', 'land', 'house'].includes(p.type_id) && !p.land_area)
          throw new BadRequestException('Completa la superficie del terreno.');
        if (p.show_exact_address) {
          const [loc] = await m.query(
            'SELECT address FROM property_private_locations WHERE property_id=?',
            [id],
          );
          if (!loc?.address)
            throw new BadRequestException(
              'Completa la dirección que deseas mostrar.',
            );
        }
        if (next === 'published' && p.advertiser_status !== 'approved')
          throw new BadRequestException('Aprueba primero al anunciante.');
      }
      const reason = text(b.reason, 1000);
      if (next === 'rejected' && !reason)
        throw new BadRequestException('Indica el motivo de rechazo.');
      await m.query(
        "UPDATE properties SET publication_status=?,moderation_reason=?,reviewed_by=?,published_at=IF(?='published',COALESCE(published_at,UTC_TIMESTAMP()),published_at),revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?",
        [next, reason || null, isAdmin(u) ? u.id : null, next, id],
      );
      await this.history(m, id, u.id, p.publication_status, next, reason);
      return { success: true };
    });
  }
  async availability(u: Actor, id: string, b: any) {
    const p = await this.get(id, u);
    const state = choice(b.availability, ['available', 'reserved', 'sold']);
    await this.db.query(
      'UPDATE properties SET availability=?,updated_at=UTC_TIMESTAMP() WHERE id=?',
      [state, p.id],
    );
    await this.history(
      this.db.manager,
      p.id,
      u.id,
      p.availability,
      state,
      'Cambio de disponibilidad',
    );
    return { success: true };
  }
  async feature(u: Actor, id: string, b: any) {
    admin(u);
    await this.db.query('UPDATE properties SET featured=? WHERE id=?', [
      b.featured === true ? 1 : 0,
      uuid(id),
    ]);
    return { success: true };
  }
  async historyFor(u: Actor, id: string) {
    await this.get(id, u);
    return this.db.query(
      'SELECT previous_status,next_status,note,created_at FROM property_status_history WHERE property_id=? ORDER BY created_at DESC',
      [id],
    );
  }
  async view(id: string) {
    await this.get(id);
    await this.db.query(
      'UPDATE properties SET view_count=view_count+1 WHERE id=?',
      [id],
    );
    return { success: true };
  }
  mediaUrl(id: string, u?: Actor) {
    return `/api/media/${id}${u ? '?signature=' + encodeURIComponent(this.jwt.sign({ mid: id, owner: u.id, aud: 'estate-media' }, { expiresIn: '1h' })) : ''}`;
  }
  async upload(u: Actor, file: any) {
    if (!file?.buffer || file.size > 8 * 1024 * 1024)
      throw new BadRequestException('Sube JPG, PNG o WebP de hasta 8 MB.');
    const [usage] = await this.db.query(
      'SELECT COUNT(*) n,COALESCE(SUM(size_bytes),0) bytes FROM estate_media WHERE owner_id=?',
      [u.id],
    );
    if (Number(usage.n) >= 200 || Number(usage.bytes) > 150 * 1024 * 1024)
      throw new BadRequestException(
        'Biblioteca llena. Elimina imágenes sin usar.',
      );
    let buffer: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 40000000 });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || ''))
        throw new Error();
      buffer = await image
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('La imagen no es válida.');
    }
    if (buffer.length > 2 * 1024 * 1024)
      throw new BadRequestException('La imagen procesada supera 2 MB.');
    const id = randomUUID(),
      name = text(file.originalname, 180) || 'Fotografía';
    await this.db.query(
      'INSERT INTO estate_media(id,owner_id,name,content,size_bytes) VALUES (?,?,?,?,?)',
      [id, u.id, name, buffer, buffer.length],
    );
    return { id, name, url: this.mediaUrl(id, u) };
  }
  async library(u: Actor) {
    const rows = await this.db.query(
      'SELECT id,name,size_bytes,created_at FROM estate_media WHERE owner_id=? ORDER BY created_at DESC',
      [u.id],
    );
    return rows.map((m) => ({ ...m, url: this.mediaUrl(m.id, u) }));
  }
  async media(id: string, signature?: string) {
    const [m] = await this.db.query('SELECT * FROM estate_media WHERE id=?', [
      uuid(id),
    ]);
    if (!m) throw new NotFoundException();
    const [pub] = await this.db.query(
      "SELECT 1 FROM property_media pm JOIN properties p ON p.id=pm.property_id JOIN advertisers a ON a.id=p.advertiser_id JOIN users u ON u.id=a.user_id WHERE pm.media_id=? AND p.publication_status='published' AND a.status='approved' AND u.isActive=1 LIMIT 1",
      [id],
    );
    const [logo] = await this.db.query(
      "SELECT 1 FROM advertisers a JOIN users u ON u.id=a.user_id WHERE a.logo_media_id=? AND a.status='approved' AND u.isActive=1 LIMIT 1",
      [id],
    );
    const site = await this.settings();
    const siteImage =
      site.design.logo_media_id === id || site.design.hero_media_id === id;
    if (!pub && !logo && !siteImage) {
      let payload: any;
      try {
        payload = await this.jwt.verifyAsync(signature || '', {
          audience: 'estate-media',
        });
      } catch {
        throw new NotFoundException();
      }
      const actor = await this.actor(payload.owner);
      if (payload.mid !== id || (!isAdmin(actor) && m.owner_id !== actor.id))
        throw new NotFoundException();
    }
    return { ...m, public: !!pub || !!logo || siteImage };
  }
  async removeMedia(u: Actor, id: string) {
    uuid(id);
    await this.db.transaction(async (tx) => {
      // Same lock order as saveDesign: prevent deletion while an image is published.
      const [settings] = await tx.query(
        'SELECT * FROM estate_settings WHERE id=1 FOR UPDATE',
      );
      const [m] = await tx.query(
        'SELECT owner_id FROM estate_media WHERE id=? FOR UPDATE',
        [id],
      );
      if (!m || (!isAdmin(u) && m.owner_id !== u.id))
        throw new ForbiddenException();
      const [used] = await tx.query(
        'SELECT (SELECT COUNT(*) FROM property_media WHERE media_id=?)+(SELECT COUNT(*) FROM advertisers WHERE logo_media_id=?) n',
        [id, id],
      );
      const design = readDesign(settings?.design_json);
      if (
        Number(used.n) ||
        design.logo_media_id === id ||
        design.hero_media_id === id
      )
        throw new ConflictException('La imagen está en uso.');
      await tx.query('DELETE FROM estate_media WHERE id=?', [id]);
    });
    return { success: true };
  }
  async favorite(u: Actor, id: string, remove = false) {
    if (remove)
      await this.db.query(
        'DELETE FROM property_favorites WHERE user_id=? AND property_id=?',
        [u.id, uuid(id)],
      );
    else {
      await this.get(id);
      await this.db.query(
        'INSERT IGNORE INTO property_favorites(user_id,property_id) VALUES (?,?)',
        [u.id, uuid(id)],
      );
    }
    return { success: true };
  }
  async favorites(u: Actor) {
    const rows = await this.db.query(
      selection +
        " JOIN property_favorites f ON f.property_id=p.id WHERE f.user_id=? AND p.publication_status='published' AND a.status='approved' ORDER BY f.created_at DESC",
      [u.id],
    );
    return Promise.all(rows.map((r) => this.hydrate(r)));
  }
  async inquiry(id: string, b: any, ip: string) {
    this.throttle(`inquiry:${ip}`, 5, 600000);
    if (b.website) return { success: true };
    const p = await this.get(id);
    if (p.availability === 'sold')
      throw new BadRequestException('Esta propiedad ya fue vendida.');
    const name = text(b.name, 120),
      message = text(b.message, 5000),
      address = email(b.email);
    if (name.length < 2 || message.length < 10 || b.consent !== true)
      throw new BadRequestException(
        'Completa nombre, consulta y consentimiento de contacto.',
      );
    const inquiryId = randomUUID();
    let requested: string | undefined;
    if (b.requested_at) {
      const date = new Date(b.requested_at);
      if (
        !Number.isFinite(date.getTime()) ||
        date.getTime() < Date.now() + 3600000 ||
        date.getTime() > Date.now() + 180 * 86400000
      )
        throw new BadRequestException(
          'Solicita una visita entre una hora y 180 días desde hoy.',
        );
      requested = date.toISOString().slice(0, 19).replace('T', ' ');
    }
    await this.db.transaction(async (m) => {
      await m.query(
        'INSERT INTO property_inquiries(id,property_id,name,email,phone,message,consent_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())',
        [inquiryId, p.id, name, address, text(b.phone, 40) || null, message],
      );
      if (requested)
        await m.query(
          'INSERT INTO property_visit_requests(id,inquiry_id,requested_at) VALUES (?,?,?)',
          [randomUUID(), inquiryId, requested],
        );
    });
    return {
      success: true,
      message: requested
        ? 'Solicitud enviada. El anunciante debe confirmar la visita.'
        : 'Consulta enviada al anunciante.',
    };
  }
  async inquiries(u: Actor) {
    return this.db.query(
      `SELECT i.*,p.title,p.code,p.advertiser_id,v.id visit_id,v.requested_at,v.status visit_status FROM property_inquiries i JOIN properties p ON p.id=i.property_id LEFT JOIN property_visit_requests v ON v.inquiry_id=i.id ${isAdmin(u) ? '' : 'WHERE p.advertiser_id=?'} ORDER BY i.created_at DESC LIMIT 200`,
      isAdmin(u) ? [] : [u.advertiser_id || ''],
    );
  }
  private async ownInquiry(u: Actor, id: string) {
    const [i] = await this.db.query(
      'SELECT i.*,p.advertiser_id FROM property_inquiries i JOIN properties p ON p.id=i.property_id WHERE i.id=?',
      [uuid(id)],
    );
    if (!i) throw new NotFoundException();
    ownership(u, i.advertiser_id);
    return i;
  }
  async inquiryMessages(u: Actor, id: string) {
    await this.ownInquiry(u, id);
    return this.db.query(
      'SELECT message,created_at,author_id FROM property_inquiry_messages WHERE inquiry_id=? ORDER BY created_at',
      [id],
    );
  }
  async updateInquiry(u: Actor, id: string, b: any) {
    await this.ownInquiry(u, id);
    if (b.status)
      await this.db.query('UPDATE property_inquiries SET status=? WHERE id=?', [
        choice(b.status, ['new', 'contacted', 'closed']),
        id,
      ]);
    if (text(b.message, 5000))
      await this.db.query(
        'INSERT INTO property_inquiry_messages(id,inquiry_id,author_id,message) VALUES (?,?,?,?)',
        [randomUUID(), id, u.id, text(b.message, 5000)],
      );
    if (b.visit_status)
      await this.db.query(
        'UPDATE property_visit_requests SET status=?,note=? WHERE inquiry_id=?',
        [
          choice(b.visit_status, [
            'requested',
            'confirmed',
            'cancelled',
            'completed',
          ]),
          text(b.note, 1000) || null,
          id,
        ],
      );
    return { success: true };
  }
  async stats(u: Actor) {
    const clause = isAdmin(u) ? '' : ' WHERE advertiser_id=?',
      params = isAdmin(u) ? [] : [u.advertiser_id || ''];
    const [row] = await this.db.query(
      `SELECT COUNT(*) total,COALESCE(SUM(publication_status='published'),0) published,COALESCE(SUM(publication_status='pending_review'),0) pending,COALESCE(SUM(view_count),0) views,COALESCE(SUM(availability='sold'),0) sold FROM properties${clause}`,
      params,
    );
    const [leads] = await this.db.query(
      'SELECT COUNT(*) total FROM property_inquiries i JOIN properties p ON p.id=i.property_id' +
        (isAdmin(u) ? '' : ' WHERE p.advertiser_id=?'),
      params,
    );
    return { ...row, inquiries: leads.total };
  }
  async users(u: Actor) {
    admin(u);
    return this.db.query(
      'SELECT id,email,firstName,lastName,role,isActive,createdAt FROM users ORDER BY createdAt DESC LIMIT 500',
    );
  }
  async updateUser(u: Actor, id: string, b: any) {
    admin(u);
    if (id === u.id)
      throw new BadRequestException(
        'No puedes suspender ni cambiar tu propio rol desde aquí.',
      );
    const role = choice(b.role, ['admin', 'vendor', 'customer']);
    await this.db.query('UPDATE users SET role=?,isActive=? WHERE id=?', [
      role,
      b.isActive === false || b.isActive === 0 ? 0 : 1,
      uuid(id),
    ]);
    return { success: true };
  }
}
