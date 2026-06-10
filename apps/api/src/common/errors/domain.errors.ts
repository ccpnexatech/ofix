/**
 * Domain errors (spec 001): services throw these; the global exception filter
 * maps them to the standard HTTP error shape. `code` carries the RN id.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** RN-01..RN-08 violations on /orders/:id/transitions — mapped to 422. */
export class InvalidTransitionError extends DomainError {}

/** RN-07 violations on warranty reopen — mapped to 422. */
export class WarrantyReopenError extends DomainError {}
