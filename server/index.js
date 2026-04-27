'use strict'

const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const sessionManager = require('./sessionManager')
const { registerRelayHandlers } = require('./eventRelay')

const PORT = process.env.PORT || 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000'

const app = express()

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// CORS — only allow frontend origin
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET'],
  credentials: false,
}))

app.use(express.json({ limit: '10kb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ...sessionManager.getStats() })
})

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'], // skip long-polling for lower latency
  maxHttpBufferSize: 1e5, // 100KB max
  pingTimeout: 20000,
  pingInterval: 10000,
})

// Rate limiter per socket (simple in-memory, per connection)
const connectionCounts = new Map()
const MAX_EVENTS_PER_SECOND = 120

io.on('connection', (socket) => {
  // Basic rate limiting
  let eventCount = 0
  const rateLimitReset = setInterval(() => { eventCount = 0 }, 1000)

  socket.use(([event, ...args], next) => {
    eventCount++
    if (eventCount > MAX_EVENTS_PER_SECOND) {
      socket.emit('error', { message: 'Rate limit exceeded' })
      return
    }
    next()
  })

  console.log(`[Server] Client connected: ${socket.id}`)

  // ─── Session Management ────────────────────────────────────────────────

  socket.on('create-session', (sessionId) => {
    try {
      // Validate UUID format
      if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9\-]{36}$/i.test(sessionId)) {
        socket.emit('error', { message: 'Invalid session ID format' })
        return
      }
      sessionManager.createSession(sessionId, socket.id)
      socket.join(sessionId)
      socket.emit('session-created', { sessionId })
      console.log(`[Server] Session created: ${sessionId}`)
    } catch (err) {
      console.error('[Server] create-session error:', err.message)
      socket.emit('error', { message: 'Failed to create session' })
    }
  })

  socket.on('join-session', (sessionId) => {
    try {
      if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9\-]{36}$/i.test(sessionId)) {
        socket.emit('error', { message: 'Invalid session ID format' })
        return
      }
      const result = sessionManager.joinSession(sessionId, socket.id)
      if (result.error === 'SESSION_NOT_FOUND') {
        socket.emit('error', { message: 'Session not found' })
        return
      }
      if (result.error === 'SESSION_FULL') {
        socket.emit('error', { message: 'Session is full — max 2 devices' })
        return
      }
      socket.join(sessionId)
      // Notify both devices
      io.to(sessionId).emit('session-ready', { sessionId })
      console.log(`[Server] Session joined: ${sessionId}`)
    } catch (err) {
      console.error('[Server] join-session error:', err.message)
      socket.emit('error', { message: 'Failed to join session' })
    }
  })

  // ─── Relay Events ──────────────────────────────────────────────────────

  registerRelayHandlers(socket, io, sessionManager)

  // ─── Disconnect ────────────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    clearInterval(rateLimitReset)
    try {
      const result = sessionManager.removeSocket(socket.id)
      if (result) {
        const { sessionId, destroyed, peer } = result
        if (destroyed) {
          // Notify remaining peer that session ended
          if (peer) {
            io.to(peer).emit('session-ended', { reason: 'controller-disconnected' })
          }
          console.log(`[Server] Session destroyed: ${sessionId} (reason: ${reason})`)
        } else {
          // Notify controller that receiver left
          if (peer) {
            io.to(peer).emit('peer-disconnected', { sessionId })
          }
          console.log(`[Server] Receiver left session: ${sessionId}`)
        }
      }
    } catch (err) {
      console.error('[Server] disconnect cleanup error:', err.message)
    }
    console.log(`[Server] Client disconnected: ${socket.id} (${reason})`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`\n🚀 RemoteX Server running on port ${PORT}`)
  console.log(`   Allowed origin: ${ALLOWED_ORIGIN}`)
  console.log(`   WebSocket only mode — ultra low latency\n`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down gracefully...')
  httpServer.close(() => process.exit(0))
})
