'use strict'

// Allowed relay event names — whitelist to prevent prototype pollution
const RELAY_EVENTS = new Set([
  'cursor-move',
  'click',
  'scroll',
  'keypress',
  'drag',
  'voice-command',
  'webrtc-offer',
  'webrtc-answer',
  'webrtc-ice',
  'ping',
  'pong',
])

// Max payload size per event (bytes when serialized)
const MAX_PAYLOAD_SIZE = 4096

/**
 * Validate event data before relaying
 */
function validatePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const serialized = JSON.stringify(data)
  if (!serialized || serialized.length > MAX_PAYLOAD_SIZE) return false
  // sessionId must be a safe UUID
  if (!data.sessionId || typeof data.sessionId !== 'string') return false
  if (!/^[a-f0-9\-]{36}$/i.test(data.sessionId)) return false
  return true
}

/**
 * Register all relay event handlers on a socket
 * @param {Socket} socket - connected socket
 * @param {object} io - Socket.io server instance
 * @param {object} sessionManager - session manager
 */
function registerRelayHandlers(socket, io, sessionManager) {
  for (const eventName of RELAY_EVENTS) {
    socket.on(eventName, (data) => {
      try {
        if (!validatePayload(data)) {
          socket.emit('relay-error', { message: 'Invalid payload', event: eventName })
          return
        }
        // Touch session activity
        sessionManager.touch(data.sessionId)
        // Relay to the room (the other device)
        socket.to(data.sessionId).emit(eventName, data)
      } catch (err) {
        console.error(`[EventRelay] Error relaying ${eventName}:`, err.message)
      }
    })
  }
}

module.exports = { registerRelayHandlers, RELAY_EVENTS }
