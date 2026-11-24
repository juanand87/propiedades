-- Después de AVISOS_INTERESADOS.sql. Repetible; no crea tareas ni avisos históricos.
CREATE TABLE IF NOT EXISTS estate_inquiry_tasks (
 id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 inquiry_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 kind ENUM('call','send_info','coordinate_visit','other') NOT NULL,
 note VARCHAR(1000) NOT NULL DEFAULT '',
 due_at DATETIME(3) NOT NULL,
 status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 created_by VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 updated_by VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 completed_at DATETIME(3) NULL,
 INDEX inquiry_task_status(inquiry_id,status,due_at), INDEX tasks_due(status,due_at),
 FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_inquiry_task_events (
 id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 task_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 actor_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 action ENUM('created','rescheduled','completed','cancelled') NOT NULL,
 snapshot_json JSON NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX task_history(task_id,created_at),
 FOREIGN KEY(task_id) REFERENCES estate_inquiry_tasks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_inquiry_task_push (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 task_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 task_revision INT UNSIGNED NOT NULL,
 scope_key VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY task_device_version(task_id,task_revision,scope_key,user_id,token),
 INDEX task_push_due(status,due_at),
 FOREIGN KEY(task_id) REFERENCES estate_inquiry_tasks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
