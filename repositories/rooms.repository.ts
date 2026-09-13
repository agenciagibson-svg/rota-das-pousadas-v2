import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AccommodationStatus, BedConfigItem, HousekeepingRoom, ManagedRoom, RoomOperationalStatus } from '@/features/acomodacoes/types'

export type NewRoom = {
  pousadaId: string
  name: string
  code: string | null
  categoryId: string | null
  description: string
  operationalDescription: string
  location: string
  capacity: number
  capacityMax: number | null
  adultsMax: number | null
  childrenMax: number
  infantsAllowed: boolean
  petsAllowed: boolean
  bedConfig: BedConfigItem[]
  accessible: boolean
  basePrice: number
  publicVisible: boolean
  displayOrder: number
  internalNotes: string
  createdBy: string
}

export type UpdateRoom = Omit<NewRoom, 'pousadaId' | 'createdBy'> & { updatedBy: string }

const ROOM_COLUMNS =
  'id, name, code, category_id, description, operational_description, location, capacity, capacity_max, adults_max, children_max, infants_allowed, pets_allowed, bed_config, accessible, base_price, status, operational_status, public_visible, display_order, internal_notes, created_at, updated_at, accommodation_categories(name)'

type RoomRow = {
  id: string
  name: string
  code: string | null
  category_id: string | null
  description: string
  operational_description: string
  location: string
  capacity: number
  capacity_max: number | null
  adults_max: number | null
  children_max: number
  infants_allowed: boolean
  pets_allowed: boolean
  bed_config: unknown
  accessible: boolean
  base_price: number
  status: AccommodationStatus
  operational_status: RoomOperationalStatus
  public_visible: boolean
  display_order: number
  internal_notes: string
  created_at: string
  updated_at: string
  accommodation_categories: { name: string } | { name: string }[] | null
}

function categoryName(v: RoomRow['accommodation_categories']): string | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0]?.name ?? null) : v.name
}

/**
 * `hideBasePrice`: quando o chamador é Governança (sem `finance`/preço na
 * matriz), o service passa `true` e o campo some do DTO (nunca vira 0/null
 * forjado) — projeção no servidor, mesma decisão do "Conflito B" do Ciclo 1.
 */
function mapRoom(r: RoomRow, amenityIds: string[], hideBasePrice: boolean): ManagedRoom {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    categoryId: r.category_id,
    categoryName: categoryName(r.accommodation_categories),
    description: r.description,
    operationalDescription: r.operational_description,
    location: r.location,
    capacity: r.capacity,
    capacityMax: r.capacity_max,
    adultsMax: r.adults_max,
    childrenMax: r.children_max,
    infantsAllowed: r.infants_allowed,
    petsAllowed: r.pets_allowed,
    bedConfig: Array.isArray(r.bed_config) ? (r.bed_config as BedConfigItem[]) : [],
    accessible: r.accessible,
    ...(hideBasePrice ? {} : { basePrice: Number(r.base_price) }),
    status: r.status,
    operationalStatus: r.operational_status,
    publicVisible: r.public_visible,
    displayOrder: r.display_order,
    internalNotes: r.internal_notes,
    amenityIds,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listRoomsByPousada(pousadaId: string, hideBasePrice = false): Promise<ManagedRoom[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .select(ROOM_COLUMNS)
    .eq('pousada_id', pousadaId)
    .order('display_order', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as unknown as RoomRow[]
  const roomIds = rows.map((r) => r.id)
  const { data: amenityRows } = roomIds.length
    ? await supabase.from('room_amenities').select('room_id, amenity_id').in('room_id', roomIds)
    : { data: [] }
  const amenitiesByRoom = new Map<string, string[]>()
  for (const a of amenityRows ?? []) {
    const list = amenitiesByRoom.get(a.room_id) ?? []
    list.push(a.amenity_id)
    amenitiesByRoom.set(a.room_id, list)
  }

  return rows.map((r) => mapRoom(r, amenitiesByRoom.get(r.id) ?? [], hideBasePrice))
}

export async function getRoomById(id: string): Promise<{ id: string; pousadaId: string; status: AccommodationStatus } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('rooms').select('id, pousada_id, status').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, pousadaId: data.pousada_id, status: data.status }
}

export async function insertRoom(row: NewRoom): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      pousada_id: row.pousadaId,
      name: row.name,
      code: row.code,
      category_id: row.categoryId,
      description: row.description,
      operational_description: row.operationalDescription,
      location: row.location,
      capacity: row.capacity,
      capacity_max: row.capacityMax,
      adults_max: row.adultsMax,
      children_max: row.childrenMax,
      infants_allowed: row.infantsAllowed,
      pets_allowed: row.petsAllowed,
      bed_config: row.bedConfig,
      accessible: row.accessible,
      base_price: row.basePrice,
      public_visible: row.publicVisible,
      display_order: row.displayOrder,
      internal_notes: row.internalNotes,
      created_by: row.createdBy,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function updateRoom(id: string, row: UpdateRoom): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('rooms')
    .update({
      name: row.name,
      code: row.code,
      category_id: row.categoryId,
      description: row.description,
      operational_description: row.operationalDescription,
      location: row.location,
      capacity: row.capacity,
      capacity_max: row.capacityMax,
      adults_max: row.adultsMax,
      children_max: row.childrenMax,
      infants_allowed: row.infantsAllowed,
      pets_allowed: row.petsAllowed,
      bed_config: row.bedConfig,
      accessible: row.accessible,
      base_price: row.basePrice,
      public_visible: row.publicVisible,
      display_order: row.displayOrder,
      internal_notes: row.internalNotes,
      updated_by: row.updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

/** Inativação/reativação CADASTRAL — nunca exclusão física (preserva histórico). */
export async function setRoomStatus(id: string, status: AccommodationStatus, updatedBy: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('rooms')
    .update({ status, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setRoomAmenities(roomId: string, amenityIds: string[]): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error: delError } = await supabase.from('room_amenities').delete().eq('room_id', roomId)
  if (delError) throw delError
  if (amenityIds.length === 0) return
  const { error } = await supabase.from('room_amenities').insert(amenityIds.map((amenity_id) => ({ room_id: roomId, amenity_id })))
  if (error) throw error
}

/** Status OPERACIONAL — via RPC (único caminho aberto também à Governança). */
export async function updateRoomOperationalStatus(pousadaId: string, roomId: string, status: RoomOperationalStatus): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('update_room_operational_status', {
    p_pousada_id: pousadaId,
    p_room_id: roomId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

/**
 * [Ciclo 3B] Única fonte de leitura de `rooms` para Governança — via RPC de
 * projeção mínima (rooms_read na RLS não concede leitura direta a esse
 * papel). Nunca traz base_price, categoria, visibilidade pública ou notas
 * comerciais.
 */
export async function listRoomsForHousekeeping(pousadaId: string): Promise<HousekeepingRoom[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_rooms_for_housekeeping', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as {
    id: string
    name: string
    code: string | null
    location: string
    operational_status: RoomOperationalStatus
    capacity: number
    next_block_starts_at: string | null
    operational_note: string | null
  }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    location: r.location,
    operationalStatus: r.operational_status,
    capacity: r.capacity,
    nextBlockStartsAt: r.next_block_starts_at,
    operationalNote: r.operational_note ?? '',
  }))
}

export async function listAmenitiesCatalog(): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('amenities').select('id, name').order('name')
  if (error) throw error
  return data ?? []
}

export type BookableRoom = {
  pousadaId: string
  roomId: string
  name: string
  description: string
  nightly: number
  capacity: number
}

/**
 * Resolve a acomodação reservável (mais barata) de uma pousada publicada, a
 * partir do slug. Única porta ao banco para leitura de rooms neste fluxo.
 */
/**
 * [Ciclo 3C] `rooms` não é mais legível diretamente por anônimo (RLS não
 * tem mais o branch de "pousada publicada"). Resolve a acomodação mais
 * barata via a projeção pública `list_public_rooms` — nunca expõe
 * internal_notes, status operacional ou colunas administrativas.
 */
export async function getBookableRoomBySlug(slug: string, checkin?: string, checkout?: string, guests = 1): Promise<BookableRoom | null> {
  const supabase = await createSupabaseServerClient()

  const { data: pousada, error } = await supabase
    .from('pousadas')
    .select('id, price_per_night')
    .eq('slug', slug)
    .eq('status', 'publicada')
    .maybeSingle()
  if (error) throw error
  if (!pousada) return null

  const { data: rpcRows, error: roomError } = await supabase.rpc('list_bookable_rooms', { p_slug: slug, p_checkin: checkin, p_checkout: checkout, p_guests: guests })
  if (roomError) throw new Error(roomError.message)
  const rooms = (rpcRows ?? []) as {
    id: string
    name: string
    description: string
    base_price: number
    capacity: number
    capacity_max: number | null
  }[]
  if (rooms.length === 0) return null

  const cheapest = [...rooms].sort((a, b) => a.base_price - b.base_price)[0]
  return {
    pousadaId: pousada.id,
    roomId: cheapest.id,
    name: cheapest.name,
    description: cheapest.description,
    nightly: Number(cheapest.base_price) || Number(pousada.price_per_night),
    capacity: cheapest.capacity_max ?? cheapest.capacity,
  }
}
