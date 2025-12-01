import { gmail_v1 } from 'googleapis'
export const GMAIL_CHANNEL_LABEL = 'Gmail'
export const GOOGLE_CALENDAR_CHANNEL_LABEL = 'Google_Calendar'
export const GOOGLE_DRIVE_CHANNEL_LABEL = 'Google_Drive'
export const NOTION_CHANNEL_LABEL = 'Notion'
export const GOOGLE_TASKS_CHANNEL_LABEL = 'Google_Tasks'
const transformGmailMessage = (gmailMessage: gmail_v1.Schema$Message) => {
  const subject = gmailMessage.payload?.headers?.find(
    (header) => header.name === 'Subject'
  )?.value
  const from = gmailMessage.payload?.headers?.find(
    (header) => header.name === 'From'
  )?.value
  const to = gmailMessage.payload?.headers?.find(
    (header) => header.name === 'To'
  )?.value
  const content = gmailMessage.snippet
  if (!subject && !content) return null
  const statistics = {
    hasImportantLabel: gmailMessage.labelIds?.includes('IMPORTANT') ?? false,
    isNoreply: from?.toLowerCase().includes('noreply') ?? false,
    isCategoryPromotions:
      gmailMessage.labelIds?.includes('CATEGORY_PROMOTIONS') ?? false
  }
  return `title: ${subject}
  content: ${content}
  from: ${from}
  to: ${to}
  labels: ${gmailMessage.labelIds?.join(', ')}
  hasImportantLabel: ${statistics.hasImportantLabel}
  isNoreply: ${statistics.isNoreply}
  isCategoryPromotions: ${statistics.isCategoryPromotions}`
}
/**
 *
 * @param channelLabel 将提取提交转换成input 字符串 替代 @prompt 中的 <content>
 * @param input 提取提交
 * @returns
 */
export const transform = (channelLabel: string, input: unknown) => {
  switch (channelLabel) {
    case GMAIL_CHANNEL_LABEL:
      return transformGmailMessage(input as gmail_v1.Schema$Message)
    default:
      return JSON.stringify(input).replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
}
