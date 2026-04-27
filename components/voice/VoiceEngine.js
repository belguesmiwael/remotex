'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { EVENTS, VOICE } from '@/lib/constants'
import { parseCommand, createDefaultContext } from './CommandParser'

/**
 * VoiceEngine — Web Speech API integration
 * Listens continuously and parses commands
 */
export default function VoiceEngine({
  socket,
  sessionId,
  active,
  lang = VOICE.LANG_DEFAULT,
  lastCursorPos,
  onCommand,
}) {
  const recognitionRef = useRef(null)
  const [lastBadge, setLastBadge] = useState(null)  // { label, ts }
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(true)

  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return null
    }

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = lang
    rec.maxAlternatives = 3

    rec.onstart = () => setIsListening(true)
    rec.onend = () => {
      setIsListening(false)
      // Auto-restart if still active
      if (active) {
        try { rec.start() } catch { /* already started */ }
      }
    }

    rec.onresult = (event) => {
      const results = Array.from(event.results).slice(event.resultIndex)
      for (const result of results) {
        if (!result.isFinal) continue
        const transcript = result[0].transcript
        const confidence = result[0].confidence || 1

        const ctx = createDefaultContext(lastCursorPos?.current || { x: 0, y: 0 })
        const parsed = parseCommand(transcript, ctx, confidence)

        if (parsed.matched) {
          // Execute locally
          parsed.action?.()

          // Relay to receiver via socket
          socket?.emit(EVENTS.VOICE_COMMAND, {
            sessionId,
            command: parsed.label,
            transcript,
          })

          setLastBadge({ label: parsed.label, ts: Date.now() })
          onCommand?.({ type: 'voice', action: parsed.label })
        } else {
          // Show unrecognized transcript
          setLastBadge({ label: `? ${transcript}`, ts: Date.now(), unknown: true })
        }
      }
    }

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('[VoiceEngine] Recognition error:', event.error)
    }

    return rec
  }, [active, lang, socket, sessionId, lastCursorPos, onCommand])

  useEffect(() => {
    if (!active) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    const rec = initRecognition()
    if (!rec) return
    recognitionRef.current = rec

    try {
      rec.start()
    } catch (err) {
      console.error('[VoiceEngine] Start failed:', err.message)
    }

    return () => {
      try { rec.stop() } catch { /* ignore */ }
    }
  }, [active, initRecognition])

  if (!active) return null

  return (
    <div className="flex flex-col gap-2 items-start">
      {!supported && (
        <div className="text-xs text-red-400 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ Speech Recognition not supported in this browser
        </div>
      )}

      {supported && (
        <div className="flex items-center gap-2">
          <span
            className="status-dot"
            style={{ background: isListening ? '#22C55E' : '#6B7280' }}
          />
          <span className="text-xs text-text-secondary font-mono">
            {isListening ? 'Listening...' : 'Starting...'}
          </span>
        </div>
      )}

      {lastBadge && (
        <div
          key={lastBadge.ts}
          className="voice-badge animate-fade-in"
          style={{
            color: lastBadge.unknown ? '#F59E0B' : '#A5B4FC',
            borderColor: lastBadge.unknown ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)',
            background: lastBadge.unknown ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.15)',
          }}
        >
          <span>{lastBadge.unknown ? '❓' : '🎤'}</span>
          <span>{lastBadge.label}</span>
        </div>
      )}

      {/* Language selector */}
      <select
        defaultValue={lang}
        onChange={(e) => {
          if (recognitionRef.current) {
            recognitionRef.current.lang = e.target.value
          }
        }}
        className="text-xs bg-transparent border border-white/10 rounded-md px-2 py-1 text-text-secondary outline-none"
      >
        <option value="en-US">🇺🇸 English</option>
        <option value="fr-FR">🇫🇷 Français</option>
        <option value="ar-SA">🇸🇦 العربية</option>
        <option value="de-DE">🇩🇪 Deutsch</option>
        <option value="es-ES">🇪🇸 Español</option>
      </select>
    </div>
  )
}
