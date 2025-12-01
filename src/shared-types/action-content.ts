import { z } from 'zod'

// 主 schema
export const ActionRecordSchema = z.object({
  text: z.string(),
  keywords: z.array(z.string()),
  summary: z.string(),
  suggestions: z.union([z.array(z.string()), z.string()]),
  labels: z.array(z.string()),
  importanceRating: z.number().min(0).max(100)
})

export type ActionRecord = z.infer<typeof ActionRecordSchema>
