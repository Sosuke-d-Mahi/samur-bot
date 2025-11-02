const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TinyURL = require('tinyurl');

async function onStart({ event, api, message, usersData, args }) {
    try {
        let uid = event.type === "message_reply" ? event.messageReply.senderID : event.senderID;
        const sexInfo = await api.getUserInfo([uid]);
        const username = sexInfo[uid].name;

        const tinyUrl = await TinyURL.shorten(`https://api-turtle.vercel.app/api/facebook/pfp?uid=${uid}`);
        const imgbbResponse = await axios.get(`https://www.noobs-api.000.pe/dipto/imgbb?url=${encodeURIComponent(tinyUrl)}`);
        const postImgResponse = await axios.get(`https://www.noobs-api.000.pe/dipto/postimg?imageUrl=${encodeURIComponent(imgbbResponse.data.data.url)}`);
        const avatarUrl = postImgResponse.data.directLink;

        const color = args.includes('--color') ? args[args.indexOf('--color') + 1] === 'false' ? false : true : true;
        let quoteText = args.join(' ');
        const authorIndex = args.indexOf('--author');
        let displayName = username;
        
        if (authorIndex !== -1) {
            displayName = args[authorIndex + 1];
            quoteText = quoteText.replace(`--author ${displayName}`, '').trim();
        }
        
        if (!quoteText) {
            const quoteResponse = await axios.get('https://api.mininxd.my.id/quotes');
            quoteText = quoteResponse.data.text;
            displayName = quoteResponse.data.author;
        }

        const response = await axios.post('https://samirxpikachu.frii.site/myquote', {
            text: quoteText,
            avatar: avatarUrl,
            username: username,
            display_name: displayName,
            color: color,
            watermark: "Architectdevs",
            returnRawImage: true
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        const imagePath = path.join(__dirname, 'quote_image.png');
        fs.writeFileSync(imagePath, response.data);
        await message.reply({
            body: "",
            attachment: fs.createReadStream(imagePath)
        });
        fs.unlinkSync(imagePath);
    } catch (error) {
        console.error("Error generating or sending the image:", error);
        await message.reply(`An error occurred while generating the quote image: ${error.message}`);
    }
}

const config = {
    name: "quote",
    aliases: ["quotly"],
    version: "1.0",
    author: "Samir Œ",
    countDown: 5,
    role: 0,
    shortDescription: "Generate a quote image.",
    longDescription: "Generate an image with a custom quote and user details.",
    category: "Fun",
    guide: {
        en: "{pn} [quote text] --author [author name] --color [true/false]"
    }
};

module.exports = {
    config,
    onStart
};