'use client'

import { Toaster } from 'react-hot-toast'

export default function GlobalToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { background: '#363636', color: '#fff' },
        success: { duration: 3000 },
        error: { duration: 6000 },
      }}
    />
  )
}

