// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SameHashScroll, sameHashTarget } from './same-hash-scroll'

const at = (pathname: string, hash = '', search = '') => ({
  origin: 'https://exemplo.test',
  pathname,
  search,
  hash,
})

describe('sameHashTarget', () => {
  it('devolve o alvo quando o link aponta para a âncora já aberta', () => {
    expect(sameHashTarget('/#destinos', at('/', '#destinos'))).toBe('destinos')
    expect(sameHashTarget('#destinos', at('/', '#destinos'))).toBe('destinos')
  })

  it('não interfere quando a âncora é outra, a página é outra ou o site é outro', () => {
    expect(sameHashTarget('/#experiencias', at('/', '#destinos'))).toBeNull()
    expect(sameHashTarget('/#destinos', at('/', ''))).toBeNull()
    expect(sameHashTarget('/#destinos', at('/pousadas', '#destinos'))).toBeNull()
    expect(sameHashTarget('/?busca=x#destinos', at('/', '#destinos'))).toBeNull()
    expect(sameHashTarget('https://outro.test/#destinos', at('/', '#destinos'))).toBeNull()
    expect(sameHashTarget('/pousadas', at('/pousadas', ''))).toBeNull()
    expect(sameHashTarget(null, at('/', '#destinos'))).toBeNull()
  })
})

describe('SameHashScroll', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    window.history.replaceState(null, '', '/')
  })

  function setup() {
    document.body.innerHTML =
      '<a id="l1" href="/#destinos"><span id="dentro">Destinos</span></a>' +
      '<a id="l2" href="/#experiencias">Experiências</a>' +
      '<section id="destinos"></section><section id="experiencias"></section>'
    const scroll = vi.fn()
    document.getElementById('destinos')!.scrollIntoView = scroll
    document.getElementById('experiencias')!.scrollIntoView = vi.fn()
    render(<SameHashScroll />)
    return scroll
  }

  const click = (id: string, init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
    document.getElementById(id)!.dispatchEvent(event)
    return event
  }

  it('rola até o alvo no segundo clique na mesma âncora', () => {
    const scroll = setup()
    window.history.replaceState(null, '', '/#destinos')
    const event = click('dentro')
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('deixa passar o clique em outra âncora e o clique com Ctrl', () => {
    const scroll = setup()
    window.history.replaceState(null, '', '/#destinos')
    expect(click('l2').defaultPrevented).toBe(false)
    expect(click('l1', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(scroll).not.toHaveBeenCalled()
  })
})
