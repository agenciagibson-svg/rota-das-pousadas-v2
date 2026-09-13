'use server'

import { createAction } from '@/actions/create-action'
import { channelIdSchema, saveChannelSchema } from './schemas'
import { removeChannel, saveChannel } from './services/channels.service'

export const saveChannelAction = createAction(saveChannelSchema, async (input) => {
  return saveChannel(input)
})

export const removeChannelAction = createAction(channelIdSchema, async (input) => {
  return removeChannel(input)
})
