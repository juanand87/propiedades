-- Apply only to the Propiedades schema with its exclusive user. Back up before DDL.
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

CREATE TABLE IF NOT EXISTS property_video_objects (
 video_id varchar(36) PRIMARY KEY, object_key varchar(200) NOT NULL UNIQUE,
 bucket varchar(63) NOT NULL, sha256 char(64) NOT NULL,
 status enum('uploading','ready','pending_delete') NOT NULL DEFAULT 'uploading',
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_video_objects_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- No FK: pending cleanup references survive a failed metadata transaction.
