const fs = require('fs');
const path = require('path');
const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags,
    AttachmentBuilder
} = require('discord.js');

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

                const attachment = new AttachmentBuilder(
                    path.join(__dirname, '../../assets/img/voice_banners.png'),
                    { name: 'voice_banners.png' }
                );

                const container = new ContainerBuilder()
                    .addComponents(
                        new TextDisplayBuilder().setContent('## Voice Channel Configuration'),
                        new MediaGalleryBuilder().addItems(
                            item => item.setURL('attachment://voice_banners.png')
                        ),
                        new TextDisplayBuilder().setContent(
                            `Konfigurasi ini dapat digunakan untuk mengelola voice channel dari <@1203600776048414720>.\n` +
                            `Lobby saat ini: ${voiceCfg.lobby ? `<#${voiceCfg.lobby}>` : 'Belum diatur'}`
                        ),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('voice_btn_rename').setLabel('Rename').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('voice_btn_limit').setLabel('Limit').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('voice_btn_region').setLabel('Region').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('voice_btn_kick').setLabel('Kick').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('voice_btn_bitrate').setLabel('Bitrate').setStyle(ButtonStyle.Secondary)
                        ),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('voice_btn_privacy').setLabel('Privacy').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('voice_btn_info').setLabel('Info').setStyle(ButtonStyle.Secondary)
                        )
                    );

                let botMessages = [];
                try {
                    const messages = await channelObj.messages.fetch({ limit: 50 });
                    botMessages = messages.filter(m => m.author?.id === client.user.id);
                } catch {}

                if (botMessages.size > 0) {
                    const firstMsg = botMessages.first();
                    await firstMsg.edit({
                        components: [container],
                        files: [attachment],
                        flags: MessageFlags.IsComponentsV2
                    });
                } else {
                    await channelObj.send({
                        components: [container],
                        files: [attachment],
                        flags: MessageFlags.IsComponentsV2
                    });
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