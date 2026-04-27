'use client'

import { io } from 'socket.io-client'

let socket = null
let initialized = false

export async function getSocket() {
  if (socket?.connected) return socket

  // Wake up the Socket.io server (Next.js API route)
  if (!initialized) {
    initialized = true
    try {
      await fetch('/api/socket')
    } catch (err) {
      console.error('[Socket] Server init failed:', err.message)
    }
  }

  if (!socket) {
    socket = io({
      path: '/api/socket',
      addTrailingSlash: false,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 15000,
    })

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
    })
  }

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
    initialized = false
  }
}
