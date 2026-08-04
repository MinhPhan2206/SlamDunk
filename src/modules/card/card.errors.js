export class CardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CardError";
    this.code = code;
  }
}
