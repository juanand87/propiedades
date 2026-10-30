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
