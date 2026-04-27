'use client'

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

// MediaPipe hand connections for skeleton drawing
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // Index
  [0, 9], [9, 10], [10, 11], [11, 12],      // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],    // Ring
  [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky
  [5, 9], [9, 13], [13, 17],                // Palm
]

const HandOverlay = forwardRef(function HandOverlay({ isPinch, cursorPos }, ref) {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)

  // Expose drawHand to parent
  useImperativeHandle(ref, () => ({
    drawHand(landmarks, screenCursorX, screenCursorY, pinch) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      if (!landmarks || landmarks.length === 0) return

      // Draw skeleton connections
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'

      for (const [a, b] of HAND_CONNECTIONS) {
        const pA = landmarks[a]
        const pB = landmarks[b]
        if (!pA || !pB) continue
        ctx.beginPath()
        ctx.moveTo(pA.x * W, pA.y * H)
        ctx.lineTo(pB.x * W, pB.y * H)
        ctx.stroke()
      }

      // Draw landmark dots
      landmarks.forEach((lm, i) => {
        const isTip = [4, 8, 12, 16, 20].includes(i)
        ctx.beginPath()
        ctx.arc(lm.x * W, lm.y * H, isTip ? 5 : 3, 0, Math.PI * 2)
        ctx.fillStyle = isTip ? '#A5B4FC' : 'rgba(99,102,241,0.6)'
        ctx.fill()
      })

      // Draw index finger tip highlight
      const indexTip = landmarks[8]
      if (indexTip) {
        ctx.beginPath()
        ctx.arc(indexTip.x * W, indexTip.y * H, 8, 0, Math.PI * 2)
        ctx.strokeStyle = '#22D3EE'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Draw cursor ring at mapped screen position
      if (screenCursorX !== undefined && screenCursorY !== undefined) {
        const radius = pinch ? 10 : 16
        const color = pinch ? '#EF4444' : '#6366F1'

        ctx.beginPath()
        ctx.arc(screenCursorX, screenCursorY, radius, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()

        // Glow
        ctx.beginPath()
        ctx.arc(screenCursorX, screenCursorY, radius, 0, Math.PI * 2)
        ctx.strokeStyle = color.replace(')', ', 0.3)').replace('rgb', 'rgba')
        ctx.lineWidth = 6
        ctx.stroke()

        // Center dot
        ctx.beginPath()
        ctx.arc(screenCursorX, screenCursorY, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    },
    clear() {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    },
  }))

  // Resize canvas to match viewport
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    />
  )
})

export default HandOverlay
