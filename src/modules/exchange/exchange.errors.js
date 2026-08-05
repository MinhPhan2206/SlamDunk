export class ExchangeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExchangeError";
    this.code = code;
  }
}
