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
export async function masterAgentCall(
  channelLabel: string,
  input: string,
  profile: typeof userProfile.$inferSelect,
  model: LanguageModel
) {
  //这里可以添加中间逻辑，例如：
  //1. 根据输入内容，判断是否需要进行进一步的分析
  //2. 如果需要进一步的分析，则调用进一步的分析方法
  //3. 如果不需要进一步的分析，则直接返回输入内容
  //4. 如果需要进一步的分析，则调用进一步的分析方法
  //5. 如果不需要进一步的分析，则直接返回输入内容
  //6. 如果需要进一步的分析，则调用进一步的分析方法
  //7. 如果不需要进一步的分析，则直接返回输入内容
  //8. 如果需要进一步的分析，则调用进一步的分析方法
  const { object } = await generateObject({
    model,
    schema: ActionRecordSchema,
    prompt: `${USER_PROFILE_PROMPT(profile)}${INPUT_PROMPT(input)}`,
    system: EXTRACT_ACTION_PROMPT(channelLabel)
  })

  return {
    action: object,
    estimate: estimate(object)
  }
}
