export class TraitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TraitError";
    this.code = code;
  }
}
