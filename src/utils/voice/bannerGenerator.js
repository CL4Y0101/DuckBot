const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

class VoiceButtonBannerGenerator {
    // 🖼️ Generate compact version untuk embed kecil
    async generateCompactBanner() {
        const width = 500;
        const height = 120;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background solid dark
        ctx.fillStyle = '#1E1F29';
        ctx.fillRect(0, 0, width, height);

        // Define rows - 2 baris dengan 4 button di baris pertama, 3 button di baris kedua
        const rows = [
            ['voice_btn_rename', 'voice_btn_limit', 'voice_btn_region', 'voice_btn_kick'],
            ['voice_btn_invite', 'voice_btn_claim', 'voice_btn_transfer']
        ];

        // Draw buttons untuk setiap row
        const startY = 25;
        const buttonWidth = 100;
        const buttonHeight = 32;
        const buttonSpacing = 15;
        const borderRadius = 8;

        rows.forEach((row, rowIndex) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);
            const currentY = startY + (rowIndex * (buttonHeight + 12));

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];
                if (!template) {
                    currentX += buttonWidth + buttonSpacing;
                    return;
                }

                this.drawCleanButton(ctx, currentX, currentY, buttonWidth, buttonHeight, template, borderRadius);
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
}

module.exports = new VoiceButtonBannerGenerator();