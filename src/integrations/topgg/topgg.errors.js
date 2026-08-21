export class TopGgError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TopGgError";
    this.code = code;
  }
}
