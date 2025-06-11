import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WAMessage, // Importar tipos relevantes
  WASocket // Importar tipos relevantes
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrTerminal from 'qrcode-terminal';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import config from './config.js';
import path from 'path'; // Necesario para manejar rutas de archivos
import { fileURLToPath } from 'url'; // Para obtener __dirname en ES Modules

const SESSION_DIR = './sesion_auth/';
const COMANDOS_DIR = './comandos';

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fs.ensureDirSync(SESSION_DIR);
fs.ensureDirSync(COMANDOS_DIR); // Asegurar que la carpeta de comandos exista

const comandos = new Map();

async function cargarComandos() {
  console.log('Cargando comandos...');
  const archivosComandos = fs.readdirSync(COMANDOS_DIR).filter(file => file.endsWith('.js'));

  for (const archivo of archivosComandos) {
    try {
      // Construir la ruta absoluta para importación dinámica
      const rutaAbsolutaComando = path.resolve(__dirname, COMANDOS_DIR, archivo);
      // Necesitamos convertirla a file URL para import() en ES modules
      const urlComando = `file://${rutaAbsolutaComando}`;

      const moduloComando = await import(urlComando);
      const comando = moduloComando.default; // Asumimos export default

      if (comando && typeof comando.nombre === 'string' && typeof comando.ejecutar === 'function') {
        comandos.set(comando.nombre.toLowerCase(), comando);
        console.log(`Comando cargado: ${config.prefijo}${comando.nombre}`);
      } else {
        console.warn(`El archivo ${archivo} no exporta un comando válido (falta nombre o ejecutar).`);
      }
    } catch (error) {
      console.error(`Error al cargar el comando desde ${archivo}:`, error);
    }
  }
  console.log(`${comandos.size} comandos cargados.`);
}

async function iniciarBot() {
  console.log('Iniciando bot...');
  await cargarComandos(); // Cargar comandos antes de iniciar el socket

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Usando Baileys v${version.join('.')}, ¿Es la última versión?: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['MiBot', 'Chrome', '1.0.0']
  });

  if (!sock.authState.creds.registered) {
    let usarCodigoEmparejamiento = false;
    const metodo = readlineSync.question('¿Cómo deseas conectar? (1: QR, 2: Código de 8 dígitos): ');

    if (metodo === '2') {
      usarCodigoEmparejamiento = true;
      const numeroTelefono = readlineSync.question('Por favor, ingresa tu número de WhatsApp (ej: 521XXXXXXXXXX): ');
      if (!numeroTelefono) {
        console.log('Número de teléfono no proporcionado. Intentando con QR.');
        usarCodigoEmparejamiento = false;
      } else {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const codigo = await sock.requestPairingCode(numeroTelefono.replace(/[^0-9]/g, ''));
          console.log(`Tu código de emparejamiento: ${codigo}`);
          console.log('Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular un dispositivo > Vincular con número de teléfono.');
        } catch (error) {
          console.error('Error al solicitar el código de emparejamiento:', error);
          console.log('Intentando con QR...');
          usarCodigoEmparejamiento = false;
        }
      }
    }
    // Si no se usa código o falla, Baileys debería mostrar QR por printQRInTerminal: true
  } else {
    console.log('Sesión encontrada. Conectando...');
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && !sock.authState.creds.registered) {
      console.log('QR recibido, por favor escanéalo si no has optado por el código de 8 dígitos.');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada debido a ', lastDisconnect?.error, ', reconectando: ', shouldReconnect);
      if (shouldReconnect) {
        iniciarBot();
      } else {
        console.log('Desconectado. No se reconectará.');
        // Considerar limpiar sesión si es loggedOut y se desea un inicio limpio la próxima vez
        // if ((lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut) {
        //   fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        // }
      }
    } else if (connection === 'open') {
      console.log('¡Conexión abierta! Bot en línea.');
      console.log(`Prefijo de comandos: ${config.prefijo}`);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe || m.type !== 'notify') {
      return; // Ignorar mensajes propios, vacíos o notificaciones de tipo no mensaje
    }

    // Obtener el contenido del mensaje de forma robusta
    let textoMensaje = '';
    if (msg.message.conversation) {
      textoMensaje = msg.message.conversation;
    } else if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) {
      textoMensaje = msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage && msg.message.imageMessage.caption) {
      textoMensaje = msg.message.imageMessage.caption;
    } else if (msg.message.videoMessage && msg.message.videoMessage.caption) {
      textoMensaje = msg.message.videoMessage.caption;
    }

    if (!textoMensaje.startsWith(config.prefijo)) {
      return; // No es un comando
    }

    const [nombreComandoConPrefijo, ...args] = textoMensaje.trim().split(/\s+/);
    const nombreComando = nombreComandoConPrefijo.slice(config.prefijo.length).toLowerCase();

    const comando = comandos.get(nombreComando);

    if (comando) {
      console.log(`Ejecutando comando: ${config.prefijo}${comando.nombre} con args: [${args.join(', ')}]`);
      try {
        await comando.ejecutar(sock, msg, args, comandos);
      } catch (error) {
        console.error(`Error al ejecutar el comando ${config.prefijo}${comando.nombre}:`, error);
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: `Error al ejecutar el comando: ${error.message}` }, { quoted: msg });
        } catch (errSend) {
          console.error('Error al enviar mensaje de error:', errSend);
        }
      }
    } else {
      // Opcional: responder si el comando no se conoce
      // await sock.sendMessage(msg.key.remoteJid, { text: `Comando desconocido: ${config.prefijo}${nombreComando}` }, { quoted: msg });
      console.log(`Comando no encontrado: ${config.prefijo}${nombreComando}`);
    }
  });

  process.on('SIGINT', async () => { console.log('Cerrando...'); await sock.logout(); process.exit(0); });
  process.on('SIGTERM', async () => { console.log('Cerrando...'); await sock.logout(); process.exit(0); });
}

iniciarBot().catch(err => console.error('Error no capturado en iniciarBot:', err));
