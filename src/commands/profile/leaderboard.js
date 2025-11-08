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
    console.log(`📊 Loaded ${parsed.length} users from database`);
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

function createLeaderboardEmbed(users, page, sort, totalPages, displayMode = 'roblox') {
  const start = (page - 1) * 10;
  const end = start + 10;
  const pageUsers = users.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Roblox Account Age Leaderboard')
    .setDescription(`Sorted by: ${sort === 'old' ? 'Oldest Accounts' : sort === 'new' ? 'Newest Accounts' : 'Alphabetical (A-Z)'}\nPage ${page}/${totalPages}`)
    .setColor('#ff6b6b')
    .setTimestamp();

  let description = '';
  pageUsers.forEach((user, index) => {
    const rank = start + index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
    const displayName = displayMode === 'discord' ? user.username : (user.roblox_nickname || user.roblox_username);
    description += `${medal} [${displayName}](https://www.roblox.com/users/${user.roblox_uid}/profile) - ${formatAge(user.createdDate)}\n`;
  });

  embed.setDescription(embed.data.description + '\n\n' + description);

  return embed;
}

function createButtons(page, totalPages, sort, displayMode = 'roblox') {
  const row = new ActionRowBuilder();

  const prevButton = new ButtonBuilder()
    .setCustomId(`leaderboard_prev_${page}_${sort}_${displayMode}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1);

  const toggleButton = new ButtonBuilder()
    .setCustomId(`leaderboard_toggle_${page}_${sort}_${displayMode}`)
    .setLabel(displayMode === 'roblox' ? 'Show Discord Names' : 'Show Roblox Names')
    .setStyle(ButtonStyle.Secondary);

  const nextButton = new ButtonBuilder()
    .setCustomId(`leaderboard_next_${page}_${sort}_${displayMode}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages);

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
        .setTitle('🔍 Verification Required')
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

    const embed = createLeaderboardEmbed(users, page, sort, totalPages, 'roblox');
    const buttons = createButtons(page, totalPages, sort, 'roblox');

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }
};
