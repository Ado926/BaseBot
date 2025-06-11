export default async function comandos(sock, msg, cmd, args) {
  switch (cmd) {
    case "ping":
      await sock.sendMessage(msg.key.remoteJid, { text: "Pong 🏓" }, { quoted: msg });
      break;

    case "ayuda":
      await sock.sendMessage(msg.key.remoteJid, { text: "Lista de comandos:\n- ping\n- ayuda\n- descargar\n- sticker" }, { quoted: msg });
      break;

    case "descargar":
      // Aquí pondrías la lógica de tu comando descargar
      await sock.sendMessage(msg.key.remoteJid, { text: "Función descargar aún no implementada." }, { quoted: msg });
      break;

    case "sticker":
      // Aquí pondrías la lógica para crear stickers
      await sock.sendMessage(msg.key.remoteJid, { text: "Función sticker aún no implementada." }, { quoted: msg });
      break;

    default:
      await sock.sendMessage(msg.key.remoteJid, { text: `❓ Comando *${cmd}* no encontrado.` }, { quoted: msg });
      break;
  }
}
