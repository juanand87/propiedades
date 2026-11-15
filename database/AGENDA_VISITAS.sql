-- Agenda autenticada. Repetible; conserva las solicitudes antiguas.
CREATE TABLE IF NOT EXISTS estate_visit_bookings (
 id CHAR(36) NOT NULL PRIMARY KEY, legacy_visit_id CHAR(36) NOT NULL UNIQUE,
 property_id CHAR(36) NOT NULL, property_title VARCHAR(180) NOT NULL,
 buyer_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 seller_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 conversation_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL, request_hash CHAR(64) NOT NULL,
 state VARCHAR(20) NOT NULL DEFAULT 'requested', version INT NOT NULL DEFAULT 1,
 starts_at DATETIME NOT NULL, proposer_id CHAR(36) NOT NULL, note VARCHAR(1000) NOT NULL DEFAULT '',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY visit_request_once(buyer_id,request_id), INDEX visit_buyer(buyer_id,updated_at),
 INDEX visit_seller(seller_id,starts_at,state), INDEX visit_property(property_id,buyer_id,state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_visit_events (
 id CHAR(36) NOT NULL PRIMARY KEY, booking_id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL,
 state VARCHAR(20) NOT NULL, version INT NOT NULL, starts_at DATETIME NOT NULL, note VARCHAR(1000) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX visit_history(booking_id,version), INDEX visit_actor(actor_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_visit_message_links (
 message_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, booking_id CHAR(36) NOT NULL, event_id CHAR(36) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_visit_notices (
 id CHAR(36) NOT NULL PRIMARY KEY, booking_id CHAR(36) NOT NULL, version INT NOT NULL,
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 kind VARCHAR(16) NOT NULL, title VARCHAR(80) NOT NULL, due_at DATETIME(3) NOT NULL,
 expanded TINYINT NOT NULL DEFAULT 0, UNIQUE KEY visit_notice_once(booking_id,version,user_id,kind),
 INDEX visit_notice_due(expanded,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_visit_push (
 notice_id CHAR(36) NOT NULL, token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
 due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(notice_id,token),
 INDEX visit_push_due(status,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
