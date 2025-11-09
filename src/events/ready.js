const { Events, REST, Routes } = require('discord.js');
const { getCommandFiles } = require('../utils/commandLoader');
const { updateRobloxUIDs } = require('../utils/roblox/updateRobloxUIDs');
const { updateVerifications } = require('../utils/roblox/verifyUser');
const { startScheduler } = require('../utils/roblox/scheduler');
const { backupDatabase } = require('../utils/github/backup');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const commands = [];
    const deployCommandFiles = getCommandFiles('./src/commands');

    for (const file of deployCommandFiles) {
      const command = require(path.resolve(file));
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
      console.log(`Started refreshing ${commands.length} application (/) commands.`);

      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );

      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      console.error('❌ Error refreshing commands:', error);
    }

    const databasePath = path.join(__dirname, '..', 'database', 'username.json');

    async function updatePresence() {
      try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return;

        const serverCount = client.guilds.cache.size;
        const memberCount = guild.memberCount;

        let robloxUsers = 0;
        if (fs.existsSync(databasePath)) {
          const fileContent = fs.readFileSync(databasePath, 'utf8');
          if (fileContent.trim()) {
            const data = JSON.parse(fileContent);
            robloxUsers = data.length;
          }
        }

        const activityNames = [
          `${serverCount} servers`,
          `${memberCount} members`,
          `${robloxUsers} Roblox users`,
          `Duck 🦆`
        ];

        const statuses = ['online', 'idle', 'dnd']; // 'invisible' status is excluded
        const types = [0, 2]; // 0 = Playing, 2 = Listening

        const randomName = activityNames[Math.floor(Math.random() * activityNames.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const randomType = types[Math.floor(Math.random() * types.length)];

        client.user.setPresence({
          activities: [{ name: randomName, type: randomType }],
          status: randomStatus,
        });

        console.log(`🎮 Presence updated → "${randomName}" [${randomStatus}]`);
      } catch (err) {
        console.error('❌ Error updating presence:', err);
      }
    }

    await updatePresence();
    setInterval(updatePresence, 60 * 1000);

    console.log('🔄 Checking for missing Roblox UIDs...');
    await updateRobloxUIDs();

    console.log('🔍 Checking for auto-verifications...');
    await updateVerifications();

    startScheduler(client);

    setInterval(async () => {
      console.log('💾 Auto-backup triggered...');
      await backupDatabase();
    }, 1000 * 60 * 30);
  },
};
