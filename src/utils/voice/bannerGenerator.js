const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

class VoiceButtonBannerGenerator {
    constructor() {
        this.buttonTemplates = {
            'voice_btn_bitrate': { emoji: '🔊', label: 'BITRATE', color: '#5865F2' },
            'voice_btn_limit': { emoji: '👥', label: 'LIMIT', color: '#EB459E' },
            'voice_btn_rename': { emoji: '📝', label: 'RENAME', color: '#57F287' },
            'voice_btn_region': { emoji: '🌐', label: 'REGION', color: '#FEE75C' },
            'voice_btn_kick': { emoji: '🚫', label: 'KICK', color: '#ED4245' },
            'voice_btn_invite': { emoji: '📞', label: 'INVITE', color: '#2ECC71' },
            'voice_btn_claim': { emoji: '👑', label: 'CLAIM', color: '#9B59B6' },
            'voice_btn_transfer': { emoji: '🔄', label: 'TRANSFER', color: '#E67E22' }
        };
    }

    // 🖼️ Generate compact version untuk embed kecil
    async generateCompactBanner() {
        const width = 640;
        const height = 140;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (very dark)
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, width, height);

        // Rows definition (match publisher layout: 5 buttons top, 5 bottom with disables)
        const rows = [
            ['voice_btn_rename', 'voice_btn_limit', 'voice_btn_region', 'voice_btn_kick', 'voice_btn_bitrate'],
            ['voice_disable_left', 'voice_btn_claim', 'voice_btn_info', 'voice_btn_transfer', 'voice_disable_right']
        ];

        // Button geometry tuned to match mockup
        const startY = 18;
        const buttonWidth = 108;
        const buttonHeight = 44;
        const buttonSpacing = 14;
        const borderRadius = 22;

        rows.forEach((row, rowIndex) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);
            const currentY = startY + (rowIndex * (buttonHeight + 12));

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];
                // draw pill background
                // outer shadow
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.7)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetY = 3;
                ctx.fillStyle = '#16171a';
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, buttonHeight, borderRadius);
                ctx.fill();
                ctx.restore();

                // inner slight highlight strip on top
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, Math.floor(buttonHeight/2), borderRadius);
                ctx.fill();

                if (template) {
                    // left colored circle
                    const circleX = currentX + 18;
                    const circleY = currentY + (buttonHeight / 2);
                    const circleR = 14;
                    ctx.beginPath();
                    ctx.fillStyle = template.color || '#5865F2';
                    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
                    ctx.fill();

                    // emoji/icon inside circle
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Arial"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(template.emoji, circleX, circleY - 1);

                    // label (uppercase look)
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '700 12px Arial';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    const textX = circleX + circleR + 10;
                    ctx.fillText((template.label || '').toUpperCase(), textX, circleY + 1);
                } else {
                    // disabled placeholder (dash)
                    ctx.fillStyle = '#9aa0a6';
                    ctx.font = '700 18px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('-', currentX + (buttonWidth/2), currentY + (buttonHeight/2));
                }

                currentX += buttonWidth + buttonSpacing;
            });
        });

        return canvas.toBuffer();
    }

    // 🎯 Draw clean button seperti gambar
    drawCleanButton(ctx, x, y, width, height, template, radius) {
        // Button background - solid dark dengan border subtle
        ctx.fillStyle = '#2F3136';
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.fill();

        // Border subtle
        ctx.strokeStyle = '#40444B';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.stroke();

        // Icon/emoji di kiri (center vertical)
        const iconX = x + 12;
        const iconY = y + (height / 2);

        ctx.fillStyle = template.color;
        ctx.font = `14px "Segoe UI Emoji", "Apple Color Emoji", "Arial"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.emoji, iconX, iconY);

        // Label text di kanan icon
        const textX = iconX + 18;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px "Arial"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.label, textX, iconY);
    }

    // Utility: rounded rectangle path
    drawRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

const gen = new VoiceButtonBannerGenerator();
// backward-compatible alias
gen.generateVoiceControlBanner = gen.generateCompactBanner.bind(gen);
module.exports = gen;