const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder } = require('discord.js');

const sessionsPath = path.join(__dirname, '../database/sessions.json');
let client = null;
const timeouts = new Map();
const sessions = new Map();

function loadFromDisk() {
  try {
    if (!fs.existsSync(sessionsPath)) return;
    const content = fs.readFileSync(sessionsPath, 'utf8');
    if (!content.trim()) return;
    const parsed = JSON.parse(content);
    for (const [key, value] of Object.entries(parsed)) {
      sessions.set(key, value);
    }
  } catch (err) {
    console.error('Failed to load sessions from disk:', err);
  }
}

function saveToDisk() {
  try {
    const obj = {};
    for (const [k, v] of sessions.entries()) obj[k] = v;
    fs.writeFileSync(sessionsPath, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to persist sessions to disk:', err);
  }
}

async function runDisable(key) {
  const session = sessions.get(key);
  if (!session) return;

  try {
    if (!client) throw new Error('Scheduler client not set');
    const channel = await client.channels.fetch(session.channelId).catch(() => null);
    if (!channel) {
      console.warn('Scheduler: channel not found for session', key);
      sessions.delete(key);
      saveToDisk();
      return;
    }

    const message = await channel.messages.fetch(session.messageId).catch(() => null);
    if (!message) {
      console.warn('Scheduler: message not found for session', key);
      sessions.delete(key);
      saveToDisk();
      return;
    }

    if (session.type === 'leaderboard') {
      try {
        const leaderboard = require('../../commands/profile/leaderboard');
        const disabled = leaderboard.createButtons(
          session.meta.page,
          session.meta.totalPages,
          session.meta.sort,
          session.meta.displayMode,
          session.meta.originalUserId,
          true
        );
        await message.edit({ components: [disabled] });
      } catch (err) {
        console.error('Scheduler: failed to disable leaderboard message', err);
      }
    } else if (session.type === 'verify') {
      try {
        const newRows = message.components.map(r => ActionRowBuilder.from(r));
        for (const row of newRows) {
          for (let i = 0; i < row.components.length; i++) {
            try {
              const btn = ButtonBuilder.from(row.components[i]);
              btn.setDisabled(true);
              row.components[i] = btn;
            } catch (e) {
            }
          }
        }
        await message.edit({ components: newRows });
      } catch (err) {
        console.error('Scheduler: failed to disable verify message', err);
      }
    }
  } catch (err) {
    console.error('Scheduler runDisable error:', err);
  } finally {
    clearTimeoutForKey(key);
    sessions.delete(key);
    saveToDisk();
  }
}

function clearTimeoutForKey(key) {
  const t = timeouts.get(key);
  if (t) {
    clearTimeout(t);
    timeouts.delete(key);
  }
}

function schedule(session) {
  try {
    if (!session || !session.key) throw new Error('Invalid session');
    sessions.set(session.key, session);
    saveToDisk();

    const now = Date.now();
    const delay = Math.max(0, session.expiresAt - now);

    clearTimeoutForKey(session.key);

    const t = setTimeout(() => runDisable(session.key), delay);
    timeouts.set(session.key, t);
  } catch (err) {
    console.error('Failed to schedule session:', err);
  }
}

function clear(key) {
  try {
    clearTimeoutForKey(key);
    const existed = sessions.delete(key);
    saveToDisk();
    return existed;
  } catch (err) {
    console.error('Failed to clear scheduled session:', err);
    return false;
  }
}

function init(_client) {
  client = _client;
  loadFromDisk();
  for (const [key, session] of sessions.entries()) {
    const now = Date.now();
    if (session.expiresAt <= now) {
      runDisable(key);
    } else {
      const delay = session.expiresAt - now;
      const t = setTimeout(() => runDisable(key), delay);
      timeouts.set(key, t);
    }
  }
}

module.exports = {
  init,
  schedule,
  clear,
  _sessions: sessions
};
