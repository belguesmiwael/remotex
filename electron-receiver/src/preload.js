'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('remotex', {
  joinSession: (sessionId) => ipcRenderer.send('join-session', sessionId),
  leaveSession: () => ipcRenderer.send('leave-session'),
  getScreenSize: () => ipcRenderer.sendSync('get-screen-size'),

  onStatus: (cb) => ipcRenderer.on('status', (_, data) => cb(data)),
  onSessionStatus: (cb) => ipcRenderer.on('session-status', (_, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('error', (_, data) => cb(data)),
  onVoiceCommand: (cb) => ipcRenderer.on('voice-command', (_, data) => cb(data)),
})
