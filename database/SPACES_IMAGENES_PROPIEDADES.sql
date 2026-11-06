-- Run only against the Propiedades schema. No production application is automatic.
-- Existing image blobs remain readable; new Spaces images use an empty content blob
-- plus this private reference. No alteration of the existing media table is needed.
USE propiedades;
CREATE TABLE IF NOT EXISTS estate_media_objects (
 media_id varchar(36) PRIMARY KEY,
 object_key varchar(200) NOT NULL UNIQUE,
 bucket varchar(63) NOT NULL,
 size_bytes int unsigned NOT NULL,
 sha256 char(64) NOT NULL,
 status enum('uploading','ready','pending_delete') NOT NULL DEFAULT 'uploading',
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_media_objects_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- No FK: pending_delete retains cleanup references after removing unused media.
