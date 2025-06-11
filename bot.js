import baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import qrTerminal from 'qrcode-terminal';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import config from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = baileys;

const SESSION_DIR = './sesion_auth/';
const COMANDOS_DIR = './comandos';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fs.ensureDirSync(SESSION_DIR);
fs.ensureDirSync(COMANDOS_DIR);

const comandos = new Map();

async function cargarComandos() {
  console.log('Cargando comandos...');
  const archivosComandos = fs.readdirSync(COMANDOS_DIR).filter(file => file.endsWith('.js'));

  for (const archivo of archivosComandos) {
    try {
      const rutaAbsolutaComando = path.resolve(__dirname, COMANDOS_DIR, archivo);
      const urlComando = `file://${rutaAbsolutaComando}`;
      const moduloComando = await import(urlComando);
      const comando = moduloComando.default;

      if (comando && typeof comando.nombre === 'string' && typeof comando.ejecutar === 'function') {
        comandos.set(comando.nombre.toLowerCase(), comando);
        console.log(`Comando cargado: ${config.prefijo}${comando.nombre}`);
      } else {
        console.warn(`El archivo ${archivo} no exporta un comando válido.`);
      }
    } catch (error) {
      console.error(`Error al cargar comando ${archivo}:`, error);
    }
  }
  console.log(`${comandos.size} comandos cargados.`);
}

async function iniciarBot() {
  console.log('Iniciando bot...');
  await cargarComandos();

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys versión: ${version.join('.')}, última versión: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // Lo manejamos manualmente para QR y código
    auth: state,
    browser: ['MiBot', 'Chrome', '1.0.0']
  });

  // Mostrar método de conexión si no está registrado
  if (!sock.authState.creds.registered) {
    const metodo = readlineSync.question('¿Cómo deseas conectar? (1: QR, 2: Código de 8 dígitos): ');

    if (metodo === '1') {
      console.log('Escanea el QR que aparecerá en consola...');
      sock.ev.on('connection.update', ({ qr }) => {
        if (qr) qrTerminal.generate(qr, { small: true });
      });
    } else if (metodo === '2') {
      const numero = readlineSync.question('Número WhatsApp con código país (ej: 521XXXXXXXXXX): ');
      if (!numero) {
        console.log('Número no válido. Usando QR en su lugar...');
        sock.ev.on('connection.update', ({ qr }) => {
          if (qr) qrTerminal.generate(qr, { small: true });
        });
      } else {
        try {
          const codigo8 = await sock.requestPairingCode(numero.replace(/\D/g, ''));
          console.log(`Código de emparejamiento (8 dígitos): ${codigo8}`);
          console.log('Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular un dispositivo > Vincular con número de teléfono.');
        } catch (err) {
          console.error('Error al solicitar código de emparejamiento:', err);
          console.log('Usando QR en su lugar...');
          sock.ev.on('connection.update', ({ qr }) => {
            if (qr) qrTerminal.generate(qr, { small: true });
          });
        }
      }
    } else {
      console.log('Opción no válida, mostrando QR...');
      sock.ev.on('connection.update', ({ qr }) => {
        if (qr) qrTerminal.generate(qr, { small: true });
      });
    }
  } else {
    console.log('Sesión ya autenticada. Conectando...');
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('Conexión cerrada, razón:', reason);
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('Reconectando...');
        iniciarBot();
      } else {
        console.log('Sesión cerrada por logout. Borra la sesión para reiniciar si quieres.');
      }
    } else if (connection === 'open') {
      console.log('Bot conectado y listo.');
      console.log(`Prefijo de comandos: ${config.prefijo}`);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    let texto = '';
    const message = msg.message;

    if (message.conversation) texto = message.conversation;
    else if (message.extendedTextMessage?.text) texto = message.extendedTextMessage.text;
    else if (message.imageMessage?.caption) texto = message.imageMessage.caption;
    else if (message.videoMessage?.caption) texto = message.videoMessage.caption;

    if (!texto.startsWith(config.prefijo)) return;

    const [cmdConPrefijo, ...args] = texto.trim().split(/\s+/);
    const cmdName = cmdConPrefijo.slice(config.prefijo.length).toLowerCase();

    const comando = comandos.get(cmdName);
    if (!comando) {
      console.log(`Comando no encontrado: ${config.prefijo}${cmdName}`);
      return;
    }

    console.log(`Ejecutando comando: ${config.prefijo}${comando.nombre} con args: [${args.join(', ')}]`);
    try {
      await comando.ejecutar(sock, msg, args, comandos);
    } catch (error) {
      console.error(`Error ejecutando comando ${config.prefijo}${comando.nombre}:`, error);
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: `Error al ejecutar el comando: ${error.message}` }, { quoted: msg });
      } catch (e) {
        console.error('Error enviando mensaje de error:', e);
      }
    }
  });

  process.on('SIGINT', async () => {
    console.log('Cerrando bot...');
    await sock.logout();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Cerrando bot...');
    await sock.logout();
    process.exit(0);
  });
}

iniciarBot().catch(err => console.error('Error al iniciar el bot:', err));
