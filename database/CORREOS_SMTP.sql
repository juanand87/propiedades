-- Ejecutar en la base propiedades antes de desplegar el backend.
-- Repetible. No modifica las propiedades ni envía correos anteriores.
CREATE TABLE IF NOT EXISTS estate_mail_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  config_json JSON NOT NULL,
  password_encrypted TEXT NULL,
  updated_by VARCHAR(36) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estate_review_mail_outbox (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  property_revision INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  recipients_json JSON NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  lease_id VARCHAR(36) NULL,
  last_error VARCHAR(80) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_at DATETIME(3) NULL,
  UNIQUE KEY review_mail_event (property_id, property_revision),
  KEY review_mail_due (status, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
