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

function formatAge(ageMs) {
  const years = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
  const days = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));

  if (years > 0) return `${years}y ${months}m`;
  if (months > 0) return `${months}m ${days}d`;
  return `${days}d`;
}

function createLeaderboardEmbed(users, page, sort, totalPages) {
  const start = (page - 1) * 10;
  const end = start + 10;
  const pageUsers = users.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Roblox Account Age Leaderboard')
    .setDescription(`Sorted by: ${sort === 'old' ? 'Oldest Accounts' : 'Newest Accounts'}\nPage ${page}/${totalPages}`)
    .setColor('#ff6b6b')
    .setTimestamp();

  let description = '';
  pageUsers.forEach((user, index) => {
    const rank = start + index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
    description += `${medal} [${user.roblox_nickname || user.roblox_username}](https://www.roblox.com/users/${user.roblox_uid}/profile) - ${formatAge(user.age)}\n`;
  });

  embed.setDescription(embed.data.description + '\n\n' + description);

  return embed;
}

function createButtons(page, totalPages, sort) {
  const row = new ActionRowBuilder();

  const prevButton = new ButtonBuilder()
    .setCustomId(`leaderboard_prev_${page}_${sort}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1);

  const nextButton = new ButtonBuilder()
    .setCustomId(`leaderboard_next_${page}_${sort}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages);

  row.addComponents(prevButton, nextButton);
  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display Roblox account age leaderboard')
    .addStringOption(option =>
      option.setName('sorting')
        .setDescription('Sort by account age')
        .setRequired(true)
        .addChoices(
          { name: 'Oldest Accounts', value: 'old' },
          { name: 'Newest Accounts', value: 'new' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const sort = interaction.options.getString('sorting');
    const users = await getUsersWithAge();

    if (users.length === 0) {
      return await interaction.editReply('No users found with valid Roblox profiles.');
    }

    // Sort users
    users.sort((a, b) => sort === 'old' ? a.createdDate - b.createdDate : b.createdDate - a.createdDate);

    const totalPages = Math.ceil(users.length / 10);
    const page = 1;

    const embed = createLeaderboardEmbed(users, page, sort, totalPages);
    const buttons = createButtons(page, totalPages, sort);

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }
};
