'use client'

import { useState, useCallback } from 'react'

// 4-corner calibration points for gesture
const GESTURE_CORNERS = [
  { id: 'tl', label: 'Top-Left',     style: { top: '10%', left: '10%' } },
  { id: 'tr', label: 'Top-Right',    style: { top: '10%', right: '10%' } },
  { id: 'bl', label: 'Bottom-Left',  style: { bottom: '10%', left: '10%' } },
  { id: 'br', label: 'Bottom-Right', style: { bottom: '10%', right: '10%' } },
]

// 9-point grid for eye tracking
function buildEyePoints() {
  const points = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      points.push({
        id: `${row}-${col}`,
        style: {
          top: `${15 + row * 35}%`,
          left: `${15 + col * 35}%`,
        },
      })
    }
  }
  return points
}

export default function CalibrationModal({ mode = 'gesture', onComplete, onSkip }) {
  const [phase, setPhase] = useState(0)  // index into points array
  const [data, setData] = useState({})   // pointId → hand landmark position
  const [done, setDone] = useState(false)
  const [instruction, setInstruction] = useState('')

  const points = mode === 'gesture' ? GESTURE_CORNERS : buildEyePoints()
  const current = points[phase]

  const gestureInstruction = mode === 'gesture'
    ? `Move your index finger to the ${current?.label || ''} and hold a pinch for 1 second`
    : `Look at the dot and click it`

  const handlePointDone = useCallback((pointId, value) => {
    const nextData = { ...data, [pointId]: value || true }
    setData(nextData)

    if (phase < points.length - 1) {
      setPhase((p) => p + 1)
    } else {
      setDone(true)
      setTimeout(() => onComplete?.(nextData), 800)
    }
  }, [data, phase, points.length, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,11,20,0.9)', backdropFilter: 'blur(12px)' }}>

      {!done ? (
        <>
          {/* Instructions overlay */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center z-10">
            <div className="glass-card px-6 py-4">
              <p className="text-sm text-text-secondary mb-1">
                {mode === 'gesture' ? '✋ Gesture Calibration' : '👁️ Eye Tracking Calibration'}
              </p>
              <p className="text-text-primary font-medium text-sm">{gestureInstruction}</p>
              <p className="text-text-muted text-xs mt-2">
                Point {phase + 1} of {points.length}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="absolute top-0 left-0 w-full h-1"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${((phase) / points.length) * 100}%`,
                background: 'linear-gradient(90deg, #6366F1, #22D3EE)',
              }}
            />
          </div>

          {/* Calibration points */}
          {points.map((point, i) => (
            <button
              key={point.id}
              onClick={() => i === phase && handlePointDone(point.id)}
              className="absolute calib-dot"
              style={{
                ...point.style,
                opacity: i === phase ? 1 : i < phase ? 0.3 : 0.15,
                cursor: i === phase ? 'crosshair' : 'default',
                transform: i === phase ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, -50%)',
                boxShadow: i === phase ? '0 0 24px rgba(99,102,241,0.8)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {i < phase && (
                <span className="text-green-400 text-xs font-bold">✓</span>
              )}
            </button>
          ))}

          {/* Skip button */}
          <button
            onClick={onSkip}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip calibration
          </button>
        </>
      ) : (
        <div className="glass-card p-8 text-center animate-slide-up">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="font-display text-xl font-semibold text-text-primary mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Calibration Complete!
          </h3>
          <p className="text-sm text-text-secondary">Tracking accuracy optimized for your setup.</p>
        </div>
      )}
    </div>
  )
}
