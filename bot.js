// bot.js
import * as baileys from "@whiskeysockets/baileys";
import chalk from "chalk";
import readlineSync from "readline-sync";
import fs from "fs";
import pino from "pino";
import comandos from "./main.js"; // Tu función principal con switch(cmd)
import config from "./config.js"; // Config con prefijo

const sessionFolder = "./session";
const credsPath = `${sessionFolder}/creds.json`;

if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

let usarCodigo = false;
let numero = "";

async function main() {
  console.clear();
  console.log(chalk.cyanBright.bold("══════════════════════════════"));
  console.log(chalk.magentaBright.bold("       MaiBot v1.0"));
  console.log(chalk.cyanBright.bold("══════════════════════════════"));

  if (!fs.existsSync(credsPath)) {
    console.log(chalk.green("1.") + " Conectar con código QR");
    console.log(chalk.green("2.") + " Conectar con código de 8 dígitos");

    const opcion = readlineSync.question(chalk.yellow("Elige una opción (1 o 2): "));
    usarCodigo = opcion === "2";

    if (usarCodigo) {
      numero = readlineSync.question(chalk.yellow("Ingresa tu número (ej: 5218144380378): "));
    }
  }

  iniciarBot();
}

async function iniciarBot() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState("session");
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.default({
    version,
    printQRInTerminal: !usarCodigo && !fs.existsSync(credsPath),
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    },
    browser: ["Ubuntu", "Chrome", "108.0.5359.125"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    const code = (lastDisconnect?.error)?.output?.statusCode;
    if (connection === "open") {
      console.log(chalk.greenBright("✅ ¡Conectado correctamente!"));
    }
    if (connection === "close") {
      const reconectar = code !== baileys.DisconnectReason.loggedOut;
      console.log(chalk.red("❌ Conexión cerrada. Código:"), code);
      if (reconectar) {
        console.log(chalk.yellow("🔁 Reconectando..."));
        iniciarBot();
      } else {
        console.log(chalk.redBright("🛑 Sesión cerrada. Borra la carpeta 'session' y vuelve a vincular."));
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (!texto) continue;

      // Mostrar mensaje recibido en consola
      console.log(`[📩] ${msg.key.remoteJid} > ${texto}`);

      if (!texto.startsWith(config.prefijo)) continue;

      const [cmd, ...args] = texto.slice(config.prefijo.length).trim().split(/\s+/);
      const comando = cmd.toLowerCase();

      // Llamar a la función comandos() del main.js
      try {
        await comandos(sock, msg, comando, args);
      } catch (e) {
        console.log(chalk.red("[❌ ERROR AL EJECUTAR COMANDO]"), e);
        await sock.sendMessage(msg.key.remoteJid, { text: "⚠️ Ocurrió un error al ejecutar el comando." }, { quoted: msg });
      }
    }
  });

  if (usarCodigo && !state.creds.registered && !fs.existsSync(credsPath)) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(numero);
        console.log(chalk.yellow("🔑 Código de emparejamiento (8 dígitos):"), chalk.greenBright.bold(code));
        console.log(chalk.gray("WhatsApp > Dispositivos vinculados > Vincular > Usar código"));
      } catch (e) {
        console.log(chalk.red("Error al generar código de emparejamiento:"), e);
      }
    }, 2500);
  }
}

main();
