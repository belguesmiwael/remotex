'use client'

import { useEffect, useRef, useCallback } from 'react'
import { EVENTS } from '@/lib/constants'
import { rafThrottle } from '@/lib/utils'

/**
 * MouseController — captures mouse/keyboard events from controller device
 * and emits them to socket with normalized coordinates (0–1 ratio)
 */
export default function MouseController({ socket, sessionId, active }) {
  const lastPos = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef(null)

  const emit = useCallback((event, data) => {
    if (!socket || !sessionId || !active) return
    socket.emit(event, { sessionId, ...data })
  }, [socket, sessionId, active])

  // Normalize screen coordinates to 0–1 ratio
  const normalize = (clientX, clientY) => ({
    x: clientX / window.innerWidth,
    y: clientY / window.innerHeight,
  })

  useEffect(() => {
    if (!active || !socket) return

    // Throttled cursor move
    const handleMouseMove = rafThrottle((e) => {
      const pos = normalize(e.clientX, e.clientY)
      lastPos.current = pos
      emit(EVENTS.CURSOR_MOVE, { x: pos.x, y: pos.y })
    })

    const handleMouseDown = (e) => {
      const pos = normalize(e.clientX, e.clientY)
      dragging.current = true
      dragStart.current = pos
      emit(EVENTS.CLICK, { button: e.button, x: pos.x, y: pos.y, type: 'down' })
    }

    const handleMouseUp = (e) => {
      const pos = normalize(e.clientX, e.clientY)
      if (dragging.current && dragStart.current) {
        const dx = Math.abs(pos.x - dragStart.current.x)
        const dy = Math.abs(pos.y - dragStart.current.y)
        if (dx > 0.01 || dy > 0.01) {
          // It was a drag, not just a click
          emit(EVENTS.DRAG, {
            from: dragStart.current,
            to: pos,
          })
        }
      }
      dragging.current = false
      dragStart.current = null
      emit(EVENTS.CLICK, { button: e.button, x: pos.x, y: pos.y, type: 'up' })
    }

    const handleClick = (e) => {
      const pos = normalize(e.clientX, e.clientY)
      emit(EVENTS.CLICK, { button: e.button, x: pos.x, y: pos.y, type: 'click' })
    }

    const handleDblClick = (e) => {
      const pos = normalize(e.clientX, e.clientY)
      emit(EVENTS.CLICK, { button: e.button, x: pos.x, y: pos.y, type: 'dblclick' })
    }

    const handleWheel = (e) => {
      e.preventDefault()
      emit(EVENTS.SCROLL, {
        deltaX: Math.round(e.deltaX),
        deltaY: Math.round(e.deltaY),
        x: lastPos.current.x,
        y: lastPos.current.y,
      })
    }

    const handleKeyDown = (e) => {
      // Don't capture browser shortcuts (Ctrl+T, Ctrl+W etc.)
      if (e.ctrlKey && ['t', 'w', 'r', 'n', 'l', 'f'].includes(e.key.toLowerCase())) return
      if (e.altKey && e.key === 'F4') return

      emit(EVENTS.KEYPRESS, {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        type: 'keydown',
      })
    }

    const handleKeyUp = (e) => {
      emit(EVENTS.KEYPRESS, {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        type: 'keyup',
      })
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('click', handleClick)
    document.addEventListener('dblclick', handleDblClick)
    document.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('dblclick', handleDblClick)
      document.removeEventListener('wheel', handleWheel)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [active, socket, emit])

  return null // Headless component
}
