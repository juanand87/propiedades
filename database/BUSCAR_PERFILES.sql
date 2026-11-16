-- Ejecutar en propiedades. Repetible; no cambia nombres, videos ni seguidores existentes.
CREATE TABLE IF NOT EXISTS estate_profile_identity (
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
 profile_kind ENUM('person','company') NOT NULL,
 username VARCHAR(30) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY profile_username(username), INDEX profile_kind(profile_kind,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
