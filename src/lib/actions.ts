/**
 * Typed envelope for server actions.
 * Every server action should return ActionResult<T>.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T = never>(error: string): ActionResult<T> {
  return { ok: false, error };
}
