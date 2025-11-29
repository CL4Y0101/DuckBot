const fs = require('fs');
const path = require('path');
const robloxAPI = require('./robloxAPI');

const databasePath = path.join(__dirname, '../../database/username.json');
const guildDatabasePath = path.join(__dirname, '../../database/guild.json');

class VerificationService {
    constructor() {
        this.cache = new Map();
    }

    async verifyUser(userid, guildid = null) {
        try {
            const normalizedUserid = String(userid);

            const data = this.loadDatabase();
            const user = data.find(u => String(u.userid) === normalizedUserid);

            if (!user) {
                console.log(`❌ User ${normalizedUserid} not found in database (total users in DB: ${data.length})`);
                if (data.length > 0) {
                    const sampleIds = data.slice(0, 3).map(u => u.userid).join(', ');
                    console.log(`   Sample user IDs in DB: ${sampleIds}...`);
                }
                return false;
            }

            await this.updateUserProfile(user);

            try {
                const prevEntry = data.find(u => String(u.userid) === normalizedUserid) || {};
                const prevNick = prevEntry.roblox_nickname || '<none>';
                const prevVerified = !!prevEntry.verified;
                console.log(`🔍 verifyUser start: userid=${normalizedUserid} prevNick=${prevNick} prevVerified=${prevVerified}`);
            } catch (e) { }

            if (!user.roblox_nickname) {
                if (user.verified) {
                    console.log(`ℹ️ Clearing verified flag for ${normalizedUserid} because display name not available`);
                    user.verified = false;
                    this.saveDatabase(data);
                }
                return false;
            }

            const isVerified = this.checkVerification(user.roblox_nickname, guildid);

            if (user.verified !== isVerified) {
                console.log(`🔁 verifyUser: userid=${normalizedUserid} nick=${user.roblox_nickname} isVerified=${isVerified} (was ${user.verified})`);
                user.verified = isVerified;
                this.saveDatabase(data);
            }

            console.log(
                isVerified
                    ? `✅ ${user.username} verified with nickname: ${user.roblox_nickname} (guild: ${guildid || 'default'})`
                    : `❌ ${user.username} not verified (nickname: ${user.roblox_nickname}) (guild: ${guildid || 'default'})`
            );

            return isVerified;

        } catch (err) {
            console.error('❌ Error verifying user:', err);
            return false;
        }
    }

    async updateVerifications(guildid = null) {
        try {
            const data = this.loadDatabase();
            let updated = false;
            let processed = 0;
            let skipped = 0;

            for (const user of data) {
                if (!user.roblox_uid) {
                    skipped++;
                    continue;
                }

                if (user.verified) {
                    skipped++;
                    continue;
                }

                await this.updateUserProfile(user);

                const isVerified = this.checkVerification(user.roblox_nickname, guildid);

                if (user.verified !== isVerified) {
                    user.verified = isVerified;
                    updated = true;

                    console.log(
                        isVerified
                            ? `✅ Auto-verified ${user.username} (${user.roblox_nickname})`
                            : `❌ Auto-unverified ${user.username} (${user.roblox_nickname})`
                    );
                }

                processed++;

                if (processed % 5 === 0) {
                    await this.delay(500);
                }
            }

            if (updated) {
                this.saveDatabase(data);
                console.log(`💾 Database updated - ${processed} users checked, ${skipped} skipped`);
            } else {
                console.log(`ℹ️ No verification changes - ${processed} users checked, ${skipped} skipped`);
            }

        } catch (err) {
            console.error('❌ Error updating verifications:', err);
        }
    }

    checkVerification(nickname, guildid = null) {
        if (!nickname) return false;

        const guildConfig = this.loadGuildConfig(guildid);
        const patterns = this.generatePatterns(nickname, guildConfig);

        const patternMatch = patterns.some(pattern =>
            this.matchPattern(nickname, pattern)
        );

        if (patternMatch) return true;

        if (guildConfig && Object.keys(guildConfig).length > 0) {
            const suffixes = Object.keys(guildConfig).filter(k => guildConfig[k]);
            const nicknameLower = nickname.toLowerCase();

            return suffixes.some(suffix => nicknameLower.includes(suffix.toLowerCase()));
        }

        const nicknameLower = nickname.toLowerCase();
        return nicknameLower.includes('dv');
    }

    generatePatterns(nickname, guildConfig) {
        const patterns = [];

        if (guildConfig && Object.keys(guildConfig).length > 0) {
            Object.keys(guildConfig).forEach(suffix => {
                if (guildConfig[suffix]) {
                    patterns.push(...this.createSuffixPatterns(nickname, suffix));
                }
            });
        } else {
            patterns.push(...this.createSuffixPatterns(nickname, 'DV'));
            patterns.push(...this.createSuffixPatterns(nickname, 'dv'));
        }

        return [...new Set(patterns)];
    }

    createSuffixPatterns(displayName, suffix) {
        const patterns = [
            `${suffix}_${displayName}`,
            `${suffix}x${displayName}`,
            `${suffix}${displayName}`,
            `${displayName}_${suffix}`,
            `${displayName}x${suffix}`,
            `${displayName}${suffix}`
        ];

        const lowerSuffix = suffix.toLowerCase();
        if (lowerSuffix !== suffix) {
            patterns.push(
                `${lowerSuffix}_${displayName}`,
                `${lowerSuffix}x${displayName}`,
                `${lowerSuffix}${displayName}`,
                `${displayName}_${lowerSuffix}`,
                `${displayName}x${lowerSuffix}`,
                `${displayName}${lowerSuffix}`
            );
        }

        const upperSuffix = suffix.toUpperCase();
        if (upperSuffix !== suffix && upperSuffix !== lowerSuffix) {
            patterns.push(
                `${upperSuffix}_${displayName}`,
                `${upperSuffix}x${displayName}`,
                `${upperSuffix}${displayName}`,
                `${displayName}_${upperSuffix}`,
                `${displayName}x${upperSuffix}`,
                `${displayName}${upperSuffix}`
            );
        }

        return patterns;
    }

    matchPattern(nickname, pattern) {
        if (nickname.toLowerCase() === pattern.toLowerCase()) {
            return true;
        }

        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');

        try {
            const regex = new RegExp(`^${regexPattern}$`, 'i');
            return regex.test(nickname);
        } catch {
            return false;
        }
    }

    async updateUserProfile(user) {
        try {
            if (user.roblox_uid) {

                const profilePromise = robloxAPI.getUserProfile(user.roblox_uid);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Roblox API timeout')), 10000)
                );

                const profile = await Promise.race([profilePromise, timeoutPromise]);
                if (profile?.displayName) {
                    user.roblox_nickname = profile.displayName;
                }
            }
        } catch (error) {
            console.log(`⚠️ Failed to update profile for ${user.username}:`, error.message);
        }
    }

    loadDatabase() {
        try {
            if (!fs.existsSync(databasePath)) {
                console.warn(`⚠️ Database file not found at: ${databasePath}`);
                return [];
            }

            const content = fs.readFileSync(databasePath, 'utf8');

            if (!content.trim()) {
                console.warn(`⚠️ Database file is empty at: ${databasePath}`);
                return [];
            }

            try {
                const data = JSON.parse(content);
                if (!Array.isArray(data)) {
                    console.error(`❌ Database is not an array! Type: ${typeof data}`);
                    return [];
                }
                return data;
            } catch (parseError) {
                console.error(`❌ Error parsing JSON from database: ${parseError.message}`);
                console.error(`❌ File content length: ${content.length} characters`);
                console.error(`❌ First 200 chars: ${content.substring(0, 200)}`);
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading database file:', error);
            return [];
        }
    }

    loadGuildConfig(guildid) {
        try {
            if (!fs.existsSync(guildDatabasePath)) return null;
            const content = fs.readFileSync(guildDatabasePath, 'utf8');
            const data = content.trim() ? JSON.parse(content) : {};
            return guildid ? data[guildid] : null;
        } catch (error) {
            console.error('❌ Error loading guild config:', error);
            return null;
        }
    }

    saveDatabase(data) {
        try {
            const deduped = Array.from(
                data.reduce((map, item) => {
                    map.set(String(item.userid), item);
                    return map;
                }, new Map()).values()
            );
            fs.writeFileSync(databasePath, JSON.stringify(deduped, null, 2));
            try {
                const stat = fs.statSync(databasePath);
                console.log(`💾 Saved database (${deduped.length} entries) at ${databasePath} mtime=${new Date(stat.mtimeMs).toISOString()}`);
            } catch { }
        } catch (error) {
            console.error('❌ Error saving database:', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const instance = new VerificationService();

if (!instance.loadDatabase) {
    throw new Error('VerificationService instance tidak memiliki method loadDatabase');
}

module.exports = instance;