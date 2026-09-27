import { describe, expect, it } from 'vitest'
import { formatQty, isLowStock, qtyWithUnit } from './labels'
import { inventoryItemSchema, movementSchema } from './schemas'

const baseItem = {
  name: 'Água 500 ml',
  category: 'bebidas',
  unit: 'garrafa',
  trackStock: true,
  initialQuantity: '10',
  minQuantity: '4',
  unitCost: '1.5',
  salePrice: '6',
  showInApp: true,
  description: '',
  photoUrl: '',
}

describe('estoque — rótulos', () => {
  it('formata quantidade e unidade', () => {
    expect(formatQty(1.5)).toBe('1,5')
    expect(qtyWithUnit(3, 'garrafa')).toBe('3 garrafas')
    expect(qtyWithUnit(1, 'garrafa')).toBe('1 garrafa')
    expect(qtyWithUnit(2, 'kg')).toBe('2 kg')
    expect(qtyWithUnit(5, 'un')).toBe('5 un.')
  })
  it('alerta no mínimo ou abaixo, só se controla estoque', () => {
    expect(isLowStock({ trackStock: true, quantity: 4, minQuantity: 4 })).toBe(true)
    expect(isLowStock({ trackStock: true, quantity: 5, minQuantity: 4 })).toBe(false)
    expect(isLowStock({ trackStock: false, quantity: 0, minQuantity: 4 })).toBe(false)
  })
})

describe('estoque — validação', () => {
  it('aceita item do app com preço e converte números', () => {
    const r = inventoryItemSchema.safeParse(baseItem)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.salePrice).toBe(6)
      expect(r.data.unitCost).toBe(1.5)
    }
  })
  it('item do app sem preço é recusado', () => {
    const r = inventoryItemSchema.safeParse({ ...baseItem, salePrice: '' })
    expect(r.success).toBe(false)
  })
  it('cortesia (preço 0) é aceita', () => {
    expect(inventoryItemSchema.safeParse({ ...baseItem, salePrice: '0' }).success).toBe(true)
  })
  it('movimento: saída precisa de quantidade; ajuste aceita zero', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(movementSchema.safeParse({ itemId: id, kind: 'saida', quantity: '0' }).success).toBe(
      false,
    )
    expect(movementSchema.safeParse({ itemId: id, kind: 'ajuste', quantity: '0' }).success).toBe(
      true,
    )
  })
  it('lançar despesa exige custo', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const r = movementSchema.safeParse({
      itemId: id,
      kind: 'entrada',
      quantity: '5',
      createExpense: true,
    })
    expect(r.success).toBe(false)
  })
})
