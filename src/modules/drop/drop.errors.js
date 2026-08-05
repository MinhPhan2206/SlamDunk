export class DropError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DropError";
    this.code = code;
    this.details = Object.freeze(details);
  }
}
