'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createReceiverPeer } from '@/lib/peer'
import { EVENTS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'

export default function ReceiverPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 })
  const [cmdLog, setCmdLog] = useState([])
  const [showUI, setShowUI] = useState(true)

  const peerRef = useRef(null)
  const connRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)
  const retryTimer = useRef(null)
  const mountedRef = useRef(true)

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-19), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  const handleEvent = useCallback((data) => {
    if (!data?.type) return
    switch (data.type) {
      case EVENTS.CURSOR_MOVE: {
        setCursorPos({
          x: Math.max(0, Math.min(1, data.x)) * window.innerWidth,
          y: Math.max(0, Math.min(1, data.y)) * window.innerHeight,
        })
        break
      }
      case EVENTS.CLICK: {
        const el = document.elementFromPoint(data.x * window.innerWidth, data.y * window.innerHeight)
        if (el) {
          if (data.clickType === 'dblclick') el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
          else el.click()
        }
        addLog({ type: 'mouse', action: data.clickType || 'click' })
        break
      }
      case EVENTS.SCROLL: {
        window.scrollBy({ left: data.deltaX || 0, top: data.deltaY || 0 })
        break
      }
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
        connRef.current?.send({ type: EVENTS.PONG, t: data.t })
        break
    }
  }, [addLog])

  const connect = useCallback(async (peer, targetId, attempt = 0) => {
    if (!mountedRef.current) return

    console.log(`[Receiver] Connecting to ${targetId}, attempt ${attempt + 1}`)

    const conn = peer.connect(targetId, {
      reliable: true,
      serialization: 'json',
    })

    let opened = false

    const timeout = setTimeout(() => {
      if (!opened && mountedRef.current) {
        conn.close()
        // Retry with backoff
        const delay = Math.min(3000 + attempt * 1000, 8000)
        setRetryCount(attempt + 1)
        setCountdown(Math.round(delay / 1000))
        const tick = setInterval(() => setCountdown(c => c > 1 ? c - 1 : (clearInterval(tick), 0)), 1000)
        retryTimer.current = setTimeout(() => {
          if (mountedRef.current) connect(peer, targetId, attempt + 1)
        }, delay)
      }
    }, 8000)

    conn.on('open', () => {
      opened = true
      clearTimeout(timeout)
      connRef.current = conn
      if (mountedRef.current) {
        setStatus('connected')
        setCountdown(null)
      }
    })

    conn.on('data', handleEvent)

    conn.on('close', () => {
      if (mountedRef.current) setStatus('ended')
    })

    conn.on('error', (err) => {
      console.warn('[Receiver] Conn error:', err)
    })
  }, [handleEvent])

  useEffect(() => {
    mountedRef.current = true
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      setErrorMsg('Invalid session ID'); setStatus('error'); return
    }

    const init = async () => {
      try {
        const { peer, targetId } = await createReceiverPeer(sessionId)
        if (!mountedRef.current) { peer.destroy(); return }
        peerRef.current = peer

        // Receive screen share
        peer.on('call', (call) => {
          call.answer()
          call.on('stream', (stream) => {
            if (videoRef.current) videoRef.current.srcObject = stream
          })
        })

        peer.on('error', (err) => {
          if (err.type === 'peer-unavailable') {
            // Controller not found yet — handled by connect() retry
            console.warn('[Receiver] peer-unavailable — will retry')
          } else if (mountedRef.current) {
            setErrorMsg('Network error: ' + err.type)
            setStatus('error')
          }
        })

        // Start connecting
        connect(peer, targetId)

      } catch (err) {
        if (!mountedRef.current) return
        setErrorMsg('Could not initialize: ' + err.message)
        setStatus('error')
      }
    }

    init()

    return () => {
      mountedRef.current = false
      clearTimeout(retryTimer.current)
      peerRef.current?.destroy()
    }
  }, [sessionId, connect])

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

  if (status === 'error') return (
    <Screen icon="⚠️" title="Error" message={errorMsg}
      action={{ label: 'Back to Home', onClick: () => router.push('/') }} />
  )

  if (status === 'ended') return (
    <Screen icon="🔌" title="Session Ended" message="The controller disconnected."
      action={{ label: 'Back to Home', onClick: () => router.push('/') }} />
  )

  if (status === 'connecting') return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {retryCount === 0 ? 'Connecting to controller...' : `Retrying... (attempt ${retryCount + 1})`}
        </h2>

        {retryCount === 0 ? (
          <p className="text-sm text-text-secondary mb-4">
            Looking for the controller. Make sure the <strong className="text-violet-400">controller page is open</strong> on the other device.
          </p>
        ) : (
          <p className="text-sm text-text-secondary mb-4">
            Controller not found yet.{countdown ? ` Retrying in ${countdown}s...` : ' Retrying...'}<br/>
            <span className="text-yellow-400">Make sure the controller page is open first.</span>
          </p>
        )}

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-6" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'linear-gradient(90deg, #6366F1, #22D3EE)' }} />
        </div>

        <div className="p-3 rounded-xl text-xs text-left" style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.1)' }}>
          <p className="text-cyan-400 font-medium mb-1">If stuck here:</p>
          <ol className="text-text-secondary space-y-1 list-decimal list-inside">
            <li>Go to <strong className="text-text-primary">the other device</strong></li>
            <li>Make sure the <strong className="text-text-primary">controller page</strong> is open</li>
            <li>This page will connect automatically</li>
          </ol>
        </div>

        <button onClick={() => router.push('/')} className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors">
          Back to Home
        </button>
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
          <span className="text-text-secondary">
            Controlled by <span className="text-violet-400 font-mono">{sessionId?.slice(0, 8).toUpperCase()}</span>
          </span>
          <button onClick={() => { peerRef.current?.destroy(); router.push('/') }} className="text-red-400/70 hover:text-red-400 transition-colors">
            ✕ Disconnect
          </button>
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
      <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h2>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        {action && <button onClick={action.onClick} className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium">{action.label}</button>}
      </div>
    </div>
  )
}
