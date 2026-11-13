-- HLS privado. Repetible; no cambia ni elimina los MP4 originales.
CREATE TABLE IF NOT EXISTS property_video_hls (
 video_id CHAR(36) NOT NULL PRIMARY KEY,
 status VARCHAR(20) NOT NULL DEFAULT 'pending',
 generation_id CHAR(36) NULL,
 metadata_json MEDIUMTEXT NULL,
 attempts INT NOT NULL DEFAULT 0,
 due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX hls_worker(status,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO property_video_hls(video_id)
SELECT id FROM property_videos WHERE status<>'archived';
