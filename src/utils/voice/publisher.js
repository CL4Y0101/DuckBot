const fs = require('fs');
const path = require('path');
const {
    AttachmentBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
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
                    .addTextDisplayComponents(td =>
                        td.setContent(
                            '### Voice Channel Setup Instructions'
                            + '\n\n**Rename**: Change the name of your temporary voice channel.'
                            + '\n**Limit**: Set a user limit for your channel.'
                            + '\n**Region**: Change the voice server region.'
                            + '\n**Kick**: Remove a user from your channel.'
                            + '\n**Bitrate**: Adjust the audio quality of your channel.'
                            + '\n**Privacy**: Set your channel to Private or Public.'
                            + '\n**Info**: View information about your channel.'
                            + '\n**Transfer**: Transfer ownership of the channel to another user.'
                            + '\n**Claim**: Claim ownership of an unclaimed temporary voice channel.'
                        )
                    )
                    .addSeparatorComponents(sep => sep)
                    .addActionRowComponents(row =>
                        row.addComponents(
                            { type: 2, custom_id: 'voice_btn_rename', label: 'Rename', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_btn_limit', label: 'Limit', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_btn_region', label: 'Region', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_btn_kick', label: 'Kick', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_btn_bitrate', label: 'Bitrate', emoji: { name: '' }, style: ButtonStyle.Secondary }
                        )
                    )
                    .addSeparatorComponents(sep => sep)
                    .addActionRowComponents(row =>
                        row.addComponents(
                            { type: 2, custom_id: 'voice_disable', emoji: { name: '-' }, style: ButtonStyle.Secondary, disabled: true },
                            { type: 2, custom_id: 'voice_disable1', emoji: { name: '-' }, style: ButtonStyle.Secondary, disabled: true },
                            { type: 2, custom_id: 'voice_btn_privacy', label: 'Privacy', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_disable2', emoji: { name: '-' }, style: ButtonStyle.Secondary, disabled: true },
                            { type: 2, custom_id: 'voice_disable3', emoji: { name: '-' }, style: ButtonStyle.Secondary, disabled: true }
                        )
                    )
                    .addSeparatorComponents(sep => sep)
                    .addActionRowComponents(row =>
                        row.addComponents(
                            { type: 2, custom_id: 'voice_disable4', emoji: { name: '-' }, style: ButtonStyle.Secondary, disabled: true },
                            { type: 2, custom_id: 'voice_btn_info', label: 'Info', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_btn_transfer', label: 'Transfer', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_btn_claim', label: 'Claim', emoji: { name: '' }, style: ButtonStyle.Secondary },
                            { type: 2, custom_id: 'voice_disable5', emoji: { name: '-' }, style: ButtonStyle.Secondary, disabled: true }
                        )
                    );

                let botMessages = [];
                try {
                    const messages = await channelObj.messages.fetch({ limit: 50 });
                    botMessages = messages.filter(m => m.author?.id === client.user.id);
                } catch { }

                if (botMessages.size > 0) {
                    const firstMsg = botMessages.first();
                    await firstMsg.edit({ components: [container], files: [attachment], flags: MessageFlags.IsComponentsV2 });
                } else {
                    await channelObj.send({ components: [container], files: [attachment], flags: MessageFlags.IsComponentsV2 });
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