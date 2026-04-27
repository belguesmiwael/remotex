'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { WEBRTC_CONFIG, EVENTS } from '@/lib/constants'

/**
 * useWebRTC — manages WebRTC peer connection lifecycle
 * @param {object} socket - Socket.io socket
 * @param {string} sessionId
 * @param {'controller'|'receiver'} role
 * @param {function} onStream - called with remote MediaStream (receiver side)
 */
export default function useWebRTC({ socket, sessionId, role, onStream }) {
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const [status, setStatus] = useState('idle')  // idle | connecting | connected | error
  const [error, setError] = useState(null)

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      ...WEBRTC_CONFIG,
      // Prefer VP8 for lower latency
      sdpSemantics: 'unified-plan',
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && sessionId) {
        socket.emit(EVENTS.WEBRTC_ICE, {
          sessionId,
          candidate: event.candidate,
        })
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('[WebRTC] Connection state:', state)
      if (state === 'connected') setStatus('connected')
      else if (state === 'failed' || state === 'closed') {
        setStatus('error')
        setError('Connection failed. Please refresh and try again.')
      } else if (state === 'connecting') {
        setStatus('connecting')
      }
    }

    pc.ontrack = (event) => {
      if (role === 'receiver' && event.streams?.[0]) {
        onStream?.(event.streams[0])
      }
    }

    return pc
  }, [socket, sessionId, role, onStream])

  // Controller: get screen → create offer
  const startScreenShare = useCallback(async () => {
    try {
      setStatus('connecting')
      setError(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      localStreamRef.current = stream

      // Handle user stopping screen share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        cleanup()
      })

      const pc = createPeerConnection()
      pcRef.current = pc

      // Add tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Set codec preference to VP8
      setCodecPreference(pc)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      socket.emit(EVENTS.WEBRTC_OFFER, {
        sessionId,
        offer: pc.localDescription,
      })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Screen share permission denied')
      } else {
        setError(err.message || 'Failed to start screen share')
      }
      setStatus('error')
    }
  }, [createPeerConnection, socket, sessionId])

  // Receiver: handle incoming offer → create answer
  const handleOffer = useCallback(async (offer) => {
    try {
      setStatus('connecting')
      const pc = createPeerConnection()
      pcRef.current = pc

      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit(EVENTS.WEBRTC_ANSWER, {
        sessionId,
        answer: pc.localDescription,
      })
    } catch (err) {
      console.error('[WebRTC] handleOffer error:', err)
      setError(err.message)
      setStatus('error')
    }
  }, [createPeerConnection, socket, sessionId])

  // Handle incoming answer (controller side)
  const handleAnswer = useCallback(async (answer) => {
    try {
      const pc = pcRef.current
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    } catch (err) {
      console.error('[WebRTC] handleAnswer error:', err)
    }
  }, [])

  // Handle incoming ICE candidate
  const handleIce = useCallback(async (candidate) => {
    try {
      const pc = pcRef.current
      if (!pc || !candidate) return
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      console.error('[WebRTC] handleIce error:', err)
    }
  }, [])

  // Cleanup
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    setStatus('idle')
  }, [])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const onOffer = (data) => {
      if (data.sessionId === sessionId && role === 'receiver') {
        handleOffer(data.offer)
      }
    }
    const onAnswer = (data) => {
      if (data.sessionId === sessionId && role === 'controller') {
        handleAnswer(data.answer)
      }
    }
    const onIce = (data) => {
      if (data.sessionId === sessionId) {
        handleIce(data.candidate)
      }
    }

    socket.on(EVENTS.WEBRTC_OFFER, onOffer)
    socket.on(EVENTS.WEBRTC_ANSWER, onAnswer)
    socket.on(EVENTS.WEBRTC_ICE, onIce)

    return () => {
      socket.off(EVENTS.WEBRTC_OFFER, onOffer)
      socket.off(EVENTS.WEBRTC_ANSWER, onAnswer)
      socket.off(EVENTS.WEBRTC_ICE, onIce)
    }
  }, [socket, sessionId, role, handleOffer, handleAnswer, handleIce])

  return { status, error, startScreenShare, cleanup }
}

// Prefer VP8 codec for low latency
function setCodecPreference(pc) {
  try {
    const transceivers = pc.getTransceivers()
    transceivers.forEach((transceiver) => {
      if (transceiver.sender?.track?.kind === 'video') {
        const { codecs } = RTCRtpSender.getCapabilities('video')
        const vp8 = codecs.filter((c) => c.mimeType === 'video/VP8')
        const others = codecs.filter((c) => c.mimeType !== 'video/VP8')
        if (vp8.length > 0 && transceiver.setCodecPreferences) {
          transceiver.setCodecPreferences([...vp8, ...others])
        }
      }
    })
  } catch {
    // setCodecPreferences may not be supported — non-critical
  }
}
