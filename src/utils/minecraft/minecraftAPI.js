const axios = require('axios');

class MinecraftAPI {
  constructor() {
    this.venityGuildName = 'https://api.venitymc.com/v2/guild/search/{query}';
    this.venityGuildInformation = 'https://api.venitymc.com/v2/guild/info/{guildId}';
    this.venityProfile = 'https://api.venitymc.com/v2/player/info/{id}';
  }

  static getBebekGuildQueries() {
    return ['bebekslowmo', 'bebekfastmode', 'bebekneumode', 'bebekuniverse'];
  }

  /**
   * Search the guild by name and then fetch its detailed information (members etc).
   * Returns null on failure.
   */
  async getGuildMembersByName(guildName) {
    try {
      if (!guildName) return null;
      const allowed = MinecraftAPI.getBebekGuildQueries();
      if (!allowed.includes(guildName.toLowerCase())) {
        throw new Error(`guildName not allowed: ${guildName}`);
      }

      const search = await this.getGuildByName(guildName);
      if (!search || !Array.isArray(search) || search.length === 0) return null;
      const id = search[0].id;
      if (!id) return null;

      const info = await this.getGuildInformation(id);
      return info || null;
    } catch (error) {
      console.error(`❌ Error in getGuildMembersByName(${guildName}): ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch information for all known bebek guilds.
   * Returns an array of guild info objects (skips failures).
   */
  async getAllBebekGuilds() {
    const queries = MinecraftAPI.getBebekGuildQueries();
    const results = [];
    for (const q of queries) {
      try {
        const info = await this.getGuildMembersByName(q);
        if (info) results.push(info);
      } catch (err) {
        console.error(`⚠️ Failed to fetch bebek guild ${q}: ${err.message}`);
      }
    }
    return results;
  }

  async getGuildByName(guildName) {
    try {
      const response = await axios.get(this.venityGuildName.replace('{query}', guildName), {
        headers: {
          'User-Agent': 'DuckCommunityBot/1.0 (Node.js)'
        },
        timeout: 15000
      });
      return response.data;
    }
    catch (error) {
      console.error(`❌ Error fetching guild by name: ${error.message}`);
      return null;
    }
  }

  async getGuildInformation(guildId) {
    try {
      const response = await axios.get(this.venityGuildInformation.replace('{guildId}', guildId), {
        headers: {
          'User-Agent': 'DuckCommunityBot/1.0 (Node.js)'
        },
        timeout: 15000
      });
      return response.data;
    }
    catch (error) {
      console.error(`❌ Error fetching guild information: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch player info by numeric player id. Returns the player info object (contains xuid).
   * Accepts either numeric id or xuid string; will try the /player/info endpoint first.
   */
  async getProfileByUUID(idOrUuid) {
    try {
      const response = await axios.get(this.venityProfile.replace('{id}', idOrUuid), {
        headers: {
          'User-Agent': 'DuckCommunityBot/1.0 (Node.js)'
        },
        timeout: 15000
      });
      if (response && response.data) return response.data;
    } catch (error) {
      try {
        const alt = 'https://api.venitymc.com/v2/profile/{uuid}';
        const resp2 = await axios.get(alt.replace('{uuid}', idOrUuid), {
          headers: { 'User-Agent': 'DuckCommunityBot/1.0 (Node.js)' },
          timeout: 15000
        });
        if (resp2 && resp2.data) return resp2.data;
      } catch (err2) {
        console.error(`❌ Error fetching profile for ${idOrUuid}: ${error.message} / ${err2.message}`);
        return null;
      }
    }
    return null;
  }
}
module.exports = MinecraftAPI;