const {
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const robloxAPI = require('../../utils/roblox/robloxAPI');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'verify_modal') {
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

      const existing = data.find(u => u.userid === interaction.user.id);
      if (existing) {
        existing.roblox_username = roblox;
        existing.verified = false;
        existing.roblox_uid = "";
        existing.roblox_nickname = "";
      } else {
        data.push(userData);
      }

      fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));

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
              }

              fs.writeFileSync(databasePath, JSON.stringify(updatedData, null, 2));
              console.log(`Updated Roblox UID for ${roblox}: ${robloxUid}`);
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