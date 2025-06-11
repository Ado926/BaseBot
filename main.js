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
      throw new Error("⚠ Formato no soportado.");
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
        throw new Error("⛔ No se pudo obtener los detalles del video.");
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
  const start = performance.now(); // Usa performance para más precisión
  const msgPing = `🏓 *Pong!*`;
  await sock.sendMessage(msg.key.remoteJid, { text: msgPing }, { quoted: msg });
  const end = performance.now();
  const ping = Math.floor(end - start);
  await sock.sendMessage(msg.key.remoteJid, { text: `🔄 *Latencia actual:* ${ping}ms` }, { quoted: msg });
  break;
}

    case "ayuda":
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "📜 *Lista de comandos disponibles:*\n\n• ping\n• ayuda\n• descargar\n• sticker\n• play"
        },
        { quoted: msg }
      );
      break;
      
      case 'update':
case 'actualizar': {
  await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Actualizando el bot desde GitHub...' }, { quoted: msg });

  exec('git pull', (err, stdout, stderr) => {
    if (err) {
      sock.sendMessage(msg.key.remoteJid, { text: `❌ Error al actualizar:\n${err.message}` }, { quoted: msg });
      return;
    }

    if (stderr) console.warn('⚠️ Advertencia durante la actualización:\n', stderr);

    if (stdout.includes('Already up to date.')) {
      sock.sendMessage(msg.key.remoteJid, { text: '✅ El bot ya está actualizado.' }, { quoted: msg });
    } else {
      sock.sendMessage(msg.key.remoteJid, { text: `✅ Actualización realizada con éxito:\n\n${stdout}` }, { quoted: msg });
    }
  });
  break;
}
    case "descargar":
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "🔧 La función de descarga está en desarrollo." },
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
        { text: "📌 Responde a una *imagen* o *video corto* para convertirlo en sticker." },
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
      let command = ffmpeg(inputPath)
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
    console.error(error);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Error al crear el sticker. Asegúrate de responder a una imagen o video corto." },
      { quoted: msg }
    );
  }
  break;

case 'play2':
case 'mp4':
case 'ytmp4':
case 'playmp4': {
  import('./comandos/play2.js')
    .then(async (module) => {
      const handler = module.default;
      await handler(msg, { conn, text, command });
    })
    .catch(err => {
      console.error(err);
      msg.reply('❌ Hubo un error al ejecutar el comando.');
    });
  break;
}
      
    case "play":
      if (!args.length) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "🔍 Escribe el nombre de una canción. Ejemplo: *.play Alone Alan Walker*" },
          { quoted: msg }
        );
        return;
      }

      const texto = args.join(" ");
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: "🔎 Buscando..." }, { quoted: msg });

        const search = await yts(texto);
        const video = search.videos[0];
        if (!video) {
          await sock.sendMessage(msg.key.remoteJid, { text: "❌ No se encontró el video." }, { quoted: msg });
          return;
        }

        const { title, url, timestamp, views, ago, duration } = video;
        const res = await ddownr.download(url, "mp3");

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: { url: video.thumbnail },
            caption: `🎵 *Título:* ${title}\n🕒 *Duración:* ${duration}\n👁 *Vistas:* ${views}\n📤 *Publicado:* ${ago}`
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
        console.error(error);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Error al buscar o descargar el audio." },
          { quoted: msg }
        );
      }
      break;

    default:
      await sock.sendMessage(msg.key.remoteJid, { text: "❔ Comando no reconocido." }, { quoted: msg });
      break;
  }
}
