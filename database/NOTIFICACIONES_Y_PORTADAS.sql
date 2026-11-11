-- Ejecutar en propiedades después de MENSAJES_PROPPIX.sql. Repetible, sin borrar datos.
CREATE TABLE IF NOT EXISTS estate_push_devices (
  token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX push_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_push_deliveries (
  message_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  ticket VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(message_id,token),
  INDEX push_due(status,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS property_video_posters (
  video_id CHAR(36) NOT NULL PRIMARY KEY,
  jpeg MEDIUMBLOB NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
