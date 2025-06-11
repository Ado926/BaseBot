import pkg from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '22.04.4']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if(qr) {
      console.log('Escanea este código QR con WhatsApp:')
      qrcode.generate(qr, { small: true })
    }

    if(connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      console.log('Conexión cerrada, código:', statusCode)
      if(statusCode === DisconnectReason.loggedOut) {
        console.log('Sesión cerrada, elimina la carpeta auth_info para reiniciar sesión.')
      }
    } else if(connection === 'open') {
      console.log('Conectado correctamente al servidor WhatsApp!')
    }
  })

  rl.question('¿Cómo deseas conectar? (1: QR, 2: Código de 8 dígitos): ', async (modo) => {
    if(modo.trim() === '1') {
      console.log('Por favor escanea el QR que aparecerá en consola.')
    } else if(modo.trim() === '2') {
      rl.question('Número WhatsApp con código país (ej: 521XXXXXXXXXX): ', async (numero) => {
        try {
          console.log('Solicitando código de emparejamiento...')
          await sock.requestPairingCode(numero.trim())
          console.log('Código de emparejamiento enviado. Revise su WhatsApp.')
          rl.question('Ingresa el código de 8 dígitos recibido: ', async (codigo8) => {
            try {
              await sock.acceptPairingCode(codigo8.trim())
              console.log('Conectado con éxito usando código de 8 dígitos!')
              rl.close()
            } catch(e) {
              console.error('Error al aceptar código:', e)
              rl.close()
            }
          })
        } catch(e) {
          console.error('Error al solicitar código de emparejamiento:', e)
          rl.close()
        }
      })
    } else {
      console.log('Opción inválida, cerrando...')
      rl.close()
      process.exit(0)
    }
  })

  return sock
}

iniciarBot().catch(e => console.error('Error iniciando bot:', e))
