-- Ejecutar en propiedades antes del despliegue. Repetible.
-- No publica ni cambia videos existentes.
CREATE TABLE IF NOT EXISTS estate_property_video_publication (
  video_id VARCHAR(36) NOT NULL PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  requested_by VARCHAR(36) NOT NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY property_video_publication_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
