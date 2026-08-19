function publicPayload(payload) {
  if (typeof payload === "string") return payload;
  const sanitized = { ...payload };
  delete sanitized.flags;
  delete sanitized.ephemeral;
  delete sanitized.fetchReply;
  return sanitized;
}

export class PrefixMessageInteraction {
  constructor(message, { commandName, options }) {
    this.originalMessage = message;
    this.id = message.id;
    this.commandName = commandName;
    this.options = options;
    this.user = message.author;
    this.member = message.member;
    this.client = message.client;
    this.guild = message.guild;
    this.guildId = message.guildId;
    this.channel = message.channel;
    this.channelId = message.channelId;
    this.deferred = false;
    this.replied = false;
    this.replyMessage = null;
    this.isPrefixCommand = true;
  }

  isButton() {
    return false;
  }

  async deferReply() {
    this.deferred = true;
  }

  async reply(payload) {
    if (this.replyMessage) return this.followUp(payload);
    this.replyMessage = await this.originalMessage.reply(publicPayload(payload));
    this.replied = true;
    return this.replyMessage;
  }

  async editReply(payload) {
    if (!this.replyMessage) {
      this.replyMessage = await this.originalMessage.reply(publicPayload(payload));
      this.replied = true;
      return this.replyMessage;
    }
    this.replyMessage = await this.replyMessage.edit(publicPayload(payload));
    return this.replyMessage;
  }

  async followUp(payload) {
    return this.channel.send(publicPayload(payload));
  }

  async fetchReply() {
    return this.replyMessage;
  }
}
