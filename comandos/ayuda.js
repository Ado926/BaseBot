// comandos/ayuda.js
import config from '../config.js';

export default {
  nombre: 'ayuda',
  descripcion: 'Muestra la lista de todos los comandos disponibles y sus descripciones.',
  /**
   * @param {import('@whiskeysockets/baileys').WASocket} sock - El socket de Baileys.
   * @param {import('@whiskeysockets/baileys').WAMessage} mensaje - El mensaje original.
   * @param {string[]} args - Argumentos del comando (no se usan aquí).
   * @param {Map<string, any>} todosLosComandos - El Map con todos los comandos cargados.
   */
  ejecutar: async (sock, mensaje, args, todosLosComandos) => {
    const chatJid = mensaje.key.remoteJid;

    let textoAyuda = '🤖 *Lista de Comandos Disponibles* 🤖\n\n';

    if (todosLosComandos && todosLosComandos.size > 0) {
      todosLosComandos.forEach(comando => {
        if (comando.nombre && comando.descripcion) { // Asegurarse de que el comando tenga nombre y descripción
          textoAyuda += `*${config.prefijo}${comando.nombre}*\n`;
          textoAyuda += `_${comando.descripcion}_\n\n`;
        }
      });
    } else {
      textoAyuda += 'No hay comandos disponibles en este momento.\n';
    }

    textoAyuda += '_Responde con !comando <argumentos> para usar un comando._';

    try {
      await sock.sendMessage(chatJid, { text: textoAyuda.trim() }, { quoted: mensaje });
    } catch (error) {
      console.error('Error en el comando ayuda:', error);
      await sock.sendMessage(chatJid, { text: 'Hubo un error al mostrar la ayuda.' }, { quoted: mensaje });
    }
  }
};
