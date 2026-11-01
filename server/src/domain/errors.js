// Base classes: app.js maps them to HTTP status codes.
// `name` is the concrete class name, so the API can answer { error: err.name, message: err.message }.
// An error may carry a `code`: a stable word the client can switch on when the status alone
// is not enough (for example the two reasons of a 409). It is sent in the answer.
export class DomainError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = new.target.name;
    if (code !== undefined) this.code = code;
  }
}

export class ValidationError extends DomainError {}    // bad input                        -> 400

export class UnauthorizedError extends DomainError {   // nobody is logged in               -> 401
  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {      // logged in, but not allowed        -> 403
  constructor(message = 'Not allowed') {
    super(message);
  }
}

export class NotFoundError extends DomainError {}      // the thing asked for is not there -> 404
export class ConflictError extends DomainError {}      // not possible in the current state -> 409 (with a code)
export class UnprocessableError extends DomainError {} // a rule of the hut fails          -> 422
