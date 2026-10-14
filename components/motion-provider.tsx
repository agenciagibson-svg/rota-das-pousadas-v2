'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'

/**
 * Animações do Motion respeitam "reduzir movimento" do sistema: com a
 * preferência ligada, saem os deslocamentos e fica só a troca de opacidade.
 * (As transições em CSS já são cortadas em `styles/tokens.css`.)
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
