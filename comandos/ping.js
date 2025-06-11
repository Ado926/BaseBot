// comandos/ping.js

export default {
  nombre: 'ping',
  descripcion: 'Verifica si el bot está en línea y responde "Pong!".',
  /**
   * @param {import('@whiskeysockets/baileys').WASocket} sock - El socket de Baileys.
   * @param {import('@whiskeysockets/baileys').WAMessage} mensaje - El mensaje original.
   * @param {string[]} args - Argumentos del comando.
   */
  ejecutar: async (sock, mensaje, args) => {
    try {
      await sock.sendMessage(
        mensaje.key.remoteJid,
        { text: 'Pong!' },
        { quoted: mensaje }
      );
    } catch (error) {
      console.error('Error en el comando ping:', error);
      // Opcionalmente, enviar un mensaje de error al chat
      // await sock.sendMessage(mensaje.key.remoteJid, { text: 'Hubo un error al procesar el ping.' }, { quoted: mensaje });
    }
  }
};
