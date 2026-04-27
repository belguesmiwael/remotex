'use strict'

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const { io } = require('socket.io-client')
const input = require('./input')
const log = require('electron-log')
const path = require('path')

// ── Config ──────────────────────────────────────────────────
const SOCKET_URL = process.env.REMOTEX_SERVER || 'https://remotex-signaling.onrender.com'

let mainWindow = null
let tray = null
let socket = null
let sessionId = null

// ── Window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    resizable: false,
    title: 'RemoteX Receiver',
    backgroundColor: '#080B14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'ui.html'))
  mainWindow.setMenuBarVisibility(false)
}

// ── Socket connection ─────────────────────────────────────────
function connectSocket() {
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 20,
    reconnectionDelay: 1500,
  })

  socket.on('connect', () => {
    log.info('[Socket] Connected:', socket.id)
    mainWindow?.webContents.send('status', { connected: true, socketId: socket.id })
  })

  socket.on('disconnect', (reason) => {
    log.info('[Socket] Disconnected:', reason)
    mainWindow?.webContents.send('status', { connected: false })
    mainWindow?.webContents.send('session-status', { joined: false })
  })

  socket.on('session-ready', (data) => {
    log.info('[Socket] Session ready:', data.sessionId)
    mainWindow?.webContents.send('session-status', { joined: true, sessionId: data.sessionId })
  })

  socket.on('session-ended', () => {
    log.info('[Socket] Session ended')
    sessionId = null
    mainWindow?.webContents.send('session-status', { joined: false })
  })

  socket.on('peer-disconnected', () => {
    mainWindow?.webContents.send('session-status', { joined: false, peerLeft: true })
  })

  socket.on('error', (data) => {
    log.error('[Socket] Error:', data)
    mainWindow?.webContents.send('error', data)
  })

  // ── Remote control events → OS input ─────────────────────

  // Get screen size for coordinate mapping
  const getScreenSize = () => screen.getPrimaryDisplay().bounds

  socket.on('cursor-move', async (data) => {
    if (data.sessionId !== sessionId) return
    const { width, height } = getScreenSize()
    await input.moveMouse(data.x * width, data.y * height)
  })

  socket.on('click', async (data) => {
    if (data.sessionId !== sessionId) return
    const { width, height } = getScreenSize()
    // Move to position first
    await input.moveMouse(data.x * width, data.y * height)
    const btn = data.button === 2 ? 'right' : data.button === 1 ? 'middle' : 'left'
    const type = data.clickType === 'dblclick' ? 'double' : 'single'
    if (data.clickType === 'click' || data.clickType === 'dblclick') {
      await input.click(btn, type)
    }
  })

  socket.on('scroll', async (data) => {
    if (data.sessionId !== sessionId) return
    await input.scroll(data.deltaX || 0, data.deltaY || 0)
  })

  socket.on('keypress', async (data) => {
    if (data.sessionId !== sessionId) return
    if (data.keyType === 'keydown') {
      await input.pressKey(data.key, data.ctrlKey, data.shiftKey, data.altKey)
    }
  })

  socket.on('voice-command', (data) => {
    if (data.sessionId !== sessionId) return
    log.info('[Voice] Command received:', data.command)
    mainWindow?.webContents.send('voice-command', data)
    // Execute common voice commands at OS level
    executeVoiceCommand(data.command)
  })

  socket.on('drag', async (data) => {
    if (data.sessionId !== sessionId) return
    const { width, height } = getScreenSize()
    await input.drag(data.from.x * width, data.from.y * height, data.to.x * width, data.to.y * height)
  })

  // Ping/Pong for latency
  socket.on('ping', (data) => {
    if (data.sessionId !== sessionId) return
    socket.emit('pong', data)
  })
}

async function executeVoiceCommand(command) {
  const { Key } = require('@nut-tree-fork/nut-js')
  try {
    if (command.includes('scroll down')) await input.scroll(0, 300)
    else if (command.includes('scroll up')) await input.scroll(0, -300)
    else if (command.includes('press enter')) await input.pressKey('Enter', false, false, false)
    else if (command.includes('press escape')) await input.pressKey('Escape', false, false, false)
    else if (command.includes('go back')) await input.pressKey('ArrowLeft', false, false, true)
    else if (command.includes('refresh')) await input.pressKey('F5', false, false, false)
    else if (command.startsWith('type ')) await input.typeText(command.slice(5))
  } catch {}
}

// ── IPC from renderer ─────────────────────────────────────────
ipcMain.on('join-session', (event, id) => {
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return
  sessionId = id
  socket?.emit('join-session', id)
  log.info('[IPC] Joining session:', id)
})

ipcMain.on('leave-session', () => {
  sessionId = null
  mainWindow?.webContents.send('session-status', { joined: false })
})

ipcMain.on('get-screen-size', (event) => {
  event.returnValue = screen.getPrimaryDisplay().bounds
})

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  connectSocket()

  // System tray
  try {
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    )
    tray = new Tray(icon)
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'RemoteX Receiver', enabled: false },
      { type: 'separator' },
      { label: 'Show Window', click: () => mainWindow?.show() },
      { label: 'Quit', click: () => app.quit() },
    ]))
    tray.setToolTip('RemoteX Receiver — waiting for controller')
  } catch {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  socket?.disconnect()
})
