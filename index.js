require('dotenv').config({
  quiet: true
});
const {
  Client,
  GatewayIntentBits,
  Collection
} = require('discord.js');
const {
  loadCommands
} = require('./src/utils/commandLoader');
const {
  loadEvents
} = require('./src/utils/eventLoader');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

loadCommands(client, './src/commands');
loadEvents(client, './src/events');

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

client.on('error', error => {
  console.error('❌ Discord Client Error:', error);
});

client.on('warn', warning => {
  console.warn('⚠️ Discord Client Warning:', warning);
});

client.login(process.env.TOKEN);