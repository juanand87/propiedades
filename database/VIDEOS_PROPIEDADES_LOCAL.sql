-- Prototype only. The local launcher validates host, port and datadir BEFORE executing this.
-- Never run this file against production during the mobile prototype.
USE propiedades;
CREATE TABLE IF NOT EXISTS property_videos (
  id varchar(36) PRIMARY KEY,
  property_id varchar(36) NOT NULL,
  created_by varchar(36) NOT NULL,
  title varchar(160) NOT NULL,
  size_bytes bigint unsigned NOT NULL,
  status enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (property_id) REFERENCES properties(id),
  KEY ix_property_video_feed(status,created_at,id),
  KEY ix_property_videos(property_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Separate metadata table also upgrades existing local demos without ALTER/DROP.
CREATE TABLE IF NOT EXISTS property_video_recordings (
  video_id varchar(36) PRIMARY KEY,
  duration_ms int unsigned NOT NULL,
  capture_seconds smallint unsigned NULL,
  request_id varchar(36) NULL UNIQUE,
  content_digest char(64) NOT NULL,
  FOREIGN KEY (video_id) REFERENCES property_videos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
