const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            if (member.user.bot) return;

            const channelId = '985908716496896051';
            const channel = member.guild.channels.cache.get(channelId);

            if (!channel) {
                console.log('Channel not found');
                return;
            }

            console.log(`🚀 Starting welcome banner creation for ${member.user.tag}`);

            // Kirim pesan "processing" dulu
            const processingMsg = await channel.send('🔄 Creating welcome banner...');

            const welcomeBanner = await createAnimatedWelcomeBanner(member);

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`🎉 Welcome to ${member.guild.name}!`)
                .setDescription(`Hello ${member.user.username}! Welcome to our server!\n\nWe're glad to have you here! 🥳`)
                .addFields(
                    { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '👥 Member Count', value: `#${member.guild.memberCount}`, inline: true },
                    { name: '📝 Server Rules', value: 'Please read the rules channel!', inline: true }
                )
                .setImage('attachment://welcome_banner.gif')
                .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            // Edit pesan processing menjadi hasil akhir
            await processingMsg.edit({
                content: `🎊 Welcome ${member.user}!`,
                embeds: [welcomeEmbed],
                files: [welcomeBanner]
            });

            console.log(`✅ Welcome message sent for ${member.user.tag}`);
        } catch (error) {
            console.error('❌ Error sending welcome message:', error);
            
            // Fallback ke simple message jika error
            const channelId = '985908716496896051';
            const channel = member.guild.channels.cache.get(channelId);
            if (channel) {
                await channel.send(`🎉 Welcome ${member.user}! We're glad to have you here!`);
            }
        }
    },
};

async function createAnimatedWelcomeBanner(member) {
    return new Promise(async (resolve, reject) => {
        try {
            const bannerPath = path.join(__dirname, '../../assets/img/banner_discord.gif');
            
            if (!fs.existsSync(bannerPath)) {
                console.log('❌ Background GIF not found, using simple banner');
                const simpleBanner = await createSimpleBanner(member, 'welcome');
                return resolve(simpleBanner);
            }

            console.log('🔄 Processing GIF background...');

            const width = 800;
            const height = 300;
            
            const encoder = new GIFEncoder(width, height);
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(150); // Lebih lambat untuk performance
            encoder.setQuality(5); // Quality lebih rendah untuk performance

            // Load avatar terlebih dahulu
            let avatarImage;
            try {
                const avatarUrl = member.user.displayAvatarURL({ 
                    extension: 'jpg', // Gunakan JPG untuk performance
                    size: 128, // Size lebih kecil
                    forceStatic: true 
                });
                console.log('🔄 Loading avatar...');
                avatarImage = await loadImage(avatarUrl);
                console.log('✅ Avatar loaded');
            } catch (error) {
                console.log('❌ Error loading avatar:', error.message);
                avatarImage = null;
            }

            try {
                // Gunakan approach yang lebih sederhana - hanya frame pertama
                console.log('🔄 Loading background frame...');
                const backgroundImage = await loadImage(bannerPath);
                console.log('✅ Background frame loaded');

                // Hanya buat 8 frame untuk performance (bukan 120 frame)
                const totalFrames = 8;
                console.log(`🔄 Creating ${totalFrames} frames...`);

                for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                    ctx.clearRect(0, 0, width, height);

                    // Draw background (frame pertama saja untuk performance)
                    ctx.drawImage(backgroundImage, 0, 0, width, height);

                    // Overlay untuk readability
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                    ctx.fillRect(0, 0, width, height);

                    // Avatar dengan border animasi
                    if (avatarImage) {
                        ctx.save();
                        
                        // Border animasi sederhana
                        const borderHue = (frameIndex * 45) % 360;
                        ctx.strokeStyle = `hsl(${borderHue}, 100%, 65%)`;
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(150, 150, 60, 0, Math.PI * 2);
                        ctx.stroke();

                        // Draw avatar
                        ctx.beginPath();
                        ctx.arc(150, 150, 58, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatarImage, 92, 92, 116, 116);
                        ctx.restore();
                    }

                    // Text dengan efek sederhana
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    
                    // "WELCOME" dengan efek bounce sederhana
                    const bounceOffset = Math.sin(frameIndex * 0.8) * 3;
                    ctx.fillText('🎉 WELCOME 🎉', 550, 100 + bounceOffset);

                    // Username
                    ctx.font = 'bold 24px Arial';
                    const username = member.user.username.length > 12 
                        ? member.user.username.substring(0, 12) + '...' 
                        : member.user.username;
                    ctx.fillText(username, 550, 140);

                    // Server name
                    ctx.font = '20px Arial';
                    const serverName = member.guild.name.length > 15
                        ? member.guild.name.substring(0, 15) + '...'
                        : member.guild.name;
                    ctx.fillText(`to ${serverName}`, 550, 170);

                    // Member count
                    ctx.font = 'bold 18px Arial';
                    ctx.fillText(`Member #${member.guild.memberCount}`, 550, 200);

                    // Progress indicator
                    console.log(`📊 Frame ${frameIndex + 1}/${totalFrames} created`);

                    encoder.addFrame(ctx);
                }

                console.log('✅ All frames created, finishing GIF...');
                encoder.finish();

                const gifBuffer = encoder.out.getData();
                console.log('✅ GIF buffer created');

                const attachment = new AttachmentBuilder(gifBuffer, { name: 'welcome_banner.gif' });
                console.log('✅ Attachment created');

                resolve(attachment);

            } catch (error) {
                console.log('❌ Error in GIF processing:', error.message);
                // Fallback ke banner sederhana
                const simpleBanner = await createSimpleBanner(member, 'welcome');
                resolve(simpleBanner);
            }

        } catch (error) {
            console.error('❌ Error creating animated welcome banner:', error.message);
            const simpleBanner = await createSimpleBanner(member, 'welcome');
            resolve(simpleBanner);
        }
    });
}

async function createSimpleBanner(member, type) {
    console.log(`🔄 Creating simple ${type} banner...`);
    
    const canvas = createCanvas(600, 200);
    const ctx = canvas.getContext('2d');

    // Background sederhana
    const gradient = ctx.createLinearGradient(0, 0, 600, 200);
    if (type === 'welcome') {
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
    } else {
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a24');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 200);

    // Load avatar kecil
    try {
        const avatarUrl = member.user.displayAvatarURL({ 
            extension: 'jpg', 
            size: 64,
            forceStatic: true 
        });
        const avatar = await loadImage(avatarUrl);
        
        // Draw avatar circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(80, 100, 30, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 50, 70, 60, 60);
        ctx.restore();

        // Avatar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(80, 100, 32, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.log('❌ Error loading avatar for simple banner:', error.message);
    }

    // Text sederhana
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    
    const title = type === 'welcome' ? 'WELCOME' : 'GOODBYE';
    ctx.fillText(title, 150, 60);

    ctx.font = 'bold 20px Arial';
    const username = member.user.username.length > 10 
        ? member.user.username.substring(0, 10) + '...' 
        : member.user.username;
    ctx.fillText(username, 150, 90);

    ctx.font = '16px Arial';
    const serverText = type === 'welcome' ? `to ${member.guild.name}` : `from ${member.guild.name}`;
    const serverName = member.guild.name.length > 15
        ? member.guild.name.substring(0, 15) + '...'
        : member.guild.name;
    ctx.fillText(serverText, 150, 115);

    ctx.font = 'bold 14px Arial';
    const memberText = type === 'welcome' 
        ? `Member #${member.guild.memberCount}` 
        : `Members: ${member.guild.memberCount}`;
    ctx.fillText(memberText, 150, 140);

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { 
        name: type === 'welcome' ? 'welcome_banner.png' : 'leave_banner.png' 
    });

    console.log('✅ Simple banner created');
    return attachment;
}