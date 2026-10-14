import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { ChannelEvent } from '@/features/canais/ical'
import type {
  ChannelCalendar,
  ChannelFeedToImport,
  ChannelProvider,
  ChannelSyncStatus,
} from '@/features/canais/types'
import { publicEnv } from '@/lib/env'
import { orNull } from '@/lib/supabase/rpc-args'

/** Monta a URL pública do feed a partir do token — o token nunca sai daqui cru. */
function exportUrlFor(token: string): string {
  return `${publicEnv.siteUrl}/api/canais/ical/${token}`
}

type CalendarRow = {
  id: string
  room_id: string
  provider: ChannelProvider
  label: string
  import_url: string | null
  export_token: string
  import_enabled: boolean
  export_enabled: boolean
  last_sync_at: string | null
  last_sync_status: ChannelSyncStatus
  last_sync_error: string
  last_event_count: number
  rooms: { name: string } | { name: string }[] | null
}

function roomNameOf(row: CalendarRow): string {
  if (!row.rooms) return 'Acomodação'
  return Array.isArray(row.rooms) ? (row.rooms[0]?.name ?? 'Acomodação') : row.rooms.name
}

/** Canais da pousada ativa — a RLS da 0044 já restringe ao tenant do usuário. */
export async function listChannelsByPousada(pousadaId: string): Promise<ChannelCalendar[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('channel_calendars')
    .select(
      'id, room_id, provider, label, import_url, export_token, import_enabled, export_enabled, last_sync_at, last_sync_status, last_sync_error, last_event_count, rooms(name)',
    )
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as CalendarRow[]).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    roomName: roomNameOf(row),
    provider: row.provider,
    label: row.label,
    importUrl: row.import_url,
    exportUrl: exportUrlFor(row.export_token),
    importEnabled: row.import_enabled,
    exportEnabled: row.export_enabled,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncError: row.last_sync_error,
    lastEventCount: row.last_event_count,
  }))
}

export async function saveChannelRpc(p: {
  roomId: string
  provider: ChannelProvider
  label: string
  importUrl: string | null
  exportToken: string
}): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('save_channel_calendar', {
    p_room_id: p.roomId,
    p_provider: p.provider,
    p_label: p.label,
    p_import_url: orNull(p.importUrl),
    p_export_token: p.exportToken,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function deleteChannelRpc(calendarId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('delete_channel_calendar', { p_calendar_id: calendarId })
  if (error) throw new Error(error.message)
}

/* -------------------------------------------------------------------------
 * Abaixo: service-role. O cron e o feed público não têm sessão de usuário,
 * então não podem passar pela RLS normal. Como no webhook de pagamento, eles
 * NUNCA tocam tabela direto — só chamam RPCs estreitas, `security definer`,
 * concedidas exclusivamente a `service_role` na 0044.
 * ---------------------------------------------------------------------- */

export async function listFeedsToImport(): Promise<ChannelFeedToImport[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('list_channel_feeds_to_import')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { calendar_id: string; import_url: string }[]).map((row) => ({
    calendarId: row.calendar_id,
    importUrl: row.import_url,
  }))
}

/**
 * Aplica o resultado de uma sincronização.
 *
 * Com `status: 'error'`, a 0044 preserva os eventos já conhecidos e grava só o
 * diagnóstico — é o fail-closed: feed que não respondeu nunca libera quarto.
 */
export async function applySyncRpc(p: {
  calendarId: string
  events: ChannelEvent[]
  status: Exclude<ChannelSyncStatus, 'never'>
  error: string
}): Promise<{ status: string; events?: number }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('sync_channel_events', {
    p_calendar_id: p.calendarId,
    p_events: p.events,
    p_status: p.status,
    p_error: p.error,
  })
  if (error) throw new Error(error.message)
  return data as { status: string; events?: number }
}

export type ExportFeedData = { roomName: string; events: ChannelEvent[] }

/** Resolve o feed de exportação pelo token. Token inválido devolve null. */
export async function getExportFeedByToken(token: string): Promise<ExportFeedData | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('get_channel_export_feed', { p_token: token })
  if (error) throw new Error(error.message)
  if (!data) return null
  return data as ExportFeedData
}
