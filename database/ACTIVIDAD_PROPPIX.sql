-- Historial de comentarios y respuestas. Repetible; no borra datos.
CREATE TABLE IF NOT EXISTS estate_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  comment_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  kind VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at DATETIME(3) NULL,
  UNIQUE KEY activity_recipient_comment(user_id,comment_id),
  INDEX activity_user_page(user_id,id),
  INDEX activity_user_unread(user_id,read_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Importar comentarios anteriores como leídos. Una respuesta al dueño recibe
-- un solo aviso, de tipo respuesta. No depende de tokens ni de Firebase.
INSERT IGNORE INTO estate_activity(user_id,comment_id,kind,created_at,read_at)
SELECT recipient_id,comment_id,MAX(kind),MAX(created_at),UTC_TIMESTAMP(3)
FROM (
  SELECT v.created_by recipient_id,c.id comment_id,'comment' kind,c.created_at
  FROM estate_video_comments c JOIN property_videos v ON v.id=c.video_id
  UNION ALL
  SELECT parent.user_id recipient_id,c.id comment_id,'reply' kind,c.created_at
  FROM estate_video_comment_replies r
  JOIN estate_video_comments c ON c.id=r.comment_id
  JOIN estate_video_comments parent ON parent.id=r.parent_id
) history
GROUP BY recipient_id,comment_id
ORDER BY MAX(created_at),comment_id;
