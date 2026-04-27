'use client'

// PeerJS P2P signaling — uses peerjs.com free cloud server
// Peer ID = sessionId with hyphens removed (safer for PeerJS)

export function safePeerId(sessionId) {
  // Remove hyphens — PeerJS is more reliable with alphanumeric-only IDs
  return 'rx' + sessionId.replace(/-/g, '')
}

async function loadPeer() {
  const { default: Peer } = await import('peerjs')
  return Peer
}

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
}

/**
 * Controller: create a peer with peerId = safePeerId(sessionId)
 * Retries up to 3 times if ID is temporarily unavailable
 */
export function createPeer(sessionId) {
  return new Promise(async (resolve, reject) => {
    const Peer = await loadPeer()
    const peerId = safePeerId(sessionId)
    let attempts = 0
    const MAX = 3

    function tryCreate() {
      attempts++
      const peer = new Peer(peerId, PEER_CONFIG)

      peer.on('open', () => {
        console.log('[Peer] Controller ready:', peerId)
        resolve(peer)
      })

      peer.on('error', (err) => {
        console.warn('[Peer] Error:', err.type, attempts)
        peer.destroy()

        if (err.type === 'unavailable-id' && attempts < MAX) {
          // Wait 2s and retry
          setTimeout(tryCreate, 2000)
        } else if (err.type === 'unavailable-id') {
          // Already a controller with this ID → we reconnect as is
          // Create without specific ID and let it fail gracefully
          reject(new Error('SESSION_TAKEN'))
        } else if (err.type === 'network' || err.type === 'server-error') {
          if (attempts < MAX) setTimeout(tryCreate, 2000)
          else reject(new Error('NETWORK_ERROR'))
        } else {
          reject(err)
        }
      })

      setTimeout(() => {
        if (peer.disconnected) {
          peer.destroy()
          if (attempts < MAX) tryCreate()
          else reject(new Error('TIMEOUT'))
        }
      }, 12000)
    }

    tryCreate()
  })
}

/**
 * Receiver: open a random peer, then connect to controller
 * Retries finding the controller for up to 45 seconds
 */
export function createReceiverPeer(sessionId) {
  return new Promise(async (resolve, reject) => {
    const Peer = await loadPeer()
    const targetId = safePeerId(sessionId)

    const peer = new Peer(PEER_CONFIG)

    peer.on('open', () => {
      console.log('[Peer] Receiver ready, connecting to:', targetId)
      resolve({ peer, targetId })
    })

    peer.on('error', (err) => {
      if (err.type !== 'peer-unavailable') {
        peer.destroy()
        reject(err)
      }
      // peer-unavailable handled in the component (retry)
    })

    setTimeout(() => {
      if (peer.disconnected) {
        peer.destroy()
        reject(new Error('TIMEOUT'))
      }
    }, 15000)
  })
}
