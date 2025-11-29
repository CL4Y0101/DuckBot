const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const robloxAPI = require('../../utils/roblox/robloxAPI');
const MinecraftAPI = require('../../utils/minecraft/minecraftAPI');
const {
  triggerImmediateBackup
} = require('../../utils/github/backup');
const {
  assignRegisteredRole,
  assignVerifiedRole
} = require('../../utils/roblox/roleManager');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'embed_modal') {
      try {
        const description = interaction.fields.getTextInputValue('description_input');
        const link = interaction.fields.getTextInputValue('link_input');

        const targetChannelId = '1421698609086464021';
        let targetChannel = client.channels.cache.get(targetChannelId);
        if (!targetChannel) {
          try {
            targetChannel = await client.channels.fetch(targetChannelId);
          } catch (err) {
            console.error('Failed to fetch target channel for embed:', err);
          }
        }

        if (!targetChannel) {
          await interaction.reply({ content: '❌ Target channel tidak ditemukan. Pastikan bot memiliki akses ke channel tersebut.', ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setDescription(description)
          .setColor('#2f3136');

        const button = new ButtonBuilder()
          .setLabel('Link')
          .setStyle(ButtonStyle.Link)
          .setURL(link);

        const row = new ActionRowBuilder().addComponents(button);

        await targetChannel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Embed berhasil dikirim.', ephemeral: true });
      } catch (error) {
        console.error('Error handling embed_modal submit:', error);
        try {
          await interaction.reply({ content: '❌ Terjadi kesalahan saat mengirim embed.', ephemeral: true });
        } catch (e) {
          console.error('Failed to send error reply to interaction:', e);
        }
      }
      return;
    }

    if (interaction.customId === 'verify_modal' || interaction.customId === 'reverify_modal') {
        const roblox = interaction.fields.getTextInputValue('roblox_username');

      const userData = {
        userid: interaction.user.id,
        username: interaction.user.username,
        roblox_username: roblox,
        roblox_uid: "",
        roblox_nickname: "",
        verified: false
      };

      const databasePath = path.join(__dirname, '../../database/username.json');

      let data = [];
      try {
        if (fs.existsSync(databasePath)) {
          const fileContent = fs.readFileSync(databasePath, 'utf8');
          if (fileContent.trim()) {
            data = JSON.parse(fileContent);
          }
        }
      } catch (error) {
        console.error('Error reading username.json:', error);
        data = [];
      }

      const existingUser = data.find(u => u.userid === interaction.user.id);
      const existingRoblox = data.find(u => u.roblox_username.toLowerCase() === roblox.toLowerCase() && u.userid !== interaction.user.id);

      if (existingRoblox) {
        return await interaction.reply({
          content: `❌ Username Roblox **${roblox}** sudah digunakan oleh akun lain. Silakan gunakan username yang berbeda atau hubungi admin untuk verifikasi ulang.`,
          ephemeral: true
        });
      }

      if (existingUser && interaction.customId === 'reverify_modal') {
        existingUser.roblox_username = roblox;
        existingUser.verified = false;
        existingUser.roblox_uid = "";
        existingUser.roblox_nickname = "";
      } else if (!existingUser) {
        data.push(userData);
      }

      fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));

      await assignRegisteredRole(client, interaction.user.id);

      setImmediate(async () => {
        try {
          const robloxUid = await robloxAPI.getUserIdByUsername(roblox);
          if (robloxUid) {
            let updatedData = [];
            try {
              if (fs.existsSync(databasePath)) {
                const fileContent = fs.readFileSync(databasePath, 'utf8');
                if (fileContent.trim()) {
                  updatedData = JSON.parse(fileContent);
                }
              }
            } catch (error) {
              console.error('Error reading updated username.json:', error);
              return;
            }

            const userToUpdate = updatedData.find(u => u.userid === interaction.user.id);
            if (userToUpdate) {
              userToUpdate.roblox_uid = robloxUid;

              const profile = await robloxAPI.getUserProfile(robloxUid);
              if (profile) {
                userToUpdate.roblox_nickname = profile.displayName;
                console.log(`Updated nickname for ${roblox}: ${profile.displayName}`);

                const nickname = profile.displayName;
                const base = nickname.slice(-2) === 'DV' ? nickname.slice(0, -2) : nickname;
                const expectedPatterns = [
                  `DV_${base}`,
                  `DVx${base}`,
                  `DV${base}`,
                  `${base}_DV`,
                  `${base}xDV`,
                  `${base}DV`
                ];

                const isVerified = expectedPatterns.some(
                  pattern => nickname.toLowerCase() === pattern.toLowerCase()
                );

                userToUpdate.verified = isVerified;
                console.log(
                  isVerified ?
                  `✅ ${userToUpdate.username} verified with nickname: ${nickname}` :
                  `❌ ${userToUpdate.username} not verified (nickname: ${nickname})`
                );
              }

              fs.writeFileSync(databasePath, JSON.stringify(updatedData, null, 2));
              console.log(`Updated Roblox UID for ${roblox}: ${robloxUid}`);

              const { triggerImmediateBackup } = require('../../utils/github/backup');
              triggerImmediateBackup().catch(err => console.error('Auto-backup failed:', err));
            }
          } else {
            console.log(`❌ Could not find Roblox UID for username: ${roblox}`);
          }
        } catch (error) {
          console.error('❌ Error updating Roblox UID:', error);
        }
      });

      await interaction.reply({
        content: `✅ Username **${roblox}** berhasil disimpan!`,
        ephemeral: true
      });
    }

    if (interaction.customId === 'venity_modal') {
      try {
        const playerName = interaction.fields.getTextInputValue('venity_playername');
        const dbPath = path.join(__dirname, '../../database/venity.json');
        let data = [];
        try {
          if (fs.existsSync(dbPath)) {
            const raw = fs.readFileSync(dbPath, 'utf8');
            if (raw.trim()) data = JSON.parse(raw);
          }
        } catch (e) {
          console.error('Failed to read venity.json:', e);
          data = [];
        }

        const userId = interaction.user.id;
        let entry = data.find(e => e.userid === userId);
        if (!entry) {
          entry = {
            userid: userId,
            username: interaction.user.username,
            playerName: '',
            playerId: null,
            xuid: null,
            guild: null,
            verified: false,
            updatedAt: new Date().toISOString()
          };
          data.push(entry);
        }

        entry.playerName = playerName;
        entry.updatedAt = new Date().toISOString();

        setImmediate(async () => {
          try {
            const api = new MinecraftAPI();
            const allGuilds = await api.getAllBebekGuilds();
            let found = null;
            if (Array.isArray(allGuilds)) {
              for (const g of allGuilds) {
                if (!g || !Array.isArray(g.members)) continue;
                const m = g.members.find(mem => mem.playerName && mem.playerName.toLowerCase() === playerName.toLowerCase());
                if (m) {
                  found = { guild: g, member: m };
                  break;
                }
              }
            }

            if (found) {
              const playerId = found.member.playerId;
              entry.playerId = playerId;
              const profile = await api.getProfileByUUID(String(playerId));
              if (profile) {
                if (profile.xuid) entry.xuid = profile.xuid;
                entry.guild = {
                  id: found.guild.id,
                  name: found.guild.name,
                  tag: found.guild.tag,
                  role: found.member.role
                };

                const profileDiscord = profile.discordId || profile.discordID || profile.discord || null;
                if (profileDiscord && String(profileDiscord) === String(userId)) {
                  entry.verified = true;
                  entry.updatedAt = new Date().toISOString();
                  console.log(`Venity: Verified ${playerName} (playerId=${playerId}, xuid=${entry.xuid}) matching discordId=${profileDiscord}`);

                  try {
                    await assignVerifiedRole(client, userId);
                  } catch (err) {
                    console.error('Failed to assign verified role via roleManager:', err);
                  }
                  try {
                    const guildObj = client.guilds.cache.get(process.env.GUILD_ID);
                    if (guildObj) {
                      const roleIds = require('../../utils/roblox/roleManager').getRoleIds(guildObj.id);
                      const VENITY_ROLE_ID = roleIds.venityRole;
                      const member = await guildObj.members.fetch(userId).catch(() => null);
                      if (member && VENITY_ROLE_ID && !member.roles.cache.has(VENITY_ROLE_ID)) {
                        await member.roles.add(VENITY_ROLE_ID).catch(err => console.error('Failed to add Venity role:', err));
                      }
                    }
                  } catch (err) {
                    console.error('Error assigning Venity-specific role:', err);
                  }

                  try {
                    await interaction.followUp({ content: `✅ Venity verification berhasil — role telah diberikan.`, ephemeral: true });
                  } catch (e) { /* ignore followUp errors */ }
                } else {
                  entry.verified = false;
                  console.log(`Venity: Found ${playerName} (playerId=${playerId}) but discordId did not match (${profileDiscord})`);
                  try {
                    await interaction.followUp({ content: '⚠️ Account Venity tidak terhubung dengan Discord Anda. Silakan verifikasi akun Anda di server Discord Venity (link di server) lalu coba verifikasi ulang di sini.', ephemeral: true });
                  } catch (e) { /* ignore */ }
                }
              } else {
                entry.verified = false;
                console.log(`Venity: Found ${playerName} (playerId=${playerId}) but failed to fetch profile`);
              }
            } else {
              entry.verified = false;
              console.log(`Venity: Player ${playerName} not found in known bebek guilds`);
            }

            try {
              fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            } catch (e) {
              console.error('Failed to write venity.json:', e);
            }

            try { await triggerImmediateBackup(); } catch (e) { console.error('triggerImmediateBackup failed:', e); }
          } catch (err) {
            console.error('Error during Venity lookup:', err);
          }
        });

        await interaction.reply({ content: `✅ Minecraft name **${playerName}** disimpan. Sedang mencari keanggotaan guild...`, ephemeral: true });
      } catch (err) {
        console.error('Error handling venity_modal submit:', err);
        try { await interaction.reply({ content: '❌ Terjadi kesalahan saat memproses verifikasi Venity.', ephemeral: true }); } catch (e) { console.error('Failed to send reply:', e); }
      }
    }
  },
};