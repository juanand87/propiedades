-- Proppix: imágenes privadas en conversaciones. Repetible, conserva mensajes.
USE propiedades;
CREATE TABLE IF NOT EXISTS estate_message_images (
  message_id bigint unsigned NOT NULL PRIMARY KEY,
  media_id varchar(36) NOT NULL,
  UNIQUE KEY message_image_media (media_id),
  CONSTRAINT message_image_message FOREIGN KEY (message_id)
    REFERENCES estate_direct_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
