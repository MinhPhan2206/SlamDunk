function applicationEmoji(name, id) {
  return Object.freeze({
    name,
    id,
    mention: `<:${name}:${id}>`,
    component: Object.freeze({ name, id }),
  });
}

export const UI_EMOJIS = Object.freeze({
  gold: applicationEmoji("Gold", "1537765021252190228"),
  shard: applicationEmoji("Shard", "1537765197714825216"),
  levelUp: applicationEmoji("LevelUp", "1537765214139850762"),
  alphaContract: applicationEmoji("AlphaContract", "1539991218648514592"),
  allStarContract: applicationEmoji("AllstarContract", "1539991283743850506"),
});
