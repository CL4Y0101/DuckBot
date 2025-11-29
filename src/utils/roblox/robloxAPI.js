const axios = require('axios');

class RobloxAPI {
  constructor() {
    this.baseURL = 'https://users.roblox.com/v1';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getUserIdByUsername(username, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `https://users.roblox.com/v1/usernames/users`, {
          usernames: [username]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DuckCommunityBot/1.0 (Node.js)'
          },
          timeout: 15000
        }
        );

        const users = response.data.data;
        if (!users || users.length === 0) {
          console.warn(`⚠️ No user found for ${username}`);
          return null;
        }

        const user = users[0];
        return user.id.toString();
      } catch (error) {
        if (error.response && error.response.status === 429) {
          console.warn(`⚠️ Roblox API rate limited (429) — attempt ${attempt}/${retries}`);
          await this.delay(2000 * attempt);
          continue;
        }

        console.error(`❌ Error fetching Roblox user ID: ${error.message}`);
        return null;
      }
    }

    console.error(`❌ Failed to fetch Roblox user ID for ${username} after ${retries} attempts`);
    return null;
  }

  async getUserProfile(userId) {
    try {
      const response = await axios.get(`${this.baseURL}/users/${userId}`, {
        headers: {
          'User-Agent': 'DuckCommunityBot/1.0 (Node.js)'
        },
        timeout: 15000
      });
      return {
        name: response.data.name,
        displayName: response.data.displayName,
        created: response.data.created,
        description: response.data.description
      };
    } catch (error) {
      console.error('Error fetching Roblox user profile:', error.message);
      return null;
    }
  }

  async getAvatarUrl(userId) {
    try {
      const response = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`, {
        headers: {
          'User-Agent': 'DuckCommunityBot/1.0 (Node.js)'
        },
        timeout: 15000
      });
      const data = response.data.data;
      if (data && data.length > 0) {
        return data[0].imageUrl;
      }
      return null;
    } catch (error) {
      console.error('Error fetching Roblox avatar:', error.message);
      return null;
    }
  }
}

module.exports = new RobloxAPI();