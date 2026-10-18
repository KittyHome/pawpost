/**
 * Marks domain errors with a global symbol rather than relying on `instanceof`:
 * bundlers can load a package more than once (Next.js bundles route handlers and
 * pages separately), and an error created by one copy must still be recognised
 * by the other.
 */
const DOMAIN_ERROR = Symbol.for("pawpost.domain-error");

/**
 * An expected, user-facing failure (bad input, invalid state transition).
 * The web app shows `message` to the user; anything else is treated as a bug.
 */
export class DomainError extends Error {
  override readonly name = "DomainError";
  readonly [DOMAIN_ERROR] = true;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return typeof error === "object" && error !== null && (error as Record<symbol, unknown>)[DOMAIN_ERROR] === true;
}
