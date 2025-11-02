const ytdlp = require("youtube-dl-exec");
const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const FormData = require("form-data");

const cacheFolder = path.join(__dirname, "cache");
if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder, { recursive: true });

const smfahimAPI = "https://smfahim.xyz/alldl";
const shazamGitHubURL = "https://raw.githubusercontent.com/Tanvir0999/stuffs/main/raw/addresses.json";

async function downloadViaAllDL(url) {
    const res = await axios.get(`${smfahimAPI}?url=${encodeURIComponent(url)}`);
    const downloadURL = res.data?.links?.sd || res.data?.links?.hd;
    if (!downloadURL) throw new Error("Couldn't fetch downloadable video link from AllDL.");
    return downloadURL;
}

async function silentVideoToAudio(videoUrl) {
    const tempFile = path.join(cacheFolder, `temp_${Date.now()}.mp3`);
    await new Promise((resolve, reject) => {
        exec(`${ffmpeg} -i "${videoUrl}" -vn -acodec libmp3lame -y "${tempFile}"`,
            (error) => error ? reject(error) : resolve()
        );
    });
    return tempFile;
}

async function shazamDetection(audioPath) {
    const form = new FormData();
    form.append('data', fs.createReadStream(audioPath), {
        filename: 'audio.mp3',
        contentType: 'audio/mpeg'
    });

    const addr = (await axios.get(shazamGitHubURL)).data.main;
    try {
        const response = await axios.post(`${addr}/shazam`, form, {
            headers: form.getHeaders()
        });
        return response.data;
    } finally {
        fs.unlink(audioPath, () => {});
    }
}

module.exports = {
    config: {
        name: "sing",
        aliases: ["song", "play", "music"],
        version: "2.1",
        author: "Mahi--",
        role: 0,
        shortDescription: "Play music from YouTube + song detection",
        longDescription: "Search or paste a YouTube URL to download and detect songs",
        category: "media",
        guide: "{p}sing [search or URL]\nUse -i to get info only when replying to audio/video."
    },

    onStart: async function ({ message, args, event, api }) {
        const infoOnly = args.includes("-i");
        try {
            // Add reaction to show “waiting” status
            try {
                api.setMessageReaction("🔄", event.messageID, () => {}, true);
            } catch (e) {
                console.log("Reaction (waiting) failed:", e.message);
            }

            // Handling reply to audio/video or link
            if (event.messageReply) {
                const reply = event.messageReply;
                const attachment = reply.attachments?.[0];
                let audioPath;

                if (attachment && ["audio", "video"].includes(attachment.type)) {
                    audioPath = attachment.type === "video"
                        ? await silentVideoToAudio(attachment.url)
                        : attachment.url;
                } else if (reply.body?.startsWith("http")) {
                    const downloadedURL = await downloadViaAllDL(reply.body);
                    audioPath = await silentVideoToAudio(downloadedURL);
                } else {
                    return message.reply("❌ Reply to an audio/video file or provide a valid link for detection.");
                }

                const detection = await shazamDetection(audioPath);
                const song = detection.song?.[0] || {};
                const artist = detection.artist?.[0] || {};
                const songInfo = `🎵 Title: ${song.name || "Unknown"}\n🎤 Artist: ${artist.name || "Unknown"}\n📀 Album: ${detection.album || "Unknown"}\n📅 Released: ${detection.released || "Unknown"}`;

                try {
                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                } catch (e) {
                    console.log("Reaction (success) failed:", e.message);
                }

                if (infoOnly) return message.reply(songInfo);
                return message.reply(`${songInfo}\n🔗 Original Link: ${reply.body || "N/A"}`);
            }

            // Handling normal YouTube search/download
            if (!args.length) return message.reply("❌ Provide a YouTube URL or search query!");

            let input = args.join(" ");
            let videoUrl = input;
            let title = 'Unknown Title';
            const urlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i;

            if (!urlRegex.test(input)) {
                const search = await yts(input);
                if (!search || !search.videos.length) return message.reply("❌ No results found!");
                videoUrl = search.videos[0].url;
                title = search.videos[0].title;
            }

            const tempDir = path.join(__dirname, "temp");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
            const fileName = `song_${Date.now()}.mp3`;
            const filePath = path.join(tempDir, fileName);

            const cookiesPath = "cookies.txt";
            if (!fs.existsSync(cookiesPath)) console.warn("⚠️ No cookies.txt found — some videos may be blocked.");

            await ytdlp(videoUrl, {
                output: filePath,
                extractAudio: true,
                audioFormat: "mp3",
                preferFreeFormats: true,
                noCheckCertificates: true,
                geoBypass: true,
                addHeader: [
                    "referer:https://www.youtube.com/",
                    "user-agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
                ],
                cookies: fs.existsSync(cookiesPath) ? cookiesPath : undefined
            });

            if (fs.existsSync(filePath)) {
                try {
                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                } catch (e) {
                    console.log("Reaction (success) failed:", e.message);
                }

                await message.reply({ body: title, attachment: fs.createReadStream(filePath) });
                fs.unlinkSync(filePath);
            } else {
                try {
                    api.setMessageReaction("❌", event.messageID, () => {}, true);
                } catch (e) {
                    console.log("Reaction (error) failed:", e.message);
                }
                return message.reply("❌ Downloaded file not found.");
            }

        } catch (e) {
            console.error(e);
            try {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            } catch (err) {
                console.log("Reaction (failure) failed:", err.message);
            }
            return message.reply("❌ Error: " + (e.message || "Unknown error"));
        }
    }
};
