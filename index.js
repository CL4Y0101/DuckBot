require('dotenv').config({
  quiet: true
});
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./src/utils/commandLoader');
const { loadEvents } = require('./src/utils/eventLoader');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();

loadCommands(client, './src/commands');
loadEvents(client, './src/events');

client.login(process.env.TOKEN);
