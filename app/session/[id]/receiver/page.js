'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSocket } from '@/lib/socket'
import { EVENTS } from '@/lib/constants'
import EventRelay from '@/components/remote-control/EventRelay'
import useWebRTC from '@/components/webrtc/useWebRTC'

export default function ReceiverPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [connectionStatus, setConnectionStatus] = useState('joining')
  const [errorMsg, setErrorMsg] = useState('')
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 })
  const [commandLog, setCommandLog] = useState([])
  const [showUI, setShowUI] = useState(true)
  const socketRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)

  const handleStream = useCallback((stream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [])

  const webrtc = useWebRTC({
    socket: socketRef.current,
    sessionId,
    role: 'receiver',
    onStream: handleStream,
  })

  useEffect(() => {
    if (!sessionId) { router.push('/'); return }
    if (!/^[a-f0-9\-]{36}$/i.test(sessionId)) {
      setErrorMsg('Invalid session ID')
      return
    }

    const socket = getSocket()
    socketRef.current = socket

    const join = () => {
      socket.emit(EVENTS.JOIN_SESSION, sessionId)
    }

    const onSessionReady = () => {
      setConnectionStatus('connected')
    }

    const onPeerDisconnected = () => {
      setConnectionStatus('peer-left')
    }

    const onSessionEnded = () => {
      setConnectionStatus('ended')
    }

    const onError = (data) => {
      setErrorMsg(data?.message || 'Could not join session')
      setConnectionStatus('error')
    }

    const onDisconnect = () => {
      setConnectionStatus('disconnected')
    }

    // Relay ping back
    const onPing = (data) => {
      socket.emit(EVENTS.PONG, data)
    }

    if (socket.connected) {
      join()
    } else {
      socket.on('connect', join)
    }

    socket.on(EVENTS.SESSION_READY, onSessionReady)
    socket.on(EVENTS.PEER_DISCONNECTED, onPeerDisconnected)
    socket.on(EVENTS.SESSION_ENDED, onSessionEnded)
    socket.on(EVENTS.ERROR, onError)
    socket.on('disconnect', onDisconnect)
    socket.on(EVENTS.PING, onPing)

    return () => {
      socket.off('connect', join)
      socket.off(EVENTS.SESSION_READY, onSessionReady)
      socket.off(EVENTS.PEER_DISCONNECTED, onPeerDisconnected)
      socket.off(EVENTS.SESSION_ENDED, onSessionEnded)
      socket.off(EVENTS.ERROR, onError)
      socket.off('disconnect', onDisconnect)
      socket.off(EVENTS.PING, onPing)
    }
  }, [sessionId, router])

  // Auto-hide UI after inactivity
  useEffect(() => {
    if (connectionStatus !== 'connected') return
    const resetTimer = () => {
      setShowUI(true)
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setShowUI(false), 4000)
    }
    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('touchmove', resetTimer)
    resetTimer()
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('touchmove', resetTimer)
      clearTimeout(hideTimer.current)
    }
  }, [connectionStatus])

  const handleCursorMove = useCallback(({ x, y }) => {
    setCursorPos({ x, y })
  }, [])

  const handleCommand = useCallback((entry) => {
    setCommandLog((prev) => [
      ...prev.slice(-20),
      { ...entry, ts: new Date().toTimeString().slice(0, 8), id: Date.now() + Math.random() }
    ])
  }, [])

  // Status screens
  if (errorMsg) {
    return (
      <StatusScreen icon="⚠️" title="Error" message={errorMsg} onHome={() => router.push('/')} />
    )
  }

  if (connectionStatus === 'joining') {
    return (
      <StatusScreen icon="🔗" title="Joining session..." message="Connecting to the controller..." />
    )
  }

  if (connectionStatus === 'ended' || connectionStatus === 'disconnected') {
    return (
      <StatusScreen icon="🔌" title="Session Ended" message="The controller disconnected." onHome={() => router.push('/')} />
    )
  }

  if (connectionStatus === 'peer-left') {
    return (
      <StatusScreen icon="👋" title="Controller Left" message="The controller disconnected from this session." onHome={() => router.push('/')} />
    )
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Remote screen video */}
      {videoRef && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-contain"
          style={{ background: '#000' }}
        />
      )}

      {/* Ghost cursor */}
      <div
        className="ghost-cursor"
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          opacity: connectionStatus === 'connected' ? 1 : 0,
        }}
      />

      {/* EventRelay — headless */}
      <EventRelay
        socket={socketRef.current}
        sessionId={sessionId}
        active={connectionStatus === 'connected'}
        onCursorMove={handleCursorMove}
        onCommand={handleCommand}
      />

      {/* HUD — auto-hides */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 transition-all duration-500 z-50"
        style={{ opacity: showUI ? 1 : 0, transform: `translateX(-50%) translateY(${showUI ? 0 : -20}px)` }}
      >
        <div className="glass-card px-4 py-2 flex items-center gap-3 text-xs">
          <span className="status-dot connected" />
          <span className="text-text-secondary">
            RemoteX Receiver · Controlled by
            <span className="text-violet-400 font-mono ml-1">
              {sessionId?.slice(0, 8).toUpperCase()}
            </span>
          </span>
          <button
            onClick={() => router.push('/')}
            className="text-red-400/70 hover:text-red-400 transition-colors ml-2"
          >
            ✕ Disconnect
          </button>
        </div>
      </div>

      {/* Mini command log overlay */}
      {commandLog.length > 0 && showUI && (
        <div className="fixed bottom-4 right-4 flex flex-col gap-1 z-50">
          {commandLog.slice(-5).map((entry) => (
            <div key={entry.id}
              className="log-entry glass-card px-3 py-1.5 text-xs font-mono flex items-center gap-2">
              <span>{entry.type === 'voice' ? '🎤' : entry.type === 'gesture' ? '✋' : '🖱️'}</span>
              <span className="text-text-secondary">{entry.action}</span>
              <span className="text-text-muted">{entry.ts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusScreen({ icon, title, message, onHome }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="font-display text-xl font-semibold text-text-primary mb-2"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {title}
        </h2>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        {onHome && (
          <button
            onClick={onHome}
            className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium"
          >
            Back to Home
          </button>
        )}
      </div>
    </div>
  )
}
