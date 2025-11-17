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
            // Normalize userid ke string untuk konsistensi
            const normalizedUserid = String(userid);
            
            const data = this.loadDatabase();
            const user = data.find(u => String(u.userid) === normalizedUserid);
            
            if (!user) {
                console.log(`❌ User ${normalizedUserid} not found in database (total users in DB: ${data.length})`);
                // Tambahan debug: show first few userids
                if (data.length > 0) {
                    const sampleIds = data.slice(0, 3).map(u => u.userid).join(', ');
                    console.log(`   Sample user IDs in DB: ${sampleIds}...`);
                }
                return false;
            }

            if (user.verified) return true;

            await this.updateUserProfile(user);

            if (!user.roblox_nickname) return false;

            const isVerified = this.checkVerification(user.roblox_nickname, guildid);
            
            if (user.verified !== isVerified) {
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

            for (const user of data) {
                if (!user.roblox_uid) continue;

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
                console.log(`💾 Database updated - ${processed} users processed`);
            } else {
                console.log(`ℹ️ No verification changes - ${processed} users checked`);
            }

        } catch (err) {
            console.error('❌ Error updating verifications:', err);
        }
    }

    checkVerification(nickname, guildid = null) {
        if (!nickname) return false;

        const guildConfig = this.loadGuildConfig(guildid);
        const patterns = this.generatePatterns(nickname, guildConfig);
        
        // Check jika pattern match
        const patternMatch = patterns.some(pattern => 
            this.matchPattern(nickname, pattern)
        );
        
        // Jika pattern match, return true
        if (patternMatch) return true;
        
        // Jika tidak, check apakah nickname mengandung salah satu suffix (case-insensitive)
        if (guildConfig && Object.keys(guildConfig).length > 0) {
            const suffixes = Object.keys(guildConfig).filter(k => guildConfig[k]);
            const nicknameLower = nickname.toLowerCase();
            
            // Check jika nickname contain any suffix
            return suffixes.some(suffix => nicknameLower.includes(suffix.toLowerCase()));
        }
        
        // Default suffixes
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
        
        // Add lowercase variant if different from original
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
        
        // Add uppercase variant if different from original
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
            .replace(/\*/g, '.*') // Wildcard support
            .replace(/\?/g, '.'); // Single char wildcard
            
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
                const profile = await robloxAPI.getUserProfile(user.roblox_uid);
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
            fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));
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