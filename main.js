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
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      throw error;
    }
  }
};

export default async function comandos(sock, msg, cmd, args) {
  switch (cmd) {
    case "ping":
      await sock.sendMessage(msg.key.remoteJid, { text: "Pong 🏓" }, { quoted: msg });
      break;

    case "ayuda":
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "📜 *Lista de comandos disponibles:*\n\n• ping\n• ayuda\n• descargar\n• sticker\n• play"
        },
        { quoted: msg }
      );
      break;

    case "descargar":
      await sock.sendMessage(msg.key.remoteJid, { text: "Función descargar aún no implementada." }, { quoted: msg });
      break;

    case "sticker":
  try {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "📸 *Responde a una imagen o video para convertirlo en sticker.*" },
        { quoted: msg }
      );
      return;
    }

    let mime;
    let mediaType;

    if (quoted.imageMessage) {
      mime = quoted.imageMessage.mimetype;
      mediaType = "image";
    } else if (quoted.videoMessage) {
      mime = quoted.videoMessage.mimetype;
      mediaType = "video";
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠ *Solo se permiten imágenes o videos de máximo 10 segundos.*" },
        { quoted: msg }
      );
      return;
    }

    const mediaMessage = {
      [mediaType]: quoted[`${mediaType}Message`],
    };

    const mediaBuffer = await sock.downloadMediaMessage({ message: mediaMessage });

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        sticker: mediaBuffer,
        packname: "BaseBot 🌸",
        author: "By Wirk",
      },
      { quoted: msg }
    );
  } catch (e) {
    console.error(e);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Ocurrió un error al crear el sticker." },
      { quoted: msg }
    );
  }
  break;

    case "play":
      if (!args.length) {
        await sock.sendMessage(msg.key.remoteJid, { text: "🔍 Escribe el nombre de la canción que deseas buscar." }, { quoted: msg });
        return;
      }

      try {
        const query = args.join(" ");
        const search = await yts(query);
        if (!search.all.length) {
          await sock.sendMessage(msg.key.remoteJid, { text: "⚠ No se encontraron resultados para tu búsqueda." }, { quoted: msg });
          return;
        }

        const video = search.all[0];
        const { title, thumbnail, timestamp, views, ago, url } = video;

        const infoMessage = {
          image: { url: thumbnail },
          caption: `🎵 *Resultado encontrado:*\n\n📌 *Título:* ${title}\n📅 *Publicado:* ${ago}\n⏱️ *Duración:* ${timestamp}\n👀 *Vistas:* ${views.toLocaleString()}\n🔗 *Link:* ${url}`
        };

        // Enviar reacción ✅ rápido
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } });

        // Enviar mensaje con info y miniatura
        await sock.sendMessage(msg.key.remoteJid, infoMessage, { quoted: msg });

        // Descargar audio
        const result = await ddownr.download(url, "mp3");

        // Enviar audio sin contextInfo para rapidez
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            audio: { url: result.downloadUrl },
            mimetype: "audio/mpeg",
            fileName: `${result.title}.mp3`,
          },
          { quoted: msg }
        );

      } catch (error) {
        console.error(error);
        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Ocurrió un error:\n${error.message}` }, { quoted: msg });
      }
      break;

    default:
      await sock.sendMessage(msg.key.remoteJid, { text: `❓ Comando *${cmd}* no encontrado.` }, { quoted: msg });
      break;
  }
}
