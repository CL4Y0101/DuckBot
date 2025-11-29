const { Events, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const tempDbPath = path.join(__dirname, '../../database/tempvoice.json');
const guildDbPath = path.join(__dirname, '../../database/guild.json');

function loadTempDb() {
  try {
    if (!fs.existsSync(tempDbPath)) return { ownerToChannel: {} };
    const raw = fs.readFileSync(tempDbPath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : { ownerToChannel: {} };
  } catch (e) {
    console.error('Failed to load tempvoice.json:', e);
    return { ownerToChannel: {} };
  }
}

function saveTempDb(obj) {
  try {
    fs.writeFileSync(tempDbPath, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Failed to save tempvoice.json:', e);
  }
}

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
          const guildDbPath = guildDbPath = path.join(__dirname, '../../database/guild.json');
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
        const members = channel.members;
        if (members && members.size === 0) {
          const ownerIdx = ownerToChannelArr.findIndex(o => o.channelId === channel.id);
          if (ownerIdx !== -1) {
            ownerToChannelArr[ownerIdx].isActive = false;
            if (voiceContainer && voiceContainer.parsed) {
              voiceContainer.entry.ownerToChannel = ownerToChannelArr;
              saveGuildRaw(voiceContainer.parsed);
            }

            setTimeout(async () => {
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
                } catch (e) {
                  console.error('Failed to delete temp voice channel:', e);
                }

                const remIdx = ownerToChannelArr.findIndex(o => o.channelId === channel.id);
                if (remIdx !== -1) {
                  ownerToChannelArr.splice(remIdx, 1);
                  if (voiceContainer && voiceContainer.parsed) {
                    voiceContainer.entry.ownerToChannel = ownerToChannelArr;
                    saveGuildRaw(voiceContainer.parsed);
                  }
                }
              } catch (e) {
                console.error('Error during delayed cleanup check for temp voice channel:', e);
              }
            }, 5000);
          }
        }
      };

      if ((!oldState.channelId || oldState.channelId !== newState.channelId) && newState.channelId) {
        if (lobbyId && newState.channelId === lobbyId) {
          const member = newState.member;
          if (!member) return;

          const existingEntry = ownerToChannelArr.find(o => o.ownerId === member.id && o.channelId);
          if (existingEntry) {
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
          }

          try {
            const parent = guild.channels.cache.get(newState.channel.parentId) || null;
            const name = `${member.user.username}'s channel`;
            const created = await guild.channels.create({
              name,
              type: ChannelType.GuildVoice,
              parent: parent ? parent.id : null,
              permissionOverwrites: [
                {
                  id: guild.roles.everyone.id,
                  allow: [],
                  deny: []
                },
                {
                  id: member.id,
                  allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Speak]
                }
              ]
            });

            const entryObj = {
              ownerId: member.id,
              channelId: created.id,
              channelName: member.user.username,
              isActive: true
            };
            ownerToChannelArr.push(entryObj);
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

      if (!newState.channel && oldState.channel) {
        await tryDeleteChannel(oldState.channel);
      }

    } catch (err) {
      console.error('Error in voiceStateUpdate handler:', err);
    }
  }
};
