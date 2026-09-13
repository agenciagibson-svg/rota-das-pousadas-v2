'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight, BriefcaseBusiness, Leaf, Mail, Newspaper, ScrollText } from 'lucide-react'

const companyLinks = [
  {
    label: 'História',
    href: '#',
    icon: ScrollText,
    title: 'A rota nasce das pousadas com alma',
    detail: 'Uma marca feita para valorizar hospedagens independentes, destinos brasileiros e viagens com mais significado.',
    step: 'origem',
  },
  {
    label: 'Sustentabilidade',
    href: '#',
    icon: Leaf,
    title: 'Turismo que respeita o lugar',
    detail: 'Curadoria para destacar pousadas conectadas com natureza, comunidade local e operação responsável.',
    step: 'impacto',
  },
  {
    label: 'Imprensa',
    href: '#',
    icon: Newspaper,
    title: 'Uma nova vitrine para o turismo nacional',
    detail: 'Materiais, releases e dados da plataforma para contar a expansão da Rota das Pousadas.',
    step: 'voz',
  },
  {
    label: 'Carreiras',
    href: '#',
    icon: BriefcaseBusiness,
    title: 'Gente construindo tecnologia com hospitalidade',
    detail: 'Produto, operação, marketing e IA trabalhando para aproximar pousadas e viajantes.',
    step: 'time',
  },
  {
    label: 'Contato',
    href: '#',
    icon: Mail,
    title: 'Fale com a Rota das Pousadas',
    detail: 'Parcerias, suporte, imprensa e oportunidades podem começar por uma mensagem simples.',
    step: 'conversa',
  },
]

export function FooterCompanyCard() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = companyLinks[activeIndex]
  const ActiveIcon = active.icon

  return (
    <div className="rounded-2xl border border-linen/10 bg-linen/[0.06] p-4 shadow-floating">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-linen">Rota das Pousadas</h4>
          <p className="mt-1 text-xs leading-relaxed text-linen/55">Mapa da marca</p>
        </div>
        <span className="rounded-full border border-linen/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-linen/60">
          Brasil
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-linen/10 bg-stone-deep/55 p-4">
        <div className="relative flex items-center justify-between">
          <span className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-linen/12" />
          {companyLinks.map((item, index) => {
            const selected = activeIndex === index
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                aria-label={`Abrir ${item.label}`}
                className={`relative z-10 flex size-7 items-center justify-center rounded-full border transition-all ${
                  selected
                    ? 'border-gold bg-gold text-stone-deep'
                    : 'border-linen/20 bg-stone-deep text-linen/45 hover:text-linen'
                }`}
              >
                <span className="size-1.5 rounded-full bg-current" />
              </button>
            )
          })}
        </div>

        <motion.div
          key={active.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mt-5"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-gold">
            <ActiveIcon className="size-4" />
            {active.step}
          </span>
          <p className="mt-3 text-pretty font-serif text-xl font-semibold leading-tight text-linen">
            {active.title}
          </p>
          <p className="mt-3 min-h-16 text-sm leading-relaxed text-linen/62">{active.detail}</p>
        </motion.div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {companyLinks.map((item, index) => {
          const Icon = item.icon
          const selected = activeIndex === index
          return (
            <Link
              key={item.label}
              href={item.href}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all ${
                selected
                  ? 'border-linen/35 bg-linen text-stone-deep'
                  : 'border-linen/10 text-linen/65 hover:border-linen/25 hover:text-linen'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4" />
                {item.label}
              </span>
              <ArrowUpRight className="size-3.5 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
