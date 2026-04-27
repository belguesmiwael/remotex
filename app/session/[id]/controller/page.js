'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createPeer, destroyPeer } from '@/lib/peer'
import { EVENTS, MODES } from '@/lib/constants'
import { shortId, formatTime, rafThrottle, copyToClipboard } from '@/lib/utils'
import HandOverlay from '@/components/gesture/HandOverlay'
import GestureEngine from '@/components/gesture/GestureEngine'
import VoiceEngine from '@/components/voice/VoiceEngine'

export default function ControllerPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('init')   // init|waiting|connected|error
  const [errorMsg, setErrorMsg] = useState('')
  const [mode, setMode] = useState(MODES.MOUSE)
  const [latency, setLatency] = useState(null)
  const [cmdLog, setCmdLog] = useState([])
  const [copied, setCopied] = useState(false)

  const peerRef = useRef(null)
  const connRef = useRef(null)      // DataConnection to receiver
  const mediaConnRef = useRef(null) // MediaConnection (screen share)
  const overlayRef = useRef(null)
  const lastCursorPos = useRef({ x: 0, y: 0 })
  const pingRef = useRef(null)

  const receiverUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/session/${sessionId}/receiver`
    : ''

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-49), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  // Send event over DataConnection
  const send = useCallback((type, payload = {}) => {
    const conn = connRef.current
    if (!conn || conn.open === false) return
    try { conn.send({ type, ...payload }) } catch {}
  }, [])

  // Throttled cursor sender
  const sendCursor = useCallback(
    rafThrottle((x, y) => {
      send(EVENTS.CURSOR_MOVE, { x, y })
      lastCursorPos.current = { x: x * window.innerWidth, y: y * window.innerHeight }
    }),
    [send]
  )

  useEffect(() => {
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      setErrorMsg('Invalid session ID'); return
    }

    let mounted = true

    const init = async () => {
      try {
        setStatus('init')
        const peer = await createPeer(sessionId)
        if (!mounted) { peer.destroy(); return }
        peerRef.current = peer

        setStatus('waiting')

        // Receiver will connect to us
        peer.on('connection', (conn) => {
          if (!mounted) return
          conn.on('open', () => {
            connRef.current = conn
            setStatus('connected')
            // Start ping loop
            pingRef.current = setInterval(() => {
              send(EVENTS.PING, { t: Date.now() })
            }, 2000)
          })
          conn.on('data', (data) => {
            if (data?.type === EVENTS.PONG) setLatency(Date.now() - data.t)
          })
          conn.on('close', () => {
            clearInterval(pingRef.current)
            if (mounted) setStatus('waiting')
          })
          conn.on('error', () => { if (mounted) setStatus('waiting') })
        })

        // Screen share: receiver calls us with video
        peer.on('call', (call) => {
          // We answer with null (we're the one sharing)
        })

        peer.on('disconnected', () => {
          if (mounted) peer.reconnect()
        })
        peer.on('error', (err) => {
          if (!mounted) return
          if (err.message === 'SESSION_TAKEN') {
            // Session already exists — just reconnect as same controller
            setStatus('waiting')
          } else {
            setErrorMsg('Connection error: ' + err.type)
            setStatus('error')
          }
        })
      } catch (err) {
        if (!mounted) return
        if (err.message === 'SESSION_TAKEN') {
          setStatus('waiting') // Already created, still valid
        } else {
          setErrorMsg(err.message === 'TIMEOUT' ? 'Connection timeout. Check your internet.' : err.message)
          setStatus('error')
        }
      }
    }

    init()

    return () => {
      mounted = false
      clearInterval(pingRef.current)
      destroyPeer()
    }
  }, [sessionId])

  // Mouse events → send over data channel
  useEffect(() => {
    if (status !== 'connected' || mode !== MODES.MOUSE) return

    const onMove = (e) => sendCursor(e.clientX / window.innerWidth, e.clientY / window.innerHeight)
    const onClick = (e) => {
      send(EVENTS.CLICK, { button: e.button, x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, clickType: 'click' })
      addLog({ type: 'mouse', action: 'click' })
    }
    const onDblClick = (e) => {
      send(EVENTS.CLICK, { button: 0, x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, clickType: 'dblclick' })
    }
    const onScroll = (e) => {
      e.preventDefault()
      send(EVENTS.SCROLL, { deltaX: Math.round(e.deltaX), deltaY: Math.round(e.deltaY) })
    }
    const onKey = (e) => {
      if (e.ctrlKey && ['t','w','r'].includes(e.key.toLowerCase())) return
      send(EVENTS.KEYPRESS, { key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, keyType: e.type })
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('click', onClick)
    document.addEventListener('dblclick', onDblClick)
    document.addEventListener('wheel', onScroll, { passive: false })
    document.addEventListener('keydown', onKey)
    document.addEventListener('keyup', onKey)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('click', onClick)
      document.removeEventListener('dblclick', onDblClick)
      document.removeEventListener('wheel', onScroll)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keyup', onKey)
    }
  }, [status, mode, send, sendCursor, addLog])

  // Screen share via PeerJS call
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      const peer = peerRef.current
      if (!peer || !connRef.current) return
      const receiverId = connRef.current.peer
      mediaConnRef.current = peer.call(receiverId, stream)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        mediaConnRef.current?.close()
        addLog({ type: 'mouse', action: 'screen share ended' })
      })
      addLog({ type: 'mouse', action: 'screen share started' })
    } catch (err) {
      if (err.name !== 'NotAllowedError') console.error(err)
    }
  }

  const handleCopy = async () => {
    await copyToClipboard(receiverUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const latencyColor = latency === null ? '#6B7280' : latency < 50 ? '#22C55E' : latency < 150 ? '#F59E0B' : '#EF4444'

  // ── SCREENS ────────────────────────────────────────────────

  if (status === 'init') return (
    <Screen icon="⏳" title="Connecting..." message="Initializing peer connection..." />
  )

  if (status === 'error') return (
    <Screen icon="⚠️" title="Error" message={errorMsg} action={{ label: 'Back to Home', onClick: () => router.push('/') }} />
  )

  if (status === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center w-full max-w-md animate-slide-up">
        <div className="text-5xl mb-4">📡</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Waiting for receiver...
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          This is the <span className="text-violet-400 font-medium">Controller</span> — your device sends commands.<br/>
          The device you want to control must open the link below.
        </p>

        {/* Receiver link */}
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-left"
          style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span className="font-mono text-xs text-violet-400 flex-1 truncate">{receiverUrl}</span>
          <button onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
              color: copied ? '#22C55E' : '#A5B4FC',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.2)'}`,
            }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="p-4 rounded-xl text-xs text-left mb-6"
          style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}>
          <p className="text-cyan-400 font-medium mb-2">📱 How to use:</p>
          <ol className="text-text-secondary space-y-1 list-decimal list-inside">
            <li>Copy the link above <strong className="text-text-primary">or share the QR</strong> on the landing page</li>
            <li>Open it on <strong className="text-text-primary">the device to be controlled</strong></li>
            <li>Both devices connect automatically ✅</li>
          </ol>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mb-6">
          <span className="status-dot waiting" /> Listening for connections...
        </div>
        <button onClick={() => router.push('/')} className="text-xs text-text-muted hover:text-text-secondary transition-colors">Cancel</button>
      </div>
    </div>
  )

  // ── DASHBOARD (connected) ──────────────────────────────────
  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5"
        style={{ background: 'rgba(13,17,23,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-violet-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>RemoteX</span>
          <span className="session-badge">{shortId(sessionId)}</span>
          <span className="status-dot connected" />
          {latency !== null && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ color: latencyColor, background: `${latencyColor}15`, border: `1px solid ${latencyColor}30` }}>
              {latency}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={startScreenShare} className="mode-pill text-xs">🖥️ Share Screen</button>
          <button onClick={() => { destroyPeer(); router.push('/') }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
            ✕ End
          </button>
        </div>
      </header>

      {/* Mode bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5"
        style={{ background: 'rgba(8,11,20,0.4)' }}>
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

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area - mouse capture zone */}
        <div className="flex-1 flex items-center justify-center"
          style={{ cursor: mode === MODES.MOUSE ? 'crosshair' : 'default' }}>
          <div className="text-center text-text-muted">
            <div className="text-6xl mb-4 opacity-20">
              {mode === MODES.MOUSE ? '🖱️' : mode === MODES.VOICE ? '🎤' : '✋'}
            </div>
            <p className="text-sm">
              {mode === MODES.MOUSE && 'Move mouse here to control receiver'}
              {mode === MODES.VOICE && 'Speak commands — they execute on receiver'}
              {mode === MODES.GESTURE && 'Hand gesture controls the receiver cursor'}
            </p>
          </div>
        </div>

        {/* Status panel */}
        <div className="w-72 flex flex-col border-l border-white/5"
          style={{ background: 'rgba(13,17,23,0.6)', backdropFilter: 'blur(12px)' }}>
          <div className="p-4 border-b border-white/5">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Active</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="status-dot connected" />
              <span className="text-xs text-text-secondary">Receiver connected</span>
            </div>

            {mode === MODES.VOICE && (
              <VoiceEngine
                active={true}
                lastCursorPos={lastCursorPos}
                onCommand={(entry) => {
                  addLog(entry)
                  send(EVENTS.VOICE_COMMAND, { command: entry.action })
                }}
              />
            )}
            {mode === MODES.GESTURE && (
              <GestureEngine
                active={true}
                overlayRef={overlayRef}
                onCommand={addLog}
                onCursorMove={({ x, y }) => {
                  sendCursor(x / window.innerWidth, y / window.innerHeight)
                }}
              />
            )}
          </div>

          {/* Command log */}
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

function Screen({ icon, title, message, action }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h2>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        {action && <button onClick={action.onClick} className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium">{action.label}</button>}
      </div>
    </div>
  )
}
