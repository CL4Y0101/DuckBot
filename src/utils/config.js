const fs = require('fs');
const path = require('path');

let cached = null;

function parseConfigFile(filePath) {
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const lines = fileContents.split('\n');
  const config = {};
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (trimmed.endsWith(':')) {
      currentSection = trimmed.slice(0, -1);
      config[currentSection] = {};
    } else if (currentSection && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      let value = valueParts.join(':').trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = [];
        }
      } else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && value !== '') value = Number(value);

      config[currentSection][key.trim()] = value;
    }
  }

  return config;
}

function getConfig() {
  if (cached) return cached;
  try {
    const configPath = path.join(__dirname, '..', '..', 'config.yml');
    if (!fs.existsSync(configPath)) return {};
    cached = parseConfigFile(configPath);
    return cached;
  } catch (e) {
    console.error('Error loading config:', e.message);
    return {};
  }
}

module.exports = { getConfig };
