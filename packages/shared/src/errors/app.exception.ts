export class AppException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppException';
  }
}
