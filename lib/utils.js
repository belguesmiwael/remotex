import { v4 as uuidv4 } from 'uuid'

/**
 * Generate a new UUID v4 session ID
 */
export function generateSessionId() {
  return uuidv4()
}

/**
 * Format session URL for sharing
 */
export function getSessionUrl(sessionId, role = 'receiver') {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/session/${sessionId}/${role}`
}

/**
 * Get controller URL
 */
export function getControllerUrl(sessionId) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/session/${sessionId}/controller`
}

/**
 * Linear interpolation for smooth cursor movement
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate distance between two 2D points
 */
export function distance2D(p1, p2) {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Format timestamp as HH:MM:SS
 */
export function formatTime(date = new Date()) {
  return date.toTimeString().slice(0, 8)
}

/**
 * Truncate session ID for display
 */
export function shortId(sessionId) {
  if (!sessionId) return ''
  return sessionId.slice(0, 8).toUpperCase()
}

/**
 * Debounce function
 */
export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/**
 * Throttle with requestAnimationFrame
 */
export function rafThrottle(fn) {
  let rafId = null
  return (...args) => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      fn(...args)
      rafId = null
    })
  }
}

/**
 * Check if browser supports a feature
 */
export function supports(feature) {
  switch (feature) {
    case 'webrtc':
      return !!(window.RTCPeerConnection || window.webkitRTCPeerConnection)
    case 'screenshare':
      return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
    case 'speech':
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    case 'camera':
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    default:
      return false
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}
