// Base classes: app.js maps them to HTTP status codes.
// `name` is the concrete class name, so the API can answer { error: err.name, message: err.message }.
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
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
export class ConflictError extends DomainError {}      // not possible in the current state -> 409
export class UnprocessableError extends DomainError {} // a rule of the hut fails          -> 422
