export type ReportKind = 'user' | 'video' | 'comment';
// SQL expressions come only from server code; user values remain placeholders.
export const notHidden = (kind: ReportKind, id: string) =>
  `NOT EXISTS(SELECT 1 FROM estate_content_moderation restriction WHERE restriction.target_kind='${kind}' AND restriction.target_id=${id} AND restriction.hidden=1)`;
export const notBlocked = (left: string, right: string) =>
  `NOT EXISTS(SELECT 1 FROM estate_user_blocks blocked WHERE (blocked.blocker_id=${left} AND blocked.blocked_id=${right}) OR (blocked.blocker_id=${right} AND blocked.blocked_id=${left}))`;
