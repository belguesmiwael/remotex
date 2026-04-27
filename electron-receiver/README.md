# RemoteX — Native Receiver (Electron)

Full OS-level remote control. Controls mouse, keyboard, scroll across the **entire screen** — not just the browser.

## Install & Run

```bash
cd electron-receiver
npm install
npm start
```

## Build distributable

```bash
npm run build:win    # Windows .exe
npm run build:mac    # macOS .dmg
npm run build:linux  # Linux .AppImage
```

## How to use

1. Start the signaling server (Render.com or local `node server/index.js`)
2. Open the web controller at your Vercel URL → Create Session → copy the **Session ID**
3. Launch this Electron app on the device to be controlled
4. Paste the Session ID → click **Connect**
5. The controller now has **full OS control** over this device

## What gets controlled

- 🖱️ Mouse position (full screen, any app)
- 👆 Left/right/double clicks
- ⌨️ Keyboard input (any app in focus)
- 📜 Scroll (vertical + horizontal)
- 🖱️ Drag & drop
- 🎤 Voice commands executed at OS level

## Requirements

- Node.js 18+
- Windows 10+ / macOS 10.15+ / Linux (X11)
- Camera permission for gesture control (optional)
