import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MateriaLive - Warehouse Inventory Tracking',
  description: 'Real-time warehouse inventory and delivery tracking system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
