'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { EVENTS, GESTURE } from '@/lib/constants'
import { GestureMapper, detectPinch, detectFist } from './GestureMapper'

export default function GestureEngine({ socket, sessionId, active, overlayRef, onCommand, onCursorMove }) {
  const videoRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const mapperRef = useRef(new GestureMapper())
  const pinchStartRef = useRef(null)
  const [status, setStatus] = useState('idle')

  const emit = useCallback((event, payload = {}) => {
    socket?.emit(event, { sessionId, ...payload })
  }, [socket, sessionId])

  const detect = useCallback(async () => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }

    try {
      const hands = await detector.estimateHands(video, { flipHorizontal: true })

      if (!hands || hands.length === 0) {
        overlayRef?.current?.clear()
        rafRef.current = requestAnimationFrame(detect)
        return
      }

      const keypoints = hands[0].keypoints
      // Index tip = keypoint 8, thumb tip = keypoint 4
      const indexTip = keypoints[8]
      const thumbTip = keypoints[4]

      if (!indexTip) { rafRef.current = requestAnimationFrame(detect); return }

      // Map to screen coordinates
      const mapped = mapperRef.current.map(indexTip.x / video.videoWidth, indexTip.y / video.videoHeight)

      // Pinch detection
      const dist = thumbTip
        ? Math.hypot((indexTip.x - thumbTip.x), (indexTip.y - thumbTip.y))
        : 999
      const isPinch = dist < GESTURE.PINCH_THRESHOLD

      if (isPinch && !pinchStartRef.current) {
        pinchStartRef.current = Date.now()
      }
      if (!isPinch && pinchStartRef.current) {
        const held = Date.now() - pinchStartRef.current
        pinchStartRef.current = null
        if (held < GESTURE.PINCH_HOLD_MS) {
          emit(EVENTS.CLICK, { x: mapped.normX, y: mapped.normY, clickType: 'click', button: 0 })
          onCommand?.({ type: 'gesture', action: 'pinch click' })
        }
      }

      // Cursor move
      if (mapped.moved) {
        emit(EVENTS.CURSOR_MOVE, { x: mapped.normX, y: mapped.normY })
        onCursorMove?.({ x: mapped.screenX, y: mapped.screenY })
      }

      // Draw overlay
      overlayRef?.current?.drawHand(
        keypoints.map(k => ({ x: k.x / video.videoWidth, y: k.y / video.videoHeight })),
        mapped.screenX, mapped.screenY, isPinch
      )

    } catch {}

    rafRef.current = requestAnimationFrame(detect)
  }, [emit, overlayRef, onCommand, onCursorMove])

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      detectorRef.current?.dispose?.()
      detectorRef.current = null
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
      overlayRef?.current?.clear()
      setStatus('idle')
      return
    }

    let mounted = true
    setStatus('loading')

    const init = async () => {
      try {
        // Dynamic import — avoids SSR issues
        const tf = await import('@tensorflow/tfjs')
        await import('@tensorflow/tfjs-backend-webgl')
        await tf.setBackend('webgl')
        await tf.ready()

        const handPoseDetection = await import('@tensorflow-models/hand-pose-detection')

        const detector = await handPoseDetection.createDetector(
          handPoseDetection.SupportedModels.MediaPipeHands,
          {
            runtime: 'tfjs',
            modelType: 'lite',
            maxHands: 1,
          }
        )

        if (!mounted) { detector.dispose(); return }
        detectorRef.current = detector

        // Get webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user', frameRate: 30 },
        })
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }

        const video = document.createElement('video')
        video.srcObject = stream
        video.setAttribute('playsinline', '')
        video.style.display = 'none'
        document.body.appendChild(video)
        await video.play()
        videoRef.current = video

        setStatus('active')
        rafRef.current = requestAnimationFrame(detect)
      } catch (err) {
        console.error('[GestureEngine]', err)
        if (mounted) setStatus('error')
      }
    }

    init()

    return () => {
      mounted = false
      cancelAnimationFrame(rafRef.current)
      detectorRef.current?.dispose?.()
      if (videoRef.current) {
        videoRef.current.srcObject?.getTracks().forEach(t => t.stop())
        document.body.removeChild(videoRef.current)
        videoRef.current = null
      }
    }
  }, [active, detect, overlayRef])

  return (
    <div className="flex flex-col gap-1 text-xs">
      {status === 'idle' && null}
      {status === 'loading' && <div className="flex items-center gap-2 text-text-secondary"><span className="status-dot waiting" />Loading TensorFlow...</div>}
      {status === 'active' && <div className="flex items-center gap-2 text-text-secondary"><span className="status-dot connected" />Hand tracking active</div>}
      {status === 'error' && <div className="text-red-400">⚠️ Camera unavailable or not supported</div>}
    </div>
  )
}
