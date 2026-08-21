export class LevelRewardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LevelRewardError";
    this.code = code;
  }
}
