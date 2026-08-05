export class PackError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PackError";
    this.code = code;
  }
}
