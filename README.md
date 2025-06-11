# BaseBot de WhatsApp en JavaScript

Un bot de WhatsApp multifuncional desarrollado en JavaScript, utilizando `@whiskeysockets/baileys`.

## Características Principales

*   **Descarga de Música**: Descarga audio directamente desde YouTube usando URLs o búsqueda por nombre.
*   **Creación de Stickers**: Convierte imágenes, videos y GIFs en stickers de WhatsApp.
*   **Comandos Dinámicos**: Fácil de extender con nuevos comandos.
*   **Configurable**: Permite cambiar el prefijo de los comandos.
*   **Múltiples Métodos de Vinculación**: Soporta conexión mediante código QR y código de 8 dígitos.

## Requisitos Previos

*   **Node.js**: Versión 16.x o superior recomendada.
*   **npm**: Generalmente se instala junto con Node.js.
*   **ffmpeg**: Esencial para la creación de stickers a partir de videos/GIFs y para la conversión de audio en el comando `!descargar`. Asegúrate de que `ffmpeg` esté instalado y accesible en el PATH de tu sistema. Puedes descargarlo desde [ffmpeg.org](https://ffmpeg.org/download.html).

## Instalación

1.  **Clona el repositorio (o descarga los archivos)**:
    ```bash
    # Si es un repo git (ejemplo)
    # git clone https://tu-repositorio-url.git
    # cd nombre-del-directorio-del-bot
    ```
    Si solo tienes los archivos, simplemente colócalos en una carpeta.

2.  **Instala las dependencias**:
    Abre una terminal en el directorio del bot y ejecuta:
    ```bash
    npm install
    ```

## Configuración

Puedes configurar el prefijo de los comandos editando el archivo `config.js`:

```javascript
// config.js
export default {
  prefijo: '!' // Cambia '!' por el prefijo que desees
};
```

## Ejecución

1.  **Inicia el bot**:
    *   Para un uso normal/producción:
        ```bash
        npm start
        ```
    *   Para desarrollo (se reiniciará automáticamente con los cambios en `bot.js`):
        ```bash
        npm run dev
        ```

2.  **Vincula con WhatsApp**:
    *   La primera vez que ejecutes el bot, se te pedirá que elijas un método de vinculación:
        *   **Código QR**: Se mostrará un código QR en la terminal. Escanéalo con WhatsApp en tu teléfono (Ajustes > Dispositivos Vinculados > Vincular un dispositivo).
        *   **Código de 8 dígitos**: Si eliges esta opción, se te pedirá tu número de WhatsApp. Luego, se generará un código de 8 dígitos que deberás ingresar en WhatsApp en tu teléfono (Ajustes > Dispositivos Vinculados > Vincular un dispositivo > Vincular con número de teléfono).
    *   Una vez vinculado, se guardará una sesión en la carpeta `sesion_auth/`. En los siguientes inicios, el bot intentará usar la sesión guardada. Si la sesión es inválida o se cierra sesión desde el teléfono, puede que necesites vincularlo de nuevo.

## Lista de Comandos

Aquí están los comandos disponibles (el prefijo por defecto es `!` según `config.js`):

*   **`!ping`**
    *   Descripción: Verifica si el bot está en línea y responde "Pong!".
    *   Uso: `!ping`

*   **`!descargar <URL de YouTube o nombre de canción>`**
    *   Descripción: Descarga audio de YouTube por URL o búsqueda por nombre.
    *   Uso:
        *   `!descargar https://www.youtube.com/watch?v=VIDEO_ID`
        *   `!descargar Nombre de la Canción Artista`

*   **`!sticker`**
    *   Descripción: Convierte imágenes/videos/GIFs a stickers. Responde a un mensaje con media o envía media con `!sticker` como caption.
    *   Uso:
        *   Responde a una imagen/video/GIF con el mensaje `!sticker`.
        *   Envía una imagen/video/GIF con el texto `!sticker` en el pie de foto/video.
    *   Nota: Los videos/GIFs para stickers animados tienen una duración máxima de 7 segundos.

*   **`!ayuda`**
    *   Descripción: Muestra la lista de todos los comandos disponibles y sus descripciones.
    *   Uso: `!ayuda`

---

Desarrollado con ❤️ por Jules (asistente de IA).
