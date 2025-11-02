const axios = require("axios");
const fs = require("fs");
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");
const pipeline = promisify(stream.pipeline);

const aspectRatioMap = {
  '1:1': { width: 1024, height: 1024 },
  '9:7': { width: 1152, height: 896 },
  '7:9': { width: 896, height: 1152 },
  '19:13': { width: 1216, height: 832 },
  '13:19': { width: 832, height: 1216 },
  '7:4': { width: 1344, height: 768 },
  '4:7': { width: 768, height: 1344 },
  '12:5': { width: 1500, height: 625 },
  '5:12': { width: 640, height: 1530 },
  '16:9': { width: 1344, height: 756 },
  '9:16': { width: 756, height: 1344 },
  '2:3': { width: 1024, height: 1536 },
  '3:2': { width: 1536, height: 1024 }
};

module.exports = {
  config: {
    name: "nijix",
    version: "1.2",
    author: "Vincenzo",
    shortDescription: "Anime-style image generation with style and aspect ratio",
    longDescription: "Generate anime-style images using Asahina2k XL API with style and aspect ratio support.",
    category: "image",
    guide: {
      en: "{pn} <prompt> [--ar <ratio>] [--style <id>]\n\n" +
          "• Available Styles:\n" +
          "  1. Cinematic\n" +
          "  2. Photographic\n" +
          "  3. Anime\n" +
          "  4. Manga\n" +
          "  5. Digital Art\n" +
          "  6. Pixel Art\n" +
          "  7. Fantasy Art\n" +
          "  8. Neon Punk\n" +
          "  9. 3D Model",
      ar: "{pn} <الموجه> [--ar <نسبة>] [--style <معرف>]"
    }
  },

  onStart: async function ({ args, message }) {
    let prompt = args.join(" ");
    const styleMatch = prompt.match(/--style (\d+)/);
    const arMatch = prompt.match(/--ar (\d+:\d+)/);
    const styleIndex = styleMatch ? styleMatch[1] : "0";
    const aspectRatio = arMatch ? arMatch[1] : "1:1";

    prompt = prompt
      .replace(/--style \d+/, "")
      .replace(/--ar \d+:\d+/, "")
      .trim();

    if (!prompt || !/^[\x00-\x7F]*$/.test(prompt)) {
      return message.reply("❌ Please provide a valid English prompt.");
    }

    const styles = {
      "0": {
        prompt: `${prompt}, masterpiece, best quality, very aesthetic, perfect face`,
        negative_prompt: "nsfw, low quality, worst quality:1.2, very displeasing, 3d, watermark, signature, ugly, poorly drawn"
      },
      "1": {
        prompt: `${prompt}, cinematic still, emotional, harmonious, vignette, highly detailed, high budget, bokeh, cinemascope, moody, epic, gorgeous, film grain, grainy, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured"
      },
      "2": {
        prompt: `${prompt}, cinematic photo, 35mm photograph, film, bokeh, professional, 4k, highly detailed, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, drawing, painting, crayon, sketch, graphite, impressionist, noisy, blurry, soft, deformed, ugly"
      },
      "3": {
        prompt: `${prompt}, anime artwork, anime style, key visual, vibrant, studio anime, highly detailed, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, photo, deformed, black and white, realism, disfigured, low contrast"
      },
      "4": {
        prompt: `${prompt}, manga style, vibrant, high-energy, detailed, iconic, Japanese comic style, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, ugly, deformed, noisy, blurry, low contrast, realism, photorealistic, Western comic style"
      },
      "5": {
        prompt: `${prompt}, concept art, digital artwork, illustrative, painterly, matte painting, highly detailed, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, photo, photorealistic, realism, ugly"
      },
      "6": {
        prompt: `${prompt}, pixel-art, low-res, blocky, pixel art style, 8-bit graphics, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, sloppy, messy, blurry, noisy, highly detailed, ultra textured, photo, realistic"
      },
      "7": {
        prompt: `${prompt}, ethereal fantasy concept art, magnificent, celestial, painterly, epic, majestic, magical, dreamy, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, photographic, realism, 35mm film, dslr, text, deformed, glitch, noise, cross-eyed, bad anatomy, ugly"
      },
      "8": {
        prompt: `${prompt}, neonpunk style, cyberpunk, vaporwave, neon, vibrant, cinematic, ultra detailed, intricate, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, painting, drawing, glitch, deformed, mutated, ugly, disfigured"
      },
      "9": {
        prompt: `${prompt}, professional 3d model, octane render, highly detailed, volumetric, dramatic lighting, perfect eyes, exclusive eyes`,
        negative_prompt: "nsfw, ugly, deformed, noisy, low poly, blurry, painting"
      }
    };

    const selected = styles[styleIndex] || styles["0"];
    const resolution = aspectRatioMap[aspectRatio] || aspectRatioMap["1:1"];
    const session_hash = Math.random().toString(36).substring(2, 13);
    const randomSeed = Math.floor(Math.random() * 1000000000);

    const payload = {
      data: [
        selected.prompt,
        selected.negative_prompt,
        randomSeed,
        resolution.width,
        resolution.height,
        7,
        28,
        "Euler a",
        `${resolution.width} x ${resolution.height}`,
        "(None)",
        "Standard v3.1",
        false,
        0.55,
        1.5,
        true
      ],
      event_data: null,
      fn_index: 5,
      trigger_id: null,
      session_hash
    };

    const headers = {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json"
    };

    try {
      await axios.post("https://asahina2k-animagine-xl-3-1.hf.space/queue/join", payload, { headers });

      const res = await axios.get("https://asahina2k-animagine-xl-3-1.hf.space/queue/data", {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/event-stream",
          "Content-Type": "application/json"
        },
        params: { session_hash },
        timeout: 30000
      });

      const events = res.data.split("\n\n");
      let imageURL = null;
      for (const evt of events) {
        if (evt.startsWith("data:")) {
          try {
            const json = JSON.parse(evt.slice(5).trim());
            if (json.msg === "process_completed" && json.success) {
              imageURL = json.output?.data?.[0]?.[0]?.image?.url;
              break;
            }
          } catch (e) {}
        }
      }

      if (!imageURL) return message.reply("⚠️ Image not ready yet. Try again later.");

      const imgRes = await axios.get(imageURL, { responseType: "stream" });
      const cachePath = path.join(__dirname, "cache");
      if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath);
      const imgPath = path.join(cachePath, `${session_hash}.png`);
      await pipeline(imgRes.data, fs.createWriteStream(imgPath));

      message.reply({
        body: `🎨 Style: ${styleIndex} | 📐 AR: ${aspectRatio} | 🧪 Seed: ${randomSeed}`,
        attachment: fs.createReadStream(imgPath)
      }, () => fs.unlinkSync(imgPath));
    } catch (err) {
      console.error(err);
      message.reply("❌ Failed to generate image. Try again later.");
    }
  }
};