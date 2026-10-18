/**
 * An expected, user-facing failure (bad input, invalid state transition).
 * The web app shows `message` to the user; anything else is treated as a bug.
 */
export class DomainError extends Error {
  override readonly name = "DomainError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
