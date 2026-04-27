'use strict'

const { mouse, keyboard, Button, Key, straightTo, centerOf } = require('@nut-tree-fork/nut-js')

// Configure nut-js speed
mouse.config.mouseSpeed = 2000   // pixels/sec — fast, instant feel
keyboard.config.autoDelayMs = 0  // no delay between keystrokes

/**
 * Move mouse to absolute screen position (pixels)
 */
async function moveMouse(x, y) {
  try {
    await mouse.setPosition({ x: Math.round(x), y: Math.round(y) })
  } catch (err) {
    // Ignore — can happen if coords are out of bounds
  }
}

/**
 * Click at current position or given coords
 * @param {'left'|'right'|'middle'} button
 * @param {'single'|'double'} type
 */
async function click(button = 'left', type = 'single') {
  try {
    const btn = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT
    if (type === 'double') {
      await mouse.doubleClick(btn)
    } else {
      await mouse.click(btn)
    }
  } catch (err) {
    console.error('[Input] Click error:', err.message)
  }
}

/**
 * Scroll wheel
 * @param {number} deltaX - horizontal scroll
 * @param {number} deltaY - vertical scroll
 */
async function scroll(deltaX, deltaY) {
  try {
    if (deltaY !== 0) {
      const lines = Math.round(Math.abs(deltaY) / 100)
      if (deltaY > 0) await mouse.scrollDown(lines || 1)
      else await mouse.scrollUp(lines || 1)
    }
    if (deltaX !== 0) {
      const lines = Math.round(Math.abs(deltaX) / 100)
      if (deltaX > 0) await mouse.scrollRight(lines || 1)
      else await mouse.scrollLeft(lines || 1)
    }
  } catch (err) {
    console.error('[Input] Scroll error:', err.message)
  }
}

/**
 * Press a key
 * @param {string} key - JS KeyboardEvent.key value
 * @param {boolean} ctrlKey
 * @param {boolean} shiftKey
 * @param {boolean} altKey
 */
async function pressKey(key, ctrlKey, shiftKey, altKey) {
  try {
    const modifiers = []
    if (ctrlKey) modifiers.push(Key.LeftControl)
    if (shiftKey) modifiers.push(Key.LeftShift)
    if (altKey) modifiers.push(Key.LeftAlt)

    const mapped = mapKey(key)
    if (!mapped) return

    if (modifiers.length > 0) {
      await keyboard.pressKey(...modifiers, mapped)
      await keyboard.releaseKey(...modifiers, mapped)
    } else {
      await keyboard.pressKey(mapped)
      await keyboard.releaseKey(mapped)
    }
  } catch (err) {
    // Unmapped keys — ignore
  }
}

/**
 * Type a string of text
 */
async function typeText(text) {
  try {
    await keyboard.type(String(text).slice(0, 500)) // Limit length
  } catch (err) {
    console.error('[Input] Type error:', err.message)
  }
}

/**
 * Drag from one position to another
 */
async function drag(fromX, fromY, toX, toY) {
  try {
    await mouse.setPosition({ x: Math.round(fromX), y: Math.round(fromY) })
    await mouse.pressButton(Button.LEFT)
    await mouse.setPosition({ x: Math.round(toX), y: Math.round(toY) })
    await mouse.releaseButton(Button.LEFT)
  } catch (err) {
    console.error('[Input] Drag error:', err.message)
  }
}

/**
 * Map JS KeyboardEvent.key → nut-js Key enum
 */
function mapKey(jsKey) {
  const map = {
    'Enter': Key.Return,
    'Backspace': Key.Backspace,
    'Delete': Key.Delete,
    'Tab': Key.Tab,
    'Escape': Key.Escape,
    'Space': Key.Space,
    ' ': Key.Space,
    'ArrowUp': Key.Up,
    'ArrowDown': Key.Down,
    'ArrowLeft': Key.Left,
    'ArrowRight': Key.Right,
    'Home': Key.Home,
    'End': Key.End,
    'PageUp': Key.PageUp,
    'PageDown': Key.PageDown,
    'F1': Key.F1, 'F2': Key.F2, 'F3': Key.F3, 'F4': Key.F4,
    'F5': Key.F5, 'F6': Key.F6, 'F7': Key.F7, 'F8': Key.F8,
    'F9': Key.F9, 'F10': Key.F10, 'F11': Key.F11, 'F12': Key.F12,
    'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E,
    'f': Key.F, 'g': Key.G, 'h': Key.H, 'i': Key.I, 'j': Key.J,
    'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N, 'o': Key.O,
    'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T,
    'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y,
    'z': Key.Z,
    '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3,
    '4': Key.Num4, '5': Key.Num5, '6': Key.Num6, '7': Key.Num7,
    '8': Key.Num8, '9': Key.Num9,
  }

  // Handle uppercase letters
  const lower = jsKey.toLowerCase()
  return map[jsKey] || map[lower] || null
}

module.exports = { moveMouse, click, scroll, pressKey, typeText, drag }
