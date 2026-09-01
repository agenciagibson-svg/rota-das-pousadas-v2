import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('remove acentos e hifeniza', () => {
    expect(slugify('São João da Serra')).toBe('sao-joao-da-serra')
  })
  it('remove símbolos e colapsa hifens', () => {
    expect(slugify('Pousada!!  Bela@Vista')).toBe('pousada-bela-vista')
  })
  it('apara hifens das pontas', () => {
    expect(slugify('  --Refúgio--  ')).toBe('refugio')
  })
})

describe('uniqueSlug', () => {
  it('mantém a base e adiciona sufixo', () => {
    const s = uniqueSlug('Refúgio das Nuvens')
    expect(s.startsWith('refugio-das-nuvens-')).toBe(true)
  })
  it('cai em "pousada" quando vazio', () => {
    expect(uniqueSlug('@@@').startsWith('pousada-')).toBe(true)
  })
})
