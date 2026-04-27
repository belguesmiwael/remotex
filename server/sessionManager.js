'use strict'

// In-memory session store — no database needed
const sessions = new Map()
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Create a new session
 * @param {string} sessionId - UUID v4
 * @param {string} controllerSocketId - socket.id of the controller
 */
function createSession(sessionId, controllerSocketId) {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    throw new Error('Invalid sessionId')
  }
  const session = {
    id: sessionId,
    controller: controllerSocketId,
    receiver: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  }
  sessions.set(sessionId, session)
  scheduleExpiry(sessionId)
  return session
}

/**
 * Join an existing session as receiver
 * @param {string} sessionId
 * @param {string} receiverSocketId
 */
function joinSession(sessionId, receiverSocketId) {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    throw new Error('Invalid sessionId')
  }
  const session = sessions.get(sessionId)
  if (!session) return { error: 'SESSION_NOT_FOUND' }
  if (session.receiver) return { error: 'SESSION_FULL' }
  session.receiver = receiverSocketId
  session.lastActivity = Date.now()
  return { session }
}

/**
 * Get session by sessionId
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null
}

/**
 * Get session by socket ID (controller or receiver)
 */
function getSessionBySocket(socketId) {
  for (const [, session] of sessions) {
    if (session.controller === socketId || session.receiver === socketId) {
      return session
    }
  }
  return null
}

/**
 * Update last activity timestamp
 */
function touch(sessionId) {
  const session = sessions.get(sessionId)
  if (session) session.lastActivity = Date.now()
}

/**
 * Remove a socket from its session (on disconnect)
 * Returns sessionId if session should be destroyed
 */
function removeSocket(socketId) {
  const session = getSessionBySocket(socketId)
  if (!session) return null

  if (session.controller === socketId) {
    // Controller left — destroy session
    sessions.delete(session.id)
    return { sessionId: session.id, destroyed: true, peer: session.receiver }
  } else {
    // Receiver left — controller stays
    session.receiver = null
    session.lastActivity = Date.now()
    return { sessionId: session.id, destroyed: false, peer: session.controller }
  }
}

/**
 * Schedule automatic session expiry after 30min inactivity
 */
function scheduleExpiry(sessionId) {
  setTimeout(() => {
    const session = sessions.get(sessionId)
    if (!session) return
    const idle = Date.now() - session.lastActivity
    if (idle >= SESSION_TIMEOUT_MS) {
      sessions.delete(sessionId)
      console.log(`[SessionManager] Session ${sessionId} expired (idle ${Math.round(idle/1000)}s)`)
    }
  }, SESSION_TIMEOUT_MS + 5000)
}

/**
 * Return count of active sessions (for monitoring)
 */
function getStats() {
  return { activeSessions: sessions.size }
}

module.exports = {
  createSession,
  joinSession,
  getSession,
  getSessionBySocket,
  removeSocket,
  touch,
  getStats,
}
