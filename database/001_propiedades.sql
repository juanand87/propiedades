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
