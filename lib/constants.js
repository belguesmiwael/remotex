// Remote control event names (sent over PeerJS DataConnection)
export const EVENTS = {
  SESSION_READY: 'session-ready',
  SESSION_ENDED: 'session-ended',
  PEER_DISCONNECTED: 'peer-disconnected',
  CURSOR_MOVE: 'cursor-move',
  CLICK: 'click',
  SCROLL: 'scroll',
  KEYPRESS: 'keypress',
  DRAG: 'drag',
  VOICE_COMMAND: 'voice-command',
  PING: 'ping',
  PONG: 'pong',
}

export const MODES = {
  MOUSE: 'mouse',
  VOICE: 'voice',
  GESTURE: 'gesture',
}

export const GESTURE = {
  PINCH_THRESHOLD: 40,
  PINCH_HOLD_MS: 500,
  SMOOTHING: 0.25,
  DEAD_ZONE: 2,
}

export const VOICE = {
  CONFIDENCE_THRESHOLD: 0.65,
  LANG_DEFAULT: 'en-US',
}
