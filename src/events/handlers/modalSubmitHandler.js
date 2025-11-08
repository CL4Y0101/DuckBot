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
const { backupDatabase } = require('../../utils/github/backup');
const { assignRegisteredRole } = require('../../utils/roblox/roleManager');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;

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

      if (existingUser && interaction.customId === 'verify_modal') {
        const robloxProfileUrl = existingUser.roblox_uid ? `https://www.roblox.com/users/${existingUser.roblox_uid}/profile` : null;

        const embed = new EmbedBuilder()
          .setTitle('🔍 Your Roblox Verification Status')
          .setDescription(`**Discord:** ${interaction.user.username}\n**Roblox Username:** ${existingUser.roblox_username}\n**Roblox Display Name:** ${existingUser.roblox_nickname || 'Not fetched yet'}\n**Verified:** ${existingUser.verified ? '✅ Yes' : '❌ No'}`)
          .setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL({
              dynamic: true
            }),
            url: robloxProfileUrl
          })
          .setColor(existingUser.verified ? '#00ff00' : '#ff6b6b')
          .setTimestamp();

        const button = new ButtonBuilder()
          .setCustomId('reverify_button')
          .setLabel('Reverify your username')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(button);

        return await interaction.reply({
          embeds: [embed],
          components: [row],
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
                  isVerified
                    ? `✅ ${userToUpdate.username} verified with nickname: ${nickname}`
                    : `❌ ${userToUpdate.username} not verified (nickname: ${nickname})`
                );
              }

              fs.writeFileSync(databasePath, JSON.stringify(updatedData, null, 2));
              console.log(`Updated Roblox UID for ${roblox}: ${robloxUid}`);

              backupDatabase().catch(err => console.error('Auto-backup failed:', err));
            }
          } else {
            console.log(`Could not find Roblox UID for username: ${roblox}`);
          }
        } catch (error) {
          console.error('Error updating Roblox UID:', error);
        }
      });

      await interaction.reply({
        content: `✅ Username **${roblox}** berhasil disimpan!`,
        ephemeral: true
      });
    }
  },
};