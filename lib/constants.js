// Socket event names
export const EVENTS = {
  CREATE_SESSION: 'create-session',
  JOIN_SESSION: 'join-session',
  SESSION_CREATED: 'session-created',
  SESSION_READY: 'session-ready',
  SESSION_ENDED: 'session-ended',
  PEER_DISCONNECTED: 'peer-disconnected',
  ERROR: 'error',

  // Remote control
  CURSOR_MOVE: 'cursor-move',
  CLICK: 'click',
  SCROLL: 'scroll',
  KEYPRESS: 'keypress',
  DRAG: 'drag',
  VOICE_COMMAND: 'voice-command',

  // WebRTC signaling
  WEBRTC_OFFER: 'webrtc-offer',
  WEBRTC_ANSWER: 'webrtc-answer',
  WEBRTC_ICE: 'webrtc-ice',

  // Latency
  PING: 'ping',
  PONG: 'pong',
}

// Control modes
export const MODES = {
  MOUSE: 'mouse',
  VOICE: 'voice',
  GESTURE: 'gesture',
}

// WebRTC configuration
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

// MediaPipe landmark indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
}

// Gesture thresholds
export const GESTURE = {
  PINCH_THRESHOLD: 40,      // pixels
  PINCH_HOLD_MS: 500,       // ms to hold for drag
  SMOOTHING: 0.25,          // lerp factor (0=sluggish, 1=instant)
  DEAD_ZONE: 2,             // min movement in px before emitting
}

// Voice
export const VOICE = {
  CONFIDENCE_THRESHOLD: 0.65,
  LANG_DEFAULT: 'en-US',
}

// Session
export const SESSION = {
  TIMEOUT_MS: 30 * 60 * 1000,
}

// Cursor throttle
export const CURSOR_THROTTLE_MS = 16 // ~60fps
