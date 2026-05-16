export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours
export const AUTH_SESSION_UPDATE_AGE_SECONDS = AUTH_SESSION_MAX_AGE_SECONDS;

type SessionLike = {
  session?: {
    createdAt?: Date | string | number | null;
  } | null;
} | null;

export function isSessionWithinMaxAge(value: SessionLike) {
  const createdAt = value?.session?.createdAt;
  if (!createdAt) return false;

  const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  return Date.now() - createdAtMs < AUTH_SESSION_MAX_AGE_SECONDS * 1000;
}
