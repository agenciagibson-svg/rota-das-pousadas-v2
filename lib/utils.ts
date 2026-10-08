import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * A escala tipográfica oficial (styles/typography.css) usa nomes `text-*`
 * próprios. Sem registrá-los, o tailwind-merge os confunde com cor de texto e
 * descarta `text-h1` ao lado de `text-foreground` (ver lib/utils.test.ts).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-xl',
            'display-l',
            'h1',
            'h2',
            'h3',
            'h4',
            'body-l',
            'body',
            'caption',
            'overline',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
