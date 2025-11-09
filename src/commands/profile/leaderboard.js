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

const databasePath = path.join(__dirname, '../../database/username.json');

function loadDatabase() {
  try {
    if (!fs.existsSync(databasePath)) {
      console.log('❌ Database file not found:', databasePath);
      return [];
    }
    const data = fs.readFileSync(databasePath, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('❌ Error loading database:', error);
    return [];
  }
}

async function getUsersWithAge() {
  const users = loadDatabase();
  const usersWithAge = [];

  for (const user of users) {
    if (!user.roblox_uid) continue;
    try {
      const profile = await robloxAPI.getUserProfile(user.roblox_uid);
      if (profile && profile.created) {
        const createdDate = new Date(profile.created);
        usersWithAge.push({
          ...user,
          createdDate,
          age: Date.now() - createdDate.getTime()
        });
      }
    } catch (error) {
      console.error(`Error fetching profile for ${user.roblox_username}:`, error);
    }
  }

  return usersWithAge;
}

function formatAge(createdDate) {
  const ageMs = Date.now() - createdDate.getTime();
  const years = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
  const days = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));

  let ageText = '';
  if (years > 0) ageText = `${years}y ${months}m`;
  else if (months > 0) ageText = `${months}m ${days}d`;
  else ageText = `${days}d`;

  const timestamp = `<t:${Math.floor(createdDate.getTime() / 1000)}:F>`;
  return `${ageText} (${timestamp})`;
}

function createLeaderboardEmbed(users, page, sort, totalPages, displayMode = 'roblox', guildName = 'Unknown Guild', currentUser = null) {
  const start = (page - 1) * 10;
  const end = start + 10;
  const pageUsers = users.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle('`🏆` Roblox Account Age Leaderboard')
    .setColor('#ff6b6b');

  let description = `**Sorted by:** ${sort === 'old' ? 'Oldest Accounts' : sort === 'new' ? 'Newest Accounts' : 'Alphabetical (A-Z)'}\n**Page:** ${page}/${totalPages}\n\n-# **Guild**: ${guildName}\n`;

  if (currentUser) {
    const userRank = users.findIndex(u => u.userid === currentUser.userid) + 1;
    const topPercentage = ((userRank / users.length) * 100).toFixed(1);
    description += `### \`📊\` Your Current Stats\n-# **User**: @${currentUser.username}\n-# **Rank**: #${userRank} *(Top ${topPercentage}%)*\n-# **Account Created At**: ${formatAge(currentUser.createdDate)}\n`;
  }

  description += `### \`🏆\` Rankings\n`;

  pageUsers.forEach((user, index) => {
    const rank = start + index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
    const displayName = displayMode === 'discord' ? user.username : (user.roblox_nickname || user.roblox_username);
    const robloxProfileLink = user.roblox_uid ? `[${displayName}](https://www.roblox.com/users/${user.roblox_uid}/profile)` : displayName;
    description += `${medal} ${robloxProfileLink}\n-# ${formatAge(user.createdDate)}\n`;
  });

  const currentTime = Math.floor(Date.now() / 1000);
  description += `\n-# Last updated: <t:${currentTime}:R> • Total users in database: ${users.length}`;

  embed.setDescription(description);
  return embed;
}

function createButtons(page, totalPages, sort, displayMode = 'roblox', userId, disabled = false) {
  const row = new ActionRowBuilder();

  const prevButton = new ButtonBuilder()
    .setCustomId(`leaderboard_prev_${page}_${sort}_${displayMode}_${userId}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1 || disabled);

  const toggleButton = new ButtonBuilder()
    .setCustomId(`leaderboard_toggle_${page}_${sort}_${displayMode}_${userId}`)
    .setLabel(displayMode === 'roblox' ? 'Show Discord Names' : 'Show Roblox Names')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const nextButton = new ButtonBuilder()
    .setCustomId(`leaderboard_next_${page}_${sort}_${displayMode}_${userId}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages || disabled);

  row.addComponents(prevButton, toggleButton, nextButton);
  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display Roblox account age leaderboard')
    .addStringOption(option =>
      option.setName('sorting')
        .setDescription('Sort by account age')
        .setRequired(false)
        .addChoices(
          { name: 'Oldest Accounts', value: 'old' },
          { name: 'Newest Accounts', value: 'new' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const allUsers = loadDatabase();
    const currentUser = allUsers.find(u => u.userid === interaction.user.id);

    if (!currentUser) {
      const embed = new EmbedBuilder()
        .setTitle('`🔍` Verification Required')
        .setDescription('You need to verify your Roblox account to view the leaderboard.\n\nClick the button below to start verification.')
        .setColor('#ff6b6b')
        .setTimestamp();

      const verifyButton = new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify Roblox Account')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(verifyButton);

      return await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }

    const sort = interaction.options.getString('sorting') || 'alphabetical';
    const users = await getUsersWithAge();

    if (users.length === 0) {
      return await interaction.editReply('No users found with valid Roblox profiles.');
    }

    if (sort === 'old') {
      users.sort((a, b) => a.createdDate - b.createdDate);
    } else if (sort === 'new') {
      users.sort((a, b) => b.createdDate - a.createdDate);
    } else {
      users.sort((a, b) => (a.roblox_nickname || a.roblox_username).localeCompare(b.roblox_nickname || b.roblox_username));
    }

    const totalPages = Math.ceil(users.length / 10);
    const page = 1;

    const guildName = interaction.guild ? interaction.guild.name : 'Unknown Guild';
    const currentUserWithAge = users.find(u => u.userid === currentUser.userid);

    const embed = createLeaderboardEmbed(users, page, sort, totalPages, 'roblox', guildName, currentUserWithAge);
    const buttons = createButtons(page, totalPages, sort, 'roblox', interaction.user.id);

    const response = await interaction.editReply({ embeds: [embed], components: [buttons] });

    setTimeout(async () => {
      try {
        const disabledButtons = createButtons(page, totalPages, sort, 'roblox', interaction.user.id, true);
        await response.edit({ embeds: [embed], components: [disabledButtons] });
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }, 5 * 60 * 1000);
  },

  loadDatabase,
  getUsersWithAge,
  formatAge,
  createLeaderboardEmbed,
  createButtons
};