const fs = require('fs');
const path = require('path');

function getEventFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getEventFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadEvents(client, eventsPath) {
  const eventFiles = getEventFiles(eventsPath);
  for (const file of eventFiles) {
    try {
      const event = require(path.resolve(file));

      if (!event.name || !event.execute) {
        console.warn(`⚠️  Skipped ${file} (missing name/execute).`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      console.log(`✅ Loaded event: ${event.name}`);
    } catch (error) {
      console.error(`❌ Error loading event from ${file}:`, error.message);
    }
  }
}

module.exports = {
  loadEvents,
  getEventFiles
};