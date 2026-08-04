export class RewardError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RewardError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
