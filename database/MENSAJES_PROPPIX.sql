-- Proppix. Ejecutar en la BD propiedades tras PERFILES_Y_VIDEOS_SOCIALES.sql.
-- Repetible. Conserva conversaciones y mensajes existentes.
USE propiedades;

CREATE TABLE IF NOT EXISTS estate_conversations (
  id varchar(36) NOT NULL PRIMARY KEY,
  user_low_id varchar(36) NOT NULL,
  user_high_id varchar(36) NOT NULL,
  low_read_id bigint unsigned NOT NULL DEFAULT 0,
  high_read_id bigint unsigned NOT NULL DEFAULT 0,
  last_message_id bigint unsigned NOT NULL DEFAULT 0,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY conversation_pair (user_low_id,user_high_id),
  KEY inbox_low (user_low_id,updated_at,id),
  KEY inbox_high (user_high_id,updated_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estate_direct_messages (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id varchar(36) NOT NULL,
  sender_id varchar(36) NOT NULL,
  client_id varchar(36) NOT NULL,
  body varchar(4000) NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY message_retry (sender_id,client_id),
  KEY conversation_history (conversation_id,id),
  KEY sender_rate (sender_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
