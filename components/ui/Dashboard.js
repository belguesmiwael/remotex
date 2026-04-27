'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MODES, EVENTS } from '@/lib/constants'
import { shortId, formatTime } from '@/lib/utils'
import MouseController from '@/components/remote-control/MouseController'
import VoiceEngine from '@/components/voice/VoiceEngine'
import GestureEngine from '@/components/gesture/GestureEngine'
import HandOverlay from '@/components/gesture/HandOverlay'
import EyeTracker from '@/components/eyetrack/EyeTracker'
import useWebRTC from '@/components/webrtc/useWebRTC'

const MAX_LOG = 50

export default function Dashboard({ socket, sessionId, connectionStatus }) {
  const router = useRouter()
  const [mode, setMode] = useState(MODES.MOUSE)
  const [commandLog, setCommandLog] = useState([])
  const [latency, setLatency] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [eyeTrackEnabled, setEyeTrackEnabled] = useState(false)
  const [screenShareActive, setScreenShareActive] = useState(false)
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const lastCursorPos = useRef({ x: 0, y: 0 })
  const pingIntervalRef = useRef(null)
  const logEndRef = useRef(null)

  const webrtc = useWebRTC({
    socket,
    sessionId,
    role: 'controller',
    onStream: setRemoteStream,
  })

  // Set video stream when received
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Latency ping
  useEffect(() => {
    if (!socket || connectionStatus !== 'connected') return

    const pingLoop = () => {
      const t = Date.now()
      socket.emit(EVENTS.PING, { sessionId, t })
    }

    const onPong = (data) => {
      if (data?.t) setLatency(Date.now() - data.t)
    }

    socket.on(EVENTS.PONG, onPong)
    pingIntervalRef.current = setInterval(pingLoop, 2000)
    pingLoop()

    return () => {
      clearInterval(pingIntervalRef.current)
      socket.off(EVENTS.PONG, onPong)
    }
  }, [socket, sessionId, connectionStatus])

  // Auto-scroll command log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commandLog])

  const addLog = useCallback((entry) => {
    setCommandLog((prev) => [
      ...prev.slice(-MAX_LOG + 1),
      { ...entry, ts: formatTime(), id: Date.now() + Math.random() },
    ])
  }, [])

  const handleEndSession = () => {
    socket?.disconnect()
    router.push('/')
  }

  const handleStartScreenShare = async () => {
    await webrtc.startScreenShare()
    setScreenShareActive(true)
  }

  const modeConfig = [
    { id: MODES.MOUSE, icon: '🖱️', label: 'Mouse' },
    { id: MODES.VOICE, icon: '🎤', label: 'Voice' },
    { id: MODES.GESTURE, icon: '✋', label: 'Gesture' },
  ]

  const latencyColor = latency === null ? '#6B7280'
    : latency < 50 ? '#22C55E'
    : latency < 150 ? '#F59E0B'
    : '#EF4444'

  return (
    <div className="flex flex-col h-screen bg-bg-base" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5"
        style={{ background: 'rgba(13,17,23,0.8)', backdropFilter: 'blur(12px)' }}>

        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-lg text-violet-400"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            RemoteX
          </span>
          <span className="session-badge">{shortId(sessionId)}</span>
          <div className="flex items-center gap-1.5">
            <span className={`status-dot ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'waiting' ? 'waiting' : 'disconnected'}`} />
            <span className="text-xs text-text-secondary capitalize">{connectionStatus}</span>
          </div>
          {latency !== null && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ color: latencyColor, background: `${latencyColor}15`, border: `1px solid ${latencyColor}30` }}>
              {latency}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Eye tracking toggle */}
          <button
            onClick={() => setEyeTrackEnabled((v) => !v)}
            className="mode-pill text-xs"
            style={{
              borderColor: eyeTrackEnabled ? 'rgba(34,211,238,0.4)' : undefined,
              background: eyeTrackEnabled ? 'rgba(34,211,238,0.1)' : undefined,
              color: eyeTrackEnabled ? '#22D3EE' : undefined,
            }}
          >
            👁️ Eye {eyeTrackEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Screen share */}
          {!screenShareActive ? (
            <button
              onClick={handleStartScreenShare}
              className="mode-pill text-xs"
              style={{
                borderColor: 'rgba(99,102,241,0.3)',
                color: '#A5B4FC',
              }}
            >
              🖥️ Share Screen
            </button>
          ) : (
            <span className="mode-pill text-xs active">🖥️ Sharing</span>
          )}

          {/* End session */}
          <button
            onClick={handleEndSession}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#F87171',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          >
            ✕ End
          </button>
        </div>
      </header>

      {/* Mode Toggle Bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5"
        style={{ background: 'rgba(8,11,20,0.4)' }}>
        <span className="text-xs text-text-muted mr-2 uppercase tracking-wider font-medium">Mode</span>
        {modeConfig.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`mode-pill ${mode === id ? 'active' : ''}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Screen stream / Placeholder — 70% */}
        <div className="flex-1 relative bg-black/30 flex items-center justify-center">
          {remoteStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="rtc-video"
            />
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-30">🖥️</div>
              <p className="text-text-muted text-sm">
                {webrtc.status === 'connecting' ? 'Connecting screen share...' : 'No screen stream yet'}
              </p>
              {webrtc.error && (
                <p className="text-red-400 text-xs mt-2">{webrtc.error}</p>
              )}
              {connectionStatus === 'connected' && !screenShareActive && (
                <button
                  onClick={handleStartScreenShare}
                  className="btn-glow mt-4 px-6 py-2 rounded-xl text-white text-sm font-medium"
                >
                  🖥️ Start Screen Share
                </button>
              )}
            </div>
          )}

          {/* Ghost cursor layer — shown in mouse mode */}
          {mode === MODES.MOUSE && (
            <MouseController
              socket={socket}
              sessionId={sessionId}
              active={connectionStatus === 'connected'}
            />
          )}
        </div>

        {/* Status Panel — 30% */}
        <div className="w-80 flex flex-col border-l border-white/5"
          style={{ background: 'rgba(13,17,23,0.6)', backdropFilter: 'blur(12px)' }}>

          {/* Mode status */}
          <div className="p-4 border-b border-white/5">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Status</p>

            <div className="flex flex-col gap-3">
              {/* Active mode indicator */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Active Mode</span>
                <span className="text-xs font-medium text-violet-400 capitalize">{mode}</span>
              </div>

              {/* Voice engine */}
              {mode === MODES.VOICE && (
                <VoiceEngine
                  socket={socket}
                  sessionId={sessionId}
                  active={mode === MODES.VOICE && connectionStatus === 'connected'}
                  lastCursorPos={lastCursorPos}
                  onCommand={addLog}
                />
              )}

              {/* Gesture engine */}
              {mode === MODES.GESTURE && (
                <GestureEngine
                  socket={socket}
                  sessionId={sessionId}
                  active={mode === MODES.GESTURE && connectionStatus === 'connected'}
                  overlayRef={overlayRef}
                  onCommand={addLog}
                  onCursorMove={(pos) => { lastCursorPos.current = pos }}
                />
              )}

              {/* Eye tracker */}
              {eyeTrackEnabled && (
                <EyeTracker
                  active={eyeTrackEnabled && connectionStatus === 'connected'}
                  onGaze={(pos) => {
                    lastCursorPos.current = pos
                    socket?.emit(EVENTS.CURSOR_MOVE, {
                      sessionId,
                      x: pos.x / window.innerWidth,
                      y: pos.y / window.innerHeight,
                    })
                  }}
                  onCommand={addLog}
                />
              )}
            </div>
          </div>

          {/* Command Log */}
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-text-muted uppercase tracking-wider">Command Log</p>
              <button
                onClick={() => setCommandLog([])}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
              {commandLog.length === 0 && (
                <p className="text-xs text-text-muted italic">No commands yet...</p>
              )}
              {commandLog.map((entry) => (
                <div key={entry.id} className="log-entry flex items-center gap-2 py-1">
                  <span className="text-xs"
                    style={{
                      color: entry.type === 'voice' ? '#A5B4FC'
                        : entry.type === 'gesture' ? '#22D3EE'
                        : '#6B7280',
                    }}>
                    {entry.type === 'voice' ? '🎤' : entry.type === 'gesture' ? '✋' : '🖱️'}
                  </span>
                  <span className="font-mono text-xs text-text-secondary flex-1 truncate">
                    {entry.action}
                  </span>
                  <span className="font-mono text-xs text-text-muted flex-shrink-0">
                    {entry.ts}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Connection info */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Session</span>
              <span className="font-mono text-violet-400/70">{shortId(sessionId)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted mt-1">
              <span>WebRTC</span>
              <span style={{ color: webrtc.status === 'connected' ? '#22C55E' : '#6B7280' }}>
                {webrtc.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hand Overlay — only rendered in gesture mode */}
      {mode === MODES.GESTURE && <HandOverlay ref={overlayRef} />}
    </div>
  )
}
