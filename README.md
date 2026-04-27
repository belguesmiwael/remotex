# 🖥️ RemoteX — Real-time Remote Control

> Control any device from your browser. No installs. No accounts. Just connect.

**RemoteX** is a standalone web app that lets two devices pair via WebRTC and then control each other using:
- 🖱️ **Mouse & Keyboard** — synchronized cursor and keystrokes
- 🎤 **Voice Commands** — "scroll down", "click", "type hello" and more
- ✋ **Hand Gestures** — MediaPipe Hands, index finger → cursor, pinch → click
- 👁️ **Eye Tracking** — WebGazer.js (optional, CPU-intensive)

No database. No login. No cloud. Everything runs in the browser.

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/belguesmiwael/remotex.git
cd remotex

# 2. Install frontend deps
npm install

# 3. Install server deps
cd server && npm install && cd ..

# 4. Create .env.local
cp .env.local.example .env.local

# 5. Run both (two terminals)
# Terminal 1 — Backend
node server/index.js

# Terminal 2 — Frontend
npm run dev

# OR run both at once
npm run dev:all

# 6. Open http://localhost:3000
```

---

## 🔧 Usage

1. **Device A (Controller):** Open `http://localhost:3000` → **Create Session** → Get QR Code + Link
2. **Device B (Receiver):** Scan QR or paste the link → **Join Session**
3. Both connected → Choose a control mode:
   - 🖱️ **Mouse mode** — move your mouse on the controller to move cursor on receiver
   - 🎤 **Voice mode** — speak commands, they execute on the receiver
   - ✋ **Gesture mode** — use your hand in front of webcam to control the cursor

---

## 🎤 Voice Commands

| Say this | Action |
|----------|--------|
| `click` / `tap` | Click at current cursor position |
| `double click` | Double-click |
| `scroll down` / `scroll up` | Scroll the page |
| `scroll left` / `scroll right` | Horizontal scroll |
| `go back` | Browser history back |
| `refresh` | Reload page |
| `press enter` | Send Enter key |
| `press escape` | Send Escape key |
| `type [text]` | Type the text |
| `scroll to top` | Jump to page top |
| `scroll to bottom` | Jump to page bottom |

Supports: 🇺🇸 English, 🇫🇷 French, 🇸🇦 Arabic, 🇩🇪 German, 🇪🇸 Spanish

---

## ✋ Gesture Controls

| Gesture | Action |
|---------|--------|
| Index finger position | Move cursor |
| Pinch (thumb + index) | Click |
| Hold pinch > 500ms | Start drag |
| Release held pinch | End drag |
| Two-finger swipe | Scroll |
| Fist | Pause gesture mode |

---

## 🏗️ Architecture

```
remotex/
├── app/                         ← Next.js App Router
│   ├── page.js                  ← Landing page (create/join)
│   ├── layout.js                ← Root layout + aurora background
│   └── session/[id]/
│       ├── controller/page.js   ← Controller dashboard
│       └── receiver/page.js     ← Receiver + ghost cursor
├── components/
│   ├── webrtc/useWebRTC.js      ← WebRTC hook (offer/answer/ICE)
│   ├── remote-control/
│   │   ├── MouseController.js   ← Capture & emit mouse events
│   │   └── EventRelay.js        ← Receive & simulate events
│   ├── voice/
│   │   ├── VoiceEngine.js       ← Web Speech API
│   │   └── CommandParser.js     ← Command dictionary
│   ├── gesture/
│   │   ├── GestureEngine.js     ← MediaPipe Hands
│   │   ├── HandOverlay.js       ← Canvas skeleton overlay
│   │   └── GestureMapper.js     ← Normalize + smooth positions
│   ├── eyetrack/EyeTracker.js   ← WebGazer.js wrapper
│   └── ui/
│       ├── Dashboard.js         ← Controller UI
│       ├── PermissionsUI.js     ← Step-by-step permissions
│       ├── CalibrationModal.js  ← Gesture/eye calibration
│       └── QRPairing.js         ← QR code generator
├── lib/
│   ├── socket.js                ← Socket.io singleton
│   ├── constants.js             ← Event names, config
│   └── utils.js                 ← Helpers
└── server/
    ├── index.js                 ← Express + Socket.io
    ├── sessionManager.js        ← In-memory sessions
    └── eventRelay.js            ← Secure event relay
```

---

## 🔒 Security

- **Session IDs** are UUID v4 — not guessable
- **Event relay** uses whitelist — only known events are relayed
- **Payload validation** — all events validated (size, format, sessionId)
- **CORS** restricted to frontend origin only
- **Rate limiting** — max 120 events/second per socket connection
- **No data stored** — all session data is in-memory, expires after 30min
- **WebRTC** — peer-to-peer, screen stream never passes through server

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` | Socket.io server URL |
| `NEXT_PUBLIC_EYE_TRACKING` | `false` | Enable eye tracking module |
| `PORT` (server) | `3001` | Server port |
| `ALLOWED_ORIGIN` (server) | `http://localhost:3000` | CORS allowed origin |

---

## 🚢 Production Deployment

```bash
# Build frontend
npm run build && npm start

# Start server (use pm2 for process management)
pm2 start server/index.js --name remotex-server

# Nginx reverse proxy recommended for HTTPS
# WebRTC requires HTTPS in production (except localhost)
```

For production WebRTC, you may need a TURN server if STUN doesn't work through strict NATs:
- [Metered.ca](https://www.metered.ca/tools/openrelay/) offers a free TURN server

---

## 📱 Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC | ✅ | ✅ | ✅ | ✅ |
| Screen Share | ✅ | ✅ | ⚠️ | ✅ |
| Speech Recognition | ✅ | ❌ | ⚠️ | ✅ |
| MediaPipe Hands | ✅ | ✅ | ✅ | ✅ |
| Eye Tracking | ✅ | ✅ | ⚠️ | ✅ |

> **Recommended:** Chrome/Edge on desktop for all features.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14 App Router · JavaScript · TailwindCSS · Framer Motion
- **Backend:** Node.js · Express · Socket.io
- **Real-time:** WebRTC (getDisplayMedia + RTCPeerConnection)
- **AI Vision:** MediaPipe Hands (WASM, runs locally)
- **Voice:** Web Speech API (browser-native, free)
- **Eye Tracking:** WebGazer.js (CDN, opt-in)
- **QR Code:** qrcode npm package

---

*Built with ❤️ — Zero database, zero auth, zero compromise.*
