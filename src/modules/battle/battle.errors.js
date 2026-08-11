export class BattleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BattleError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
