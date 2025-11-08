const {
  Events
} = require('discord.js');
const {
  REST,
  Routes
} = require('discord.js');
const {
  getCommandFiles
} = require('../utils/commandLoader');
const {
  updateRobloxUIDs
} = require('../utils/updateRobloxUIDs');
const {
  updateVerifications
} = require('../utils/verifyUser');
const {
  startScheduler
} = require('../utils/scheduler');
const path = require('path');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
client.user.setPresence({
  activities: [{
    name: 'Duck 🦆',
    type: 2, // 0 = Playing, 2 = Listening, 3 = Watching, 5 = Competing
  }],
  status: 'dnd', // 'online' | 'idle' | 'dnd' | 'invisible'
});
    const commands = [];
    const deployCommandFiles = getCommandFiles('./src/commands');

    for (const file of deployCommandFiles) {
      const command = require(path.resolve(file));
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      }
    }

    const rest = new REST({
      version: '10'
    }).setToken(process.env.TOKEN);

    try {
      console.log(`Started refreshing ${commands.length} application (/) commands.`);

      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
          body: commands
        },
      );

      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      console.error(error);
    }

    console.log('🔄 Checking for missing Roblox UIDs...');
    await updateRobloxUIDs();

    console.log('🔍 Checking for auto-verifications...');
    await updateVerifications();

    startScheduler(client);
  },
};
