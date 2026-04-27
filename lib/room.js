'use client'

// Trystero/Nostr — P2P via decentralized Nostr relays
// Zero account needed, multiple public relay fallbacks

const APP_ID = 'remotex-v2'

let roomInstance = null

/**
 * Join a room (both controller and receiver call this with the same sessionId)
 * Returns the trystero room object
 */
export async function joinRoom(sessionId) {
  if (roomInstance) {
    roomInstance.leave()
    roomInstance = null
  }

  const { joinRoom: trysteroJoin } = await import('trystero/nostr')

  const room = trysteroJoin(
    {
      appId: APP_ID,
      // Use well-known reliable relays explicitly
      relayUrls: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social',
        'wss://nostr.wine',
      ],
    },
    sessionId
  )

  roomInstance = room
  return room
}

export function leaveRoom() {
  if (roomInstance) {
    roomInstance.leave()
    roomInstance = null
  }
}
