import { generateObject, LanguageModel } from 'ai'
import { userProfile } from '../db-schema/user-schema'
import { ActionRecordSchema } from '../shared-types'
import {
  EXTRACT_ACTION_PROMPT,
  INPUT_PROMPT,
  USER_PROFILE_PROMPT
} from './prompts'
import { estimate } from './estimate'
export const GMAIL_CHANNEL_LABEL = 'Gmail'
export const GOOGLE_CALENDAR_CHANNEL_LABEL = 'Google_Calendar'
export const GOOGLE_DRIVE_CHANNEL_LABEL = 'Google_Drive'
export const NOTION_CHANNEL_LABEL = 'Notion'
export const GOOGLE_TASKS_CHANNEL_LABEL = 'Google_Tasks'
export async function masterAgentCall({
  channelLabel,
  input,
  profile,
  model
}: {
  channelLabel: string
  input: string
  profile: typeof userProfile.$inferSelect
  model: LanguageModel
}) {
  //这里可以添加中间逻辑，例如：
  //需要进一步的 generateObject 处理得到指标后，再调用 estimate 方法得到估计值
  const result = await generateObject({
    model,
    schema: ActionRecordSchema,
    prompt: `${USER_PROFILE_PROMPT(profile)}${INPUT_PROMPT(input)}`,
    system: EXTRACT_ACTION_PROMPT(channelLabel)
  })

  return {
    ...result,
    estimate: estimate(result.object)
  }
}
