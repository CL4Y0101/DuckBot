const fs = require('fs');
const path = require('path');

function getCommandFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getCommandFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadCommands(client, commandsPath) {
  const commandFiles = getCommandFiles(commandsPath);
  // console.log('Loading commands from:', commandFiles);
  for (const file of commandFiles) {
    try {
      const command = require(path.resolve(file));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`Error loading command from ${file}:`, error.message);
    }
  }
}

module.exports = {
  loadCommands,
  getCommandFiles
};