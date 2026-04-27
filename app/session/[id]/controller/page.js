'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { joinRoom, leaveRoom } from '@/lib/room'
import { EVENTS, MODES } from '@/lib/constants'
import { shortId, formatTime, rafThrottle, copyToClipboard } from '@/lib/utils'
import HandOverlay from '@/components/gesture/HandOverlay'
import GestureEngine from '@/components/gesture/GestureEngine'
import VoiceEngine from '@/components/voice/VoiceEngine'

export default function ControllerPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('connecting') // connecting|waiting|connected|error
  const [mode, setMode] = useState(MODES.MOUSE)
  const [latency, setLatency] = useState(null)
  const [cmdLog, setCmdLog] = useState([])
  const [copied, setCopied] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [peerCount, setPeerCount] = useState(0)

  const roomRef = useRef(null)
  const sendEventRef = useRef(null)
  const overlayRef = useRef(null)
  const lastCursorPos = useRef({ x: 0, y: 0 })
  const pingRef = useRef(null)

  const receiverUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/session/${sessionId}/receiver`
    : ''

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-49), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  const sendEvent = useCallback((type, payload = {}) => {
    sendEventRef.current?.({ type, ...payload })
  }, [])

  const sendCursor = useCallback(rafThrottle((x, y) => {
    sendEvent(EVENTS.CURSOR_MOVE, { x, y })
    lastCursorPos.current = { x: x * window.innerWidth, y: y * window.innerHeight }
  }), [sendEvent])

  useEffect(() => {
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) return

    let mounted = true

    const init = async () => {
      try {
        const room = await joinRoom(sessionId)
        if (!mounted) { room.leave(); return }
        roomRef.current = room

        // Make actions
        const [send, receive] = room.makeAction('event')
        sendEventRef.current = send

        // Handle incoming pong for latency
        receive((data) => {
          if (data?.type === EVENTS.PONG) setLatency(Date.now() - data.t)
        })

        // Peer join/leave
        room.onPeerJoin((peerId) => {
          if (!mounted) return
          setPeerCount(c => c + 1)
          setStatus('connected')
          // Start ping
          pingRef.current = setInterval(() => {
            send({ type: EVENTS.PING, t: Date.now() })
          }, 2000)
        })

        room.onPeerLeave(() => {
          if (!mounted) return
          setPeerCount(c => {
            const next = c - 1
            if (next <= 0) {
              clearInterval(pingRef.current)
              setStatus('waiting')
              setLatency(null)
            }
            return Math.max(0, next)
          })
        })

        setStatus('waiting')

      } catch (err) {
        if (!mounted) return
        console.error('[Room] Init error:', err)
        setStatus('error')
      }
    }

    init()
    return () => {
      mounted = false
      clearInterval(pingRef.current)
      leaveRoom()
    }
  }, [sessionId])

  // Mouse/keyboard capture
  useEffect(() => {
    if (status !== 'connected' || mode !== MODES.MOUSE) return

    const onMove = (e) => sendCursor(e.clientX / window.innerWidth, e.clientY / window.innerHeight)
    const onClick = (e) => {
      sendEvent(EVENTS.CLICK, { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, clickType: 'click' })
      addLog({ type: 'mouse', action: 'click' })
    }
    const onDblClick = (e) => sendEvent(EVENTS.CLICK, { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, clickType: 'dblclick' })
    const onWheel = (e) => { e.preventDefault(); sendEvent(EVENTS.SCROLL, { deltaX: Math.round(e.deltaX), deltaY: Math.round(e.deltaY) }) }
    const onKey = (e) => {
      if (e.ctrlKey && ['t', 'w', 'r'].includes(e.key.toLowerCase())) return
      sendEvent(EVENTS.KEYPRESS, { key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, keyType: e.type })
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('click', onClick)
    document.addEventListener('dblclick', onDblClick)
    document.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('keydown', onKey)
    document.addEventListener('keyup', onKey)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('click', onClick)
      document.removeEventListener('dblclick', onDblClick)
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keyup', onKey)
    }
  }, [status, mode, sendEvent, sendCursor, addLog])

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      const room = roomRef.current
      if (!room) return
      room.addStream(stream)
      setScreenSharing(true)
      stream.getVideoTracks()[0].addEventListener('ended', () => setScreenSharing(false))
    } catch {}
  }

  const handleCopy = async () => { await copyToClipboard(receiverUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }
  const latencyColor = latency === null ? '#6B7280' : latency < 50 ? '#22C55E' : latency < 150 ? '#F59E0B' : '#EF4444'

  // ── CONNECTING SCREEN ────────────────────────────────────
  if (status === 'connecting') return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm">
        <div className="text-5xl mb-4">🌐</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Joining network...
        </h2>
        <p className="text-sm text-text-secondary">Connecting to Nostr relay network</p>
        <div className="mt-4 w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: '70%', background: 'linear-gradient(90deg, #6366F1, #22D3EE)' }} />
        </div>
      </div>
    </div>
  )

  // ── WAITING SCREEN ────────────────────────────────────────
  if (status === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center w-full max-w-md animate-slide-up">
        <div className="text-5xl mb-4">📡</div>
        <h2 className="text-xl font-semibold text-text-primary mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Controller ready ✓
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Waiting for the <span className="text-violet-400 font-medium">receiver device</span> to connect
        </p>

        {/* Link */}
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4"
          style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span className="font-mono text-xs text-violet-400 flex-1 truncate">{receiverUrl}</span>
          <button onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
              color: copied ? '#22C55E' : '#A5B4FC',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.2)'}`,
            }}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        {/* Instructions */}
        <div className="p-4 rounded-xl text-sm text-left mb-6"
          style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}>
          <p className="text-cyan-400 font-semibold mb-3">📱 On the phone/other device:</p>
          <ol className="text-text-secondary space-y-2 list-decimal list-inside">
            <li>Open the link above <strong className="text-text-primary">(or scan QR from homepage)</strong></li>
            <li>Wait a few seconds for connection</li>
            <li>This page will show <strong className="text-green-400">"Connected ✓"</strong> automatically</li>
          </ol>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
          <span className="status-dot waiting" /> Listening via Nostr relay network...
        </div>
        <button onClick={() => { leaveRoom(); router.push('/') }}
          className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )

  // ── DASHBOARD (connected) ─────────────────────────────────
  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5"
        style={{ background: 'rgba(13,17,23,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-violet-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>RemoteX</span>
          <span className="session-badge">{shortId(sessionId)}</span>
          <span className="status-dot connected" />
          <span className="text-xs text-green-400">{peerCount} receiver{peerCount > 1 ? 's' : ''} ✓</span>
          {latency !== null && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ color: latencyColor, background: `${latencyColor}15`, border: `1px solid ${latencyColor}30` }}>
              {latency}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={startScreenShare}
            className={`mode-pill text-xs ${screenSharing ? 'active' : ''}`}>
            🖥️ {screenSharing ? 'Sharing' : 'Share Screen'}
          </button>
          <button onClick={() => { leaveRoom(); router.push('/') }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
            ✕ End
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5" style={{ background: 'rgba(8,11,20,0.4)' }}>
        <span className="text-xs text-text-muted uppercase tracking-wider mr-2">Mode</span>
        {[
          { id: MODES.MOUSE, icon: '🖱️', label: 'Mouse' },
          { id: MODES.VOICE, icon: '🎤', label: 'Voice' },
          { id: MODES.GESTURE, icon: '✋', label: 'Gesture' },
        ].map(({ id, icon, label }) => (
          <button key={id} onClick={() => setMode(id)} className={`mode-pill ${mode === id ? 'active' : ''}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center"
          style={{ cursor: mode === MODES.MOUSE ? 'crosshair' : 'default' }}>
          <div className="text-center text-text-muted">
            <div className="text-6xl mb-4 opacity-20">
              {mode === MODES.MOUSE ? '🖱️' : mode === MODES.VOICE ? '🎤' : '✋'}
            </div>
            <p className="text-sm">
              {mode === MODES.MOUSE && 'Move mouse here → controls receiver cursor'}
              {mode === MODES.VOICE && 'Speak commands → execute on receiver'}
              {mode === MODES.GESTURE && 'Hand gesture → controls receiver cursor'}
            </p>
          </div>
        </div>

        <div className="w-72 flex flex-col border-l border-white/5" style={{ background: 'rgba(13,17,23,0.6)' }}>
          <div className="p-4 border-b border-white/5">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Active</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="status-dot connected" />
              <span className="text-xs text-text-secondary">Receiver connected via Nostr P2P</span>
            </div>

            {mode === MODES.VOICE && (
              <VoiceEngine active={true} lastCursorPos={lastCursorPos}
                onCommand={(e) => { addLog(e); sendEvent(EVENTS.VOICE_COMMAND, { command: e.action }) }} />
            )}
            {mode === MODES.GESTURE && (
              <GestureEngine active={true} overlayRef={overlayRef} onCommand={addLog}
                onCursorMove={({ x, y }) => sendCursor(x / window.innerWidth, y / window.innerHeight)} />
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-muted uppercase tracking-wider">Log</p>
              <button onClick={() => setCmdLog([])} className="text-xs text-text-muted hover:text-text-secondary">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
              {cmdLog.length === 0 && <p className="text-xs text-text-muted italic">No commands yet...</p>}
              {cmdLog.map(e => (
                <div key={e.id} className="log-entry flex items-center gap-2 py-0.5">
                  <span className="text-xs">{e.type === 'voice' ? '🎤' : e.type === 'gesture' ? '✋' : '🖱️'}</span>
                  <span className="font-mono text-xs text-text-secondary flex-1 truncate">{e.action}</span>
                  <span className="font-mono text-xs text-text-muted">{e.ts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {mode === MODES.GESTURE && <HandOverlay ref={overlayRef} />}
    </div>
  )
}
