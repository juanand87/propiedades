export type NotificationDestination =
  | { kind: "test" }
  | { kind: "conversation"; conversationId: string }
  | { kind: "property"; propertyId: string; matchId: string }
  | { kind: "video"; videoId: string; commentId: string };

const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

// Only IDs are accepted; a notification cannot supply an arbitrary screen or URL.
export function notificationDestination(
  data: unknown,
): NotificationDestination | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const fields = data as Record<string, unknown>;
  if (fields.test === "true") return { kind: "test" };
  if (
    fields.type === "property_match" &&
    validId(fields.propertyId) &&
    typeof fields.searchMatchId === "string" &&
    /^[1-9][0-9]{0,18}$/.test(fields.searchMatchId)
  )
    return {
      kind: "property",
      propertyId: fields.propertyId,
      matchId: fields.searchMatchId,
    };
  if (validId(fields.videoId) && validId(fields.commentId))
    return {
      kind: "video",
      videoId: fields.videoId,
      commentId: fields.commentId,
    };
  if (validId(fields.conversationId))
    return { kind: "conversation", conversationId: fields.conversationId };
  return null;
}
