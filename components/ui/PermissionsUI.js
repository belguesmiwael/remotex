'use client'

import { useState } from 'react'

const PERMISSION_STEPS = [
  {
    id: 'mic',
    icon: '🎤',
    title: 'Microphone',
    subtitle: 'Required for Voice Commands',
    description: 'RemoteX uses your microphone to detect voice commands like "scroll down", "click", "go back" and more. Your audio is processed locally and never sent to any server.',
    constraint: { audio: true },
    optional: true,
  },
  {
    id: 'camera',
    icon: '📷',
    title: 'Camera',
    subtitle: 'Required for Hand Gesture & Eye Tracking',
    description: 'Your webcam is used locally for hand gesture detection (MediaPipe) and optional eye tracking (WebGazer). Video never leaves your device.',
    constraint: { video: { width: 640, height: 480, facingMode: 'user' } },
    optional: true,
  },
  {
    id: 'screen',
    icon: '🖥️',
    title: 'Screen Sharing',
    subtitle: 'Required for Remote Screen View',
    description: 'Allows the receiver device to see your screen in real time via a direct peer-to-peer WebRTC connection. No intermediary servers see your screen.',
    type: 'display',
    optional: true,
  },
]

export default function PermissionsUI({ onComplete, onSkip }) {
  const [step, setStep] = useState(0)
  const [granted, setGranted] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [streams, setStreams] = useState({})

  const current = PERMISSION_STEPS[step]
  const isLast = step === PERMISSION_STEPS.length - 1

  const handleAllow = async () => {
    setLoading(true)
    setError('')
    try {
      let stream
      if (current.type === 'display') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      } else {
        stream = await navigator.mediaDevices.getUserMedia(current.constraint)
      }
      // Store streams for later use
      setStreams((prev) => ({ ...prev, [current.id]: stream }))
      setGranted((prev) => ({ ...prev, [current.id]: true }))
      advance(stream)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permission denied. You can grant it later in settings.')
      } else {
        setError(err.message || 'Could not access device')
      }
    } finally {
      setLoading(false)
    }
  }

  const advance = (stream) => {
    const allStreams = { ...streams, [current.id]: stream }
    if (isLast) {
      onComplete?.(granted, allStreams)
    } else {
      setStep((s) => s + 1)
      setError('')
    }
  }

  const handleSkip = () => {
    if (isLast) {
      onComplete?.(granted, streams)
    } else {
      setStep((s) => s + 1)
      setError('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="glass-card p-8 w-full max-w-md animate-slide-up">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {PERMISSION_STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{
                background: i <= step
                  ? 'linear-gradient(90deg, #6366F1, #22D3EE)'
                  : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-6 mx-auto"
          style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
          {current.icon}
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h3 className="font-display text-xl font-semibold text-text-primary mb-1"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {current.title}
          </h3>
          <p className="text-sm text-violet-400 mb-4">{current.subtitle}</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Granted indicators */}
        {Object.keys(granted).length > 0 && (
          <div className="flex gap-2 justify-center mb-4">
            {Object.entries(granted).map(([id, ok]) => (
              ok && (
                <span key={id} className="text-xs px-2 py-1 rounded-full text-green-400"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  ✓ {id}
                </span>
              )
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-400 animate-fade-in"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleAllow}
            disabled={loading}
            className="btn-glow w-full py-3 px-6 rounded-xl text-white font-semibold text-sm"
          >
            {loading ? '⏳ Requesting...' : `Allow ${current.title}`}
          </button>

          {current.optional && (
            <button
              onClick={handleSkip}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip for now
            </button>
          )}
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          Step {step + 1} of {PERMISSION_STEPS.length}
        </p>
      </div>
    </div>
  )
}
