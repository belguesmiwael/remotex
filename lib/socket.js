'use client'

import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (socket?.connected) return socket
  if (socket) return socket  // Return even if reconnecting

  const url = process.env.NEXT_PUBLIC_SOCKET_URL
  if (!url) {
    console.error('[Socket] NEXT_PUBLIC_SOCKET_URL is not set!')
    return null
  }

  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  })

  socket.on('connect', () => console.log('[Socket] Connected:', socket.id))
  socket.on('disconnect', (r) => console.log('[Socket] Disconnected:', r))
  socket.on('connect_error', (e) => console.error('[Socket] Error:', e.message))

  return socket
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}
