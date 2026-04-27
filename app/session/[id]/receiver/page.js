'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { EVENTS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'

export default function ReceiverPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('joining')
  const [errorMsg, setErrorMsg] = useState('')
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 })
  const [cmdLog, setCmdLog] = useState([])
  const [showUI, setShowUI] = useState(true)

  const socketRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-19), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  useEffect(() => {
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) { setErrorMsg('Invalid session ID'); return }

    const socket = getSocket()
    if (!socket) { setErrorMsg('Socket server not configured — set NEXT_PUBLIC_SOCKET_URL'); return }
    socketRef.current = socket

    const join = () => socket.emit('join-session', sessionId)
    if (socket.connected) { join() } else { socket.once('connect', join) }

    socket.on('session-ready', () => setStatus('connected'))
    socket.on('session-ended', () => setStatus('ended'))
    socket.on('peer-disconnected', () => setStatus('ended'))
    socket.on('error', (d) => { setErrorMsg(d?.message || 'Error'); setStatus('error') })

    // Remote events
    socket.on(EVENTS.CURSOR_MOVE, (d) => {
      if (d.sessionId !== sessionId) return
      setCursorPos({ x: Math.max(0, Math.min(1, d.x)) * window.innerWidth, y: Math.max(0, Math.min(1, d.y)) * window.innerHeight })
    })
    socket.on(EVENTS.CLICK, (d) => {
      if (d.sessionId !== sessionId) return
      const el = document.elementFromPoint(d.x * window.innerWidth, d.y * window.innerHeight)
      if (el) { d.clickType === 'dblclick' ? el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) : el.click() }
      addLog({ type: 'mouse', action: d.clickType || 'click' })
    })
    socket.on(EVENTS.SCROLL, (d) => {
      if (d.sessionId !== sessionId) return
      window.scrollBy({ left: d.deltaX || 0, top: d.deltaY || 0 })
    })
    socket.on(EVENTS.KEYPRESS, (d) => {
      if (d.sessionId !== sessionId) return
      const t = document.activeElement || document.body
      t.dispatchEvent(new KeyboardEvent(d.keyType || 'keydown', { key: d.key, code: d.code, ctrlKey: d.ctrlKey, shiftKey: d.shiftKey, altKey: d.altKey, bubbles: true }))
      if (d.keyType === 'keydown') addLog({ type: 'keyboard', action: `key: ${d.key}` })
    })
    socket.on(EVENTS.VOICE_COMMAND, (d) => {
      if (d.sessionId !== sessionId) return
      addLog({ type: 'voice', action: d.command })
    })
    socket.on(EVENTS.PING, (d) => {
      if (d.sessionId !== sessionId) return
      socket.emit(EVENTS.PONG, { ...d })
    })

    return () => {
      socket.off('session-ready'); socket.off('session-ended'); socket.off('peer-disconnected')
      socket.off('error'); socket.off(EVENTS.CURSOR_MOVE); socket.off(EVENTS.CLICK)
      socket.off(EVENTS.SCROLL); socket.off(EVENTS.KEYPRESS); socket.off(EVENTS.VOICE_COMMAND)
      socket.off(EVENTS.PING)
    }
  }, [sessionId, addLog])

  useEffect(() => {
    if (status !== 'connected') return
    const reset = () => { setShowUI(true); clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setShowUI(false), 4000) }
    window.addEventListener('mousemove', reset); window.addEventListener('touchstart', reset)
    reset()
    return () => { window.removeEventListener('mousemove', reset); window.removeEventListener('touchstart', reset); clearTimeout(hideTimer.current) }
  }, [status])

  if (status === 'error') return <Screen icon="⚠️" title="Error" message={errorMsg} action={{ label: 'Home', onClick: () => router.push('/') }} />
  if (status === 'ended') return <Screen icon="🔌" title="Session Ended" message="Controller disconnected." action={{ label: 'Home', onClick: () => router.push('/') }} />

  if (status === 'joining') return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Joining session...</h2>
        <p className="text-sm text-text-secondary mb-4">Connecting to signaling server</p>
        <div className="w-full h-1 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: '65%', background: 'linear-gradient(90deg, #6366F1, #22D3EE)' }} />
        </div>
        <p className="text-xs text-text-muted">Make sure the controller page is open on the other device</p>
        <button onClick={() => router.push('/')} className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" style={{ background: '#000' }} />
      <div className="ghost-cursor" style={{ left: cursorPos.x, top: cursorPos.y }} />
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500"
        style={{ opacity: showUI ? 1 : 0, transform: `translateX(-50%) translateY(${showUI ? 0 : -20}px)` }}>
        <div className="glass-card px-4 py-2 flex items-center gap-3 text-xs">
          <span className="status-dot connected" />
          <span className="text-text-secondary">Controlled by <span className="text-violet-400 font-mono">{sessionId?.slice(0,8).toUpperCase()}</span></span>
          <button onClick={() => { disconnectSocket(); router.push('/') }} className="text-red-400/70 hover:text-red-400 transition-colors">✕ Disconnect</button>
        </div>
      </div>
      {cmdLog.length > 0 && showUI && (
        <div className="fixed bottom-4 right-4 flex flex-col gap-1 z-50">
          {cmdLog.slice(-5).map(e => (
            <div key={e.id} className="log-entry glass-card px-3 py-1.5 text-xs font-mono flex items-center gap-2">
              <span>{e.type === 'voice' ? '🎤' : e.type === 'gesture' ? '✋' : '🖱️'}</span>
              <span className="text-text-secondary">{e.action}</span>
              <span className="text-text-muted">{e.ts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Screen({ icon, title, message, action }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h2>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        {action && <button onClick={action.onClick} className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm">{action.label}</button>}
      </div>
    </div>
  )
}
