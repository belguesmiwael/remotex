'use client'

import { VOICE } from '@/lib/constants'

// Extensible command registry
// Key: command phrase or regex string | Value: action function factory
const COMMAND_REGISTRY = [
  {
    patterns: ['click', 'tap', 'press'],
    action: (ctx) => () => ctx.triggerClick?.(),
    label: 'click',
  },
  {
    patterns: ['double click', 'double tap'],
    action: (ctx) => () => ctx.triggerDoubleClick?.(),
    label: 'double click',
  },
  {
    patterns: ['scroll down', 'scroll d', 'move down'],
    action: (ctx) => () => ctx.scroll?.(0, 300),
    label: 'scroll down',
  },
  {
    patterns: ['scroll up', 'move up'],
    action: (ctx) => () => ctx.scroll?.(0, -300),
    label: 'scroll up',
  },
  {
    patterns: ['scroll left', 'move left'],
    action: (ctx) => () => ctx.scroll?.(-300, 0),
    label: 'scroll left',
  },
  {
    patterns: ['scroll right', 'move right'],
    action: (ctx) => () => ctx.scroll?.(300, 0),
    label: 'scroll right',
  },
  {
    patterns: ['go back', 'back'],
    action: () => () => window.history.back(),
    label: 'go back',
  },
  {
    patterns: ['go forward', 'forward'],
    action: () => () => window.history.forward(),
    label: 'go forward',
  },
  {
    patterns: ['refresh', 'reload'],
    action: () => () => window.location.reload(),
    label: 'refresh',
  },
  {
    patterns: ['press enter', 'enter', 'confirm'],
    action: (ctx) => () => ctx.pressKey?.('Enter'),
    label: 'press enter',
  },
  {
    patterns: ['press escape', 'escape', 'cancel'],
    action: (ctx) => () => ctx.pressKey?.('Escape'),
    label: 'press escape',
  },
  {
    patterns: ['press tab', 'tab'],
    action: (ctx) => () => ctx.pressKey?.('Tab'),
    label: 'press tab',
  },
  {
    patterns: ['scroll to top', 'go to top'],
    action: () => () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    label: 'scroll to top',
  },
  {
    patterns: ['scroll to bottom', 'go to bottom'],
    action: () => () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
    label: 'scroll to bottom',
  },
  {
    // type [text] — regex with capture group
    patterns: [/^type (.+)$/i, /^write (.+)$/i],
    action: (ctx) => (match) => ctx.typeText?.(match),
    label: 'type text',
    isRegex: true,
  },
  {
    // open [app/url]
    patterns: [/^open (.+)$/i, /^navigate to (.+)$/i],
    action: () => (match) => {
      // Safety: only allow relative paths or validate URLs
      if (match.startsWith('http://') || match.startsWith('https://')) {
        window.open(match, '_blank', 'noopener,noreferrer')
      }
    },
    label: 'open',
    isRegex: true,
  },
]

/**
 * Parse a voice transcript and find the best matching command
 * @param {string} transcript - recognized speech
 * @param {object} ctx - action context (methods to call)
 * @param {number} confidence - recognition confidence (0–1)
 * @returns {{ matched: boolean, label: string, action: function|null }}
 */
export function parseCommand(transcript, ctx = {}, confidence = 1) {
  if (confidence < VOICE.CONFIDENCE_THRESHOLD) {
    return { matched: false, label: '', action: null }
  }

  const normalized = transcript.toLowerCase().trim()

  for (const command of COMMAND_REGISTRY) {
    for (const pattern of command.patterns) {
      if (typeof pattern === 'string') {
        if (normalized === pattern || normalized.includes(pattern)) {
          return {
            matched: true,
            label: command.label,
            action: command.action(ctx),
          }
        }
      } else if (pattern instanceof RegExp) {
        const match = normalized.match(pattern)
        if (match) {
          const captured = match[1] || ''
          return {
            matched: true,
            label: `${command.label}: "${captured}"`,
            action: () => command.action(ctx)(captured),
          }
        }
      }
    }
  }

  return { matched: false, label: normalized, action: null }
}

/**
 * Default action context — delegates to DOM APIs
 */
export function createDefaultContext(lastCursorPos = { x: 0, y: 0 }) {
  return {
    triggerClick: () => {
      const el = document.elementFromPoint(lastCursorPos.x, lastCursorPos.y)
      el?.click()
    },
    triggerDoubleClick: () => {
      const el = document.elementFromPoint(lastCursorPos.x, lastCursorPos.y)
      el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    },
    scroll: (x, y) => {
      window.scrollBy({ left: x, top: y, behavior: 'smooth' })
    },
    pressKey: (key) => {
      const target = document.activeElement || document.body
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
    },
    typeText: (text) => {
      // Sanitize: only printable chars
      const safe = String(text).replace(/[<>]/g, '')
      const target = document.activeElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const start = target.selectionStart || 0
        const end = target.selectionEnd || 0
        target.value = target.value.slice(0, start) + safe + target.value.slice(end)
        target.selectionStart = target.selectionEnd = start + safe.length
        target.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        document.execCommand('insertText', false, safe)
      }
    },
  }
}
