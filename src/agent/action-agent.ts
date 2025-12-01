import { generateObject, LanguageModel } from 'ai'
import { userProfile } from '../db-schema/user-schema'
import { ActionRecordSchema } from '../shared-types'
import {
  EXTRACT_ACTION_PROMPT,
  INPUT_PROMPT,
  USER_PROFILE_PROMPT
} from './gmail/prompts'
import { GMAIL_CHANNEL_LABEL, transform } from './gmail/transform'
import { estimate } from './gmail/estimate'
export async function masterAgentCall(
  channelLabel: string,
  input: unknown,
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
  switch (channelLabel) {
    case GMAIL_CHANNEL_LABEL:
      const inputString = transform(channelLabel, input)
      if (!inputString) {
        return {
          action: null,
          estimate: 0
        }
      }
      const { object } = await generateObject({
        model,
        schema: ActionRecordSchema,
        prompt: `${USER_PROFILE_PROMPT(profile)}${INPUT_PROMPT(inputString)}`,
        system: EXTRACT_ACTION_PROMPT(channelLabel)
      })

      return {
        action: object,
        estimate: estimate(object)
      }
    default:
      throw new Error(`Unsupported channel label: ${channelLabel}`)
  }
}
