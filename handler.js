// ./handler.js
import fs from "fs"
import chalk from "chalk"
import { config } from "./config.js"  // <--- Importamos el prefijo

const comandos = new Map()

// Cargar comandos desde ./comandos/
const files = fs.readdirSync("./comandos").filter(f => f.endsWith(".js"))
for (const file of files) {
  const comando = await import(`./comandos/${file}`)
  const nombre = file.replace(".js", "")
  comandos.set(nombre, comando.default)
  console.log(chalk.blue(`[COMANDO]`) + ` Cargado: ${nombre}`)
}

export async function handleMessage(sock, msg) {
  try {
    const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text
    if (!texto) return

    if (!texto.startsWith(config.prefix)) return

    const [cmd, ...args] = texto.slice(config.prefix.length).trim().split(/\s+/)
    const comando = comandos.get(cmd.toLowerCase())

    if (comando) {
      await comando(sock, msg, args)
    }
  } catch (err) {
    console.log(chalk.red("[ERROR]"), err)
  }
}
