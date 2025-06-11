// comandos/sticker.js
import { downloadMediaMessage, WAMessage, WASocket } from '@whiskeysockets/baileys';
import fs from 'fs-extra'; // Para manejo de archivos si es necesario, aunque Baileys puede usar buffers
import { exec } from 'child_process'; // Para verificar ffmpeg
import util from 'util';

const execPromise = util.promisify(exec);

// Función auxiliar para convertir Stream a Buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Función para verificar si ffmpeg está instalado
async function checkFfmpeg() {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch (error) {
    console.warn("ffmpeg no parece estar instalado. Los stickers de video/gif podrían no funcionar.");
    return false;
  }
}

let ffmpegDisponible = false;
checkFfmpeg().then(disponible => ffmpegDisponible = disponible);

export default {
  nombre: 'sticker',
  descripcion: 'Convierte imágenes/videos/GIFs a stickers. Responde a un mensaje con media o envía media con !sticker como caption.',
  /**
   * @param {WASocket} sock
   * @param {WAMessage} mensaje
   * @param {string[]} args
   */
  ejecutar: async (sock, mensaje, args) => {
    const chatJid = mensaje.key.remoteJid;
    let mensajeConMedia = mensaje;
    let esReply = false;

    // Verificar si es un reply a un mensaje con media
    if (mensaje.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      mensajeConMedia = {
        key: mensaje.message.extendedTextMessage.contextInfo.stanzaId, // ID del mensaje citado
        message: mensaje.message.extendedTextMessage.contextInfo.quotedMessage
      };
      esReply = true;
    }

    const tipoMensaje = Object.keys(mensajeConMedia.message || {})[0]; // imageMessage, videoMessage, etc.

    let mediaBuffer;
    let esVideoOgif = false;

    if (tipoMensaje === 'imageMessage') {
      await sock.sendMessage(chatJid, { text: '🖼️ Procesando imagen para sticker...' }, { quoted: mensaje });
      const stream = await downloadMediaMessage(mensajeConMedia, 'buffer', {}, {
        // logger: pino().child({ level: 'silent' }), // Descomentar si se necesita log detallado
        reuploadRequest: sock.updateMediaMessage
      });
      mediaBuffer = await streamToBuffer(stream);
    } else if (tipoMensaje === 'videoMessage') {
      // Podría ser un video o un GIF animado
      const esGif = mensajeConMedia.message.videoMessage.gifPlayback === true;
      if (esGif) {
        await sock.sendMessage(chatJid, { text: '💫 Procesando GIF para sticker animado...' }, { quoted: mensaje });
      } else {
        await sock.sendMessage(chatJid, { text: '🎬 Procesando video para sticker animado...' }, { quoted: mensaje });
      }

      if (!ffmpegDisponible) {
        await sock.sendMessage(chatJid, { text: '⚠️ Advertencia: ffmpeg no está disponible. La creación de stickers animados podría fallar o tomar mucho tiempo.' }, { quoted: mensaje });
      }

      // Limitar duración de video/gif para stickers (ej. 7 segundos)
      const duracionVideo = mensajeConMedia.message.videoMessage.seconds;
      if (duracionVideo > 7) {
          await sock.sendMessage(chatJid, { text: `El ${esGif ? 'GIF' : 'video'} es demasiado largo (${duracionVideo}s). Máximo 7 segundos para stickers animados.` }, { quoted: mensaje });
          return;
      }

      const stream = await downloadMediaMessage(mensajeConMedia, 'buffer', {}, {
        reuploadRequest: sock.updateMediaMessage
      });
      mediaBuffer = await streamToBuffer(stream);
      esVideoOgif = true;
    } else {
      // Si el comando es !sticker pero no es reply ni tiene media directa con caption !sticker
      // (el manejador de comandos ya debería filtrar por caption, pero doble chequeo)
      if (!esReply || (esReply && !['imageMessage', 'videoMessage'].includes(tipoMensaje))) {
         await sock.sendMessage(chatJid, { text: 'Por favor, responde a una imagen/video/GIF con !sticker, o envía una imagen/video/GIF con el comando !sticker en el pie de foto.' }, { quoted: mensaje });
        return;
      }
    }

    if (!mediaBuffer) {
      await sock.sendMessage(chatJid, { text: 'No pude obtener la media para crear el sticker.' }, { quoted: mensaje });
      return;
    }

    try {
      await sock.sendMessage(chatJid, { text: '✨ Creando sticker...' }, { quoted: mensaje });

      // Para stickers animados, Baileys/ffmpeg pueden necesitar configuración específica
      // o usar una librería como wa-sticker-formatter para mejor control.
      // Por ahora, confiamos en la capacidad de Baileys con ffmpeg.
      const stickerOptions = {
        sticker: mediaBuffer,
        // pack: 'Mi Bot Stickers', // Opcional: metadatos del sticker
        // author: 'JulesBot'      // Opcional
      };

      // Si es video/gif, Baileys intentará hacerlo animado si ffmpeg está.
      // No hay una opción explícita 'animated' aquí, depende de la media de entrada.
      await sock.sendMessage(chatJid, stickerOptions, { quoted: mensaje });
      console.log('Sticker enviado.');

    } catch (error) {
      console.error('Error al crear o enviar el sticker:', error);
      await sock.sendMessage(chatJid, { text: `❌ Hubo un error al crear el sticker: ${error.message}` }, { quoted: mensaje });
    }
  }
};
