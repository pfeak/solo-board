/**
 * Business exception classes.
 */

export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class NotFoundError extends BusinessError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends BusinessError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends BusinessError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}
