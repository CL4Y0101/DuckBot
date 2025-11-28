const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const robloxAPI = require('../../utils/roblox/robloxAPI');
const sessionScheduler = require('../../utils/disableButton/sessionScheduler');

const databasePath = path.join(__dirname, '../../database/username.json');

function loadDatabase() {
  if (!fs.existsSync(databasePath)) return [];
  try {
    const content = fs.readFileSync(databasePath, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to load database:', err);
    return [];
  }
}

async function getUsersWithAge() {
  const users = loadDatabase();
  const list = [];

  for (const user of users) {
    if (!user.roblox_uid) continue;
    try {
      const profile = await robloxAPI.getUserProfile(user.roblox_uid);
      if (profile && profile.created) {
        const createdDate = new Date(profile.created);
        list.push({
          ...user,
          createdDate,
          age: Date.now() - createdDate.getTime()
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch ${user.roblox_username}:`, e.message);
    }
  }
  return list;
}

function formatAge(createdDate) {
  const diff = Date.now() - createdDate.getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
  const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));

  let text = years > 0 ? `${years}y ${months}m` : months > 0 ? `${months}m ${days}d` : `${days}d`;
  return `${text} (<t:${Math.floor(createdDate.getTime() / 1000)}:F>)`;
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours} hours ago`;
  if (minutes > 0) return `${minutes} minutes ago`;
  return `${seconds} seconds ago`;
}

function createLeaderboardEmbed(users, page, sort, totalPages, displayMode = 'roblox', guildName = 'Unknown', currentUser = null, lastUpdated = null) {
  const start = (page - 1) * 10;
  const end = start + 10;
  const currentPageUsers = users.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle('`🏆` Roblox Account Age Leaderboard')
    .setColor('#00aaff');

  let desc = `**Sort**: ${sort === 'old' ? 'Oldest' : sort === 'new' ? 'Newest' : 'A–Z'} | **Page**: ${page}/${totalPages}\n-# **Guild**: ${guildName}\n`;

  if (currentUser) {
    const rank = users.findIndex(u => u.userid === currentUser.userid) + 1;
    const percent = ((rank / users.length) * 100).toFixed(1);
    desc += `\n### \`📊\` Your Stats\n-# **User**: @${currentUser.username}\n-# **Rank**: #${rank} *(Top ${percent}%)*\n-# **Created**: ${formatAge(currentUser.createdDate)}\n`;
  }

  desc += `\n### \`🏆\` Rankings\n`;
  for (let i = 0; i < currentPageUsers.length; i++) {
    const user = currentPageUsers[i];
    const rank = start + i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
    const name = displayMode === 'discord' ? user.username : (user.roblox_nickname || user.roblox_username);
    const link = user.roblox_uid ? `[${name}](https://www.roblox.com/users/${user.roblox_uid}/profile)` : name;
    let displayMedalLink = `${medal} ${link}`;
    if (currentUser && user.userid === currentUser.userid) {
      displayMedalLink = `<a:blue_arrow_right:1437420636153577493> ${medal} ${link} <a:blue_arrow_left:1437420744815542293>`;
    }
    desc += `${displayMedalLink}\n-# <:blank:1437120167665729638> ${formatAge(user.createdDate)}\n`;
  }

  if (lastUpdated) {
    desc += `\n-# Last updated: <t:${Math.floor(lastUpdated / 1000)}:R> • Total users in database: ${users.length}`;
  }

  embed.setDescription(desc);
  return embed;
}

function createButtons(page, totalPages, sort, displayMode, originalUserId, disabled = false) {
  const row = new ActionRowBuilder();
  const prev = new ButtonBuilder()
    .setCustomId(`leaderboard_prev_${page}_${sort}_${displayMode}_${originalUserId}`)
    .setLabel('Prev')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled || page <= 1);

  const toggle = new ButtonBuilder()
    .setCustomId(`leaderboard_toggle_${page}_${sort}_${displayMode}_${originalUserId}`)
    .setLabel(displayMode === 'roblox' ? 'Show Discord Names' : 'Show Roblox Names')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const next = new ButtonBuilder()
    .setCustomId(`leaderboard_next_${page}_${sort}_${displayMode}_${originalUserId}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled || page >= totalPages);

  row.addComponents(prev, toggle, next);
  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display Roblox account age leaderboard')
    .addStringOption(o =>
      o.setName('sorting')
        .setDescription('Sort by oldest or newest accounts')
        .addChoices(
          { name: 'Oldest Accounts', value: 'old' },
          { name: 'Newest Accounts', value: 'new' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const db = loadDatabase();
    const currentUser = db.find(u => u.userid === interaction.user.id);

    if (!currentUser) {
      const embed = new EmbedBuilder()
        .setTitle('🔍 Verification Required')
        .setDescription('You must verify your Roblox account first!')
        .setColor('#ff5555');
      return await interaction.editReply({ embeds: [embed] });
    }

    const sort = interaction.options.getString('sorting') || 'alphabetical';
    const users = await getUsersWithAge();

    if (!users.length)
      return await interaction.editReply('No valid users found.');

    if (sort === 'old') users.sort((a, b) => a.createdDate - b.createdDate);
    else if (sort === 'new') users.sort((a, b) => b.createdDate - a.createdDate);
    else users.sort((a, b) => (a.roblox_nickname || a.roblox_username).localeCompare(b.roblox_nickname || b.roblox_username));

    const totalPages = Math.ceil(users.length / 10);
    const page = 1;
    const guildName = interaction.guild ? interaction.guild.name : 'Unknown';
    const currentUserWithAge = users.find(u => u.userid === currentUser.userid);

    const embed = createLeaderboardEmbed(users, page, sort, totalPages, 'roblox', guildName, currentUserWithAge, Date.now());
    const buttons = createButtons(page, totalPages, sort, 'roblox', interaction.user.id);

    await interaction.editReply({ embeds: [embed], components: [buttons] });

    const sent = await interaction.fetchReply();
    sessionScheduler.schedule({
      key: sent.id,
      channelId: sent.channelId,
      messageId: sent.id,
      type: 'leaderboard',
      meta: { originalUserId: interaction.user.id, page, totalPages, sort, displayMode: 'roblox' },
      expiresAt: Date.now() + 5 * 60 * 1000
    });
  },

  loadDatabase,
  getUsersWithAge,
  formatAge,
  createLeaderboardEmbed,
  createButtons
};
