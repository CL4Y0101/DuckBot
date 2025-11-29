const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

class VoiceButtonBannerGenerator {
    constructor() {
        this.buttonTemplates = {
            'voice_btn_bitrate': { emoji: '🔊', label: 'BITRATE', color: '#2C2F33' },
            'voice_btn_limit': { emoji: '👥', label: 'LIMIT', color: '#2C2F33' },
            'voice_btn_rename': { emoji: '📝', label: 'RENAME', color: '#2C2F33' },
            'voice_btn_region': { emoji: '🌐', label: 'REGION', color: '#2C2F33' },
            'voice_btn_kick': { emoji: '🚫', label: 'KICK', color: '#2C2F33' },
            'voice_btn_claim': { emoji: '👑', label: 'CLAIM', color: '#2C2F33' },
            'voice_btn_info': { emoji: 'ℹ️', label: 'INFO', color: '#2C2F33' },
            'voice_btn_transfer': { emoji: '🔄', label: 'TRANSFER', color: '#2C2F33' },
            'voice_disable_left': { emoji: '⚫', label: '', color: '#2C2F33' },
            'voice_disable_right': { emoji: '⚫', label: '', color: '#2C2F33' }
        };
    }

    // 🎨 Generate banner dengan button visuals
    async generateButtonBanner(rows = []) {
        const width = 960;
        const height = 260;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0b0c0e';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('VOICE CHANNEL CONTROL', width / 2, 36);

        // Subtitle
        ctx.fillStyle = '#BFC7D9';
        ctx.font = '14px Arial';
        ctx.fillText('Manage your temporary voice channel', width / 2, 60);

        // Draw buttons untuk setiap row (gaya pill gelap dengan icon bulat berwarna di kiri)
        let currentY = 80;
        const buttonWidth = 180;
        const buttonHeight = 48;
        const buttonSpacing = 18;
        const borderRadius = 28;

        rows.forEach((row) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];
                if (!template) {
                    currentX += buttonWidth + buttonSpacing;
                    return;
                }

                // Outer pill (dark)
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetY = 3;
                ctx.fillStyle = '#0f1113';
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, buttonHeight, borderRadius);
                ctx.fill();
                ctx.restore();

                // Small colored circle for icon at left
                const circleRadius = 18;
                const circleX = currentX + 20;
                const circleY = currentY + (buttonHeight / 2);
                ctx.beginPath();
                ctx.fillStyle = template.color || '#5865F2';
                ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
                ctx.fill();

                // Emoji / icon inside circle
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '18px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(template.emoji, circleX, circleY);

                // Label text (left aligned after icon)
                const textX = circleX + circleRadius + 12;
                const textY = currentY + (buttonHeight / 2) + 6; // vertical tweak
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '700 14px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(template.label, textX, textY);

                // subtle separator (very faint)
                ctx.strokeStyle = 'rgba(255,255,255,0.02)';
                ctx.lineWidth = 1;
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, buttonHeight, borderRadius);
                ctx.stroke();

                currentX += buttonWidth + buttonSpacing;
            });

            currentY += buttonHeight + 18;
        });

        // Footer thin line
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, height - 6, width, 6);

        return canvas.toBuffer();
    }

    // 🔧 Utility function untuk rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // 🖼️ Generate banner berdasarkan button configuration
    async generateVoiceControlBanner() {
        // Define button rows sesuai dengan setup Anda
        const row1 = [
            'voice_btn_bitrate',
            'voice_btn_limit', 
            'voice_btn_rename',
            'voice_btn_region',
            'voice_btn_kick'
        ];

        const row2 = [
            'voice_disable_left',
            'voice_btn_claim',
            'voice_btn_info',
            'voice_btn_transfer', 
            'voice_disable_right'
        ];

        return await this.generateButtonBanner([row1, row2]);
    }

    // 🎯 Generate banner untuk specific voice channel info
    async generateChannelInfoBanner(channelInfo) {
        const width = 800;
        const height = 200;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#5865F2');
        gradient.addColorStop(1, '#EB459E');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('VOICE CHANNEL INFO', width / 2, 50);

        // Channel info
        ctx.font = '20px Arial';
        ctx.fillText(`Channel: ${channelInfo.name || 'Unknown'}`, width / 2, 90);
        ctx.fillText(`Bitrate: ${channelInfo.bitrate ? `${channelInfo.bitrate / 1000}kbps` : 'N/A'}`, width / 2, 120);
        ctx.fillText(`Users: ${channelInfo.userCount || 0}/${channelInfo.userLimit || 'Unlimited'}`, width / 2, 150);

        return canvas.toBuffer();
    }
}

module.exports = new VoiceButtonBannerGenerator();
