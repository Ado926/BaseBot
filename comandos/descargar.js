// comandos/descargar.js
import ytdl from 'ytdl-core';
import youtubeSr from 'youtube-sr';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';

// Directorio temporal para descargas
const TEMP_DIR = './temp_downloads';
fs.ensureDirSync(TEMP_DIR); // Asegurar que exista

export default {
  nombre: 'descargar',
  descripcion: 'Descarga audio de YouTube por URL o búsqueda por nombre. Uso: !descargar <URL o nombre de canción>',
  /**
   * @param {import('@whiskeysockets/baileys').WASocket} sock - El socket de Baileys.
   * @param {import('@whiskeysockets/baileys').WAMessage} mensaje - El mensaje original.
   * @param {string[]} args - Argumentos del comando (URL o nombre de la canción).
   */
  ejecutar: async (sock, mensaje, args) => {
    const consulta = args.join(' ').trim();
    const chatJid = mensaje.key.remoteJid;

    if (!consulta) {
      await sock.sendMessage(chatJid, { text: 'Por favor, proporciona una URL de YouTube o el nombre de una canción.\nEj: !descargar https://youtu.be/dQw4w9WgXcQ\nO: !descargar Never Gonna Give You Up' }, { quoted: mensaje });
      return;
    }

    try {
      await sock.sendMessage(chatJid, { text: '🔎 Buscando tu canción...' }, { quoted: mensaje });

      let videoInfo;
      let videoUrl;

      if (ytdl.validateURL(consulta)) {
        videoUrl = consulta;
        videoInfo = await ytdl.getInfo(videoUrl);
      } else {
        const searchResult = await youtubeSr.searchOne(consulta, 'video', 'AR'); // 'AR' es un código de país, puedes cambiarlo o quitarlo
        if (!searchResult) {
          await sock.sendMessage(chatJid, { text: '😔 No pude encontrar ningún video con ese nombre.' }, { quoted: mensaje });
          return;
        }
        videoUrl = `https://www.youtube.com/watch?v=${searchResult.id}`;
        videoInfo = await ytdl.getInfo(videoUrl); // Obtener info después de encontrar la URL
      }

      const tituloVideo = videoInfo.videoDetails.title;
      const duracionSegundos = parseInt(videoInfo.videoDetails.lengthSeconds);

      // Limitar duración para evitar abusos (ej. 10 minutos)
      if (duracionSegundos > 600) {
         await sock.sendMessage(chatJid, { text: `El video es demasiado largo (${Math.floor(duracionSegundos/60)} min). Intenta con uno de menos de 10 minutos.` }, { quoted: mensaje });
         return;
      }

      await sock.sendMessage(chatJid, { text: `⬇️ Descargando audio de: *${tituloVideo}*...` }, { quoted: mensaje });

      const nombreArchivoBase = tituloVideo.replace(/[^a-zA-Z0-9_]/g, '_'); // Limpiar nombre para archivo
      const rutaArchivoTempWebm = path.join(TEMP_DIR, `${nombreArchivoBase}_${Date.now()}.webm`);
      const rutaArchivoTempMp3 = path.join(TEMP_DIR, `${nombreArchivoBase}_${Date.now()}.mp3`);

      const audioStream = ytdl(videoUrl, {
        filter: 'audioonly',
        quality: 'highestaudio'
      });

      // Usar una Promise para manejar el stream y la conversión con ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(audioStream)
          .audioBitrate(128)
          .toFormat('mp3')
          .save(rutaArchivoTempMp3)
          .on('error', (err) => {
            console.error('Error en ffmpeg:', err);
            reject(new Error(`Error al convertir el audio: ${err.message}`));
          })
          .on('end', () => {
            console.log('Conversión a MP3 finalizada.');
            resolve(true);
          });
      });

      if (!fs.existsSync(rutaArchivoTempMp3)) {
        throw new Error('El archivo MP3 no se generó correctamente.');
      }

      console.log(`Audio guardado en: ${rutaArchivoTempMp3}`);
      await sock.sendMessage(chatJid, { text: `⬆️ Enviando: *${tituloVideo}*...` }, { quoted: mensaje });

      await sock.sendMessage(
        chatJid,
        {
          audio: { url: rutaArchivoTempMp3 },
          mimetype: 'audio/mp4', // WhatsApp a veces prefiere mp4 para audios mp3
          // fileName: `${tituloVideo}.mp3` // Opcional: nombre del archivo
        },
        { quoted: mensaje }
      );

      console.log('Audio enviado.');

      // Limpieza
      await fs.remove(rutaArchivoTempMp3);
      // Si el archivo .webm se guardó (aunque ffmpeg puede streamear directamente), también eliminarlo.
      // if (fs.existsSync(rutaArchivoTempWebm)) await fs.remove(rutaArchivoTempWebm);

    } catch (error) {
      console.error('Error en el comando descargar:', error);
      await sock.sendMessage(chatJid, { text: `❌ Hubo un error al procesar tu solicitud: ${error.message}` }, { quoted: mensaje });
      // Asegurar limpieza en caso de error
      const filesInTemp = fs.readdirSync(TEMP_DIR);
      for (const file of filesInTemp) {
        if (file.includes(args.join('_'))) { // Intenta ser específico si es posible
            await fs.remove(path.join(TEMP_DIR, file)).catch(e => console.error("Error limpiando archivo:", e));
        }
      }
    }
  }
};
