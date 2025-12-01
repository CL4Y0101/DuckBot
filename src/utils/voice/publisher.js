const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, Attachment, ContainerBuilder, MessageFlags, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');

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
                let containerComponentFromRows = null;
                try {
                    containerComponentFromRows = new ContainerBuilder()
                        .setAccentColor(0x5865F2)
                        .addTextDisplayComponents((td) =>
                            td.setContent('Kontrol Voice (Components V2): gunakan tombol di setiap section.'),
                        )
                        .addSeparatorComponents((sep) => sep)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Rename'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_rename')
                                        .setLabel('Rename')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Limit'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_limit')
                                        .setLabel('Limit')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Region'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_region')
                                        .setLabel('Region')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Kick'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_kick')
                                        .setLabel('Kick')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Bitrate'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_bitrate')
                                        .setLabel('Bitrate')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSeparatorComponents((sep) => sep)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Privacy'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_privacy')
                                        .setLabel('Privacy')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSeparatorComponents((sep) => sep)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Claim'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_claim')
                                        .setLabel('Claim')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Info'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_info')
                                        .setLabel('Info')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) => td.setContent('Transfer'))
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId('voice_btn_transfer')
                                        .setLabel('Transfer')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        );
                } catch (e) {
                    console.warn('Components V2 (ContainerBuilder) dari baris tombol tidak tersedia:', e?.message || e);
                }

                // Tambahkan ActionRow biasa di bawah Container (seperti pagination di OwO bot)
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('voice_panel_refresh')
                        .setLabel('🔄 Refresh')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('voice_panel_settings')
                        .setLabel('⚙️ Settings')
                        .setStyle(ButtonStyle.Primary)
                );

                if (botMessages.size > 0) {
                    try {
                        const firstMsg = botMessages.first();
                        if (containerComponentFromRows) {
                            await firstMsg.edit({ 
                                embeds: [], 
                                components: [containerComponentFromRows, actionRow], 
                                files: [], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                        } else {
                            await firstMsg.edit({ embeds: [embed], components: [], files: [attachment] });
                        }
                        console.log(`✅ Updated bot message in channel ${ch}`);
                    } catch (e) {
                        console.error(`❌ Failed to update bot message in channel ${ch}:`, e);
                    }
                } else {
                    try {
                        if (containerComponentFromRows) {
                            await channelObj.send({ 
                                components: [containerComponentFromRows, actionRow], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                        } else {
                            await channelObj.send({ embeds: [embed], files: [attachment] });
                        }
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