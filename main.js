import path from "path";
import { exec } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import yts from "yt-search";
import axios from "axios";

const formatAudio = ["mp3", "m4a", "webm", "acc", "flac", "opus", "ogg", "wav"];

const ddownr = {
  download: async (url, format) => {
    if (!formatAudio.includes(format)) {
      throw new Error("⛔️ Formato de audio no compatible.");
    }

    const config = {
      method: "GET",
      url: `https://p.oceansaver.in/ajax/download.php?format=${format}&url=${encodeURIComponent(url)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    };

    try {
      const response = await axios.request(config);
      if (response.data?.success) {
        const { id, title, info } = response.data;
        const downloadUrl = await ddownr.cekProgress(id);
        return { id, title, image: info.image, downloadUrl };
      } else {
        throw new Error("❌ No se pudieron obtener los detalles del video.");
      }
    } catch (error) {
      throw error;
    }
  },

  cekProgress: async (id) => {
    const config = {
      method: "GET",
      url: `https://p.oceansaver.in/ajax/progress.php?id=${id}`,
      headers: { "User-Agent": "Mozilla/5.0" }
    };

    try {
      while (true) {
        const response = await axios.request(config);
        if (response.data?.success && response.data.progress === 1000) {
          return response.data.download_url;
        }
        await new Promise(resolve => setTimeout(resolve, 3000)); // Espera 3 segundos
      }
    } catch (error) {
      throw error;
    }
  }
};

export default async function comandos(sock, msg, cmd, args) {
  switch (cmd) {
    case "ping": {
      const start = performance.now();
      await sock.sendMessage(msg.key.remoteJid, { text: "🏓 *Pong!*" }, { quoted: msg });
      const end = performance.now();
      const ping = Math.floor(end - start);
      await sock.sendMessage(msg.key.remoteJid, { text: `🔄 *Latencia actual:* ${ping}ms` }, { quoted: msg });
      break;
    }

    case "ayuda":
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "📚 *Comandos Disponibles:*\n\n• `ping`\n• `ayuda`\n• `descargar`\n• `sticker`\n• `play`\n• `play2`"
        },
        { quoted: msg }
      );
      break;

    case 'update':
    case 'actualizar': {
      await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Iniciando actualización del bot desde GitHub...' }, { quoted: msg });

      exec('git pull', (err, stdout, stderr) => {
        if (err) {
          sock.sendMessage(msg.key.remoteJid, { text: `❌ *Error al actualizar el bot:*\n\`\`\`${err.message}\`\`\`` }, { quoted: msg });
          return;
        }

        if (stderr) console.warn('⚠️ *Advertencia durante la actualización:*\n', stderr);

        if (stdout.includes('Already up to date.')) {
          sock.sendMessage(msg.key.remoteJid, { text: '✅ El bot ya se encuentra en la versión más reciente.' }, { quoted: msg });
        } else {
          sock.sendMessage(msg.key.remoteJid, { text: `✅ *Actualización completada exitosamente:*\n\n\`\`\`${stdout}\`\`\`` }, { quoted: msg });
        }
      });
      break;
    }

    case "descargar":
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "🚧 La función de descarga directa se encuentra en desarrollo." },
        { quoted: msg }
      );
      break;

    case "sticker":
    case "s":
      try {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || (!quoted.imageMessage && !quoted.videoMessage)) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "📎 Por favor, *responde a una imagen o un video corto* (menos de 10 segundos) para crear un sticker." },
            { quoted: msg }
          );
          return;
        }

        const mediaType = quoted.imageMessage ? "imageMessage" : "videoMessage";
        const quotedMsg = {
          key: {
            remoteJid: msg.key.remoteJid,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            fromMe: false,
            participant: msg.message.extendedTextMessage.contextInfo.participant,
          },
          message: {
            [mediaType]: quoted[mediaType]
          }
        };

        await sock.sendMessage(msg.key.remoteJid, { text: "⏳ Creando sticker, por favor espera..." }, { quoted: msg });

        const buffer = await downloadMediaMessage(
          quotedMsg,
          "buffer",
          {},
          { logger: console, reuploadRequest: sock.reuploadRequest, getAuth: () => sock.authState }
        );

        const inputPath = `./tmp/input_${Date.now()}.${mediaType === "imageMessage" ? "jpg" : "mp4"}`;
        const outputPath = `./tmp/output_${Date.now()}.webp`;

        fs.mkdirSync("./tmp", { recursive: true });
        fs.writeFileSync(inputPath, buffer);

        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .on("end", resolve)
            .on("error", reject)
            .outputOptions([
              "-vcodec", "libwebp",
              "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
              "-lossless", "1",
              "-compression_level", "6",
              "-preset", "default",
              "-loop", "0",
              "-an", "-vsync", "0"
            ])
            .toFormat("webp")
            .save(outputPath);
        });

        const stickerBuffer = fs.readFileSync(outputPath);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            sticker: stickerBuffer,
            packname: "Bot 🌸",
            author: "by Wirk"
          },
          { quoted: msg }
        );

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

      } catch (error) {
        console.error("Error al crear sticker:", error);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ *Error al crear el sticker.* Asegúrate de responder a una imagen o video válido." },
          { quoted: msg }
        );
      }
      break;

    case 'play2':
    case 'mp4':
    case 'ytmp4':
    case 'playmp4': {
      const fetch = (await import('node-fetch')).default;

      const decryptBase64 = (str) => Buffer.from(str, 'base64').toString();
      const searchAPI = decryptBase64('aHR0cDovLzE3My4yMDguMjAwLjIyNzozMjY5L3NlYXJjaF95b3V0dWJlP3F1ZXJ5PQ==');
      const downloadAPI = decryptBase64('aHR0cDovLzE3My4yMDguMjAwLjIyNzozMjY5L2Rvd25sb2FkX3ZpZGVvP3VybD0=');

      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const text = body.slice(body.indexOf(' ') + 1).trim();

      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: '🔍 Por favor, ingresa el *nombre o URL del video* que deseas buscar.\n\n_Ejemplo:_. `play2 Imagine Dragons - Believer`'
        }, { quoted: msg });
        break;
      }

      try {
        await sock.sendMessage(msg.key.remoteJid, { text: "🔎 Buscando video en YouTube, por favor espera..." }, { quoted: msg });
        const res = await fetch(`${searchAPI}${encodeURIComponent(text)}`);
        const json = await res.json();

        if (!json.results || !json.results.length) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ No se encontraron resultados para tu búsqueda. Intenta con un término más específico.'
          }, { quoted: msg });
          break;
        }

        const video = json.results[0];
        const thumb = video.thumbnails.find(t => t.width === 720)?.url || video.thumbnails[0]?.url;
        const title = video.title;
        const url = video.url;
        const duration = Math.floor(video.duration);
        const views = video.views;

        const info = `
🎬 *Título:* ${title}
📺 *Canal:* ${video.channel}
⏱️ *Duración:* ${duration}s
👀 *Vistas:* ${views.toLocaleString()}
🔗 *URL:* ${url}

_Procesando descarga del video, esto puede tardar unos segundos..._
`.trim();

        await sock.sendMessage(msg.key.remoteJid, {
          image: { url: thumb },
          caption: info
        }, { quoted: msg });

        const down = await fetch(`${downloadAPI}${encodeURIComponent(url)}`);
        const downJson = await down.json();

        if (!downJson.file_url) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ No se pudo descargar el video. Por favor, intenta de nuevo más tarde.'
          }, { quoted: msg });
          break;
        }

        await sock.sendMessage(msg.key.remoteJid, {
          video: { url: downJson.file_url },
          mimetype: 'video/mp4',
          fileName: `${downJson.title}.mp4`
        }, { quoted: msg });

      } catch (err) {
        console.error("Error en el comando play2:", err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Ocurrió un error al procesar la solicitud. Por favor, inténtalo de nuevo.'
        }, { quoted: msg });
      }
      break;
    }

    case "play":
      if (!args.length) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "🎵 Por favor, ingresa el *nombre de la canción* que deseas escuchar.\n\n_Ejemplo:_. `play Alone Alan Walker`" },
          { quoted: msg }
        );
        return;
      }

      const queryAudio = args.join(" ");
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: "🔎 Buscando audio en YouTube, por favor espera..." }, { quoted: msg });

        const search = await yts(queryAudio);
        const video = search.videos[0];
        if (!video) {
          await sock.sendMessage(msg.key.remoteJid, { text: "❌ No se encontró ningún audio con ese nombre. Intenta con una búsqueda diferente." }, { quoted: msg });
          return;
        }

        const { title, url, timestamp, views, ago, duration } = video;
        const res = await ddownr.download(url, "mp3");

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: { url: video.thumbnail },
            caption: `
🎵 *Título:* ${title}
⏱️ *Duración:* ${duration}
👀 *Vistas:* ${views.toLocaleString()}
📅 *Publicado:* ${ago}

_Preparando el audio, esto puede tomar unos segundos..._
`.trim()
          },
          { quoted: msg }
        );

        const response = await axios.get(res.downloadUrl, { responseType: "arraybuffer" });

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            audio: Buffer.from(response.data),
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            ptt: false
          },
          { quoted: msg }
        );
      } catch (error) {
        console.error("Error en el comando play:", error);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Ocurrió un error al buscar o descargar el audio. Por favor, inténtalo de nuevo." },
          { quoted: msg }
        );
      }
      break;

    default:
      await sock.sendMessage(msg.key.remoteJid, { text: "❓ Comando no reconocido. Usa `ayuda` para ver la lista de comandos disponibles." }, { quoted: msg });
      break;
  }
}
