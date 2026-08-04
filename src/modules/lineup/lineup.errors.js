export class LineupError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LineupError";
    this.code = code;
  }
}
