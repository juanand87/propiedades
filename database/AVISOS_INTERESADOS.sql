-- Después de INTERESADOS_EQUIPO.sql. Repetible; no genera avisos históricos.
CREATE TABLE IF NOT EXISTS estate_inquiry_notices (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 event_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 inquiry_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 expanded TINYINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY assignment_event(event_id), INDEX latest_inquiry_notice(inquiry_id,id),
 INDEX pending_inquiry_notices(expanded,id),
 FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_inquiry_push (
 notice_id BIGINT UNSIGNED NOT NULL,
 token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 status ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(notice_id,token), INDEX inquiry_push_due(status,due_at),
 FOREIGN KEY(notice_id) REFERENCES estate_inquiry_notices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
