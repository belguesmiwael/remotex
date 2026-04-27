import './globals.css'

export const metadata = {
  title: 'RemoteX — Real-time Remote Control',
  description: 'Control any device remotely via WebRTC, Voice, Gesture & Eye Tracking',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🖥️</text></svg>',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="aurora-bg" aria-hidden="true">
          <div className="aurora-orb aurora-orb-1" />
          <div className="aurora-orb aurora-orb-2" />
          <div className="aurora-orb aurora-orb-3" />
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}
