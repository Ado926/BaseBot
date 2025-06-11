import path from "path";
import ytdl from 'ytdl-core'
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
  await sock.sendMessage(msg.key.remoteJid, { text: `⚔️ *Latencia actual:* ${ping}ms` }, { quoted: msg });
  break;
}

    case "ayuda":
case "menu":
  await sock.sendMessage(
    msg.key.remoteJid,
    {
      image: { url: "https://raw.githubusercontent.com/Ado926/WirksiBoxFiles/main/1749661095010-fyrz5r-1749661072633-fd9d32.jpg" },
      caption: `> ⚔️ Michi Bot Base\n 📜 *Lista de comandos disponibles:*\n\n• ping\n• descargar [ en desarrollo ]\n• sticker\n• play\n• play2\n• tiktok <URL>\n\n> 🍫 Michi Base Bot 2025 | Made With Wirk 🍟`
    },
    { quoted: msg }
  );
  break;

      case 'xd': {
  const buttons = [
    { buttonId: 'boton1', buttonText: { displayText: 'Botón 1' }, type: 1 },
    { buttonId: 'boton2', buttonText: { displayText: 'Botón 2' }, type: 1 },
    { buttonId: 'boton3', buttonText: { displayText: 'Botón 3' }, type: 1 }
  ];

  const buttonMessage = {
    text: 'xd',
    buttons: buttons,
    headerType: 1
  };

  await sock.sendMessage(msg.key.remoteJid, buttonMessage, { quoted: msg });
  break;
      }
      
 case 'update':
case 'actualizar': {
  await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Actualizando el bot desde GitHub...' }, { quoted: msg });

  exec('git pull', async (err, stdout, stderr) => {
    if (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Error al actualizar:\n${err.message}` }, { quoted: msg });
      return;
    }

    if (stderr) console.warn('⚠️ Advertencia durante la actualización:\n', stderr);

    if (stdout.includes('Already up to date.')) {
      await sock.sendMessage(msg.key.remoteJid, { text: '✅ El bot ya está actualizado.' }, { quoted: msg });
    } else {
      await sock.sendMessage(msg.key.remoteJid, { text: `✅ Actualización realizada con éxito:\n\n${stdout}` }, { quoted: msg });
      await sock.sendMessage(msg.key.remoteJid, { text: '♻️ Reiniciando el bot para aplicar cambios...' }, { quoted: msg });

      setTimeout(() => {
        process.exit(0);
      }, 3000);
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
  const fetch = (await import('node-fetch')).default;

  const decryptBase64 = (str) => Buffer.from(str, 'base64').toString();
  const searchAPI = decryptBase64('aHR0cDovLzE3My4yMDguMjAwLjIyNzozMjY5L3NlYXJjaF95b3V0dWJlP3F1ZXJ5PQ==');
  const downloadAPI = decryptBase64('aHR0cDovLzE3My4yMDguMjAwLjIyNzozMjY5L2Rvd25sb2FkX3ZpZGVvP3VybD0=');

  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const text = body.slice(body.indexOf(' ') + 1).trim();

  if (!text) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: '🔍 *Ingresa el nombre del video.*\n\n📌 Ejemplo:\n.play2 Usewa Ado'
    }, { quoted: msg });
    break;
  }

  try {
    const res = await fetch(`${searchAPI}${encodeURIComponent(text)}`);
    const json = await res.json();

    if (!json.results || !json.results.length) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '⚠️ No se encontraron resultados para tu búsqueda.'
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
Enviando video, un momento… 
    `.trim();

    await sock.sendMessage(msg.key.remoteJid, {
      image: { url: thumb },
      caption: info
    }, { quoted: msg });

    const down = await fetch(`${downloadAPI}${encodeURIComponent(url)}`);
    const downJson = await down.json();

    if (!downJson.file_url) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ No se pudo descargar el video.'
      }, { quoted: msg });
      break;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      video: { url: downJson.file_url },
      mimetype: 'video/mp4',
      fileName: `${downJson.title}.mp4`
    }, { quoted: msg });

  } catch (err) {
    console.error(err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Ocurrió un error al procesar el comando.'
    }, { quoted: msg });
  }

  break;
}

case "tiktok": {
  try {
    const fg = (await import('api-dylux')).default;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const argsText = text.split(' ').slice(1).join(' ').trim();

    if (!argsText) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '🥀 Ingresa un enlace válido de TikTok.\nEjemplo:\n.tiktok https://vm.tiktok.com/ZMSUaxrhJ/',
      }, { quoted: msg });
      break;
    }

    if (!/(?:https?:\/\/)?(?:www\.)?(?:vm|vt|t)?\.?tiktok\.com\/[^\s]+/gi.test(argsText)) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❎ Enlace de TikTok inválido.',
      }, { quoted: msg });
      break;
    }

    await sock.sendMessage(msg.key.remoteJid, { react: { text: '🕒', key: msg.key } });

    const data = await fg.tiktok(argsText);
    const { title, play, duration, author } = data.result;

    const caption = `乂 *TikTok Download*\n\n👤 *Autor:* ${author.nickname}\n📌 *Título:* ${title}\n⏱️ *Duración:* ${duration}`;

    await sock.sendMessage(msg.key.remoteJid, {
      video: { url: play },
      mimetype: 'video/mp4',
      fileName: 'tiktok.mp4',
      caption
    }, { quoted: msg });

    await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error(e);
    await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ *Error:* ${e.message}`,
    }, { quoted: msg });
  }
  break;
}
    // Objeto para guardar configuraciones por grupo (mejor usar DB o JSON persistente)
const groupSettings = {};

// Función para manejar comandos
async function handleCommand({
  command,
  args,
  isGroup,
  isAdmin,
  isBotAdmin,
  groupId,
  reply,
  mentioned,
  senderId,
  setGroupDescription,
  setGroupName,
  kickUserFromGroup,
  getGroupName,
  messageBody,
  isMessageFromAdmin,
}) {
  switch (command) {
    case 'antilink':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para activar antilink.');
      if (!args[0]) return reply('📌 Uso: #antilink activar | desactivar');

      if (!groupSettings[groupId]) groupSettings[groupId] = {};
      if (args[0].toLowerCase() === 'activar') {
        groupSettings[groupId].antilink = true;
        reply('✅ AntiLink activado en este grupo.');
      } else if (args[0].toLowerCase() === 'desactivar') {
        groupSettings[groupId].antilink = false;
        reply('⚠️ AntiLink desactivado en este grupo.');
      } else {
        reply('❌ Parámetro inválido, usa activar o desactivar.');
      }
      break;

    case 'bienvenida':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para configurar la bienvenida.');
      if (!args[0]) return reply('📌 Uso: #bienvenida activar | desactivar');

      if (!groupSettings[groupId]) groupSettings[groupId] = {};
      if (args[0].toLowerCase() === 'activar') {
        groupSettings[groupId].welcome = true;
        reply('👋 Mensajes de bienvenida activados.');
      } else if (args[0].toLowerCase() === 'desactivar') {
        groupSettings[groupId].welcome = false;
        reply('👋 Mensajes de bienvenida desactivados.');
      } else {
        reply('❌ Parámetro inválido, usa activar o desactivar.');
      }
      break;

    case 'despedida':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para configurar la despedida.');
      if (!args[0]) return reply('📌 Uso: #despedida activar | desactivar');

      if (!groupSettings[groupId]) groupSettings[groupId] = {};
      if (args[0].toLowerCase() === 'activar') {
        groupSettings[groupId].goodbye = true;
        reply('👋 Mensajes de despedida activados.');
      } else if (args[0].toLowerCase() === 'desactivar') {
        groupSettings[groupId].goodbye = false;
        reply('👋 Mensajes de despedida desactivados.');
      } else {
        reply('❌ Parámetro inválido, usa activar o desactivar.');
      }
      break;

    case 'kick':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isAdmin) return reply('⚠️ Solo administradores pueden expulsar.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para expulsar.');
      if (!mentioned.length) return reply('📌 Menciona a alguien para expulsar.');

      for (const user of mentioned) {
        try {
          await kickUserFromGroup(groupId, user);
        } catch {
          reply(`❌ No pude expulsar a @${user.split('@')[0]}.`);
        }
      }
      reply(`🚪 Usuario(s) expulsado(s) con éxito.`);
      break;

    case 'kicknum':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isAdmin) return reply('⚠️ Solo administradores pueden expulsar.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para expulsar.');
      if (!args[0]) return reply('📌 Uso: #kicknum +[código_país][número]');

      const prefixMatch = args[0].match(/^\+?\d+/);
      if (!prefixMatch) return reply('❌ Prefijo inválido.');
      const prefix = prefixMatch[0];

      reply(`🚪 Eliminando a los números con prefijo ${prefix}...`);

      const numberToKick = args[0].replace(/\D/g, '');
      if (!numberToKick) return reply('❌ Número inválido.');

      try {
        await kickUserFromGroup(groupId, numberToKick + '@s.whatsapp.net');
        reply(`✅ Número ${args[0]} expulsado con éxito.`);
      } catch {
        reply('❌ No pude expulsar ese número. Revisa que el número esté en el grupo.');
      }
      break;

    case 'setdesc':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isAdmin) return reply('⚠️ Solo administradores pueden cambiar la descripción.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para cambiar la descripción.');
      if (!args.length) return reply('📌 Uso: #setdesc [nueva descripción]');

      const newDesc = args.join(' ');
      await setGroupDescription(groupId, newDesc);
      reply('📝 Descripción del grupo actualizada.');
      break;

    case 'setname':
      if (!isGroup) return reply('❌ Este comando solo funciona en grupos.');
      if (!isAdmin) return reply('⚠️ Solo administradores pueden cambiar el nombre.');
      if (!isBotAdmin) return reply('⚠️ Necesito ser administrador para cambiar el nombre.');
      if (!args.length) return reply('📌 Uso: #setname [nuevo nombre]');

      const newName = args.join(' ');
      await setGroupName(groupId, newName);
      reply('✏️ Nombre del grupo actualizado.');
      break;

    default:
      reply('❓ Comando no reconocido. Usa #help para ver comandos disponibles.');
  }

  // --- Detección automática de links para antilink ---

  if (isGroup && groupSettings[groupId]?.antilink) {
    const linkRegex = /(https?:\/\/|www\.)\S+/i;

    if (linkRegex.test(messageBody)) {
      if (!isBotAdmin) {
        reply('⚠️ El antilink está activo, pero no soy admin para expulsar.');
        return;
      }
      if (isMessageFromAdmin) {
        reply('⚠️ Eres admin, no puedo expulsarte por enviar links.');
        return;
      }
      reply(`🚫 AntiLink detectado, serás eliminado del grupo.`);
      await kickUserFromGroup(groupId, senderId);
    }
  }
}

// --- Eventos de bienvenida y despedida ---

async function onUserJoin({
  groupId,
  userId,
  sendMessage,
  getGroupName,
}) {
  if (!groupSettings[groupId]?.welcome) return;

  const groupName = await getGroupName(groupId);
  await sendMessage(groupId, `👋 Holaa @${userId.split('@')[0]}, bienvenido(a) a ${groupName} 🎉`, { mentions: [userId] });
}

async function onUserLeave({
  groupId,
  userId,
  sendMessage,
  getGroupName,
}) {
  if (!groupSettings[groupId]?.goodbye) return;

  const groupName = await getGroupName(groupId);
  await sendMessage(groupId, `👋 @${userId.split('@')[0]} se fue del grupo ${groupName}, lo extrañaremos 😢`, { mentions: [userId] });
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
      await sock.sendMessage(msg.key.remoteJid, { text: "❔ Comando no reconocido. Usa !menu para ver lo comandos disponibles" }, { quoted: msg });
      break;
  }
}
