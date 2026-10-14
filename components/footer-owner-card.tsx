'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight, Bot, Hotel } from 'lucide-react'
import { ownerActions } from '@/components/footer-links'

export function FooterOwnerCard() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = ownerActions[activeIndex]
  const ActiveIcon = active.icon

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-linen text-sm font-semibold">Para pousadas</h2>
          <p className="text-linen/55 mt-1 text-xs leading-relaxed">Central do parceiro</p>
        </div>
        <span className="bg-linen/10 text-linen flex size-10 shrink-0 items-center justify-center rounded-full">
          <Hotel className="size-5" />
        </span>
      </div>

      <div className="border-linen/10 bg-stone-deep/55 mt-4 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ipe inline-flex items-center gap-2 text-xs font-semibold">
            <ActiveIcon className="size-4" />
            {active.metric}
          </span>
          <Bot className="text-linen/40 size-4" />
        </div>

        <motion.div
          key={active.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <p className="text-linen font-display mt-3 text-xl leading-tight font-medium text-pretty">
            {active.title}
          </p>
          <p className="text-linen/62 mt-3 min-h-14 text-sm leading-relaxed">{active.detail}</p>
        </motion.div>
      </div>

      <div className="mt-4 space-y-2">
        {ownerActions.map((action, index) => {
          const Icon = action.icon
          const selected = activeIndex === index
          return (
            <Link
              key={action.label}
              href={action.href}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
                selected
                  ? 'border-linen/35 bg-linen text-stone-deep'
                  : 'border-linen/10 text-linen/65 hover:border-linen/25 hover:text-linen'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4" />
                {action.label}
              </span>
              <ArrowUpRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
