'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { EVENTS, GESTURE } from '@/lib/constants'
import { GestureMapper, detectPinch, detectFist, detectTwoFingerSwipe } from './GestureMapper'

/**
 * GestureEngine — MediaPipe Hands integration
 * Runs hand detection on webcam frames and emits cursor/gesture events
 */
export default function GestureEngine({
  socket,
  sessionId,
  active,
  overlayRef,
  onCommand,
  onCursorMove,
}) {
  const videoRef = useRef(null)
  const handsRef = useRef(null)
  const cameraRef = useRef(null)
  const mapperRef = useRef(new GestureMapper())
  const pinchStartRef = useRef(null)  // timestamp when pinch started
  const prevLandmarksRef = useRef(null)
  const [status, setStatus] = useState('idle')  // idle | loading | active | error
  const [isPinch, setIsPinch] = useState(false)

  const handleResults = useCallback((results) => {
    const landmarks = results.multiHandLandmarks?.[0]

    // Clear overlay if no hand detected
    if (!landmarks || landmarks.length === 0) {
      overlayRef?.current?.clear()
      prevLandmarksRef.current = null
      return
    }

    // Check fist → pause gesture mode
    if (detectFist(landmarks)) {
      overlayRef?.current?.clear()
      onCommand?.({ type: 'gesture', action: 'fist — paused' })
      return
    }

    // Index finger tip → cursor position
    const indexTip = landmarks[8]
    const mapped = mapperRef.current.map(1 - indexTip.x, indexTip.y)  // mirror X

    // Pinch detection
    const { isPinch: pinchNow } = detectPinch(landmarks)
    setIsPinch(pinchNow)

    if (pinchNow && !pinchStartRef.current) {
      pinchStartRef.current = Date.now()
    }

    if (!pinchNow && pinchStartRef.current) {
      const heldMs = Date.now() - pinchStartRef.current
      pinchStartRef.current = null

      if (heldMs < GESTURE.PINCH_HOLD_MS) {
        // Short pinch → click
        socket?.emit(EVENTS.CLICK, {
          sessionId,
          button: 0,
          x: mapped.normX,
          y: mapped.normY,
          type: 'click',
        })
        onCommand?.({ type: 'gesture', action: 'click' })
      } else {
        // Long pinch release → drag end
        socket?.emit(EVENTS.DRAG, {
          sessionId,
          from: { x: mapped.normX, y: mapped.normY },
          to: { x: mapped.normX, y: mapped.normY },
        })
        onCommand?.({ type: 'gesture', action: 'drag' })
      }
    }

    // Two-finger swipe → scroll
    const swipe = detectTwoFingerSwipe(landmarks, prevLandmarksRef.current)
    if (swipe) {
      const delta = swipe === 'down' ? 200 : -200
      socket?.emit(EVENTS.SCROLL, {
        sessionId,
        deltaX: 0,
        deltaY: delta,
      })
      onCommand?.({ type: 'gesture', action: `scroll ${swipe}` })
    }

    prevLandmarksRef.current = landmarks

    // Emit cursor move if moved enough
    if (mapped.moved) {
      socket?.emit(EVENTS.CURSOR_MOVE, {
        sessionId,
        x: mapped.normX,
        y: mapped.normY,
      })
      onCursorMove?.({ x: mapped.screenX, y: mapped.screenY })
    }

    // Draw overlay
    overlayRef?.current?.drawHand(landmarks, mapped.screenX, mapped.screenY, pinchNow)
  }, [socket, sessionId, overlayRef, onCommand, onCursorMove])

  useEffect(() => {
    if (!active) {
      // Cleanup
      cameraRef.current?.stop()
      handsRef.current?.close()
      cameraRef.current = null
      handsRef.current = null
      setStatus('idle')
      overlayRef?.current?.clear()
      return
    }

    let isMounted = true

    const init = async () => {
      try {
        setStatus('loading')

        // Dynamic import to avoid SSR
        const { Hands } = await import('@mediapipe/hands')
        const { Camera } = await import('@mediapipe/camera_utils')

        if (!isMounted) return

        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        })

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,  // Lite model for speed
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.6,
        })

        hands.onResults(handleResults)

        // Create hidden video element for webcam
        const video = document.createElement('video')
        video.style.display = 'none'
        video.setAttribute('playsinline', '')
        document.body.appendChild(video)
        videoRef.current = video

        const camera = new Camera(video, {
          onFrame: async () => {
            if (handsRef.current) {
              await handsRef.current.send({ image: video })
            }
          },
          width: 640,
          height: 480,
        })

        handsRef.current = hands
        cameraRef.current = camera

        await camera.start()

        if (isMounted) {
          setStatus('active')
          await hands.initialize()
        }
      } catch (err) {
        console.error('[GestureEngine] Init failed:', err)
        if (isMounted) setStatus('error')
      }
    }

    init()

    return () => {
      isMounted = false
      cameraRef.current?.stop()
      handsRef.current?.close()
      if (videoRef.current) {
        document.body.removeChild(videoRef.current)
        videoRef.current = null
      }
    }
  }, [active, handleResults, overlayRef])

  return (
    <div className="flex flex-col gap-1">
      {status === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="status-dot waiting" />
          Loading MediaPipe...
        </div>
      )}
      {status === 'active' && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="status-dot connected" />
          {isPinch ? '🤏 Pinching' : '✋ Hand detected'}
        </div>
      )}
      {status === 'error' && (
        <div className="text-xs text-red-400">
          ⚠️ Could not start gesture detection. Check camera permissions.
        </div>
      )}
    </div>
  )
}
