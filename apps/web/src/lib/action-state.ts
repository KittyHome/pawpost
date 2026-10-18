/** Result of a Server Action, shaped for `useActionState`. Client-safe. */
export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: T }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

export const idle: ActionState<never> = { status: "idle" };

export function fieldError(state: ActionState<unknown>, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}
