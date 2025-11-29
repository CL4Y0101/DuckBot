const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { isAFK, setAFK, removeAFK } = require('../../commands/afk/afk');

function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../../../config.yml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const lines = fileContents.split('\n');
    const config = {};
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;

      if (trimmed.endsWith(':')) {
        currentSection = trimmed.slice(0, -1);
        config[currentSection] = {};
      } else if (currentSection && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        let value = valueParts.join(':').trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            value = JSON.parse(value);
          } catch {
            value = [];
          }
        }
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value)) value = Number(value);

        config[currentSection][key.trim()] = value;
      }
    }

    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    return { settings: { prefix: '!' } };
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot) return;

    const config = loadConfig();
    const settings = config.settings || {};
    const afkConfig = config.afk || {};
    const prefix = settings.prefix || '!';

    const afkData = isAFK(message.author.id);
    if (afkData && afkConfig.removeAFKOnMessage !== false) {
      if (afkConfig.exemptRoles && afkConfig.exemptRoles.length > 0) {
        const member = message.guild?.members.cache.get(message.author.id);
        if (member && afkConfig.exemptRoles.some(roleId => member.roles.cache.has(roleId))) {
        } else {
        removeAFK(message.author.id);

        if (afkConfig.enableNicknameChange !== false) {
          try {
            const member = message.guild.members.cache.get(message.author.id);
            if (member && member.displayName.startsWith(afkConfig.nicknamePrefix || '[AFK] ')) {
              const afkUsers = loadAFK();
              const afkData = afkUsers.find(user => user.userId === message.author.id);
              if (afkData && afkData.originalNickname) {
                await member.setNickname(afkData.originalNickname);
              } else {
                const originalName = member.displayName.slice((afkConfig.nicknamePrefix || '[AFK] ').length);
                await member.setNickname(originalName);
              }
            }
          } catch (error) {
            console.error('Error removing AFK nickname:', error);
          }
        }

        const welcomeMessage = (afkConfig.welcomeBackMessage || '👋 **Welcome back, {user}!**\n-# You were AFK for: <t:{time}:R>')
          .replace('{user}', message.author.username)
          .replace('{time}', Math.floor(afkData.timestamp / 1000));
        await message.reply(welcomeMessage);
          return;
        }
      } else {
        removeAFK(message.author.id);

        if (afkConfig.enableNicknameChange !== false) {
          try {
            const member = message.guild.members.cache.get(message.author.id);
            if (member && member.displayName.startsWith(afkConfig.nicknamePrefix || '[AFK] ')) {
              const originalName = member.displayName.slice((afkConfig.nicknamePrefix || '[AFK] ').length);
              await member.setNickname(originalName);
            }
          } catch (error) {
            console.error('Error removing AFK nickname:', error);
          }
        }

        const welcomeMessage = (afkConfig.welcomeBackMessage || '👋 **Welcome back, {user}!**\n-# You were AFK for: <t:{time}:R>')
          .replace('{user}', message.author.username)
          .replace('{time}', Math.floor(afkData.timestamp / 1000));
        await message.reply(welcomeMessage);
        return;
      }
    }

    if (afkConfig.notifyOnMention !== false && message.mentions.users.size > 0) {
      if (afkConfig.exemptChannels && afkConfig.exemptChannels.includes(message.channel.id)) {
      } else {
        for (const [userId, user] of message.mentions.users) {
          const afkData = isAFK(userId);
          if (afkData) {
            const timestamp = afkData.timestamp;
            const timeFormat = afkConfig.timeFormat === 'absolute' ? 'f' : 'R';
            const mentionMessage = (afkConfig.mentionAFKMessage || '😴 **{user}** is currently AFK.\n-# Reason: {reason}\n-# AFK since: <t:{time}:R>')
              .replace('{user}', user.username)
              .replace('{reason}', afkData.reason)
              .replace('{time}', Math.floor(timestamp / 1000));

            await message.reply(mentionMessage);

            if (afkConfig.notifyMultipleMentionsOnce !== false) {
              break;
            }
          }
        }
      }
    }

    if (afkConfig.prefixCommandsEnabled === false || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const validCommands = [afkConfig.commandName || 'afk'];
    if (afkConfig.afkCommandAliases) {
      validCommands.push(...afkConfig.afkCommandAliases);
    }

    if (validCommands.includes(commandName)) {
      let reason = args.join(' ') || (afkConfig.defaultReason || 'No reason provided');

      if (afkConfig.maxReasonLength && reason.length > afkConfig.maxReasonLength) {
        reason = reason.substring(0, afkConfig.maxReasonLength) + '...';
      }

      const existingAFK = isAFK(message.author.id);
      if (existingAFK) {
        const alreadyMessage = (afkConfig.alreadyAFKMessage || '❌ You are already AFK: {reason}').replace('{reason}', existingAFK.reason);
        await message.reply(alreadyMessage);
        return;
      }

      setAFK(message.author.id, reason);

      if (afkConfig.enableNicknameChange !== false) {
        try {
          const member = message.guild.members.cache.get(message.author.id);
          if (member) {
            const originalName = member.displayName;
            const afkName = (afkConfig.nicknamePrefix || '[AFK] ') + originalName;
            await member.setNickname(afkName);
          }
        } catch (error) {
          console.error('Error setting AFK nickname:', error);
        }
      }

      const setMessage = (afkConfig.setAFKMessage || '✅ You are now AFK: {reason}').replace('{reason}', reason);
      await message.reply(setMessage);
    } else if (commandName === 'welcome') {
      const { execute } = require('../guildMessage/guildMemberAdd');
      await execute(message.member);
    } else if (commandName === 'leave') {
      const { execute } = require('../guildMessage/guildMemberRemove');
      await execute(message.member);
    }
  },
};


