'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSocket } from '@/lib/socket'
import { EVENTS } from '@/lib/constants'
import Dashboard from '@/components/ui/Dashboard'

export default function ControllerPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id

  const [connectionStatus, setConnectionStatus] = useState('waiting')  // waiting | connected | disconnected | error
  const [errorMsg, setErrorMsg] = useState('')
  const socketRef = useRef(null)

  useEffect(() => {
    if (!sessionId) {
      router.push('/')
      return
    }

    // Validate session ID format
    if (!/^[a-f0-9\-]{36}$/i.test(sessionId)) {
      setErrorMsg('Invalid session ID')
      return
    }

    const socket = getSocket()
    socketRef.current = socket

    const onConnect = () => {
      socket.emit(EVENTS.CREATE_SESSION, sessionId)
    }

    const onSessionCreated = (data) => {
      console.log('[Controller] Session created:', data.sessionId)
      setConnectionStatus('waiting')
    }

    const onSessionReady = () => {
      console.log('[Controller] Session ready — receiver joined')
      setConnectionStatus('connected')
    }

    const onPeerDisconnected = () => {
      setConnectionStatus('waiting')
    }

    const onSessionEnded = () => {
      setConnectionStatus('disconnected')
    }

    const onError = (data) => {
      setErrorMsg(data?.message || 'Unknown error')
      setConnectionStatus('error')
    }

    const onDisconnect = (reason) => {
      setConnectionStatus('disconnected')
    }

    const onPing = (data) => {
      socket.emit(EVENTS.PONG, data)
    }

    if (socket.connected) {
      onConnect()
    } else {
      socket.on('connect', onConnect)
    }

    socket.on(EVENTS.SESSION_CREATED, onSessionCreated)
    socket.on(EVENTS.SESSION_READY, onSessionReady)
    socket.on(EVENTS.PEER_DISCONNECTED, onPeerDisconnected)
    socket.on(EVENTS.SESSION_ENDED, onSessionEnded)
    socket.on(EVENTS.ERROR, onError)
    socket.on('disconnect', onDisconnect)
    socket.on(EVENTS.PING, onPing)

    return () => {
      socket.off('connect', onConnect)
      socket.off(EVENTS.SESSION_CREATED, onSessionCreated)
      socket.off(EVENTS.SESSION_READY, onSessionReady)
      socket.off(EVENTS.PEER_DISCONNECTED, onPeerDisconnected)
      socket.off(EVENTS.SESSION_ENDED, onSessionEnded)
      socket.off(EVENTS.ERROR, onError)
      socket.off('disconnect', onDisconnect)
      socket.off(EVENTS.PING, onPing)
    }
  }, [sessionId, router])

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-card p-8 text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Connection Error
          </h2>
          <p className="text-sm text-text-secondary mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-card p-10 text-center max-w-sm animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            ⏳
          </div>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Waiting for receiver...
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            Share this link or QR code with the device you want to control.
          </p>

          <div className="flex items-center gap-2 p-3 rounded-xl mb-6"
            style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <span className="font-mono text-xs text-violet-400 flex-1 truncate">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/session/${sessionId}/receiver`
                : '...'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <span className="status-dot waiting" />
            Listening for connections...
          </div>

          <button
            onClick={() => router.push('/')}
            className="mt-6 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-card p-8 text-center max-w-sm">
          <div className="text-4xl mb-4">🔌</div>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Session Ended
          </h2>
          <p className="text-sm text-text-secondary mb-6">The receiver disconnected.</p>
          <button
            onClick={() => router.push('/')}
            className="btn-glow px-6 py-2.5 rounded-xl text-white text-sm font-medium"
          >
            New Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      socket={socketRef.current}
      sessionId={sessionId}
      connectionStatus={connectionStatus}
    />
  )
}
