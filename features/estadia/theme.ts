import { brand } from '@/lib/design-tokens'

/**
 * Tema do app da estadia: segue o celular ("sistema") ou a escolha do
 * hóspede, salva no aparelho. Só o app muda de tema — o site segue claro.
 */
export type ThemePref = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const STAY_THEME_KEY = 'rp_stay_theme'

/** Cor da barra do sistema (theme-color) em cada tema: o fundo do app. */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: brand.neblina,
  dark: brand.breu,
}

export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

/**
 * Roda no HTML antes da primeira pintura (com o nonce da CSP), logo depois de
 * abrir `[data-stay-app]`: assim quem usa o celular no escuro não vê um clarão
 * branco antes do app hidratar. Mesma regra de `resolveTheme`.
 */
export const stayThemeBootScript = `(function(){try{
var k=${JSON.stringify(STAY_THEME_KEY)},c=${JSON.stringify(THEME_COLOR)};
var p=null;try{p=localStorage.getItem(k)}catch(e){}
var dark=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var t=dark?'dark':'light';
var el=document.querySelector('[data-stay-app]');if(el)el.setAttribute('data-theme',t);
if(p==='light'||p==='dark'){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute('content',c[t]);}
}catch(e){}})();`
