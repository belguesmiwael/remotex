'use client'

// Trystero/Torrent — P2P signaling via BitTorrent WebSocket trackers
// These trackers handle millions of peers 24/7 — never blocked, no accounts
// Same technology used by WebTorrent (30M+ users)

const APP_ID = 'remotex-v4'

let roomInstance = null

export async function joinRoom(sessionId) {
  if (roomInstance) {
    try { roomInstance.leave() } catch {}
    roomInstance = null
  }

  const { joinRoom: trysteroJoin } = await import('trystero/torrent')

  const room = trysteroJoin(
    {
      appId: APP_ID,
      // Public BitTorrent WebSocket trackers — extremely reliable
      relayUrls: [
        'wss://tracker.webtorrent.dev',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz',
      ],
    },
    sessionId
  )

  roomInstance = room
  return room
}

export function leaveRoom() {
  if (roomInstance) {
    try { roomInstance.leave() } catch {}
    roomInstance = null
  }
}
