import { Server } from 'socket.io'

// In-memory session store (persists within Lambda container lifetime)
const sessions = new Map()
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// Whitelist of allowed relay events
const RELAY_EVENTS = [
  'cursor-move', 'click', 'scroll', 'keypress', 'drag',
  'voice-command', 'webrtc-offer', 'webrtc-answer', 'webrtc-ice',
  'ping', 'pong',
]

function validateSessionId(id) {
  return typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)
}

function validatePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  if (!validateSessionId(data.sessionId)) return false
  if (JSON.stringify(data).length > 8192) return false
  return true
}

function scheduleExpiry(sessionId, io) {
  setTimeout(() => {
    const session = sessions.get(sessionId)
    if (!session) return
    const idle = Date.now() - session.lastActivity
    if (idle >= SESSION_TIMEOUT_MS) {
      // Notify connected peers
      io.to(sessionId).emit('session-ended', { reason: 'timeout' })
      sessions.delete(sessionId)
      console.log(`[Socket] Session expired: ${sessionId}`)
    }
  }, SESSION_TIMEOUT_MS + 5000)
}

export default function handler(req, res) {
  // Only initialize once per Lambda container
  if (res.socket.server.io) {
    res.end()
    return
  }

  console.log('[Socket] Initializing Socket.io server...')

  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    transports: ['websocket', 'polling'],
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e5,
    pingTimeout: 20000,
    pingInterval: 10000,
  })

  res.socket.server.io = io

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`)

    // Rate limiting
    let eventCount = 0
    const resetInterval = setInterval(() => { eventCount = 0 }, 1000)

    socket.use(([event, ...args], next) => {
      eventCount++
      if (eventCount > 120) {
        socket.emit('error', { message: 'Rate limit exceeded' })
        return
      }
      next()
    })

    // ── Session Management ─────────────────────────────
    socket.on('create-session', (sessionId) => {
      if (!validateSessionId(sessionId)) {
        socket.emit('error', { message: 'Invalid session ID' })
        return
      }
      sessions.set(sessionId, {
        id: sessionId,
        controller: socket.id,
        receiver: null,
        lastActivity: Date.now(),
      })
      socket.join(sessionId)
      socket.emit('session-created', { sessionId })
      scheduleExpiry(sessionId, io)
      console.log(`[Socket] Session created: ${sessionId}`)
    })

    socket.on('join-session', (sessionId) => {
      if (!validateSessionId(sessionId)) {
        socket.emit('error', { message: 'Invalid session ID' })
        return
      }
      const session = sessions.get(sessionId)
      if (!session) {
        socket.emit('error', { message: 'Session not found' })
        return
      }
      if (session.receiver) {
        socket.emit('error', { message: 'Session is full — max 2 devices' })
        return
      }
      session.receiver = socket.id
      session.lastActivity = Date.now()
      socket.join(sessionId)
      io.to(sessionId).emit('session-ready', { sessionId })
      console.log(`[Socket] Session joined: ${sessionId}`)
    })

    // ── Event Relay ────────────────────────────────────
    for (const eventName of RELAY_EVENTS) {
      socket.on(eventName, (data) => {
        if (!validatePayload(data)) return
        sessions.get(data.sessionId)?.lastActivity && (sessions.get(data.sessionId).lastActivity = Date.now())
        socket.to(data.sessionId).emit(eventName, data)
      })
    }

    // ── Disconnect ─────────────────────────────────────
    socket.on('disconnect', (reason) => {
      clearInterval(resetInterval)

      for (const [sessionId, session] of sessions) {
        if (session.controller === socket.id) {
          io.to(sessionId).emit('session-ended', { reason: 'controller-disconnected' })
          sessions.delete(sessionId)
          console.log(`[Socket] Session destroyed: ${sessionId}`)
          break
        }
        if (session.receiver === socket.id) {
          session.receiver = null
          io.to(sessionId).emit('peer-disconnected', { sessionId })
          break
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`)
    })
  })

  res.end()
}

export const config = {
  api: { bodyParser: false },
}
