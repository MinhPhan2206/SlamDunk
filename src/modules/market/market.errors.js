export class MarketError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MarketError";
    this.code = code;
  }
}
