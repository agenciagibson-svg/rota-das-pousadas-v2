'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true once the window has scrolled past `threshold` pixels.
 * Extracted from SiteHeader so the same behavior can be reused
 * (e.g. by a future sticky sub-nav) without duplicating the listener.
 */
export function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}
