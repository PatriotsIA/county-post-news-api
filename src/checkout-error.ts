export class CheckoutError extends Error {
  constructor(readonly statusCode: number, message: string, readonly code?: string) {
    super(message);
  }
}
