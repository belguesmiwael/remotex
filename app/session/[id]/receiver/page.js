'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { connectToPeer, destroyPeer } from '@/lib/peer'
import { EVENTS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'

export default function ReceiverPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [status, setStatus] = useState('connecting') // connecting|connected|ended|error
  const [errorMsg, setErrorMsg] = useState('')
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 })
  const [cmdLog, setCmdLog] = useState([])
  const [showUI, setShowUI] = useState(true)

  const peerRef = useRef(null)
  const connRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)

  const addLog = useCallback((entry) => {
    setCmdLog(prev => [...prev.slice(-19), { ...entry, ts: formatTime(), id: Date.now() + Math.random() }])
  }, [])

  // Simulate events received from controller
  const handleEvent = useCallback((data) => {
    if (!data?.type) return

    switch (data.type) {
      case EVENTS.CURSOR_MOVE: {
        const x = Math.max(0, Math.min(1, data.x)) * window.innerWidth
        const y = Math.max(0, Math.min(1, data.y)) * window.innerHeight
        setCursorPos({ x, y })
        break
      }
      case EVENTS.CLICK: {
        const sx = data.x * window.innerWidth
        const sy = data.y * window.innerHeight
        const el = document.elementFromPoint(sx, sy)
        if (el) {
          if (data.clickType === 'dblclick') el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
          else el.click()
        }
        addLog({ type: 'mouse', action: `${data.clickType || 'click'} (${Math.round(sx)},${Math.round(sy)})` })
        break
      }
      case EVENTS.SCROLL: {
        window.scrollBy({ left: data.deltaX || 0, top: data.deltaY || 0, behavior: 'auto' })
        addLog({ type: 'mouse', action: `scroll (${data.deltaX},${data.deltaY})` })
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
      case EVENTS.VOICE_COMMAND: {
        addLog({ type: 'voice', action: data.command })
        break
      }
      case EVENTS.PING: {
        connRef.current?.send({ type: EVENTS.PONG, t: data.t })
        break
      }
      default: break
    }
  }, [addLog])

  useEffect(() => {
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      setErrorMsg('Invalid session ID'); setStatus('error'); return
    }

    let mounted = true

    const init = async () => {
      try {
        const peer = await connectToPeer(sessionId)
        if (!mounted) { peer.destroy(); return }
        peerRef.current = peer

        // Connect data channel to controller (controller's peer ID = sessionId)
        const conn = peer.connect(sessionId, { reliable: true, serialization: 'json' })
        connRef.current = conn

        conn.on('open', () => {
          if (!mounted) return
          setStatus('connected')
        })

        conn.on('data', (data) => {
          if (!mounted) return
          handleEvent(data)
        })

        conn.on('close', () => { if (mounted) setStatus('ended') })
        conn.on('error', (err) => {
          if (!mounted) return
          setErrorMsg('Connection error')
          setStatus('error')
        })

        // Receive screen share video from controller
        peer.on('call', (call) => {
          call.answer() // No stream from receiver side
          call.on('stream', (remoteStream) => {
            if (videoRef.current) videoRef.current.srcObject = remoteStream
          })
        })

        peer.on('error', (err) => {
          if (!mounted) return
          if (err.type === 'peer-unavailable') {
            setErrorMsg('Session not found — make sure the controller is open first.')
          } else {
            setErrorMsg('Connection error: ' + err.type)
          }
          setStatus('error')
        })

        // Timeout if no connection in 20s
        setTimeout(() => {
          if (mounted && status === 'connecting') {
            setErrorMsg('Could not reach controller. Make sure the controller is open.')
            setStatus('error')
          }
        }, 20000)

      } catch (err) {
        if (!mounted) return
        setErrorMsg(err.message === 'TIMEOUT' ? 'Connection timeout. Check your internet.' : 'Could not connect: ' + err.message)
        setStatus('error')
      }
    }

    init()
    return () => { mounted = false; destroyPeer() }
  }, [sessionId, handleEvent])

  // Auto-hide UI
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

  if (status === 'connecting') return (
    <Screen icon="🔗" title="Connecting to controller..." message="Make sure the controller page is open on the other device." />
  )
  if (status === 'error') return (
    <Screen icon="⚠️" title="Connection Failed" message={errorMsg} action={{ label: 'Back to Home', onClick: () => router.push('/') }} />
  )
  if (status === 'ended') return (
    <Screen icon="🔌" title="Session Ended" message="The controller disconnected." action={{ label: 'Back to Home', onClick: () => router.push('/') }} />
  )

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Screen share video */}
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
          <button onClick={() => { destroyPeer(); router.push('/') }} className="text-red-400/70 hover:text-red-400 transition-colors">
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
