const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../../utils/config');

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

function setAFK(userId, reason, originalNickname = null) {
  const afkUsers = loadAFK();
  const existingIndex = afkUsers.findIndex(user => user.userId === userId);

  if (existingIndex !== -1) {
    afkUsers[existingIndex].reason = reason;
    afkUsers[existingIndex].timestamp = Date.now();
    if (originalNickname) afkUsers[existingIndex].originalNickname = originalNickname;
  } else {
    afkUsers.push({
      userId: userId,
      reason: reason,
      timestamp: Date.now(),
      originalNickname: originalNickname
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

  const afkUsers = loadAFK();
  const afkData = afkUsers.find(user => user.userId === userId);
  if (afkData && afkData.originalNickname) {
    try {
      const targetMember = interaction.guild.members.cache.get(userId);
      if (targetMember) {
        await targetMember.setNickname(afkData.originalNickname);
      }
    } catch (error) {
      console.error('Error restoring nickname:', error);
    }
  }

  removeAFK(userId);

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
    const config = getConfig();
    const afkConfig = config.afk || {};

    if (afkConfig.commandChannelOnly && afkConfig.commandChannels) {
      if (!afkConfig.commandChannels.includes(interaction.channel.id)) {
        await interaction.reply({
          content: `❌ AFK commands can only be used in designated channels.`,
          ephemeral: true
        });
        return;
      }
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      let reason = interaction.options.getString('reason') || 'No reason provided';

      const existingAFK = isAFK(interaction.user.id);
      if (existingAFK) {
        await interaction.reply(`❌ You are already AFK: ${existingAFK.reason}`);
        return;
      }

      let originalNickname = null;
      let nicknameChanged = false;
      try {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member) {
          originalNickname = member.displayName;
          const afkName = `[AFK] ${originalNickname}`;
          await member.setNickname(afkName);
          nicknameChanged = true;
        }
      } catch (error) {
        // console.error('Error setting AFK nickname:', error);
        if (error.code === 50013) {
        }
      }

      setAFK(interaction.user.id, reason, originalNickname);

      const response = nicknameChanged
        ? `✅ You are now AFK: ${reason}`
        : `✅ You are now AFK: ${reason}\n-# ⚠️ *Nickname couldn't be changed due to role hierarchy. The bot needs a higher role position than you.*`;

      await interaction.reply(response);

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
        .setTitle('`😴` Currently AFK Users')
        .setColor('#FFA500')
        .setTimestamp();

      let desc = `### \`📊\` AFK Status\n`;
      for (let i = 0; i < afkUsers.length; i++) {
        const user = afkUsers[i];
        const member = interaction.guild.members.cache.get(user.userId);
        const username = member ? member.user.username : 'Unknown User';
        const timeAgo = Math.floor((Date.now() - user.timestamp) / 1000);
        const hours = Math.floor(timeAgo / 3600);
        const minutes = Math.floor((timeAgo % 3600) / 60);
        const seconds = timeAgo % 60;

        let timeString;
        if (hours > 0) {
          timeString = `${hours}h ${minutes}m ago`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds}s ago`;
        } else {
          timeString = `${seconds}s ago`;
        }

        desc += `**${i + 1}.** ${username}\n-# ${user.reason} • <t:${Math.floor(user.timestamp / 1000)}:R>\n`;
      }

      desc += `\n-# Total AFK users: ${afkUsers.length}`;

      embed.setDescription(desc);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  isAFK,
  setAFK,
  removeAFK,
  removeAFKByAdmin
};
