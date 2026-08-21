export class VoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VoteError";
    this.code = code;
  }
}
