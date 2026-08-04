export class UpgradeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "UpgradeError";
    this.code = code;
  }
}
