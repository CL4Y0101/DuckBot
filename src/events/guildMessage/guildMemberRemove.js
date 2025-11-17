const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const GIFEncoder = require('gifencoder');
const gifFrames = require('gif-frames');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            if (member.user.bot) return;

            const channelId = '985908885938376744';
            const channel = member.guild.channels.cache.get(channelId);
            
            if (!channel) {
                console.log('Channel not found');
                return;
            }

            const leaveBanner = await createAnimatedLeaveBanner(member);

            const leaveEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`😢 Goodbye from ${member.guild.name}!`)
                .setDescription(`**${member.user.username}** has left the server.\n\nWe're sad to see you go! 😔`)
                .addFields(
                    { name: '📅 Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                    { name: '👥 Members Left', value: `#${member.guild.memberCount}`, inline: true },
                    { name: '📝 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setImage('attachment://leave_banner.gif')
                .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            await channel.send({
                embeds: [leaveEmbed],
                files: [leaveBanner]
            });

            console.log(`Leave message sent for ${member.user.tag}`);
        } catch (error) {
            console.error('Error sending leave message:', error);
        }
    },
};

async function createAnimatedLeaveBanner(member) {
    return new Promise(async (resolve, reject) => {
        try {
            const bannerPath = path.join(__dirname, '../../assets/img/banner_discord.gif');
            
            if (!fs.existsSync(bannerPath)) {
                console.log('Background GIF not found, using animated gradient');
                const fallbackBanner = await createSingleFrameBanner(member, 'goodbye');
                return resolve(fallbackBanner);
            }

            const width = 800;
            const height = 300;
            
            const encoder = new GIFEncoder(width, height);
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(120);
            encoder.setQuality(10);

            let avatarImage;
            try {
                const avatarUrl = member.user.displayAvatarURL({ 
                    extension: 'png', 
                    size: 256,
                    forceStatic: true 
                });
                avatarImage = await loadImage(avatarUrl);
            } catch (error) {
                console.log('Error loading avatar:', error);
                avatarImage = null;
            }

            try {
                const frameData = await gifFrames({
                    url: bannerPath,
                    frames: 'all',
                    outputType: 'png'
                });

                console.log(`Loaded ${frameData.length} frames from background GIF`);

                for (let frameIndex = 0; frameIndex < Math.min(frameData.length, 12); frameIndex++) {
                    const frame = frameData[frameIndex];
                    const frameImage = await loadImage(frame.getImage());
                    
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(frameImage, 0, 0, width, height);

                    const overlayAlpha = 0.5 + Math.sin(frameIndex * 0.3) * 0.2;
                    ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
                    ctx.fillRect(0, 0, width, height);

                    if (avatarImage) {
                        ctx.save();
                        
                        const borderAlpha = 0.7 + Math.sin(frameIndex * 0.5) * 0.3;
                        ctx.strokeStyle = `rgba(255, 255, 255, ${borderAlpha})`;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(150, 150, 62, 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.globalAlpha = 0.8 + Math.sin(frameIndex * 0.3) * 0.2;
                        ctx.beginPath();
                        ctx.arc(150, 150, 60, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatarImage, 90, 90, 120, 120);
                        ctx.restore();
                        ctx.globalAlpha = 1.0;
                    }

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 38px Arial';
                    ctx.textAlign = 'center';
                    
                    const shakeOffset = Math.sin(frameIndex * 2) * 3;
                    ctx.fillText('😢 GOODBYE 😢', 550 + shakeOffset, 100);

                    ctx.font = 'bold 30px Arial';
                    const username = member.user.username.length > 15 
                        ? member.user.username.substring(0, 15) + '...' 
                        : member.user.username;
                    ctx.fillText(username, 550, 150);

                    ctx.font = '26px Arial';
                    const serverName = member.guild.name.length > 20
                        ? member.guild.name.substring(0, 20) + '...'
                        : member.guild.name;
                    ctx.fillText(`from ${serverName}`, 550, 190);

                    ctx.font = 'bold 22px Arial';
                    ctx.fillText(`Members Left: ${member.guild.memberCount}`, 550, 230);

                    encoder.addFrame(ctx);
                }

                encoder.finish();
                const gifBuffer = encoder.out.getData();
                const attachment = new AttachmentBuilder(gifBuffer, { name: 'leave_banner.gif' });

                resolve(attachment);

            } catch (error) {
                console.log('Error processing GIF frames, using single frame:', error);
                const fallbackBanner = await createSingleFrameBanner(member, 'goodbye');
                resolve(fallbackBanner);
            }

        } catch (error) {
            console.error('Error creating animated leave banner:', error);
            const staticBanner = await createStaticLeaveBanner(member);
            resolve(staticBanner);
        }
    });
}