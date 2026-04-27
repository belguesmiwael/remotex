'use client'

import { useEffect, useRef, useState } from 'react'

const WEBGAZER_CDN = 'https://webgazer.cs.brown.edu/webgazer.js'

/**
 * EyeTracker — optional WebGazer.js wrapper
 * Disabled by default (CPU-intensive)
 */
export default function EyeTracker({ active, onGaze, onCommand }) {
  const [status, setStatus] = useState('idle')  // idle | loading | calibrating | active | error
  const [calibPoints, setCalibPoints] = useState(0)  // 0-9
  const gazeRef = useRef(null)
  const scriptRef = useRef(null)

  const loadWebGazer = () => {
    return new Promise((resolve, reject) => {
      if (window.webgazer) { resolve(window.webgazer); return }

      const script = document.createElement('script')
      script.src = WEBGAZER_CDN
      script.async = true
      script.onload = () => {
        if (window.webgazer) resolve(window.webgazer)
        else reject(new Error('WebGazer not loaded'))
      }
      script.onerror = () => reject(new Error('Failed to load WebGazer'))
      document.head.appendChild(script)
      scriptRef.current = script
    })
  }

  useEffect(() => {
    if (!active) {
      // Stop WebGazer
      if (window.webgazer) {
        try {
          window.webgazer.end()
          window.webgazer.clearData()
        } catch { /* ignore */ }
      }
      setStatus('idle')
      setCalibPoints(0)
      return
    }

    let isMounted = true

    const init = async () => {
      try {
        setStatus('loading')
        const wg = await loadWebGazer()
        if (!isMounted) return

        wg.setRegression('ridge')
        wg.showVideoPreview(false)
        wg.showPredictionPoints(false)

        wg.setGazeListener((data, elapsedTime) => {
          if (!data || !isMounted) return
          gazeRef.current = data

          // Move cursor to gaze position
          const x = Math.max(0, Math.min(window.innerWidth, data.x))
          const y = Math.max(0, Math.min(window.innerHeight, data.y))

          onGaze?.({ x, y })
        })

        await wg.begin()

        if (isMounted) {
          setStatus('calibrating')
        }
      } catch (err) {
        console.error('[EyeTracker] Init failed:', err)
        if (isMounted) setStatus('error')
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [active, onGaze])

  const handleCalibClick = (dotId) => {
    setCalibPoints((n) => {
      const next = n + 1
      if (next >= 9) {
        setStatus('active')
        onCommand?.({ type: 'eyetrack', action: 'calibration complete' })
      }
      return next
    })
  }

  // 9-point calibration grid
  const calibDots = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    style: {
      top: `${10 + Math.floor(i / 3) * 40}%`,
      left: `${10 + (i % 3) * 40}%`,
    },
  }))

  if (!active) return null

  return (
    <>
      {status === 'calibrating' && (
        <div className="fixed inset-0 z-40"
          style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center z-10">
            <div className="glass-card px-6 py-4">
              <p className="text-sm font-medium text-text-primary mb-1">👁️ Eye Tracking Calibration</p>
              <p className="text-xs text-text-secondary">Look at each dot and click it. {calibPoints}/9 done.</p>
            </div>
          </div>

          {calibDots.map((dot) => (
            <button
              key={dot.id}
              onClick={() => handleCalibClick(dot.id)}
              disabled={calibPoints > dot.id}
              className="calib-dot absolute"
              style={{
                ...dot.style,
                transform: 'translate(-50%, -50%)',
                opacity: calibPoints > dot.id ? 0.4 : 1,
              }}
            >
              {calibPoints > dot.id && <span className="text-green-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-text-secondary">
        {status === 'loading' && <><span className="status-dot waiting" /> Loading WebGazer...</>}
        {status === 'calibrating' && <><span className="status-dot waiting" /> Calibrating... ({calibPoints}/9)</>}
        {status === 'active' && <><span className="status-dot connected" /> Eye tracking active</>}
        {status === 'error' && <span className="text-red-400">⚠️ Eye tracking unavailable</span>}
      </div>
    </>
  )
}
