-- Ejecutar en propiedades después de NOTIFICACIONES_Y_PORTADAS.sql.
-- Repetible. No modifica ni borra videos, comentarios o mensajes existentes.
CREATE TABLE IF NOT EXISTS estate_video_push_deliveries (
  comment_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind VARCHAR(16) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(comment_id,token),
  INDEX video_push_due(status,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
