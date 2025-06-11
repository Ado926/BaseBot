import * as baileys from "@whiskeysockets/baileys"
import chalk from "chalk"
import readlineSync from "readline-sync"
import fs from "fs"
import pino from "pino"

// ---- Configuración de sesión ----
const sessionFolder = "./session"
const credsPath = `${sessionFolder}/creds.json`

if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder)

// Variables globales
let usarCodigo = false
let numero = ""

// ---- Función inicial ----
async function main() {
  console.clear()
  console.log(chalk.cyan("══════════════════════════════"))
  console.log(chalk.magenta("       InfinityBot v1.0"))
  console.log(chalk.cyan("══════════════════════════════"))
  console.log(chalk.green("✅ Base preparada"))

  // Si no hay credenciales existentes, preguntar modo de conexión
  if (!fs.existsSync(credsPath)) {
    console.log(chalk.green("1.") + " Conectar con QR")
    console.log(chalk.green("2.") + " Conectar con código de 8 dígitos")

    const opcion = readlineSync.question(chalk.yellow("Elige una opción (1 o 2): "))
    usarCodigo = opcion === "2"

    if (usarCodigo) {
      numero = readlineSync.question(chalk.yellow("Ingresa tu número (ej: 5218144380378): "))
    }
  }

  await startBot()
}

// ---- Inicio del bot y conexión ----
async function startBot() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionFolder)
  const { version } = await baileys.fetchLatestBaileysVersion()

  const sock = baileys.makeWASocket({
    version,
    printQRInTerminal: !usarCodigo && !fs.existsSync(credsPath),
    logger: pino({ level: "silent" }),
    auth: { creds: state.creds, keys: baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
    browser: ["Ubuntu", "Chrome", "108.0.5359.125"]
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    const code = lastDisconnect?.error?.output?.statusCode
    if (connection === "open") {
      console.log(chalk.greenBright("✅ Conectado correctamente!"))
    }
    if (connection === "close") {
      const reconectar = code !== baileys.DisconnectReason.loggedOut
      console.log(chalk.red("❌ Conexión cerrada. Código:"), code)
      if (reconectar) {
        console.log(chalk.blue("🔁 Reconectando..."))
        startBot()
      } else {
        console.log(chalk.redBright("🔒 Sesión finalizada. Elimina la carpeta 'session' para reiniciar."))
      }
    }
  })

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      // Aquí puedes delegar a tu handler
      console.log("📩 Mensaje recibido:", msg.message?.conversation || "")
      // Ejemplo respuesta automática:
      if (msg.message.conversation === "!ping") {
        await sock.sendMessage(msg.key.remoteJid, { text: "pong" })
      }
    }
  })

  // Si elegiste emparejamiento por código y no hay credenciales aún, solicitarlo
  if (usarCodigo && !state.creds.registered && !fs.existsSync(credsPath)) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(numero)
        console.log(chalk.yellow("🔐 Código de emparejamiento (8 dígitos):"), chalk.greenBright.bold(code))
        console.log(chalk.gray("WhatsApp > Dispositivos vinculados > Vincular un dispositivo > Vincular con número"))
      } catch (e) {
        console.log(chalk.red("❌ Error al generar el código:"), e)
      }
    }, 2500)
  }
}

// ---- Ejecutar ----
main().catch(err => console.error(chalk.red("Error fatal:"), err))
