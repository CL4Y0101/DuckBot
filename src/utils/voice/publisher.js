const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function publishVoiceSetupEmbeds(client) {
    try {
        const guildConfigPath = path.join(__dirname, '..', '..', 'database', 'guild.json');
        if (!fs.existsSync(guildConfigPath)) return;
        const raw = fs.readFileSync(guildConfigPath, 'utf8');
        const parsed = raw.trim() ? JSON.parse(raw) : null;
        if (!parsed) return;

        const entries = [];
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (item && typeof item === 'object') {
                    for (const key of Object.keys(item)) entries.push({ guildId: key, config: item[key] });
                }
            }
        } else if (parsed && typeof parsed === 'object') {
            for (const key of Object.keys(parsed)) entries.push({ guildId: key, config: parsed[key] });
        }

        for (const e of entries) {
            try {
                const cfg = e.config || {};
                const voiceCfg = cfg.voice || cfg.TempVoice || {};
                const ch = voiceCfg.channel || null;
                if (!ch) continue;
                const channelObj = client.channels.cache.get(ch);
                if (!channelObj) continue;

                let botMessage = null;
                try {
                    const messages = await channelObj.messages.fetch({ limit: 50 });
                    botMessage = messages.find(m => m.author && m.author.id === client.user.id && m.embeds && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Temporary Voice Setup'));
                } catch (e) {
                }

                const embed = new EmbedBuilder()
                    .setTitle('Temporary Voice Setup')
                    .setDescription(`Gunakan perintah atau klik tombol (nanti) untuk menetapkan voice channel aktif sebagai lobby.\n\nCurrent lobby: ${voiceCfg.lobby ? `<#${voiceCfg.lobby}>` : 'Not set'}`)
                    .setColor('#5865F2');

                if (botMessage) {
                    try { await botMessage.edit({ embeds: [embed] }); } catch (e) { }
                } else {
                    try { await channelObj.send({ embeds: [embed] }); } catch (e) { }
                }
            } catch (err) {
                console.error('Failed to publish voice setup embed for entry:', err);
            }
        }
    } catch (err) {
        console.error('Error publishing voice setup embeds:', err);
    }
}

module.exports = { publishVoiceSetupEmbeds };
