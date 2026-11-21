-- Cola persistente: conserva el original privado durante el procesamiento.
-- Repetible; no modifica videos ni propiedades existentes.
USE propiedades;
CREATE TABLE IF NOT EXISTS estate_video_upload_jobs (
 id CHAR(36) NOT NULL PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 property_id CHAR(36) NULL,
 digest CHAR(64) NOT NULL,
 source_key VARCHAR(512) NULL,
 body_json TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'pending',
 video_id CHAR(36) NULL,
 result_json TEXT NULL,
 error_text VARCHAR(500) NULL,
 attempts INT NOT NULL DEFAULT 0,
 notify_requested TINYINT NOT NULL DEFAULT 0,
 notified_at DATETIME(3) NULL,
 notify_attempts INT NOT NULL DEFAULT 0,
 due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 notify_due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX upload_worker(status,due_at),
 INDEX upload_owner(user_id,created_at),
 INDEX upload_notice(status,notify_requested,notified_at,notify_due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
