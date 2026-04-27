'use client'

import { useEffect, useRef, useCallback } from 'react'
import { EVENTS } from '@/lib/constants'

/**
 * EventRelay — receives remote control events and simulates them on the receiver device
 */
export default function EventRelay({ socket, sessionId, active, onCursorMove, onCommand }) {
  const ghostRef = useRef({ x: 0, y: 0 })

  const simulateClick = useCallback((x, y, type = 'click') => {
    const screenX = x * window.innerWidth
    const screenY = y * window.innerHeight
    const el = document.elementFromPoint(screenX, screenY)
    if (!el) return

    if (type === 'click') {
      el.click()
    } else if (type === 'dblclick') {
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    }

    onCommand?.({ type: 'mouse', action: `${type} at (${Math.round(screenX)}, ${Math.round(screenY)})` })
  }, [onCommand])

  const simulateKey = useCallback((data) => {
    const target = document.activeElement || document.body
    try {
      target.dispatchEvent(new KeyboardEvent(data.type || 'keydown', {
        key: data.key,
        code: data.code,
        ctrlKey: data.ctrlKey,
        shiftKey: data.shiftKey,
        altKey: data.altKey,
        metaKey: data.metaKey,
        bubbles: true,
        cancelable: true,
      }))
      if (data.type === 'keydown') {
        onCommand?.({ type: 'keyboard', action: `key: ${data.key}` })
      }
    } catch (err) {
      console.warn('[EventRelay] Key dispatch failed:', err.message)
    }
  }, [onCommand])

  useEffect(() => {
    if (!active || !socket) return

    const onCursorMoveEvent = (data) => {
      if (data.sessionId !== sessionId) return
      const x = Math.max(0, Math.min(1, data.x))
      const y = Math.max(0, Math.min(1, data.y))
      ghostRef.current = { x, y }
      onCursorMove?.({ x: x * window.innerWidth, y: y * window.innerHeight })
    }

    const onClickEvent = (data) => {
      if (data.sessionId !== sessionId) return
      if (data.type === 'click' || data.type === 'up') {
        simulateClick(data.x, data.y, data.type === 'click' ? 'click' : 'click')
      } else if (data.type === 'dblclick') {
        simulateClick(data.x, data.y, 'dblclick')
      }
    }

    const onScrollEvent = (data) => {
      if (data.sessionId !== sessionId) return
      window.scrollBy({
        left: data.deltaX || 0,
        top: data.deltaY || 0,
        behavior: 'auto',
      })
      onCommand?.({ type: 'mouse', action: `scroll (${data.deltaX}, ${data.deltaY})` })
    }

    const onKeypressEvent = (data) => {
      if (data.sessionId !== sessionId) return
      simulateKey(data)
    }

    const onVoiceCommand = (data) => {
      if (data.sessionId !== sessionId) return
      onCommand?.({ type: 'voice', action: data.command })
    }

    const onDragEvent = (data) => {
      if (data.sessionId !== sessionId) return
      // Simulate drag via synthetic mouse events
      const fromX = data.from.x * window.innerWidth
      const fromY = data.from.y * window.innerHeight
      const toX = data.to.x * window.innerWidth
      const toY = data.to.y * window.innerHeight
      const el = document.elementFromPoint(fromX, fromY)
      if (!el) return

      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: fromX, clientY: fromY }))
      setTimeout(() => {
        el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: toX, clientY: toY }))
        document.elementFromPoint(toX, toY)?.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, clientX: toX, clientY: toY })
        )
      }, 50)

      onCommand?.({ type: 'mouse', action: 'drag' })
    }

    socket.on(EVENTS.CURSOR_MOVE, onCursorMoveEvent)
    socket.on(EVENTS.CLICK, onClickEvent)
    socket.on(EVENTS.SCROLL, onScrollEvent)
    socket.on(EVENTS.KEYPRESS, onKeypressEvent)
    socket.on(EVENTS.VOICE_COMMAND, onVoiceCommand)
    socket.on(EVENTS.DRAG, onDragEvent)

    return () => {
      socket.off(EVENTS.CURSOR_MOVE, onCursorMoveEvent)
      socket.off(EVENTS.CLICK, onClickEvent)
      socket.off(EVENTS.SCROLL, onScrollEvent)
      socket.off(EVENTS.KEYPRESS, onKeypressEvent)
      socket.off(EVENTS.VOICE_COMMAND, onVoiceCommand)
      socket.off(EVENTS.DRAG, onDragEvent)
    }
  }, [active, socket, sessionId, simulateClick, simulateKey, onCursorMove, onCommand])

  return null
}
