const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');

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

                let botMessages = [];
                try {
                    const messages = await channelObj.messages.fetch({ limit: 50 });
                    botMessages = messages.filter(m =>
                        m.author && m.author.id === client.user.id &&
                        (
                            (m.embeds && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Temporary Voice Setup') || m.embeds[0].title.includes('Voice Channel Configuration'))) ||
                            (m.components && m.components.length > 0)
                        )
                    );
                    console.log(`🔍 Found ${botMessages.size} existing bot message(s) in channel ${ch}`);
                } catch (e) {
                    console.error(`❌ Error fetching messages in channel ${ch}:`, e);
                }

                const attachment = new AttachmentBuilder(path.join(__dirname, '../../assets/img/voice_banners.png'), { name: 'voice_banners.png' });

                const embed = new EmbedBuilder()
                    .setTitle('Voice Channel Configuration')
                    .setDescription(`Konfigurasi ini dapat digunakan untuk mengelola voice channel dari <@1203600776048414720>.\nJika mencoba mengonfigurasi channel lain, mungkin tidak berfungsi.\n\nLobby saat ini: ${voiceCfg.lobby ? `<#${voiceCfg.lobby}>` : 'Belum diatur'}`)
                    .setColor('#5865F2')
                    .setImage('attachment://voice_banners.png');
                const Rows = [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('voice_btn_rename').setEmoji('<:name_1:1444497646554320906>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_btn_limit').setEmoji('<:limit_1:1444497644658495590>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_btn_region').setEmoji('<:region_1:1444497649007984680>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_btn_kick').setEmoji('<:kick_1:1444497642506948722>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_btn_bitrate').setEmoji('<:bitrate_1:1444497627046612992>').setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('voice_disable1').setLabel('─').setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('voice_btn_privacy').setEmoji('<:privacy:1444822572054216885>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_disable2').setLabel('─').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('voice_disable3').setLabel('─').setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('voice_btn_info').setEmoji('<:info_1:1444497632746803412>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_btn_transfer').setEmoji('<:transfer_1:1444497651159662603>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_btn_claim').setEmoji('<:claim_1:1444497629634629724>').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_disable4').setLabel('─').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    )
                ];

                if (botMessages.size > 0) {
                    try {
                        const firstMsg = botMessages.first();
                        await firstMsg.edit({ embeds: [embed], components: [...Rows], files: [attachment] });
                    } catch (e) {
                        console.error(`❌ Failed to update bot message in channel ${ch}:`, e);
                    }
                } else {
                    try {
                        await channelObj.send({ embeds: [embed], files: [attachment], components: [...Rows] });
                    } catch (e) {
                        console.error(`❌ Failed to send bot message in channel ${ch}:`, e);
                    }
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