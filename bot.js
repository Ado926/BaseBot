import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  generatePairingCode,
  requestPairingCode,
} from '@whiskeysockets/baileys'
import { boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function questionAsync(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function iniciarBot() {
  // Carga o crea archivo para guardar sesión
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  // Obtiene la última versión de baileys para mejor compatibilidad
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`Usando Baileys v${version.join('.')} (última: ${isLatest})`)

  // Preguntar cómo conectar
  let metodo = await questionAsync('¿Cómo deseas conectar? (1: QR, 2: Código de 8 dígitos): ')

  // Crea el socket con la sesión y versión
  const sock = makeWASocket({
    version,
    printQRInTerminal: false, // No mostrar QR automático, lo haremos manual
    auth: state,
  })

  sock.ev.on('creds.update', saveCreds)

  // Escucha eventos de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
      console.log('Escanea el código QR arriba para conectar el bot.')
    }

    if(connection === 'close') {
      const statusCode = (lastDisconnect?.error as boom.Boom)?.output?.statusCode
      console.log('Conexión cerrada, código:', statusCode)
      if(statusCode === 401) {
        console.log('Sesión inválida. Borra carpeta auth_info para reiniciar sesión.')
      }
    } else if(connection === 'open') {
      console.log('Conectado correctamente al servidor WhatsApp!')
    }
  })

  if(metodo === '2') {
    // Pide número con código país
    let numero = await questionAsync('Número WhatsApp con código país (ej: 521XXXXXXXXXX): ')
    numero = numero.trim()

    try {
      // Solicitar código de emparejamiento (pairing code)
      const pairingCode = await requestPairingCode(sock, numero)

      console.log(`Código de emparejamiento recibido para ${numero}: ${pairingCode}`)

      console.log('Entra el código de 8 dígitos que te mostró WhatsApp para emparejar:')
      const codigoUsuario = await questionAsync('Código: ')

      // Completa el emparejamiento con el código que ingresó el usuario
      await sock.verifyPairingCode(codigoUsuario.trim())

      console.log('Emparejamiento exitoso! Bot conectado.')
    } catch (err) {
      console.error('Error solicitando código de emparejamiento:', err)
      console.log('Se intentará conectar por QR en su lugar...')
    }
  }

  // Espera a mensajes o eventos (ejemplo)
  sock.ev.on('messages.upsert', ({ messages }) => {
    const msg = messages[0]
    if(!msg.message || msg.key.fromMe) return

    const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || ''
    console.log('Mensaje recibido:', text)

    if(text.toLowerCase() === 'ping') {
      sock.sendMessage(msg.key.remoteJid, { text: 'pong' })
    }
  })
}

iniciarBot()
