export class MarketServiceError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}
