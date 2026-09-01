'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOutAction } from '../actions'
import { Button } from '@/components/ui/button'

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await signOutAction()
          router.push('/')
          router.refresh()
        })
      }
    >
      <LogOut className="size-4" />
      {pending ? 'Saindo…' : 'Sair'}
    </Button>
  )
}
