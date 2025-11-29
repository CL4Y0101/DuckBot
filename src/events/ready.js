const { Events, REST, Routes } = require('discord.js');
const { getCommandFiles } = require('../utils/commandLoader');
const { updateRobloxUIDs } = require('../utils/roblox/updateRobloxUIDs');
const verificationService = require('../utils/roblox/verifyUser');
const { startScheduler } = require('../utils/roblox/scheduler');
const { triggerImmediateBackup, checkAndPullRemoteChanges, startBackupWatcher } = require('../utils/github/backup');
const inviteTracker = require('../utils/inviteTracker');
const fs = require('fs');
const path = require('path');
const { publishVoiceSetupEmbeds } = require('../utils/voice/publisher');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    await this.deployCommands();

    await this.initializePresence(client);

    await this.initializeServices(client);

    console.log('🚀 All systems initialized and ready!');
  },

  async deployCommands() {
    try {
      const commands = [];
      const deployCommandFiles = getCommandFiles('./src/commands');

      for (const file of deployCommandFiles) {
        const command = require(path.resolve(file));
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        }
      }

      const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

      console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );

      console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      console.error('❌ Error refreshing commands:', error);
    }
  },

  async initializePresence(client) {
    const databasePath = path.join(__dirname, '..', 'database', 'username.json');

    const updatePresence = async () => {
      try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return;

        const serverCount = client.guilds.cache.size;
        const memberCount = guild.memberCount;

        let robloxUsers = 0;
        let verifiedUsers = 0;

        if (fs.existsSync(databasePath)) {
          const fileContent = fs.readFileSync(databasePath, 'utf8');
          if (fileContent.trim()) {
            const data = JSON.parse(fileContent);
            robloxUsers = data.length;
            verifiedUsers = data.filter(user => user.verified).length;
          }
        }

        const activityNames = [
          `${serverCount} servers`,
          `${memberCount} members`,
          `${robloxUsers} Roblox users`,
          `${verifiedUsers} verified users`,
          `Duck 🦆`
        ];

        const statuses = ['online', 'idle', 'dnd'];
        const types = [0, 2, 3]; // 0 = Playing, 2 = Listening, 3 = Watching

        const randomName = activityNames[Math.floor(Math.random() * activityNames.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const randomType = types[Math.floor(Math.random() * types.length)];

        client.user.setPresence({
          activities: [{ name: randomName, type: randomType }],
          status: randomStatus,
        });

        console.log(`🔄 Presence updated: ${randomName} (${randomStatus})`);

      } catch (err) {
        console.error('❌ Error updating presence:', err);
      }
    };

    await updatePresence();

    setInterval(updatePresence, 2 * 60 * 1000);
  },

  async initializeServices(client) {
    try {
      console.log('🔄 Initializing services...');

      try {
        console.log('🔽 Pulling remote database before initializing services...');
        await checkAndPullRemoteChanges();
        console.log('✅ Remote database pull completed');
      } catch (err) {
        console.error('❌ Initial pull of remote database failed:', err && err.message ? err.message : err);
      }

      console.log('📊 Updating Roblox UIDs...');
      await updateRobloxUIDs();
      console.log('✅ Roblox UIDs updated');

      console.log('🔍 Running initial verification check...');
      await verificationService.updateVerifications(process.env.GUILD_ID);
      console.log('✅ Initial verification check completed');

      console.log('⏰ Starting verification scheduler...');
      startScheduler(client);
      console.log('✅ Scheduler started');

      try {
        const sessionScheduler = require('../utils/disableButton/sessionScheduler');
        sessionScheduler.init(client);
        console.log('✅ Session scheduler initialized');
      } catch (err) {
        console.error('❌ Failed to initialize session scheduler:', err.message);
      }

      console.log('💾 Initializing backup system...');
      await this.initializeBackupSystem();
      console.log('✅ Backup system initialized');

      console.log('📨 Initializing invite tracking...');
      try {
        const guildConfigPath = path.join(__dirname, '..', 'database', 'guild.json');
        if (fs.existsSync(guildConfigPath)) {
          const raw = fs.readFileSync(guildConfigPath, 'utf8');
          const parsed = JSON.parse(raw);
          const entries = [];
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && typeof item === 'object') {
                for (const key of Object.keys(item)) entries.push({ guildId: key, config: item[key] });
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            for (const key of Object.keys(parsed)) {
              const val = parsed[key];
              if (val && typeof val === 'object' && val.tracking !== undefined) {
                entries.push({ guildId: key, config: val });
              } else if (Array.isArray(val)) {
                for (const item of val) if (item && item[key]) entries.push({ guildId: key, config: item[key] });
              }
            }
          }

          for (const e of entries) {
            try {
              const cfg = e.config || {};
              if (cfg.tracking && cfg.tracking.enabled) {
                const ch = cfg.tracking.channel || process.env.INVITE_TRACKER_CHANNEL;
                if (!ch) {
                  console.warn(`⚠️ Invite tracking enabled for guild ${e.guildId} but no tracking.channel configured and no INVITE_TRACKER_CHANNEL env var set.`);
                } else {
                  const chObj = client.channels.cache.get(ch);
                  if (!chObj) {
                    console.warn(`⚠️ Tracking channel ${ch} for guild ${e.guildId} not found in cache. Ensure the channel ID is correct and the bot has access.`);
                  }
                }
              }
            } catch (err) {
            }
          }
        }
      } catch (err) {
        console.error('❌ Error validating guild tracking config:', err);
      }

      await inviteTracker.initializeGuild(client, process.env.GUILD_ID);
      console.log('✅ Invite tracking initialized');

      // publish voice setup embed to configured channels (implementation in utils/voice/publisher)
      try {
        await publishVoiceSetupEmbeds(client);
        console.log('✅ Voice setup embeds published');
      } catch (err) {
        console.error('❌ Failed to publish voice setup embeds:', err);
      }

    } catch (error) {
      console.error('❌ Error initializing services:', error);
    }
  },

  async initializeBackupSystem() {
    try {
      await triggerImmediateBackup();
      console.log('✅ Initial backup completed');
    } catch (error) {
      console.error('❌ Initial backup failed:', error.message);
    }

    try {
      startBackupWatcher();
    } catch (err) {
      console.error('❌ Failed to start backup watcher:', err.message);
    }

    setInterval(async () => {
      try {
        console.log('💾 Running scheduled backup...');
        await triggerImmediateBackup();
        console.log('✅ Scheduled backup completed');
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error.message);
      }
    }, 5 * 60 * 1000); // 5 minutes

    setInterval(async () => {
      try {
        await checkAndPullRemoteChanges();
      } catch (error) {
        console.error('❌ Scheduled pull failed:', error.message);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

// publishVoiceSetupEmbeds moved to src/utils/voice/publisher.js
};