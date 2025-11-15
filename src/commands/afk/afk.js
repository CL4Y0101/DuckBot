const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const afkPath = path.join(__dirname, '../../database/afk.json');

function loadAFK() {
  try {
    if (!fs.existsSync(afkPath)) return [];
    const data = fs.readFileSync(afkPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading AFK data:', error);
    return [];
  }
}

function saveAFK(data) {
  try {
    fs.writeFileSync(afkPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving AFK data:', error);
  }
}

function isAFK(userId) {
  const afkUsers = loadAFK();
  return afkUsers.find(user => user.userId === userId);
}

function setAFK(userId, reason) {
  const afkUsers = loadAFK();
  const existingIndex = afkUsers.findIndex(user => user.userId === userId);

  if (existingIndex !== -1) {
    afkUsers[existingIndex].reason = reason;
    afkUsers[existingIndex].timestamp = Date.now();
  } else {
    afkUsers.push({
      userId: userId,
      reason: reason,
      timestamp: Date.now()
    });
  }

  saveAFK(afkUsers);
}

function removeAFK(userId) {
  const afkUsers = loadAFK();
  const filtered = afkUsers.filter(user => user.userId !== userId);
  saveAFK(filtered);
}

async function removeAFKByAdmin(userId, adminId, interaction) {
  const member = interaction.guild?.members.cache.get(adminId);
  if (!member || !member.permissions.has('Administrator')) {
    throw new Error('You do not have permission to remove AFK status from others.');
  }

  removeAFK(userId);

  try {
    const member = interaction.guild.members.cache.get(userId);
    if (member && member.displayName.startsWith('[AFK] ')) {
      const originalName = member.displayName.slice(6);
      await member.setNickname(originalName);
    }
  } catch (error) {
    console.error('Error removing AFK nickname:', error);
  }

  return true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Manage AFK status')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your AFK status')
        .addStringOption(option =>
          option.setName('reason')
          .setDescription('Reason for being AFK')
          .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove AFK status from a user (Admin only)')
        .addUserOption(option =>
          option.setName('user')
          .setDescription('The user to remove AFK status from')
          .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all users currently AFK')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      let reason = interaction.options.getString('reason') || 'No reason provided';

      const existingAFK = isAFK(interaction.user.id);
      if (existingAFK) {
        await interaction.reply(`❌ You are already AFK: ${existingAFK.reason}`);
        return;
      }

      setAFK(interaction.user.id, reason);

      try {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member) {
          const originalName = member.displayName;
          const afkName = `[AFK] ${originalName}`;
          await member.setNickname(afkName);
        }
      } catch (error) {
        console.error('Error setting AFK nickname:', error);
      }

      await interaction.reply(`✅ You are now AFK: ${reason}`);

    } else if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const targetUserId = targetUser.id;

      const afkData = isAFK(targetUserId);
      if (!afkData) {
        await interaction.reply({ content: `❌ ${targetUser.username} is not AFK.`, ephemeral: true });
        return;
      }

      try {
        await removeAFKByAdmin(targetUserId, interaction.user.id, interaction);
        await interaction.reply({ content: `✅ Removed AFK status from ${targetUser.username}.`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
      }

    } else if (subcommand === 'list') {
      const afkUsers = loadAFK();

      if (afkUsers.length === 0) {
        await interaction.reply({ content: '❌ No users are currently AFK.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Currently AFK Users')
        .setColor('#FFA500')
        .setTimestamp();

      let description = '';
      for (const user of afkUsers) {
        const member = interaction.guild.members.cache.get(user.userId);
        const username = member ? member.user.username : 'Unknown User';
        const timeAgo = Math.floor((Date.now() - user.timestamp) / 1000);
        description += `• **${username}**: ${user.reason} (${timeAgo}s ago)\n`;
      }

      embed.setDescription(description);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  isAFK,
  setAFK,
  removeAFK,
  removeAFKByAdmin
};
