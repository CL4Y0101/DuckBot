const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

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
                    botMessage = messages.find(m => m.author && m.author.id === client.user.id && m.embeds && m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Temporary Voice Setup') || m.embeds[0].title.includes('Voice Channel Configuration')));
                    console.log(`🔍 Checking for existing bot message in channel ${ch}: ${botMessage ? 'Found' : 'Not found'}`);
                } catch (e) {
                    console.error(`❌ Error fetching messages in channel ${ch}:`, e);
                }

                const embed = new EmbedBuilder()
                    .setTitle('Voice Channel Configuration')
                    .setDescription(`This **Configuration** can be used to manage voice channels from <@1203600776048414720>.\nHowever if u try to Configuration different channel, it might cant\n\nCurrent lobby: ${voiceCfg.lobby ? `<#${voiceCfg.lobby}>` : 'Not set'}`)
                    .setColor('#5865F2');
                // .setImage('attachment://voice_banners.png');

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('voice_btn_rename').setEmoji('<:name:1444180316284649503>').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('voice_btn_limit').setEmoji('<:limit:1444180214845407353>').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('voice_btn_region').setEmoji('<:region:1444180378549223588>').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('voice_btn_kick').setEmoji('<:kick:1444180450443657307>').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('voice_btn_bitrate').setEmoji('<:bitrate:1444180148202111120>').setStyle(ButtonStyle.Secondary)
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('voice_disable_left').setLabel('-').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('voice_btn_claim').setEmoji('<:claim:1444180511437357169>').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('voice_btn_info').setEmoji('<:info:1444180599517610079>').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('voice_btn_transfer').setEmoji('<:transfer:1444180697911787590>').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('voice_disable_right').setLabel('-').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );

                const components = [row1, row2];

                if (botMessage) {
                    try {
                        await botMessage.edit({ embeds: [embed], components });
                        console.log(`✅ Edited existing bot message in channel ${ch}`);
                    } catch (e) {
                        console.error(`❌ Failed to edit bot message in channel ${ch}:`, e);
                    }
                } else {
                    try {
                        await channelObj.send({ embeds: [embed], components });
                        console.log(`✅ Sent new bot message in channel ${ch}`);
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