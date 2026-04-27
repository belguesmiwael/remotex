'use client'

import { GESTURE } from '@/lib/constants'
import { lerp, clamp, distance2D } from '@/lib/utils'

/**
 * GestureMapper — maps normalized hand positions to screen coordinates
 * Handles smoothing, dead zone, and calibration offsets
 */
export class GestureMapper {
  constructor() {
    this.prevX = 0
    this.prevY = 0
    this.calibration = null  // { minX, maxX, minY, maxY } from calibration
  }

  /**
   * Map normalized hand position (0–1) to screen pixel coordinates
   * @param {number} nx - normalized x (0–1, from MediaPipe)
   * @param {number} ny - normalized y (0–1, from MediaPipe)
   * @returns {{ screenX: number, screenY: number, moved: boolean }}
   */
  map(nx, ny) {
    let x = nx
    let y = ny

    // Apply calibration if available
    if (this.calibration) {
      const { minX, maxX, minY, maxY } = this.calibration
      x = (x - minX) / Math.max(maxX - minX, 0.001)
      y = (y - minY) / Math.max(maxY - minY, 0.001)
    }

    // Clamp to [0, 1]
    x = clamp(x, 0, 1)
    y = clamp(y, 0, 1)

    // Apply smoothing (lerp)
    const smoothX = lerp(this.prevX, x, GESTURE.SMOOTHING)
    const smoothY = lerp(this.prevY, y, GESTURE.SMOOTHING)

    // Convert to screen pixels
    const screenX = smoothX * window.innerWidth
    const screenY = smoothY * window.innerHeight

    const prevScreenX = this.prevX * window.innerWidth
    const prevScreenY = this.prevY * window.innerHeight

    // Dead zone check
    const moved = Math.abs(screenX - prevScreenX) >= GESTURE.DEAD_ZONE ||
                  Math.abs(screenY - prevScreenY) >= GESTURE.DEAD_ZONE

    this.prevX = smoothX
    this.prevY = smoothY

    return { screenX, screenY, normX: smoothX, normY: smoothY, moved }
  }

  /**
   * Set calibration from 4-corner data
   * @param {object} corners - { tl, tr, bl, br } each { x, y }
   */
  calibrate(corners) {
    if (!corners.tl || !corners.tr || !corners.bl || !corners.br) return

    this.calibration = {
      minX: Math.min(corners.tl.x, corners.bl.x),
      maxX: Math.max(corners.tr.x, corners.br.x),
      minY: Math.min(corners.tl.y, corners.tr.y),
      maxY: Math.max(corners.bl.y, corners.br.y),
    }
  }

  reset() {
    this.prevX = 0
    this.prevY = 0
    this.calibration = null
  }
}

/**
 * Detect pinch gesture — distance between thumb tip (4) and index tip (8)
 * @param {Array} landmarks - MediaPipe hand landmarks [{x, y, z}]
 * @returns {{ isPinch: boolean, distance: number }}
 */
export function detectPinch(landmarks) {
  if (!landmarks || landmarks.length < 9) return { isPinch: false, distance: Infinity }

  const thumbTip = landmarks[4]
  const indexTip = landmarks[8]

  // MediaPipe landmarks are normalized (0–1) — scale to pixel space
  const scale = Math.max(window.innerWidth, window.innerHeight)
  const dist = distance2D(
    { x: thumbTip.x * scale, y: thumbTip.y * scale },
    { x: indexTip.x * scale, y: indexTip.y * scale }
  )

  return { isPinch: dist < GESTURE.PINCH_THRESHOLD, distance: dist }
}

/**
 * Detect two-finger swipe (index + middle extended)
 * Returns direction: 'up' | 'down' | null
 */
export function detectTwoFingerSwipe(landmarks, prevLandmarks) {
  if (!landmarks || !prevLandmarks) return null

  const indexNow = landmarks[8]
  const middleNow = landmarks[12]
  const indexPrev = prevLandmarks[8]
  const middlePrev = prevLandmarks[12]

  if (!indexNow || !middleNow || !indexPrev || !middlePrev) return null

  const dy = ((indexNow.y + middleNow.y) / 2) - ((indexPrev.y + middlePrev.y) / 2)

  if (Math.abs(dy) < 0.02) return null  // too small to count
  return dy > 0 ? 'down' : 'up'
}

/**
 * Detect fist — all fingertips below their corresponding MCP joints
 */
export function detectFist(landmarks) {
  if (!landmarks || landmarks.length < 21) return false

  const fingerTips = [8, 12, 16, 20]    // index, middle, ring, pinky tips
  const fingerMcps = [5, 9, 13, 17]     // corresponding MCP (knuckle) joints

  return fingerTips.every((tipIdx, i) => {
    return landmarks[tipIdx].y > landmarks[fingerMcps[i]].y
  })
}
