USE propiedades;
CREATE TABLE IF NOT EXISTS estate_video_comment_replies (
  comment_id varchar(36) PRIMARY KEY,
  parent_id varchar(36) NOT NULL,
  FOREIGN KEY (comment_id) REFERENCES estate_video_comments(id),
  FOREIGN KEY (parent_id) REFERENCES estate_video_comments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
