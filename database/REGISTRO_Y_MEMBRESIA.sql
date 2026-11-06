-- Ejecutar únicamente en propiedades. Repetible; no modifica cuentas existentes.
USE propiedades;
CREATE TABLE IF NOT EXISTS estate_account_profiles (
 user_id varchar(36) NOT NULL PRIMARY KEY,
 account_type enum('buyer','seller') NULL,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_google_identities (
 google_sub varchar(255) NOT NULL PRIMARY KEY,
 user_id varchar(36) NOT NULL UNIQUE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_google_requests (
 id varchar(36) NOT NULL PRIMARY KEY,
 poll_hash char(64) NOT NULL,
 launch_hash char(64) NOT NULL,
 nonce varchar(100) NOT NULL,
 verifier varchar(100) NOT NULL,
 status enum('new','started','processing','complete','failed','consumed') NOT NULL DEFAULT 'new',
 user_id varchar(36) NULL,
 expires_at datetime NOT NULL,
 INDEX idx_google_expiry(expires_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
