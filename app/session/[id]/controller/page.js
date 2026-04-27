'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { EVENTS, MODES } from '@/lib/constants'
import { shortId, formatTime, rafThrottle, copyToClipboard } from '@/lib/utils'
import HandOverlay from '@/components/gesture/HandOverlay'
import GestureEngine from '@/components/gesture/GestureEngine'
import VoiceEngine from '@/components/voice/VoiceEngine'

export default function ControllerPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('waiting')
  const [mode, setMode] = useState(MODES.MOUSE)
  const [latency, setLatency] = useState(null)
  const [cmdLog, setCmdLog] = useState([])
  const [copied, setCopied] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [socketError, setSocketError] = useState('')

  const socketRef = useRef(null)
  const overlayRef = useRef(null)
  const lastCursorPos = useRef({ x: 0, y: 0 })
  const pingRef = useRef(null)

  const receiverUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/session/${sessionId}/receiver`
    : ''

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-49), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  const emit = useCallback((event, payload = {}) => {
    socketRef.current?.emit(event, { sessionId, ...payload })
  }, [sessionId])

  const sendCursor = useCallback(rafThrottle((x, y) => {
    emit(EVENTS.CURSOR_MOVE, { x, y })
    lastCursorPos.current = { x: x * window.innerWidth, y: y * window.innerHeight }
  }), [emit])

  useEffect(() => {
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) return

    const socket = getSocket()
    if (!socket) { setSocketError('NEXT_PUBLIC_SOCKET_URL not configured'); return }
    socketRef.current = socket

    const register = () => socket.emit('create-session', sessionId)

    if (socket.connected) { register() }
    else { socket.once('connect', register) }

    socket.on('session-created', () => setStatus('waiting'))
    socket.on('session-ready', () => {
      setStatus('connected')
      pingRef.current = setInterval(() => emit(EVENTS.PING, { t: Date.now() }), 2000)
    })
    socket.on('peer-disconnected', () => {
      clearInterval(pingRef.current)
      setStatus('waiting')
      setLatency(null)
    })
    socket.on('session-ended', () => { clearInterval(pingRef.current); setStatus('ended') })
    socket.on(EVENTS.PONG, (d) => setLatency(Date.now() - d.t))
    socket.on('error', (d) => setSocketError(d?.message || 'Server error'))

    return () => {
      clearInterval(pingRef.current)
      socket.off('session-created')
      socket.off('session-ready')
      socket.off('peer-disconnected')
      socket.off('session-ended')
      socket.off(EVENTS.PONG)
      socket.off('error')
    }
  }, [sessionId, emit])

  // Mouse/keyboard capture
  useEffect(() => {
    if (status !== 'connected' || mode !== MODES.MOUSE) return
    const onMove = (e) => sendCursor(e.clientX / window.innerWidth, e.clientY / window.innerHeight)
    const onClick = (e) => { emit(EVENTS.CLICK, { x: e.clientX/window.innerWidth, y: e.clientY/window.innerHeight, clickType: 'click' }); addLog({ type: 'mouse', action: 'click' }) }
    const onDbl = (e) => emit(EVENTS.CLICK, { x: e.clientX/window.innerWidth, y: e.clientY/window.innerHeight, clickType: 'dblclick' })
    const onWheel = (e) => { e.preventDefault(); emit(EVENTS.SCROLL, { deltaX: Math.round(e.deltaX), deltaY: Math.round(e.deltaY) }) }
    const onKey = (e) => { if (e.ctrlKey && ['t','w','r'].includes(e.key.toLowerCase())) return; emit(EVENTS.KEYPRESS, { key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, keyType: e.type }) }
    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('click', onClick)
    document.addEventListener('dblclick', onDbl)
    document.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('keydown', onKey)
    document.addEventListener('keyup', onKey)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('click', onClick)
      document.removeEventListener('dblclick', onDbl)
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keyup', onKey)
    }
  }, [status, mode, emit, sendCursor, addLog])

  const handleCopy = async () => { await copyToClipboard(receiverUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }
  const latencyColor = latency === null ? '#6B7280' : latency < 50 ? '#22C55E' : latency < 150 ? '#F59E0B' : '#EF4444'

  if (socketError) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-8 text-center max-w-md">
        <div className="text-4xl mb-4">⚙️</div>
        <h2 className="text-xl font-semibold text-text-primary mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Signaling server not configured
        </h2>
        <p className="text-sm text-text-secondary mb-4">{socketError}</p>
        <div className="p-4 rounded-xl text-xs text-left mb-4"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-violet-400 font-semibold mb-2">Add to Vercel environment variables:</p>
          <code className="text-green-400 block">NEXT_PUBLIC_SOCKET_URL=https://your-render-server.onrender.com</code>
        </div>
        <a href="https://render.com/deploy" target="_blank" className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium inline-block">
          Deploy server on Render →
        </a>
      </div>
    </div>
  )

  if (status === 'ended') return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-8 text-center max-w-sm">
        <div className="text-4xl mb-4">🔌</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Session Ended</h2>
        <button onClick={() => router.push('/')} className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium">New Session</button>
      </div>
    </div>
  )

  if (status === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center w-full max-w-md animate-slide-up">
        <div className="text-5xl mb-4">📡</div>
        <h2 className="text-xl font-semibold text-text-primary mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Controller ready ✓</h2>
        <p className="text-sm text-text-secondary mb-6">Open this link on the device to be controlled:</p>
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4"
          style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span className="font-mono text-xs text-violet-400 flex-1 truncate">{receiverUrl}</span>
          <button onClick={handleCopy} className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
            style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', color: copied ? '#22C55E' : '#A5B4FC', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.2)'}` }}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mb-4">
          <span className="status-dot waiting" /> Waiting for receiver...
        </div>
        <button onClick={() => router.push('/')} className="text-xs text-text-muted hover:text-text-secondary transition-colors">Cancel</button>
      </div>
    </div>
  )

  // Dashboard
  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5"
        style={{ background: 'rgba(13,17,23,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-violet-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>RemoteX</span>
          <span className="session-badge">{shortId(sessionId)}</span>
          <span className="status-dot connected" />
          {latency !== null && <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: latencyColor, background: `${latencyColor}15`, border: `1px solid ${latencyColor}30` }}>{latency}ms</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { disconnectSocket(); router.push('/') }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
            ✕ End
          </button>
        </div>
      </header>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5" style={{ background: 'rgba(8,11,20,0.4)' }}>
        <span className="text-xs text-text-muted uppercase tracking-wider mr-2">Mode</span>
        {[{ id: MODES.MOUSE, icon: '🖱️', label: 'Mouse' }, { id: MODES.VOICE, icon: '🎤', label: 'Voice' }, { id: MODES.GESTURE, icon: '✋', label: 'Gesture' }].map(({ id, icon, label }) => (
          <button key={id} onClick={() => setMode(id)} className={`mode-pill ${mode === id ? 'active' : ''}`}>{icon} {label}</button>
        ))}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center" style={{ cursor: mode === MODES.MOUSE ? 'crosshair' : 'default' }}>
          <div className="text-center text-text-muted">
            <div className="text-6xl mb-4 opacity-20">{mode === MODES.MOUSE ? '🖱️' : mode === MODES.VOICE ? '🎤' : '✋'}</div>
            <p className="text-sm">{mode === MODES.MOUSE ? 'Move mouse here → controls receiver' : mode === MODES.VOICE ? 'Speak commands → execute on receiver' : 'Hand gesture → controls receiver'}</p>
          </div>
        </div>
        <div className="w-72 flex flex-col border-l border-white/5" style={{ background: 'rgba(13,17,23,0.6)' }}>
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3"><span className="status-dot connected" /><span className="text-xs text-text-secondary">Receiver connected ✓</span></div>
            {mode === MODES.VOICE && <VoiceEngine active={true} lastCursorPos={lastCursorPos} onCommand={(e) => { addLog(e); emit(EVENTS.VOICE_COMMAND, { command: e.action }) }} />}
            {mode === MODES.GESTURE && <GestureEngine active={true} overlayRef={overlayRef} onCommand={addLog} onCursorMove={({ x, y }) => sendCursor(x / window.innerWidth, y / window.innerHeight)} />}
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
