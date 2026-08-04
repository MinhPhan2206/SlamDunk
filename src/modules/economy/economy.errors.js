export class EconomyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EconomyError";
    this.code = code;
  }
}
