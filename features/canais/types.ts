/** Canal de calendário (iCal) vinculado a uma acomodação. */
export type ChannelProvider = 'airbnb' | 'booking' | 'outro'
export type ChannelSyncStatus = 'never' | 'ok' | 'error'

export type ChannelCalendar = {
  id: string
  roomId: string
  roomName: string
  provider: ChannelProvider
  label: string
  /** Feed da OTA que a Rota lê. Nulo = este canal só exporta. */
  importUrl: string | null
  /** URL completa do feed que a Rota publica — já montada com o token. */
  exportUrl: string
  importEnabled: boolean
  exportEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: ChannelSyncStatus
  lastSyncError: string
  lastEventCount: number
}

/** Feed pendente de importação, na visão do cron. */
export type ChannelFeedToImport = {
  calendarId: string
  importUrl: string
}

/** Resultado da sincronização de um feed. */
export type ChannelSyncResult = {
  calendarId: string
  status: 'ok' | 'error'
  events: number
  error: string
}

export const CHANNEL_PROVIDER_LABEL: Record<ChannelProvider, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  outro: 'Outro canal',
}

export const CHANNEL_SYNC_LABEL: Record<ChannelSyncStatus, string> = {
  never: 'Ainda não sincronizado',
  ok: 'Sincronizado',
  error: 'Falha na sincronização',
}
