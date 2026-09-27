/** Rótulos do estoque — usados no painel e no app do hóspede. */

export const INVENTORY_CATEGORIES = [
  'bebidas',
  'alimentos',
  'frigobar',
  'cafe_da_manha',
  'enxoval',
  'amenities',
  'limpeza',
  'manutencao',
  'servicos',
  'outros',
] as const
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  bebidas: 'Bebidas',
  alimentos: 'Alimentos',
  frigobar: 'Frigobar',
  cafe_da_manha: 'Café da manhã',
  enxoval: 'Enxoval',
  amenities: 'Amenities',
  limpeza: 'Limpeza',
  manutencao: 'Manutenção',
  servicos: 'Serviços',
  outros: 'Outros',
}

export const INVENTORY_UNITS = [
  'un',
  'garrafa',
  'lata',
  'pacote',
  'caixa',
  'kg',
  'g',
  'l',
  'ml',
  'par',
  'jogo',
] as const
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]

export const UNIT_LABEL: Record<InventoryUnit, string> = {
  un: 'unidade',
  garrafa: 'garrafa',
  lata: 'lata',
  pacote: 'pacote',
  caixa: 'caixa',
  kg: 'kg',
  g: 'g',
  l: 'litro',
  ml: 'ml',
  par: 'par',
  jogo: 'jogo',
}

export const MOVEMENT_KINDS = ['entrada', 'saida', 'perda', 'ajuste'] as const
export type MovementKind = (typeof MOVEMENT_KINDS)[number] | 'pedido'

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  perda: 'Perda',
  ajuste: 'Ajuste',
  pedido: 'Pedido',
}

/** "12", "1,5", "0,250" — quantidade sem zeros à toa. */
export function formatQty(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/** "3 garrafas" — plural simples só para unidades contáveis. */
export function qtyWithUnit(value: number, unit: InventoryUnit): string {
  const countable = ['un', 'garrafa', 'lata', 'pacote', 'caixa', 'par', 'jogo'].includes(unit)
  if (unit === 'un') return `${formatQty(value)} un.`
  const label = UNIT_LABEL[unit]
  return `${formatQty(value)} ${countable && value !== 1 ? `${label}s` : label}`
}

/** Item em alerta: controla estoque e está no mínimo ou abaixo. */
export function isLowStock(item: { trackStock: boolean; quantity: number; minQuantity: number }) {
  return item.trackStock && item.quantity <= item.minQuantity
}
