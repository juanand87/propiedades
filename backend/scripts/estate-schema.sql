-- PROPIEDADES: migration for an empty or partially initialized legacy database.
-- Execute only with the exclusive Propiedades account. No other schema is accessed.
-- MySQL DDL is not transactional. Back up propiedades before applying.
USE `propiedades`;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
 id varchar(36) PRIMARY KEY, email varchar(255) NOT NULL UNIQUE, password varchar(255) NOT NULL,
 firstName varchar(255) NOT NULL, lastName varchar(255) NOT NULL,
 role enum('admin','vendor','customer') NOT NULL DEFAULT 'customer',
 requirePasswordChange tinyint NOT NULL DEFAULT 0, phone varchar(255) NULL, tempPassword varchar(255) NULL,
 createdBy enum('self-registration','checkout-order') NOT NULL DEFAULT 'self-registration',
 isActive tinyint NOT NULL DEFAULT 1, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estate_migrations (version varchar(80) PRIMARY KEY, applied_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS estate_regions (id int PRIMARY KEY, name varchar(120) NOT NULL, code varchar(10) NOT NULL UNIQUE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_communes (id int AUTO_INCREMENT PRIMARY KEY, region_id int NOT NULL, name varchar(120) NOT NULL, UNIQUE KEY uq_estate_commune(region_id,name), FOREIGN KEY(region_id) REFERENCES estate_regions(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_types (id varchar(30) PRIMARY KEY, name varchar(80) NOT NULL, active tinyint NOT NULL DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS amenities (id varchar(40) PRIMARY KEY, name varchar(80) NOT NULL, active tinyint NOT NULL DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO property_types(id,name) VALUES ('house','Casa'),('apartment','Departamento'),('plot','Parcela'),('land','Terreno'),('commercial','Local comercial'),('office','Oficina');
INSERT IGNORE INTO amenities(id,name) VALUES ('garden','Jardín'),('pool','Piscina'),('terrace','Terraza'),('balcony','Balcón'),('barbecue','Quincho'),('elevator','Ascensor'),('security','Seguridad'),('heating','Calefacción'),('laundry','Logia'),('accessibility','Accesibilidad'),('pets','Admite mascotas'),('gated','Condominio'),('water','Agua potable'),('electricity','Electricidad');

CREATE TABLE IF NOT EXISTS advertisers (
 id varchar(36) PRIMARY KEY, user_id varchar(36) NOT NULL UNIQUE, legacy_vendor_id varchar(36) NULL,
 slug varchar(180) NOT NULL UNIQUE, display_name varchar(160) NOT NULL, description text NULL,
 kind enum('owner','broker','agency') NOT NULL DEFAULT 'owner', status enum('pending','approved','suspended') NOT NULL DEFAULT 'pending',
 phone varchar(40) NULL, whatsapp varchar(40) NULL, public_email varchar(255) NULL,
 legal_name varchar(180) NULL, tax_id varchar(30) NULL, logo_media_id varchar(36) NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Identity references are checked by the application; users may have an existing legacy collation.
CREATE TABLE IF NOT EXISTS properties (
 id varchar(36) PRIMARY KEY, advertiser_id varchar(36) NOT NULL, created_by varchar(36) NOT NULL,
 code varchar(20) NOT NULL UNIQUE, slug varchar(220) NOT NULL UNIQUE, title varchar(180) NOT NULL DEFAULT '',
 summary varchar(400) NULL, description text NOT NULL, type_id varchar(30) NOT NULL DEFAULT 'house',
 operation_type varchar(10) NOT NULL DEFAULT 'sale', price_amount decimal(18,4) NULL, price_unit enum('CLP','UF') NOT NULL DEFAULT 'CLP',
 region_id int NULL, commune_id int NULL, neighborhood varchar(120) NULL, show_exact_address tinyint NOT NULL DEFAULT 0,
 built_area decimal(14,4) NULL, usable_area decimal(14,4) NULL, land_area decimal(14,4) NULL,
 bedrooms int NULL, bathrooms int NULL, parking int NULL, storage_rooms int NULL,
 construction_year int NULL, condition_type varchar(30) NULL, floors int NULL, floor_number int NULL,
 common_expenses decimal(18,4) NULL, contributions decimal(18,4) NULL, expense_unit enum('CLP','UF') NOT NULL DEFAULT 'CLP', contributions_period varchar(20) NOT NULL DEFAULT 'quarterly',
 publication_status enum('draft','pending_review','published','paused','rejected','archived') NOT NULL DEFAULT 'draft',
 availability enum('available','reserved','sold') NOT NULL DEFAULT 'available',
 featured tinyint NOT NULL DEFAULT 0, moderation_reason varchar(1000) NULL, reviewed_by varchar(36) NULL,
 published_at datetime NULL, view_count int NOT NULL DEFAULT 0, revision int NOT NULL DEFAULT 1,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(advertiser_id) REFERENCES advertisers(id), FOREIGN KEY(type_id) REFERENCES property_types(id),
 FOREIGN KEY(region_id) REFERENCES estate_regions(id), FOREIGN KEY(commune_id) REFERENCES estate_communes(id),
 KEY ix_property_search(publication_status,availability,price_unit,price_amount), KEY ix_property_location(region_id,commune_id,type_id), KEY ix_property_advertiser(advertiser_id,publication_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_private_locations (
 property_id varchar(36) PRIMARY KEY, address varchar(255) NULL, latitude decimal(10,7) NULL, longitude decimal(10,7) NULL,
 FOREIGN KEY(property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_amenities (
 property_id varchar(36) NOT NULL, amenity_id varchar(40) NOT NULL, PRIMARY KEY(property_id,amenity_id),
 FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(amenity_id) REFERENCES amenities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Optimized, metadata-stripped WebP assets stay durable without an external bucket.
CREATE TABLE IF NOT EXISTS estate_media (
 id varchar(36) PRIMARY KEY, owner_id varchar(36) NOT NULL, name varchar(180) NOT NULL,
 mime varchar(40) NOT NULL DEFAULT 'image/webp', content mediumblob NOT NULL, size_bytes int NOT NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_media_owner(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_media (
 property_id varchar(36) NOT NULL, media_id varchar(36) NOT NULL, sort_order int NOT NULL DEFAULT 0, alt_text varchar(180) NULL,
 PRIMARY KEY(property_id,media_id), FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(media_id) REFERENCES estate_media(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_favorites (
 user_id varchar(36) NOT NULL, property_id varchar(36) NOT NULL, created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,property_id), FOREIGN KEY(property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_inquiries (
 id varchar(36) PRIMARY KEY, property_id varchar(36) NOT NULL, user_id varchar(36) NULL,
 name varchar(120) NOT NULL, email varchar(255) NOT NULL, phone varchar(40) NULL, message text NOT NULL,
 status enum('new','contacted','closed') NOT NULL DEFAULT 'new', consent_at datetime NOT NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(property_id) REFERENCES properties(id), KEY ix_inquiry_property(property_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_inquiry_messages (
 id varchar(36) PRIMARY KEY, inquiry_id varchar(36) NOT NULL, author_id varchar(36) NOT NULL, message text NOT NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_visit_requests (
 id varchar(36) PRIMARY KEY, inquiry_id varchar(36) NOT NULL, requested_at datetime NOT NULL,
 status enum('requested','confirmed','cancelled','completed') NOT NULL DEFAULT 'requested', note varchar(1000) NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_status_history (
 id varchar(36) PRIMARY KEY, property_id varchar(36) NOT NULL, actor_id varchar(36) NOT NULL,
 previous_status varchar(30) NULL, next_status varchar(30) NOT NULL, note varchar(1000) NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_settings (
 id int PRIMARY KEY, site_name varchar(100) NOT NULL DEFAULT 'Propiedades', tagline varchar(200) NOT NULL DEFAULT 'Encuentra tu próximo lugar',
 contact_email varchar(255) NULL, about_text text NULL, homepage_title varchar(180) NOT NULL DEFAULT 'Un nuevo lugar para tu próxima historia.',
 index_enabled tinyint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO estate_settings(id) VALUES (1);
INSERT IGNORE INTO estate_migrations(version) VALUES ('001_real_estate');

-- Geographic catalog from the local project, independent of shipping.
USE `propiedades`;
INSERT IGNORE INTO estate_regions (id, name, code) VALUES
(1, 'Región de Tarapacá', 'I'),
(2, 'Región de Antofagasta', 'II'),
(3, 'Región de Atacama', 'III'),
(4, 'Región de Coquimbo', 'IV'),
(5, 'Región de Valparaíso', 'V'),
(6, 'Región Metropolitana de Santiago', 'RM'),
(7, 'Región del Libertador General Bernardo O\'Higgins', 'VI'),
(8, 'Región del Maule', 'VII'),
(9, 'Región del Ñuble', 'XVI'),
(10, 'Región del Biobío', 'VIII'),
(11, 'Región de La Araucanía', 'IX'),
(12, 'Región de Los Ríos', 'XIV'),
(13, 'Región de Los Lagos', 'X'),
(14, 'Región de Aysén del General Carlos Ibáñez del Campo', 'XI'),
(15, 'Región de Magallanes y de la Antártica Chilena', 'XII'),
(16, 'Región de Arica y Parinacota', 'XV');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(16, 'Arica'),
(16, 'Camarones'),
(16, 'General Lagos'),
(16, 'Putre');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(1, 'Alto Hospicio'),
(1, 'Camiña'),
(1, 'Colchane'),
(1, 'Huara'),
(1, 'Iquique'),
(1, 'Pica'),
(1, 'Pozo Almonte');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(2, 'Antofagasta'),
(2, 'Calama'),
(2, 'María Elena'),
(2, 'Mejillones'),
(2, 'Ollagüe'),
(2, 'San Pedro de Atacama'),
(2, 'Sierra Gorda'),
(2, 'Taltal'),
(2, 'Tocopilla');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(3, 'Alto del Carmen'),
(3, 'Caldera'),
(3, 'Chañaral'),
(3, 'Copiapó'),
(3, 'Diego de Almagro'),
(3, 'Freirina'),
(3, 'Huasco'),
(3, 'Tierra Amarilla'),
(3, 'Vallenar');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(4, 'Andacollo'),
(4, 'Canela'),
(4, 'Combarbalá'),
(4, 'Coquimbo'),
(4, 'Illapel'),
(4, 'La Higuera'),
(4, 'La Serena'),
(4, 'Los Vilos'),
(4, 'Monte Patria'),
(4, 'Ovalle'),
(4, 'Paiguano'),
(4, 'Punitaqui'),
(4, 'Río Hurtado'),
(4, 'Salamanca'),
(4, 'Vicuña');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(5, 'Algarrobo'),
(5, 'Cabildo'),
(5, 'Calera'),
(5, 'Calle Larga'),
(5, 'Cartagena'),
(5, 'Casablanca'),
(5, 'Catemu'),
(5, 'Concón'),
(5, 'El Quisco'),
(5, 'El Tabo'),
(5, 'Hijuelas'),
(5, 'Isla de Pascua'),
(5, 'Juan Fernández'),
(5, 'La Cruz'),
(5, 'La Ligua'),
(5, 'Limache'),
(5, 'Llaillay'),
(5, 'Los Andes'),
(5, 'Nogales'),
(5, 'Olmué'),
(5, 'Panquehue'),
(5, 'Papudo'),
(5, 'Petorca'),
(5, 'Puchuncaví'),
(5, 'Putaendo'),
(5, 'Quillota'),
(5, 'Quilpué'),
(5, 'Quintero'),
(5, 'Rinconada'),
(5, 'San Antonio'),
(5, 'San Esteban'),
(5, 'San Felipe'),
(5, 'Santa María'),
(5, 'Santo Domingo'),
(5, 'Valparaíso'),
(5, 'Villa Alemana'),
(5, 'Viña del Mar'),
(5, 'Zapallar');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(6, 'Alhué'),
(6, 'Buin'),
(6, 'Calera de Tango'),
(6, 'Cerrillos'),
(6, 'Cerro Navia'),
(6, 'Colina'),
(6, 'Conchalí'),
(6, 'Curacaví'),
(6, 'El Bosque'),
(6, 'El Monte'),
(6, 'Estación Central'),
(6, 'Huechuraba'),
(6, 'Independencia'),
(6, 'Isla de Maipo'),
(6, 'La Cisterna'),
(6, 'La Florida'),
(6, 'La Granja'),
(6, 'La Pintana'),
(6, 'La Reina'),
(6, 'Lampa'),
(6, 'Las Condes'),
(6, 'Lo Barnechea'),
(6, 'Lo Espejo'),
(6, 'Lo Prado'),
(6, 'Macul'),
(6, 'Maipú'),
(6, 'María Pinto'),
(6, 'Melipilla'),
(6, 'Ñuñoa'),
(6, 'Padre Hurtado'),
(6, 'Paine'),
(6, 'Pedro Aguirre Cerda'),
(6, 'Peñaflor'),
(6, 'Peñalolén'),
(6, 'Pirque'),
(6, 'Providencia'),
(6, 'Pudahuel'),
(6, 'Puente Alto'),
(6, 'Quilicura'),
(6, 'Quinta Normal'),
(6, 'Recoleta'),
(6, 'Renca'),
(6, 'San Bernardo'),
(6, 'San Joaquín'),
(6, 'San José de Maipo'),
(6, 'San Miguel'),
(6, 'San Pedro'),
(6, 'San Ramón'),
(6, 'Santiago'),
(6, 'Talagante'),
(6, 'Tiltil'),
(6, 'Vitacura');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(7, 'Chépica'),
(7, 'Chimbarongo'),
(7, 'Codegua'),
(7, 'Coinco'),
(7, 'Coltauco'),
(7, 'Doñihue'),
(7, 'Graneros'),
(7, 'La Estrella'),
(7, 'Las Cabras'),
(7, 'Litueche'),
(7, 'Lolol'),
(7, 'Machalí'),
(7, 'Malloa'),
(7, 'Marchihue'),
(7, 'Mostazal'),
(7, 'Nancagua'),
(7, 'Navidad'),
(7, 'Olivar'),
(7, 'Palmilla'),
(7, 'Paredones'),
(7, 'Peralillo'),
(7, 'Peumo'),
(7, 'Pichidegua'),
(7, 'Pichilemu'),
(7, 'Placilla'),
(7, 'Pumanque'),
(7, 'Quinta de Tilcoco'),
(7, 'Rancagua'),
(7, 'Rengo'),
(7, 'Requínoa'),
(7, 'San Fernando'),
(7, 'San Vicente'),
(7, 'Santa Cruz');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(8, 'Cauquenes'),
(8, 'Chanco'),
(8, 'Colbún'),
(8, 'Constitución'),
(8, 'Curepto'),
(8, 'Curicó'),
(8, 'Empedrado'),
(8, 'Hualañé'),
(8, 'Licantén'),
(8, 'Linares'),
(8, 'Longaví'),
(8, 'Maule'),
(8, 'Molina'),
(8, 'Parral'),
(8, 'Pelarco'),
(8, 'Pelluhue'),
(8, 'Pencahue'),
(8, 'Rauco'),
(8, 'Retiro'),
(8, 'Río Claro'),
(8, 'Romeral'),
(8, 'Sagrada Familia'),
(8, 'San Clemente'),
(8, 'San Javier'),
(8, 'San Rafael'),
(8, 'Talca'),
(8, 'Teno'),
(8, 'Vichuquén'),
(8, 'Villa Alegre'),
(8, 'Yerbas Buenas');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(9, 'Bulnes'),
(9, 'Chillán'),
(9, 'Chillán Viejo'),
(9, 'Cobquecura'),
(9, 'Coelemu'),
(9, 'Coihueco'),
(9, 'El Carmen'),
(9, 'Ninhue'),
(9, 'Ñiquén'),
(9, 'Pemuco'),
(9, 'Pinto'),
(9, 'Portezuelo'),
(9, 'Quillón'),
(9, 'Quirihue'),
(9, 'Ránquil'),
(9, 'San Carlos'),
(9, 'San Fabián'),
(9, 'San Ignacio'),
(9, 'San Nicolás'),
(9, 'Treguaco'),
(9, 'Yungay');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(10, 'Alto Biobío'),
(10, 'Antuco'),
(10, 'Arauco'),
(10, 'Cabrero'),
(10, 'Cañete'),
(10, 'Chiguayante'),
(10, 'Concepción'),
(10, 'Contulmo'),
(10, 'Coronel'),
(10, 'Curanilahue'),
(10, 'Florida'),
(10, 'Hualpén'),
(10, 'Hualqui'),
(10, 'Laja'),
(10, 'Lebu'),
(10, 'Los Álamos'),
(10, 'Los Ángeles'),
(10, 'Lota'),
(10, 'Mulchén'),
(10, 'Nacimiento'),
(10, 'Negrete'),
(10, 'Penco'),
(10, 'Quilaco'),
(10, 'Quilleco'),
(10, 'San Pedro de la Paz'),
(10, 'San Rosendo'),
(10, 'Santa Bárbara'),
(10, 'Santa Juana'),
(10, 'Talcahuano'),
(10, 'Tirúa'),
(10, 'Tomé'),
(10, 'Tucapel'),
(10, 'Yumbel');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(11, 'Angol'),
(11, 'Carahue'),
(11, 'Cholchol'),
(11, 'Collipulli'),
(11, 'Cunco'),
(11, 'Curacautín'),
(11, 'Curarrehue'),
(11, 'Ercilla'),
(11, 'Freire'),
(11, 'Galvarino'),
(11, 'Gorbea'),
(11, 'Lautaro'),
(11, 'Loncoche'),
(11, 'Lonquimay'),
(11, 'Los Sauces'),
(11, 'Lumaco'),
(11, 'Melipeuco'),
(11, 'Nueva Imperial'),
(11, 'Padre Las Casas'),
(11, 'Perquenco'),
(11, 'Pitrufquén'),
(11, 'Pucón'),
(11, 'Purén'),
(11, 'Renaico'),
(11, 'Saavedra'),
(11, 'Temuco'),
(11, 'Teodoro Schmidt'),
(11, 'Toltén'),
(11, 'Traiguén'),
(11, 'Victoria'),
(11, 'Vilcún'),
(11, 'Villarrica');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(12, 'Corral'),
(12, 'Futrono'),
(12, 'La Unión'),
(12, 'Lago Ranco'),
(12, 'Lanco'),
(12, 'Los Lagos'),
(12, 'Máfil'),
(12, 'Mariquina'),
(12, 'Paillaco'),
(12, 'Panguipulli'),
(12, 'Río Bueno'),
(12, 'Valdivia');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(13, 'Ancud'),
(13, 'Calbuco'),
(13, 'Castro'),
(13, 'Chaitén'),
(13, 'Chonchi'),
(13, 'Cochamó'),
(13, 'Curaco de Vélez'),
(13, 'Dalcahue'),
(13, 'Fresia'),
(13, 'Frutillar'),
(13, 'Futaleufú'),
(13, 'Hualaihué'),
(13, 'Llanquihue'),
(13, 'Los Muermos'),
(13, 'Maullín'),
(13, 'Osorno'),
(13, 'Palena'),
(13, 'Puerto Montt'),
(13, 'Puerto Octay'),
(13, 'Puerto Varas'),
(13, 'Puqueldón'),
(13, 'Purranque'),
(13, 'Puyehue'),
(13, 'Queilén'),
(13, 'Quellón'),
(13, 'Quemchi'),
(13, 'Quinchao'),
(13, 'Río Negro'),
(13, 'San Juan de la Costa'),
(13, 'San Pablo');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(14, 'Aysén'),
(14, 'Chile Chico'),
(14, 'Cisnes'),
(14, 'Cochrane'),
(14, 'Coyhaique'),
(14, 'Guaitecas'),
(14, 'Lago Verde'),
(14, 'O\'Higgins'),
(14, 'Río Ibáñez'),
(14, 'Tortel');
INSERT IGNORE INTO estate_communes (region_id, name) VALUES
(15, 'Antártica'),
(15, 'Cabo de Hornos'),
(15, 'Laguna Blanca'),
(15, 'Natales'),
(15, 'Porvenir'),
(15, 'Primavera'),
(15, 'Punta Arenas'),
(15, 'Río Verde'),
(15, 'San Gregorio'),
(15, 'Timaukel'),
(15, 'Torres del Paine');
INSERT IGNORE INTO estate_migrations(version) VALUES ('002_locations');

-- Preserve compatible advertiser identities without importing credentials or music.
USE `propiedades`;
SET @has_legacy_vendor = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='propiedades' AND table_name='vendors' AND column_name IN ('id','userId','storeName','slug'));
SET @identity_sql = IF(@has_legacy_vendor=4,
 'INSERT IGNORE INTO advertisers(id,user_id,legacy_vendor_id,slug,display_name,kind,status) SELECT v.id,v.userId,v.id,v.slug,v.storeName,''broker'',''pending'' FROM propiedades.vendors v JOIN propiedades.users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=CONVERT(v.userId USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE v.userId IS NOT NULL',
 'SELECT ''Sin cuentas heredadas que migrar'' AS migration_info');
PREPARE estate_identity FROM @identity_sql;
EXECUTE estate_identity;
DEALLOCATE PREPARE estate_identity;
INSERT IGNORE INTO estate_migrations(version) VALUES ('003_identity');

-- Post-migration verification. These statements never modify records.
SELECT DATABASE() AS target_database;
SELECT version,applied_at FROM estate_migrations ORDER BY version;
SELECT COUNT(*) AS regions FROM estate_regions;
SELECT COUNT(*) AS communes FROM estate_communes;
SELECT COUNT(*) AS preserved_users FROM users;
SELECT COUNT(*) AS properties FROM properties;

-- Configuración visual de Propiedades. Repetible; conserva el diseño y los datos.
USE `propiedades`;
SET @design_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='propiedades' AND table_name='estate_settings' AND column_name='design_json');
SET @design_sql = IF(@design_column=0, 'ALTER TABLE propiedades.estate_settings ADD COLUMN design_json LONGTEXT NULL', 'SELECT ''design_json ya existe'' AS migration_info');
PREPARE estate_design FROM @design_sql;
EXECUTE estate_design;
DEALLOCATE PREPARE estate_design;
SET @revision_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='propiedades' AND table_name='estate_settings' AND column_name='design_revision');
SET @design_sql = IF(@revision_column=0, 'ALTER TABLE propiedades.estate_settings ADD COLUMN design_revision INT NOT NULL DEFAULT 1', 'SELECT ''design_revision ya existe'' AS migration_info');
PREPARE estate_design FROM @design_sql;
EXECUTE estate_design;
DEALLOCATE PREPARE estate_design;
INSERT IGNORE INTO propiedades.estate_migrations(version) VALUES ('004_site_design');
SELECT version,applied_at FROM propiedades.estate_migrations WHERE version='004_site_design';

-- Sitios propios de los anunciantes de Propiedades. No requiere repetir 004.
USE `propiedades`;
CREATE TABLE IF NOT EXISTS advertiser_sites (
 advertiser_id varchar(36) PRIMARY KEY,
 design_json LONGTEXT NOT NULL,
 logo_media_id varchar(36) NULL,
 hero_media_id varchar(36) NULL,
 revision INT NOT NULL DEFAULT 1,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(advertiser_id) REFERENCES advertisers(id),
 FOREIGN KEY(logo_media_id) REFERENCES estate_media(id),
 FOREIGN KEY(hero_media_id) REFERENCES estate_media(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO propiedades.estate_migrations(version) VALUES ('005_advertiser_sites');
SELECT version,applied_at FROM propiedades.estate_migrations WHERE version='005_advertiser_sites';
