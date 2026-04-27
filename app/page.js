'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateSessionId, getSessionUrl, copyToClipboard, shortId } from '@/lib/utils'
import QRPairing from '@/components/ui/QRPairing'

export default function LandingPage() {
  const router = useRouter()
  const [sessionUrl, setSessionUrl] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [joinId, setJoinId] = useState('')
  const [copied, setCopied] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const inputRef = useRef(null)

  const handleCreate = () => {
    setCreating(true)
    const id = generateSessionId()
    setSessionId(id)
    const url = getSessionUrl(id, 'receiver')
    setSessionUrl(url)
    setShowQR(true)
    setCreating(false)
  }

  const handleGoController = () => {
    if (!sessionId) return
    router.push(`/session/${sessionId}/controller`)
  }

  const handleJoin = () => {
    const cleaned = joinId.trim().toLowerCase()
    if (!cleaned) {
      setJoinError('Please enter a session ID or paste a link')
      return
    }
    // Support both UUID and full URL
    const uuidMatch = cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
    if (!uuidMatch) {
      setJoinError('Invalid session ID format')
      return
    }
    setJoinError('')
    router.push(`/session/${uuidMatch[1]}/receiver`)
  }

  const handleCopy = async () => {
    await copyToClipboard(sessionUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-violet-400 border border-violet-500/20 bg-violet-500/5 mb-6">
          <span className="status-dot connected" />
          WebRTC · Voice · Gesture · Eye Tracking
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-4"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            RemoteX
          </span>
        </h1>
        <p className="text-text-secondary text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
          Control any device remotely from your browser.<br />
          No installs. No accounts. Just connect.
        </p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">

        {/* Create Session */}
        <div className="glass-card glass-card-hover p-8 flex flex-col gap-6">
          <div>
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-2xl mb-4">
              🖥️
            </div>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-2"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Create Session
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              This device becomes the <strong className="text-violet-400">controller</strong>. 
              Share the QR code or link with the device you want to control.
            </p>
          </div>

          {!showQR ? (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-glow w-full py-3 px-6 rounded-xl text-white font-semibold text-sm transition-all"
            >
              {creating ? '⏳ Generating...' : '✨ Create New Session'}
            </button>
          ) : (
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* QR Code */}
              <div className="flex justify-center">
                <QRPairing url={sessionUrl} size={160} />
              </div>

              {/* Session ID */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-elevated border border-violet-500/10">
                <span className="session-badge flex-shrink-0">{shortId(sessionId)}</span>
                <input
                  readOnly
                  value={sessionUrl}
                  className="flex-1 bg-transparent text-xs text-text-secondary font-mono truncate outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
                    color: copied ? '#22C55E' : '#A5B4FC',
                    border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.2)'}`,
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* Go to controller */}
              <button
                onClick={handleGoController}
                className="btn-glow w-full py-3 px-6 rounded-xl text-white font-semibold text-sm"
              >
                🎮 Open Controller Dashboard
              </button>

              <button
                onClick={() => { setShowQR(false); setSessionId(''); setSessionUrl('') }}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors text-center"
              >
                Start over
              </button>
            </div>
          )}
        </div>

        {/* Join Session */}
        <div className="glass-card glass-card-hover p-8 flex flex-col gap-6">
          <div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-2xl mb-4">
              📱
            </div>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-2"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Join Session
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              This device becomes the <strong className="text-cyan-400">receiver</strong> (controlled device).
              Enter the session ID or paste the link from the controller.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <input
              ref={inputRef}
              value={joinId}
              onChange={(e) => { setJoinId(e.target.value); setJoinError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Paste session ID or URL..."
              className="w-full px-4 py-3 rounded-xl text-sm font-mono text-text-primary placeholder-text-muted outline-none transition-all"
              style={{
                background: 'rgba(13,17,23,0.8)',
                border: joinError ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(34,211,238,0.2)',
                boxShadow: joinError ? '0 0 12px rgba(239,68,68,0.1)' : 'none',
              }}
            />
            {joinError && (
              <p className="text-xs text-red-400 animate-fade-in">{joinError}</p>
            )}

            <button
              onClick={handleJoin}
              className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(99,102,241,0.2))',
                border: '1px solid rgba(34,211,238,0.3)',
                color: '#22D3EE',
                boxShadow: '0 0 20px rgba(34,211,238,0.1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 30px rgba(34,211,238,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(34,211,238,0.1)' }}
            >
              🔗 Join Session
            </button>
          </div>

          {/* Features */}
          <div className="mt-auto pt-4 border-t border-white/5">
            <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wider">Features</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '🖱️', label: 'Mouse & Keyboard' },
                { icon: '🎤', label: 'Voice Commands' },
                { icon: '✋', label: 'Hand Gestures' },
                { icon: '👁️', label: 'Eye Tracking' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-text-muted text-center">
        No accounts. No data stored. Peer-to-peer via WebRTC. Session expires in 30 min.
      </p>
    </main>
  )
}
