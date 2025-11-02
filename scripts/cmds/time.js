const { createCanvas } = require('canvas');
const fs = require('fs-extra');
const path = require('path'); // Fixed the typo here
const moment = require('moment-timezone');
const os = require('os');

// Helper function to find a valid timezone. It's not perfect but covers many common cases.
function findTimezone(location) {
    const query = location.toLowerCase().replace(/ /g, '_');
    const allTimezones = moment.tz.names();
    
    // Direct match (e.g., "Asia/Dhaka")
    const directMatch = allTimezones.find(tz => tz.toLowerCase() === location.toLowerCase());
    if (directMatch) return directMatch;

    // Search for timezone by location part (e.g., "Dhaka", "London")
    let found = allTimezones.find(tz => tz.toLowerCase().endsWith(`/${query}`));
    
    if (!found) {
        // Broader search
        found = allTimezones.find(tz => tz.toLowerCase().includes(query));
    }
    
    return found;
}


module.exports = {
  config: {
    name: 'time',
    version: '2.1',
    author: 'Mahi--', // Corrected author name
    countDown: 5,
    role: 0,
    category: 'utility',
    shortDescription: 'Display date & time on a canvas',
    longDescription: 'Displays the current date and time for a specified location on a canvas image.',
    guide: {
      en: '{pn}\n{pn} [country/city]',
    },
  },
  
  onStart: async function ({ message, args }) {
    const processingMessage = await message.reply("🕒 Generating the clock, please wait...");
    try {
        let timezone;
        let locationName;

        if (args.length === 0) {
            timezone = 'Asia/Dhaka';
            locationName = 'Bangladesh';
        } else {
            const locationQuery = args.join(' ');
            timezone = findTimezone(locationQuery);
            locationName = locationQuery.toUpperCase();
        }

        if (!timezone) {
            await message.unsend(processingMessage.messageID);
            return message.reply(`Sorry, I couldn't find a timezone for "${args.join(' ')}". Please try a different city or country name (e.g., "London", "Japan").`);
        }

        const now = moment().tz(timezone);
        const time = now.format('hh:mm:ss A');
        const date = now.format('dddd, DD MMMM YYYY');
        
        const uptime = process.uptime();
        const days = Math.floor(uptime / (60 * 60 * 24));
        const hours = Math.floor((uptime / (60 * 60)) % 24);
        const minutes = Math.floor((uptime / 60) % 60);
        const formattedUptime = `${days}d ${hours}h ${minutes}m`;

        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext('2d');

        const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grd.addColorStop(0, '#1d2b4a');
        grd.addColorStop(1, '#0f172a');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(time, canvas.width / 2, 160);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px Arial';
        ctx.fillText(date, canvas.width / 2, 230);
        
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(locationName, canvas.width / 2, 270);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Arial';
        ctx.fillText(`(${timezone})`, canvas.width / 2, 295);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, 330);
        ctx.lineTo(canvas.width - 50, 330);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Bot Uptime: ${formattedUptime}`, 50, 355);
        
        ctx.textAlign = 'right';
        ctx.fillText('Anchestor', canvas.width - 50, 355);

        const outputPath = path.join(__dirname, 'cache', `time_card_${Date.now()}.png`);
        await fs.ensureDir(path.dirname(outputPath));
        const buffer = canvas.toBuffer("image/png");
        fs.writeFileSync(outputPath, buffer);

        await message.reply({
            attachment: fs.createReadStream(outputPath)
        });
        
        fs.unlinkSync(outputPath);
        await message.unsend(processingMessage.messageID);

    } catch(err) {
        console.error("Error in time command:", err);
        await message.unsend(processingMessage.messageID);
        message.reply("An error occurred while creating the time card. Please ensure the 'moment-timezone' package is installed.");
    }
  },
};