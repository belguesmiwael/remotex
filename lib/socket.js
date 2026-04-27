'use client'

import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    socket = io(url, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
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
  }
}
