'use strict'

const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const sessionManager = require('./sessionManager')
const { registerRelayHandlers } = require('./eventRelay')

const PORT = process.env.PORT || 3001

// Accept any origin in production (Vercel frontend URL varies)
// In prod, set ALLOWED_ORIGIN env var on Render to your Vercel URL
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN, 'http://localhost:3000']
  : ['*']

const app = express()

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: false }))
app.use(express.json({ limit: '10kb' }))

// Health check — Render pings this to keep alive
app.get('/', (req, res) => res.json({ status: 'ok', service: 'RemoteX Signaling', ...sessionManager.getStats() }))
app.get('/health', (req, res) => res.json({ status: 'ok', ...sessionManager.getStats() }))

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e5,
  pingTimeout: 20000,
  pingInterval: 10000,
})

io.on('connection', (socket) => {
  let eventCount = 0
  const rateLimitReset = setInterval(() => { eventCount = 0 }, 1000)

  socket.use(([event], next) => {
    eventCount++
    if (eventCount > 120) { socket.emit('error', { message: 'Rate limit' }); return }
    next()
  })

  socket.on('create-session', (sessionId) => {
    if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      socket.emit('error', { message: 'Invalid session ID' }); return
    }
    try {
      sessionManager.createSession(sessionId, socket.id)
      socket.join(sessionId)
      socket.emit('session-created', { sessionId })
    } catch { socket.emit('error', { message: 'Could not create session' }) }
  })

  socket.on('join-session', (sessionId) => {
    if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      socket.emit('error', { message: 'Invalid session ID' }); return
    }
    const result = sessionManager.joinSession(sessionId, socket.id)
    if (result.error === 'SESSION_NOT_FOUND') { socket.emit('error', { message: 'Session not found — make sure controller is open' }); return }
    if (result.error === 'SESSION_FULL') { socket.emit('error', { message: 'Session full' }); return }
    socket.join(sessionId)
    io.to(sessionId).emit('session-ready', { sessionId })
  })

  registerRelayHandlers(socket, io, sessionManager)

  socket.on('disconnect', (reason) => {
    clearInterval(rateLimitReset)
    const result = sessionManager.removeSocket(socket.id)
    if (result?.destroyed && result.peer) io.to(result.peer).emit('session-ended', { reason: 'controller-disconnected' })
    else if (!result?.destroyed && result?.peer) io.to(result.peer).emit('peer-disconnected', { sessionId: result.sessionId })
  })
})

httpServer.listen(PORT, () => {
  console.log(`\n🚀 RemoteX Signaling Server on port ${PORT}\n`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
