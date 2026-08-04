export class TradeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TradeError";
    this.code = code;
  }
}
