export class QuicksellError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QuicksellError";
    this.code = code;
  }
}
