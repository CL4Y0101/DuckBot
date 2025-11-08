const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const robloxAPI = require('../../utils/roblox/robloxAPI');

const databasePath = path.join(__dirname, '../../database/username.json');

function loadDatabase() {
  try {
    const data = fs.readFileSync(databasePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading database:', error);
    return [];
  }
}

function getRobloxUsernames() {
  const users = loadDatabase();
  return users.map(user => user.roblox_username).filter(username => username);
}

function getDiscordUsernames() {
  const users = loadDatabase();
  return users.map(user => user.username).filter(username => username);
}

function findUserByRobloxUsername(robloxUsername) {
  const users = loadDatabase();
  return users.find(user => user.roblox_username === robloxUsername);
}

function findUserByDiscordUsername(discordUsername) {
  const users = loadDatabase();
  return users.find(user => user.username === discordUsername);
}

async function createRobloxEmbed(user) {
  const embed = new EmbedBuilder()
    .setColor('#393a41');

  const avatarUrl = await robloxAPI.getAvatarUrl(user.roblox_uid);
  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const profile = await robloxAPI.getUserProfile(user.roblox_uid);
  let description = 'None provided';
  let createdTimestamp = 'Unknown';

  if (profile) {
    description = profile.description || 'None provided';
    createdTimestamp = profile.created ? `<t:${Math.floor(new Date(profile.created).getTime() / 1000)}:F>` : 'Unknown';
  }

  embed.setDescription(
    `### [${user.roblox_nickname}](https://www.roblox.com/users/${user.roblox_uid}/profile) (${user.roblox_uid})\n` +
    `## Roblox Information\n` +
    `### @${user.roblox_username}\n` +
    `Account Created: ${createdTimestamp}\n` +
    `## Description\n` +
    `${description}`
  );

  return embed;
}

async function createDiscordEmbed(user, interaction) {
  const embed = new EmbedBuilder()
    .setColor('#393a41');

  try {
    if (interaction.guild) {
      const discordUser = await interaction.guild.members.fetch(user.userid);
      if (discordUser) {
        embed.setThumbnail(discordUser.user.displayAvatarURL({ dynamic: true, size: 256 }));
      }
    }
  } catch (error) {
    console.error('Error fetching Discord user:', error);
  }

  const profile = await robloxAPI.getUserProfile(user.roblox_uid);
  let description = 'None provided';
  let createdTimestamp = 'Unknown';

  if (profile) {
    description = profile.description || 'None provided';
    createdTimestamp = profile.created ? `<t:${Math.floor(new Date(profile.created).getTime() / 1000)}:F>` : 'Unknown';
  }

  let discordInfo = '';
  try {
    if (interaction.guild) {
      const discordUser = await interaction.guild.members.fetch(user.userid);
      if (discordUser) {
        const discordCreatedTimestamp = Math.floor(discordUser.user.createdTimestamp / 1000);
        discordInfo = `\n## Discord Information\n### @${user.username}\nAccount Created: <t:${discordCreatedTimestamp}:F>`;
      }
    }
  } catch (error) {
    console.error('Error fetching Discord user:', error);
  }

  embed.setDescription(
    `### [${user.roblox_nickname}](https://www.roblox.com/users/${user.roblox_uid}/profile) (${user.roblox_uid})\n` +
    `## Roblox Information\n` +
    `### @${user.roblox_username}\n` +
    `Account Created: ${createdTimestamp}\n` +
    `## Description\n` +
    `${description}` +
    `${discordInfo}`
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
        .setDescription('Get profile by Discord username')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Discord username')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.options.getString('username');

    if (subcommand === 'roblox_user') {
      const user = findUserByRobloxUsername(username);
      if (!user) {
        return await interaction.reply({
          content: 'User not found in database.',
          ephemeral: true
        });
      }

      const embed = await createRobloxEmbed(user);
      await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'discord_user') {
      const user = findUserByDiscordUsername(username);
      if (!user) {
        return await interaction.reply({
          content: 'User not found in database.',
          ephemeral: true
        });
      }

      const embed = await createDiscordEmbed(user);
      await interaction.reply({ embeds: [embed] });
    }
  },

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'username') {
      let choices = [];

      if (interaction.options.getSubcommand() === 'roblox_user') {
        choices = getRobloxUsernames();
      } else if (interaction.options.getSubcommand() === 'discord_user') {
        choices = getDiscordUsernames();
      }

      const filtered = choices.filter(choice =>
        choice.toLowerCase().includes(focusedOption.value.toLowerCase())
      ).slice(0, 25);

      await interaction.respond(
        filtered.map(choice => ({ name: choice, value: choice }))
      );
    }
  }
};
