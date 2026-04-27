'use client'

// PeerJS replaces Socket.io — pure P2P signaling via peerjs.com free server
// No backend needed, works on Vercel with zero configuration

let peerInstance = null

/**
 * Create a Peer with a specific ID (controller uses sessionId as peer ID)
 * @param {string} peerId
 * @returns {Promise<Peer>}
 */
export function createPeer(peerId) {
  return new Promise(async (resolve, reject) => {
    const { default: Peer } = await import('peerjs')

    const peer = new Peer(peerId, {
      // PeerJS free cloud server — handles WebRTC signaling
      // No setup needed, free tier supports thousands of connections
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    })

    peer.on('open', (id) => {
      console.log('[Peer] Opened with ID:', id)
      peerInstance = peer
      resolve(peer)
    })

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        reject(new Error('SESSION_TAKEN'))
      } else if (err.type === 'network' || err.type === 'server-error') {
        reject(new Error('NETWORK_ERROR'))
      } else {
        console.warn('[Peer] Error:', err.type, err.message)
        reject(err)
      }
    })

    // Timeout after 15s
    setTimeout(() => reject(new Error('TIMEOUT')), 15000)
  })
}

/**
 * Connect to an existing peer (receiver connects to controller)
 * @param {string} remotePeerId - controller's session ID
 * @returns {Promise<Peer>}
 */
export function connectToPeer(remotePeerId) {
  return new Promise(async (resolve, reject) => {
    const { default: Peer } = await import('peerjs')

    // Receiver gets a random peer ID
    const peer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    })

    peer.on('open', () => {
      console.log('[Peer] Receiver peer open, connecting to:', remotePeerId)
      peerInstance = peer
      resolve(peer)
    })

    peer.on('error', (err) => {
      console.warn('[Peer] Receiver error:', err.type)
      reject(err)
    })

    setTimeout(() => reject(new Error('TIMEOUT')), 15000)
  })
}

export function destroyPeer() {
  if (peerInstance) {
    peerInstance.destroy()
    peerInstance = null
  }
}
