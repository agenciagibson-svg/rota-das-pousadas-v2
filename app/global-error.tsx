'use client'

import { useEffect } from 'react'

/**
 * Catches errors thrown in the root layout itself. Must render its own
 * <html>/<body> because the layout failed. Kept dependency-free on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f6f1',
          color: '#1f2420',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Algo saiu da rota</h1>
          <p style={{ color: '#6b6459', marginTop: 8 }}>
            Ocorreu um erro crítico. Recarregue a página para continuar.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              backgroundColor: '#0f766e',
              color: '#f8f6f1',
              border: 0,
              borderRadius: 9999,
              padding: '10px 20px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
