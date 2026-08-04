export class BattleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BattleError";
    this.code = code;
  }
}
