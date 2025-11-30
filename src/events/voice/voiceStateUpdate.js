const { Events, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const guildDbPath = path.join(__dirname, '../../database/guild.json');
const creationCooldowns = new Map();

function getGuildConfig(guildId) {
  try {
    if (!fs.existsSync(guildDbPath)) return null;
    const raw = fs.readFileSync(guildDbPath, 'utf8');
    const parsed = raw.trim() ? JSON.parse(raw) : null;
    if (!parsed) return null;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object' && item[guildId]) return item[guildId];
      }
      return null;
    }
    return parsed[guildId] || null;
  } catch (e) {
    console.error('Failed to read guild.json for tempvoice:', e);
    return null;
  }
}

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState, client) {
    try {
      const guild = newState.guild || oldState.guild;
      if (!guild) return;

      const cfg = getGuildConfig(guild.id) || {};
      const tempCfg = cfg.TempVoice || cfg.voice || {};
      const lobbyId = tempCfg.lobby || null;

      function loadGuildRaw() {
        try {
          const guildDbPath = path.join(__dirname, '../../database/guild.json');
          if (!fs.existsSync(guildDbPath)) return null;
          const raw = fs.readFileSync(guildDbPath, 'utf8');
          return raw.trim() ? JSON.parse(raw) : null;
        } catch (e) {
          console.error('Failed to load guild.json:', e);
          return null;
        }
      }

      function saveGuildRaw(parsed) {
        try {
          const guildDbPath = path.join(__dirname, '../../database/guild.json');
          fs.writeFileSync(guildDbPath, JSON.stringify(parsed, null, 2), 'utf8');
        } catch (e) {
          console.error('Failed to save guild.json:', e);
        }
      }

      function getOrCreateVoiceArray(parsed, gid) {
        if (!parsed) return null;
        if (Array.isArray(parsed)) {
          let foundIdx = -1;
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (item && typeof item === 'object' && item[gid]) { foundIdx = i; break; }
          }
          if (foundIdx === -1) return null;
          const cfgObj = parsed[foundIdx][gid] = parsed[foundIdx][gid] || {};
          cfgObj.voice = cfgObj.voice || {};
          cfgObj.voice.ownerToChannel = cfgObj.voice.ownerToChannel || [];
          return { parsed, entry: cfgObj.voice };
        } else if (parsed && typeof parsed === 'object') {
          parsed[gid] = parsed[gid] || {};
          parsed[gid].voice = parsed[gid].voice || {};
          parsed[gid].voice.ownerToChannel = parsed[gid].voice.ownerToChannel || [];
          return { parsed, entry: parsed[gid].voice };
        }
        return null;
      }

      const guildRaw = loadGuildRaw();
      const voiceContainer = getOrCreateVoiceArray(guildRaw, guild.id);
      let ownerToChannelArr = (voiceContainer && voiceContainer.entry && voiceContainer.entry.ownerToChannel) ? voiceContainer.entry.ownerToChannel : [];

      const tryDeleteChannel = async (channel) => {
        if (!channel || channel.type !== ChannelType.GuildVoice) return;
        if (channel.id === lobbyId) return;
        if (tempCfg && tempCfg.channel && channel.id === tempCfg.channel) return;

        const members = channel.members;
        if (!members || members.size !== 0) return;

        const ownerIdx = ownerToChannelArr.findIndex(o => o.channelId === channel.id);
        if (ownerIdx === -1) {
          return;
        }

        const ownerIdForCooldown = ownerToChannelArr[ownerIdx].ownerId || null;

        ownerToChannelArr[ownerIdx].isActive = false;
        ownerToChannelArr[ownerIdx].channelId = null;
        if (voiceContainer && voiceContainer.parsed) {
          voiceContainer.entry.ownerToChannel = ownerToChannelArr;
          saveGuildRaw(voiceContainer.parsed);
        }

        try {
          let latest = guild.channels.cache.get(channel.id);
          if (!latest) {
            try { latest = await guild.channels.fetch(channel.id); } catch (e) { latest = null; }
          }

          if (latest && latest.members && latest.members.size > 0) {
            const idx = ownerToChannelArr.findIndex(o => o.channelId === channel.id);
            if (idx !== -1) {
              ownerToChannelArr[idx].isActive = true;
              if (voiceContainer && voiceContainer.parsed) {
                voiceContainer.entry.ownerToChannel = ownerToChannelArr;
                saveGuildRaw(voiceContainer.parsed);
              }
            }
            return;
          }

          try {
            if (latest) await latest.delete('Temporary voice channel empty - cleanup');
            else await channel.delete('Temporary voice channel empty - cleanup');

            if (ownerIdForCooldown) {
              const key = `${guild.id}:${ownerIdForCooldown}`;
              creationCooldowns.set(key, Date.now() + 30000);
            }
          } catch (e) {
            console.error('Failed to delete temp voice channel:', e);
            if (ownerIdForCooldown) {
              const key = `${guild.id}:${ownerIdForCooldown}`;
              creationCooldowns.set(key, Date.now() + 30000);
            }
          }
        } catch (e) {
          console.error('Error during immediate cleanup for temp voice channel:', e);
        }
      };

      if ((!oldState.channelId || oldState.channelId !== newState.channelId) && newState.channelId) {
        if (lobbyId && newState.channelId === lobbyId) {
          const member = newState.member;
          if (!member) return;

          const cooldownKey = `${guild.id}:${member.id}`;
          const expiresAt = creationCooldowns.get(cooldownKey);
          if (expiresAt && Date.now() < expiresAt) {
            const expirySec = Math.floor(expiresAt / 1000);
            try {
              await member.send(`<:fail:1444451615255040061> You'er in a cooldown, please wait a few second. And try again later <t:${expirySec}:R>`);
            } catch (e) {
            }
            return;
          }

          const existingEntry = ownerToChannelArr.find(o => o.ownerId === member.id);
          if (existingEntry && existingEntry.channelId) {
            const existing = guild.channels.cache.get(existingEntry.channelId);
            if (existing) {
              try {
                await member.voice.setChannel(existing);
              } catch (e) {
                console.error('Failed to move user to existing temp channel:', e);
              }
              existingEntry.isActive = true;
              if (voiceContainer && voiceContainer.parsed) { voiceContainer.entry.ownerToChannel = ownerToChannelArr; saveGuildRaw(voiceContainer.parsed); }
              return;
            }
            existingEntry.channelId = null;
            existingEntry.isActive = false;
            if (voiceContainer && voiceContainer.parsed) { voiceContainer.entry.ownerToChannel = ownerToChannelArr; saveGuildRaw(voiceContainer.parsed); }
          }

          try {
            const parent = guild.channels.cache.get(newState.channel.parentId) || null;
            const name = `${member.user.username}'s channel`;

            const defaultBitrate = (tempCfg && tempCfg.bitrate) ? tempCfg.bitrate : 64000;
            const defaultUserLimit = (tempCfg && tempCfg.userlimit) ? tempCfg.userlimit : 0;
            const defaultRegion = (tempCfg && tempCfg.region) ? tempCfg.region : 'auto';
            const defaultSlowmode = (tempCfg && tempCfg.slowmode) ? tempCfg.slowmode : 0;

            const created = await guild.channels.create({
              name,
              type: ChannelType.GuildVoice,
              parent: parent ? parent.id : null,
              bitrate: defaultBitrate,
              userLimit: defaultUserLimit,
              rtcRegion: defaultRegion === 'auto' ? null : defaultRegion,
              permissionOverwrites: [
                {
                  id: guild.roles.everyone.id,
                  allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                  deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                  id: member.id,
                  allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Speak]
                },
                {
                  id: "996367985759486042",
                  allow: [PermissionFlagsBits.ViewChannel],
                  deny: []
                }
              ]
            });

            const entryObj = {
              ownerId: member.id,
              channelId: created.id,
              channelName: member.user.username,
              slowmode: defaultSlowmode,
              bitrate: defaultBitrate,
              userlimit: defaultUserLimit,
              region: defaultRegion,
              isActive: true
            };
            if (existingEntry) {
              Object.assign(existingEntry, entryObj);
            } else {
              ownerToChannelArr.push(entryObj);
            }
            if (voiceContainer && voiceContainer.parsed) { voiceContainer.entry.ownerToChannel = ownerToChannelArr; saveGuildRaw(voiceContainer.parsed); }

            try { await member.voice.setChannel(created); } catch (e) { console.error('Failed to move user to new temp channel:', e); }
          } catch (e) {
            console.error('Error creating temp voice channel:', e);
          }
        }
      }

      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel;
        await tryDeleteChannel(oldChannel);
      }
    } catch (e) {
      console.error('Error in voiceStateUpdate handler:', e);
    }
  }
};
