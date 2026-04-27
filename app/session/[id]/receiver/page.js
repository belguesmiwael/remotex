'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { joinRoom, leaveRoom } from '@/lib/room'
import { EVENTS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'

export default function ReceiverPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('connecting') // connecting|waiting|connected|ended|error
  const [cmdLog, setCmdLog] = useState([])
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 })
  const [showUI, setShowUI] = useState(true)

  const roomRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)
  const mountedRef = useRef(true)

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-19), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  const handleEvent = useCallback((data) => {
    if (!data?.type) return
    switch (data.type) {
      case EVENTS.CURSOR_MOVE:
        setCursorPos({
          x: Math.max(0, Math.min(1, data.x)) * window.innerWidth,
          y: Math.max(0, Math.min(1, data.y)) * window.innerHeight,
        })
        break
      case EVENTS.CLICK: {
        const el = document.elementFromPoint(data.x * window.innerWidth, data.y * window.innerHeight)
        if (el) {
          if (data.clickType === 'dblclick') el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
          else el.click()
        }
        addLog({ type: 'mouse', action: data.clickType || 'click' })
        break
      }
      case EVENTS.SCROLL:
        window.scrollBy({ left: data.deltaX || 0, top: data.deltaY || 0 })
        break
      case EVENTS.KEYPRESS: {
        const target = document.activeElement || document.body
        target.dispatchEvent(new KeyboardEvent(data.keyType || 'keydown', {
          key: data.key, code: data.code,
          ctrlKey: data.ctrlKey, shiftKey: data.shiftKey, altKey: data.altKey,
          bubbles: true, cancelable: true,
        }))
        if (data.keyType === 'keydown') addLog({ type: 'keyboard', action: `key: ${data.key}` })
        break
      }
      case EVENTS.VOICE_COMMAND:
        addLog({ type: 'voice', action: data.command })
        break
      case EVENTS.PING:
        // Send pong back — trystero broadcasts to all peers
        // We use a separate action to avoid feedback loops
        break
    }
  }, [addLog])

  useEffect(() => {
    mountedRef.current = true
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) return

    let mounted = true

    const init = async () => {
      try {
        const room = await joinRoom(sessionId)
        if (!mounted) { room.leave(); return }
        roomRef.current = room

        // Listen for events from controller
        const [, receiveEvent] = room.makeAction('event')
        receiveEvent((data) => {
          if (mounted) handleEvent(data)
        })

        // Receive screen share stream from controller
        room.onPeerStream((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream
        })

        // Peer join = controller connected
        room.onPeerJoin(() => {
          if (mounted) setStatus('connected')
        })

        room.onPeerLeave(() => {
          if (mounted) setStatus('ended')
        })

        // We're in the room — waiting for controller to join
        setStatus('waiting')

      } catch (err) {
        if (!mounted) return
        console.error('[Room] Error:', err)
        setStatus('error')
      }
    }

    init()
    return () => {
      mounted = false
      leaveRoom()
    }
  }, [sessionId, handleEvent])

  // Auto-hide HUD
  useEffect(() => {
    if (status !== 'connected') return
    const reset = () => {
      setShowUI(true)
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setShowUI(false), 4000)
    }
    window.addEventListener('mousemove', reset)
    window.addEventListener('touchstart', reset)
    reset()
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('touchstart', reset)
      clearTimeout(hideTimer.current)
    }
  }, [status])

  // ── SCREENS ──────────────────────────────────────────────
  if (status === 'error') return (
    <Screen icon="⚠️" title="Connection Error" message="Could not join the relay network. Check your internet."
      action={{ label: 'Back to Home', onClick: () => { leaveRoom(); router.push('/') } }} />
  )

  if (status === 'ended') return (
    <Screen icon="🔌" title="Session Ended" message="The controller disconnected."
      action={{ label: 'Back to Home', onClick: () => { leaveRoom(); router.push('/') } }} />
  )

  if (status === 'connecting') return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">🌐</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Joining relay network...
        </h2>
        <p className="text-sm text-text-secondary mb-4">Connecting to Nostr relays</p>
        <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'linear-gradient(90deg, #6366F1, #22D3EE)' }} />
        </div>
      </div>
    </div>
  )

  if (status === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Waiting for controller...
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Joined the relay network ✓<br/>
          Waiting for the <span className="text-violet-400 font-medium">controller</span> to open their page.
        </p>
        <div className="p-3 rounded-xl text-xs text-left mb-4"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <p className="text-violet-400 font-medium mb-1">On the controller device:</p>
          <p className="text-text-secondary">Go to <strong className="text-text-primary">Create Session → Open Controller Dashboard</strong></p>
          <p className="text-text-secondary mt-1">This page will connect <strong className="text-green-400">automatically</strong>.</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
          <span className="status-dot waiting" /> Listening on relay network...
        </div>
        <button onClick={() => { leaveRoom(); router.push('/') }}
          className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )

  // ── CONNECTED ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" style={{ background: '#000' }} />

      {/* Ghost cursor */}
      <div className="ghost-cursor" style={{ left: cursorPos.x, top: cursorPos.y }} />

      {/* HUD */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500"
        style={{ opacity: showUI ? 1 : 0, transform: `translateX(-50%) translateY(${showUI ? 0 : -20}px)` }}>
        <div className="glass-card px-4 py-2 flex items-center gap-3 text-xs">
          <span className="status-dot connected" />
          <span className="text-text-secondary">
            Controlled by <span className="text-violet-400 font-mono">{sessionId?.slice(0, 8).toUpperCase()}</span>
          </span>
          <button onClick={() => { leaveRoom(); router.push('/') }}
            className="text-red-400/70 hover:text-red-400 transition-colors">
            ✕ Disconnect
          </button>
        </div>
      </div>

      {/* Command log */}
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
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h2>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        {action && <button onClick={action.onClick} className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium">{action.label}</button>}
      </div>
    </div>
  )
}
