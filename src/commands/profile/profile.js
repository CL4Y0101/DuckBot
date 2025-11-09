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

function getRobloxUsernames() {
  const users = loadDatabase();
  const usernames = users
    .map(user => user.roblox_username)
    .filter(username => username && typeof username === 'string')
    .slice(0, 25);
  console.log(`🎮 Found ${usernames.length} Roblox usernames`);
  return usernames;
}

function getDiscordUsernames() {
  const users = loadDatabase();
  const usernames = users
    .map(user => user.username)
    .filter(username => username && typeof username === 'string')
    .slice(0, 25);
  console.log(`💬 Found ${usernames.length} Discord usernames`);
  return usernames;
}

function findUserByRobloxUsername(robloxUsername) {
  const users = loadDatabase();
  return users.find(user => 
    user.roblox_username && 
    user.roblox_username.toLowerCase() === robloxUsername.toLowerCase()
  );
}

function findUserByDiscordUsername(discordUsername) {
  const users = loadDatabase();
  return users.find(user => 
    user.username && 
    user.username.toLowerCase() === discordUsername.toLowerCase()
  );
}

function findUserByDiscordUserid(discordUserid) {
  const users = loadDatabase();
  return users.find(user => user.userid === discordUserid);
}

async function createRobloxEmbed(user) {
  const embed = new EmbedBuilder()
    .setTitle('`🎮` Roblox Profile Information')
    .setColor('#ff6b6b');

  try {
    const avatarUrl = await robloxAPI.getAvatarUrl(user.roblox_uid);
    if (avatarUrl) {
      embed.setThumbnail(avatarUrl);
    }
  } catch (error) {
    console.error('Error getting avatar:', error);
  }

  let description = 'None provided';
  let createdTimestamp = 'Unknown';
  let displayName = user.roblox_nickname || user.roblox_username;
  let isBanned = false;
  let isPremium = false;
  let followerCount = 'Unknown';
  let followingCount = 'Unknown';

  try {
    const profile = await robloxAPI.getUserProfile(user.roblox_uid);
    if (profile) {
      description = profile.description || 'None provided';
      if (profile.created) {
        createdTimestamp = `<t:${Math.floor(new Date(profile.created).getTime() / 1000)}:F>`;
      }
      if (profile.displayName) {
        displayName = profile.displayName;
      }
      isBanned = profile.isBanned || false;
      isPremium = profile.hasPremium || false;
    }
  } catch (error) {
    console.error('Error getting Roblox profile:', error);
  }

  let accountAge = 'Unknown';
  if (createdTimestamp !== 'Unknown') {
    const createdDate = new Date(createdTimestamp.match(/\d+/)[0] * 1000);
    const now = new Date();
    const ageMs = now - createdDate;
    const years = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365));
    const months = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
    const days = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));

    if (years > 0) accountAge = `${years}y ${months}m`;
    else if (months > 0) accountAge = `${months}m ${days}d`;
    else accountAge = `${days}d`;
  }

  embed.setDescription(
    `### \`👤\` [${displayName}](https://www.roblox.com/users/${user.roblox_uid}/profile)\n` +
    `**Sorted by:** Roblox Account Information\n\n` +
    `### \`📊\` Account Details\n` +
    `-# **User ID:** \`${user.roblox_uid}\`\n` +
    `-# **Username:** \`@${user.roblox_username}\`\n` +
    `-# **Account Age:** \`${accountAge}\`\n` +
    `-# **Account Created:** ${createdTimestamp}\n` +
    `-# **Premium Status:** ${isPremium ? '✅ Yes' : '❌ No'}\n` +
    `-# **Account Status:** ${isBanned ? '🚫 Banned' : '✅ Active'}\n\n` +
    `### \`📝\` Profile Description\n-# ${description.length > 500 ? description.substring(0, 497) + '...' : description}`
  );

  return embed;
}

async function createDiscordEmbed(user, interaction) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('`💬` Discord Profile Information');

  try {
    if (interaction.guild) {
      const discordUser = await interaction.guild.members.fetch(user.userid);
      if (discordUser) {
        embed.setThumbnail(discordUser.user.displayAvatarURL({ dynamic: true, size: 256 }));
      }
    }
  } catch (error) {
    console.error('Error fetching Discord user avatar:', error);
  }

  let discordCreatedTimestamp = 'Unknown';
  let accountAge = 'Unknown';
  let joinDate = 'Unknown';

  try {
    const discordUser = await interaction.client.users.fetch(user.userid);
    if (discordUser) {
      discordCreatedTimestamp = `<t:${Math.floor(discordUser.createdTimestamp / 1000)}:F>`;

      const createdDate = new Date(discordUser.createdTimestamp);
      const now = new Date();
      const ageMs = now - createdDate;
      const years = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365));
      const months = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
      const days = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));

      if (years > 0) accountAge = `${years}y ${months}m`;
      else if (months > 0) accountAge = `${months}m ${days}d`;
      else accountAge = `${days}d`;
    }
  } catch (error) {
    console.error('Error fetching Discord user creation date:', error);
  }

  try {
    if (interaction.guild) {
      const member = await interaction.guild.members.fetch(user.userid);
      if (member) {
        joinDate = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;
      }
    }
  } catch (error) {
    console.error('Error fetching member join date:', error);
  }

  embed.setDescription(
    `### \`👤\` ${user.username}\n` +
    `**Sorted by:** Discord Account Information\n\n` +
    `### \`📊\` Account Details\n` +
    `-# **User ID:** \`${user.userid}\`\n` +
    `-# **Account Age:** \`${accountAge}\`\n` +
    `-# **Account Created:** ${discordCreatedTimestamp}\n` +
    (joinDate !== 'Unknown' ? `-# **Server Joined:** ${joinDate}\n` : '') +
    `-# **Roblox Verified:** ${user.verified ? '✅ Yes' : '❌ No'}`
  );

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Get user profile information')
    .addSubcommand(subcommand =>
      subcommand
        .setName('roblox_user')
        .setDescription('Get profile by Roblox username')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Roblox username')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('discord_user')
        .setDescription('Get profile by Discord user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Discord user')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'roblox_user') {
        const username = interaction.options.getString('username');
        console.log(`🔍 Searching for Roblox user: ${username}`);
        
        const user = findUserByRobloxUsername(username);
        if (!user) {
          const embed = new EmbedBuilder()
            .setTitle('`🔍` User Not Found')
            .setDescription(`User "${username}" is not verified in our database.\n\nIf this is you, please verify your Roblox account first.`)
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

        console.log(`✅ Found user:`, user);
        const embed = await createRobloxEmbed(user);
        await interaction.editReply({ embeds: [embed] });

      } else if (subcommand === 'discord_user') {
        const discordUser = interaction.options.getUser('user');
        console.log(`🔍 Searching for Discord user: ${discordUser.tag}`);
        
        const user = findUserByDiscordUserid(discordUser.id);
        if (!user) {
          const embed = new EmbedBuilder()
            .setTitle('`🔍` User Not Found')
            .setDescription(`User ${discordUser.tag} is not verified in our database.\n\nIf this is you, please verify your Roblox account first.`)
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

        console.log(`✅ Found user:`, user);
        const robloxEmbed = await createRobloxEmbed(user);
        const discordEmbed = await createDiscordEmbed(user, interaction);
        await interaction.editReply({ embeds: [robloxEmbed, discordEmbed] });
      }
    } catch (error) {
      console.error('❌ Error in execute:', error);
      await interaction.editReply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  },

  async autocomplete(interaction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      console.log(`🔍 Autocomplete focused:`, focusedOption);

      if (focusedOption.name !== 'username') {
        return await interaction.respond([]);
      }

      const subcommand = interaction.options.getSubcommand();
      console.log(`📝 Autocomplete subcommand: ${subcommand}`);

      let choices = [];

      if (subcommand === 'roblox_user') {
        choices = getRobloxUsernames();
      } else if (subcommand === 'discord_user') {
        choices = getDiscordUsernames();
      }

      console.log(`📋 Available choices: ${choices.length}`);

      const filtered = choices
        .filter(choice => {
          if (!choice || typeof choice !== 'string') return false;
          return choice.toLowerCase().includes(focusedOption.value.toLowerCase());
        })
        .slice(0, 25);

      console.log(`✅ Filtered choices: ${filtered.length}`);

      if (filtered.length === 0) {
        filtered.push('No users found');
      }

      await interaction.respond(
        filtered.map(choice => ({ 
          name: choice.length > 100 ? choice.substring(0, 97) + '...' : choice,
          value: choice.length > 100 ? choice.substring(0, 100) : choice
        }))
      );

    } catch (error) {
      console.error('❌ Autocomplete error:', error);
      
      try {
        await interaction.respond([
          { name: 'Error loading options', value: 'error' }
        ]);
      } catch (respondError) {
        console.error('❌ Failed to send error response:', respondError);
      }
    }
  },

  getRobloxUsernames,
  getDiscordUsernames,
  findUserByRobloxUsername,
  findUserByDiscordUsername,
  findUserByDiscordUserid
};