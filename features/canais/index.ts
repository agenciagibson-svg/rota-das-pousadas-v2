/**
 * Canais — sincronização de calendário por iCal com Airbnb, Booking e afins.
 * Barrel público da feature; o resto do projeto importa daqui.
 */
export { parseICalendar, buildICalendar, type ChannelEvent } from './ical'
export {
  CHANNEL_PROVIDER_LABEL,
  CHANNEL_SYNC_LABEL,
  type ChannelCalendar,
  type ChannelFeedToImport,
  type ChannelProvider,
  type ChannelSyncResult,
  type ChannelSyncStatus,
} from './types'
export { saveChannelSchema, channelIdSchema, type SaveChannelInput, type ChannelIdInput } from './schemas'
export { ChannelsView } from './components/channels-view'
