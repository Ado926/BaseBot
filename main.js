// main.js 👻
export const comandos = {
  ping: async (sock, msg, args) => {
    await sock.sendMessage(msg.key.remoteJid, { text: "🏓 ¡Pong!" }, { quoted: msg })
  },

  ayuda: async (sock, msg, args) => {
    const texto = `
🌟 *Comandos disponibles:*
- .ping
- .ayuda
- .sticker
- .descargar
`.trim()
    await sock.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg })
  },

  sticker: async (sock, msg, args) => {
    await sock.sendMessage(msg.key.remoteJid, { text: "🧃 Aquí iría el sticker (lógica no implementada)." }, { quoted: msg })
  },

  descargar: async (sock, msg, args) => {
    await sock.sendMessage(msg.key.remoteJid, { text: "🎶 Descargando (esto es solo un ejemplo)..." }, { quoted: msg })
  }
}
