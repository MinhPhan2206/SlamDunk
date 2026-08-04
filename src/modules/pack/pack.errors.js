export class PackError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PackError";
    this.code = code;
    this.details = Object.freeze(details);
  }
}
