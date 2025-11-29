import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

/**
 * Agent Configuration Interface
 * Defines the configuration structure for AI agents
 */
export interface AgentConfiguration {
  model: string
  systemPrompt: string
  temperature: number
  maxSteps: number
  toolChoice: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string }
  stopWhen: Array<{
    type: 'stepCount'
    maxSteps: number
  }>
  tools: Array<{
    name: string
    enabled: boolean
    config?: {
      apiKey?: string
      endpoint?: string
      timeout?: number
      [key: string]: unknown
    }
  }>
}

/**
 * Memory Type Enum
 * Defines the types of memories: action, memory, fact, task
 */
export const memoryTypeEnum = pgEnum('memory_type', [
  'action',
  'memory',
  'fact',
  'task'
])

/**
 * Memory Status Enum
 * Defines the status of memories: active, done, ignored, overridden
 */
export const memoryStatusEnum = pgEnum('memory_status', [
  'active',
  'done',
  'ignored',
  'overridden'
])

/**
 * Memory Content Interface
 * Defines the structure of memory content stored as JSON
 */
export interface MemoryContent {
  text?: string
  keywords?: string[]
  summary?: string
  suggestions?: string[] | string
  links?: string[]
  importanceRating?: number
  [key: string]: unknown
}

/**
 * Agents Table
 * Stores AI agent configurations and metadata
 */
export const agents = pgTable(
  'app_agents',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    configuration: jsonb('configuration').$type<AgentConfiguration>().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('agents_created_by_idx').on(table.createdBy),
    index('agents_is_active_idx').on(table.isActive),
    unique('agents_name_unique').on(table.name)
  ]
)

/**
 * User Memories Table
 * Stores user memories extracted from various data sources (Gmail, Drive, Calendar, etc.)
 */
export const userMemories = pgTable(
  'app_user_memories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channelLabel: text('channel_label').notNull(),
    refId: text('ref_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    type: memoryTypeEnum('type').notNull(),
    title: text('title').notNull(),
    content: jsonb('content').$type<MemoryContent>().notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    status: memoryStatusEnum('status').notNull().default('active'),
    labels: jsonb('labels').$type<string[]>().default([]),
    tags: jsonb('tags').$type<string[]>().default([]),
    priority: integer('priority').default(0),
    description: text('description'),
    statistics: jsonb('statistics').$type<Record<string, number>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('user_memories_user_id_idx').on(table.userId),
    index('user_memories_channel_label_idx').on(table.channelLabel),
    index('user_memories_ref_id_idx').on(table.refId),
    index('user_memories_type_idx').on(table.type),
    index('user_memories_status_idx').on(table.status),
    index('user_memories_priority_idx').on(table.priority),
    index('user_memories_created_at_idx').on(table.createdAt),
    unique('user_memories_channel_ref_unique').on(
      table.channelLabel,
      table.refId
    )
  ]
)
