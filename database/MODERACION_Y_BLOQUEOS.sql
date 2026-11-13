-- Ejecutar antes de desplegar moderación. Repetible; no elimina contenido.
CREATE TABLE IF NOT EXISTS estate_user_blocks (
 blocker_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 blocked_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(blocker_id,blocked_id), INDEX blocked_user(blocked_id,blocker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_content_moderation (
 target_kind VARCHAR(12) NOT NULL, target_id CHAR(36) NOT NULL,
 hidden TINYINT NOT NULL DEFAULT 0, moderator_id CHAR(36) NOT NULL,
 note VARCHAR(2000) NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(target_kind,target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_reports (
 id CHAR(36) NOT NULL PRIMARY KEY,
 reporter_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 target_kind VARCHAR(12) NOT NULL, target_id CHAR(36) NOT NULL,
 reason VARCHAR(24) NOT NULL, details VARCHAR(1000) NOT NULL,
 snapshot_json MEDIUMTEXT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'open',
 action VARCHAR(16) NULL, resolution_note VARCHAR(2000) NULL, reviewer_id CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), reviewed_at DATETIME(3) NULL,
 UNIQUE KEY report_once(reporter_id,target_kind,target_id), INDEX report_queue(status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_moderation_actions (
 id CHAR(36) NOT NULL PRIMARY KEY, moderator_id CHAR(36) NOT NULL,
 report_id CHAR(36) NULL, target_kind VARCHAR(12) NOT NULL, target_id CHAR(36) NOT NULL,
 action VARCHAR(16) NOT NULL, note VARCHAR(2000) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX moderation_target(target_kind,target_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
