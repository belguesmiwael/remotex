'use client'

import { useEffect, useRef } from 'react'

export default function QRPairing({ url, size = 200 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!url || !canvasRef.current) return

    // Dynamic import to avoid SSR issues
    import('qrcode').then((QRCode) => {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      }).catch((err) => {
        console.error('[QRPairing] Failed to generate QR:', err)
      })
    })
  }, [url, size])

  if (!url) return null

  return (
    <div className="qr-container">
      <canvas ref={canvasRef} width={size} height={size} />
    </div>
  )
}
