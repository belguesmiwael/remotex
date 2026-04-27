'use client'

// Trystero/MQTT — P2P via public MQTT brokers (EMQ, HiveMQ, Mosquitto)
// MQTT is synchronous pub/sub, extremely reliable, < 2s connection
// Zero accounts needed, free public brokers handle millions of IoT devices

const APP_ID = 'remotex-v3'

let roomInstance = null

export async function joinRoom(sessionId) {
  if (roomInstance) {
    try { roomInstance.leave() } catch {}
    roomInstance = null
  }

  const { joinRoom: trysteroJoin } = await import('trystero/mqtt')

  const room = trysteroJoin(
    {
      appId: APP_ID,
      // Use all 3 reliable public brokers for redundancy
      relayUrls: [
        'wss://broker.emqx.io:8084/mqtt',
        'wss://broker.hivemq.com:8884/mqtt',
        'wss://test.mosquitto.org:8081/mqtt',
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
