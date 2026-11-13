-- Búsquedas guardadas y alertas. Repetible, sin modificar propiedades existentes.
CREATE TABLE IF NOT EXISTS estate_saved_searches (
 id CHAR(36) NOT NULL PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 name VARCHAR(80) NOT NULL,
 filters_json TEXT NOT NULL,
 filter_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 enabled TINYINT NOT NULL DEFAULT 1,
 starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 checked_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY saved_search_unique(user_id,filter_hash),
 INDEX saved_search_worker(enabled,checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_search_matches (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 search_id CHAR(36) NOT NULL,
 property_id CHAR(36) NOT NULL,
 is_baseline TINYINT NOT NULL DEFAULT 0,
 read_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY search_property_once(search_id,property_id),
 INDEX search_match_page(search_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_search_push_deliveries (
 match_id BIGINT UNSIGNED NOT NULL,
 token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'pending',
 due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(match_id,token),
 INDEX search_push_due(status,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
