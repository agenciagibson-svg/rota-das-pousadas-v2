'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { duration, easing } from '@/lib/design-tokens'

type RevealProps = {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}

export function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: duration.reveal, delay, ease: [...easing.standard] }}
    >
      {children}
    </motion.div>
  )
}
