'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import { createPousadaAdminSchema, type CreatePousadaAdminInput } from '../schemas'
import { createPousadaAdminAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'

export function AdminCreatePousadaForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreatePousadaAdminInput>({
    resolver: zodResolver(createPousadaAdminSchema),
    defaultValues: {
      name: '',
      city: '',
      state: '',
      description: '',
      pricePerNight: 0,
      instagram: '',
      contactEmail: '',
      whatsapp: '',
      images: [],
      publishNow: true,
    },
  })

  async function onSubmit(values: CreatePousadaAdminInput) {
    setFormError(null)
    const result = await createPousadaAdminAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    router.push(result.data.redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Controller
        control={control}
        name="images"
        render={({ field }) => (
          <ImageUpload
            label="Fotos"
            hint="A primeira foto vira a capa da pousada."
            value={field.value}
            onChange={field.onChange}
            error={errors.images?.message}
          />
        )}
      />

      <Input
        label="Nome da pousada"
        placeholder="Ex.: Refúgio das Nuvens"
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Input
          label="Cidade"
          placeholder="Ex.: Monte Verde"
          error={errors.city?.message}
          {...register('city')}
        />
        <Input
          label="UF"
          placeholder="MG"
          maxLength={2}
          className="w-20 uppercase"
          error={errors.state?.message}
          {...register('state')}
        />
      </div>

      <Input
        label="Diária (R$)"
        type="number"
        min={1}
        placeholder="720"
        error={errors.pricePerNight?.message}
        {...register('pricePerNight')}
      />

      <Textarea
        label="Descrição"
        rows={5}
        placeholder="Conte a história e os diferenciais da pousada…"
        error={errors.description?.message}
        {...register('description')}
      />

      <Input
        label="Instagram"
        placeholder="@nomedapousada ou link do perfil"
        hint="Usado como referência — aparece como link na página da pousada."
        error={errors.instagram?.message}
        {...register('instagram')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="E-mail de contato"
          type="email"
          placeholder="contato@pousada.com.br"
          error={errors.contactEmail?.message}
          {...register('contactEmail')}
        />
        <Input
          label="WhatsApp"
          placeholder="(00) 00000-0000"
          error={errors.whatsapp?.message}
          {...register('whatsapp')}
        />
      </div>

      <label className="text-foreground flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="border-input size-4 rounded"
          {...register('publishNow')}
        />
        Publicar imediatamente (senão fica salva como rascunho)
      </label>

      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Cadastrando…' : 'Cadastrar pousada'}
      </Button>
    </form>
  )
}
