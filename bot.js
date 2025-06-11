import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg;

// Para __dirname en ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta para guardar la sesión
const SESSION_DIR = path.join(__dirname, 'session');

async function iniciarBot() {
  // Crear carpeta de sesión si no existe
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR);
  }

  // Usar MultiFileAuthState para manejar la sesión (baileys recomienda esto)
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  // Crear socket (cliente WhatsApp)
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // No imprimir QR en consola, porque lo manejamos a mano
  });

  // Eventos para imprimir QR o reconexión
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Escanea este código QR con WhatsApp:');
      console.log(qr);
      // Aquí puedes usar algún paquete para mostrar QR en consola si quieres
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('Sesión cerrada por logout. Borra la carpeta session y vuelve a iniciar.');
      } else {
        console.log('Conexión cerrada inesperadamente, intentando reconectar...');
        iniciarBot(); // Reintentar conexión
      }
    } else if (connection === 'open') {
      console.log('¡Bot conectado correctamente!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Aquí carga tus comandos o escucha mensajes...

  // Ejemplo simple: responder a "!ping"
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

      if (text === '!ping') {
        await sock.sendMessage(msg.key.remoteJid, { text: 'pong' });
      }
    } catch (e) {
      console.error('Error al procesar mensaje:', e);
    }
  });
}

// Ejecutar la función principal
iniciarBot().catch(console.error);
