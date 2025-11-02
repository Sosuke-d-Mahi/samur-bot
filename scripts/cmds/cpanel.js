const os = require('os');
const { createCanvas } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const si = require('systeminformation');
const GIFEncoder = require('gifencoder');

function sanitizePercentage(value, defaultVal = 0) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultVal;
    return Math.max(0, Math.min(100, num));
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

function getCurrentCPUUsage() {
    return new Promise((resolve) => {
        const startCores = os.cpus();
        setTimeout(() => {
            const endCores = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;
            for (let i = 0; i < endCores.length; i++) {
                const start = startCores[i].times;
                const end = endCores[i].times;
                totalTick += (end.user - start.user) + (end.nice - start.nice) + (end.sys - start.sys) + (end.irq - start.irq) + (end.idle - start.idle);
                totalIdle += (end.idle - start.idle);
            }
            const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
            resolve(Math.max(0, Math.min(100, usage)).toFixed(2));
        }, 100);
    });
}

async function getDiskInfo() {
    try {
        const data = await si.fsSize();
        const primaryDisk = data.find(d => d.mount === '/' || d.fs.toLowerCase().startsWith('c:')) || data[0];
        if (primaryDisk) {
            return {
                use: primaryDisk.use,
                total: (primaryDisk.size / 1024 / 1024 / 1024).toFixed(1) + ' GB'
            };
        }
    } catch (e) { console.error("Error fetching disk info:", e); }
    return { use: 0, total: 'N/A' };
}

/**
 * Returns the specified GPU name.
 * @returns {Promise<string>} A promise that resolves to the GPU model name.
 */
async function getGpuInfo() {
    // This function now returns a static value as requested.
    return 'RTX 5060';
}


function drawHexagon(ctx, x, y, size, fillStyle, strokeStyle, lineWidth = 2) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + (Math.PI / 6);
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

function fillHexStat(ctx, x, y, label, value, labelColor, valueColor, labelFont, valueFont) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = labelColor;
    ctx.font = labelFont;
    ctx.fillText(label, x, y + 18);
    ctx.fillStyle = valueColor;
    ctx.font = valueFont;
    ctx.fillText(value, x, y - 8);
}

module.exports = {
    config: {
        name: 'cpanel',
        aliases: ['Panel'],
        version: '6.5',
        author: 'Mahi--',
        countDown: 10,
        role: 0,
        category: 'system',
        guide: {
            en: '{pn}: Generates a creative, animated Hex-style GIF with system statistics.'
        }
    },

    onStart: async function ({ message }) {
        try {
            // --- Fetching System Information ---
            const osMemoryUsagePercentageNum = sanitizePercentage(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
            const currentCpuUsageNum = parseFloat(await getCurrentCPUUsage());
            const diskInfo = await getDiskInfo();
            const diskUsagePercentageNum = sanitizePercentage(diskInfo.use);
            const cpuCores = os.cpus().length;
            const platformInfo = `${os.platform()} (${os.arch()})`;
            const botUptime = formatUptime(process.uptime());
            const systemUptime = formatUptime(os.uptime());
            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + ' GB';
            const gpuName = await getGpuInfo();
            const hostname = os.hostname();

            // --- Canvas and GIF Setup ---
            const canvasWidth = 1000;
            const canvasHeight = 667;
            const gifPath = path.join(__dirname, "cache", `system_hex_v6.5_${Date.now()}.gif`);
            await fs.ensureDir(path.dirname(gifPath));

            const encoder = new GIFEncoder(canvasWidth, canvasHeight);
            const gifStream = fs.createWriteStream(gifPath);
            encoder.createReadStream().pipe(gifStream);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(150);
            encoder.setQuality(10);

            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');
            
            // --- GIF Frame Generation ---
            const frameCount = 15;
            for (let i = 0; i < frameCount; i++) {
                const hue = (i * 360 / frameCount) % 360;
                const glowColor = `hsl(${hue}, 100%, 70%)`;
                const secondaryColor = '#9CA3AF';
                const textColor = '#E5E7EB';
                const bgFill = '#0b0f1c';
                const hexFill = '#111a25';

                // Draw background
                ctx.fillStyle = bgFill;
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                
                const centerX = canvasWidth / 2;
                const centerY = canvasHeight / 2;
                
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 20;
                
                // Define hexagon sizes and positions
                const mainHexSize = 100;
                const satelliteHexSize = 85;
                const cornerHexSize = 70;
                const satelliteDist = mainHexSize + satelliteHexSize;
                const cornerDistX = satelliteDist + cornerHexSize;
                const cornerDistY = satelliteHexSize + 30;

                // --- Draw Satellite Hexagons (Main Stats) ---
                const satelliteHexes = [
                    { angle: 60,  label: "RAM USAGE",   value: `${osMemoryUsagePercentageNum.toFixed(1)}%`, font: 'bold 30px Arial' },
                    { angle: 120, label: "SYS UPTIME",  value: systemUptime, font: 'bold 22px Arial' },
                    { angle: 180, label: "CPU USAGE",   value: `${currentCpuUsageNum.toFixed(1)}%`, font: 'bold 30px Arial' },
                    { angle: 240, label: "BOT UPTIME",  value: botUptime, font: 'bold 22px Arial' },
                    { angle: 300, label: "CPU CORES",   value: cpuCores, font: 'bold 30px Arial' },
                    { angle: 0,   label: "DISK USAGE",  value: `${diskUsagePercentageNum.toFixed(1)}%`, font: 'bold 30px Arial' }
                ];
                
                satelliteHexes.forEach(hex => {
                    const angleRad = (Math.PI / 180) * hex.angle;
                    const hexX = centerX + satelliteDist * Math.cos(angleRad);
                    const hexY = centerY + satelliteDist * Math.sin(angleRad);
                    drawHexagon(ctx, hexX, hexY, satelliteHexSize, hexFill, glowColor, 3);
                    fillHexStat(ctx, hexX, hexY, hex.label, hex.value, secondaryColor, textColor, '14px Arial', hex.font);
                });

                // --- Draw Corner Hexagons (System Specs) ---
                const cornerHexes = [
                    { x: centerX - cornerDistX, y: centerY - cornerDistY, label: "TOTAL RAM", value: totalRam },
                    { x: centerX + cornerDistX, y: centerY - cornerDistY, label: "GPU", value: gpuName.substring(0, 12) },
                    { x: centerX - cornerDistX, y: centerY + cornerDistY, label: "TOTAL DISK", value: diskInfo.total },
                    { x: centerX + cornerDistX, y: centerY + cornerDistY, label: "HOSTNAME", value: hostname.substring(0, 12) }
                ];

                cornerHexes.forEach(hex => {
                    drawHexagon(ctx, hex.x, hex.y, cornerHexSize, hexFill, glowColor, 2);
                    fillHexStat(ctx, hex.x, hex.y, hex.label, hex.value, secondaryColor, textColor, '12px Arial', 'bold 18px Arial');
                });

                // --- Draw Central Hexagon ---
                drawHexagon(ctx, centerX, centerY, mainHexSize, hexFill, glowColor, 4);
                
                ctx.shadowBlur = 0; // Reset shadow for text
                
                // Draw central text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = glowColor;
                ctx.font = 'bold 28px Arial';
                ctx.fillText("Anchestor", centerX, centerY - 15);
                ctx.fillStyle = textColor;
                ctx.font = '16px Arial';
                ctx.fillText("by mahi", centerX, centerY + 22);

                // --- Draw Header and Footer Info ---
                const now = new Date();
                const dateString = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
                const timeString = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                ctx.fillStyle = secondaryColor;
                ctx.font = `12px Arial`;
                ctx.textAlign = 'right';
                ctx.fillText(dateString, canvasWidth - 20, 25);
                ctx.fillText(timeString, canvasWidth - 20, 40);
                
                ctx.textAlign = 'left';
                ctx.fillText(`OS: ${platformInfo}`, 20, 25);

                encoder.addFrame(ctx);
            }
            
            // --- Finalize and Send GIF ---
            encoder.finish();
            await new Promise(res => gifStream.on('finish', res));

            await message.reply({ attachment: fs.createReadStream(gifPath) });
            
            // Clean up the temporary file
            fs.unlink(gifPath, (err) => {
                if (err) console.error("Failed to delete temp GIF:", err);
            });

        } catch (err) {
            console.error(`Error generating system image:`, err);
            return message.reply(`❌ Could not generate the system dashboard image due to an internal error. Please check console logs.`);
        }
    }
};