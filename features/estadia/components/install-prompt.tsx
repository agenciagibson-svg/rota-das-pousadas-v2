'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'rp_stay_install_dismissed'

/**
 * Convite para instalar o app da estadia na tela inicial.
 * Android/Chrome: botão que abre o instalador do navegador.
 * iPhone (Safari): instruções — a Apple não deixa o site abrir o instalador.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // sem storage
    }
    if (standalone || dismissed) return

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
    if (isIos) {
      setIos(true)
      setVisible(true)
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sem storage
    }
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => null)
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="relative mb-1 rounded-[24px] bg-white p-4 pr-10 text-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute top-2.5 right-2.5 rounded-full bg-[#f4f4f2] p-1.5 text-[#1e1e1e]"
      >
        <X className="size-4" />
      </button>
      <p className="font-bold text-[#1e1e1e]">Deixe o app na tela do seu celular</p>
      {ios ? (
        <p className="mt-1 text-[#9a9a96]">
          No Safari, toque em <Share className="inline size-4 align-text-bottom" /> Compartilhar e
          depois em <strong>Adicionar à Tela de Início</strong>.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[#9a9a96]">Abra com um toque, como qualquer aplicativo.</p>
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#1e1e1e] px-4 py-2.5 font-bold text-white"
          >
            <Download className="size-4" />
            Instalar app
          </button>
        </>
      )}
    </div>
  )
}
