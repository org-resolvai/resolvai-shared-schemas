import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

// Order metadata type definition
export interface OrderMetadata {
  stripe_session_id?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  stripe_subscription_item_id?: string // Subscription item ID for upgrades
  stripe_configured?: boolean
  created_via?: string
  payment_method?: string
  payment_intent_id?: string
  payment_method_id?: string
  payment_status?: string
  webhook_event_type?: string
  webhook_event_id?: string
  processed_at?: string
  [key: string]: unknown
}

// User order type definition (embedded in profile)
export interface UserOrder {
  id: string // Order number, e.g., "ORD-2024-001"
  planId: string // Plan ID for linking to plan configuration
  amount: string // Amount (using string for precise calculation)
  currency: string // Currency type
  status: 'pending' | 'active' | 'expired' | 'cancelled' // Order status
  startDate: string // ISO date string
  endDate: string // ISO date string
  autoRenew: boolean // Auto renewal setting
  metadata?: OrderMetadata // Additional information like payment details
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
}

// User profile metadata type definition
export interface UserSubscription {
  stripe_customer_id?: string
  order?: UserOrder // Legacy: Single order per user (deprecated, use subscriptions instead)
  subscriptions?: Record<string, UserOrder> // Multiple subscriptions keyed by planId
}

export interface UserLocation {
  latitude?: number
  longitude?: number
  [key: string]: unknown
}

// Notification settings type definition
export interface NotificationSettings {
  push: boolean
  phone: boolean
  whatsapp: boolean
}

// Personalized settings type definition
export interface PersonalizedSettings {
  topicPreferences: string[]
  excludeKeywords: string[]
  labels: string[]
  tags: string[]
  [key: string]: unknown
}

export const userProfile = pgTable('app_user_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  locale: text('locale').default('en'),
  timezone: text('timezone'),
  location: jsonb('location').$type<UserLocation>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  notificationSettings: jsonb(
    'notification_settings'
  ).$type<NotificationSettings>(),
  personalizedSettings: jsonb(
    'personalized_settings'
  ).$type<PersonalizedSettings>(),
  subData: jsonb('sub_data').$type<UserSubscription>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
})

export const userOrders = pgTable(
  'app_user_orders',
  {
    id: text('id').primaryKey(), // Order number, e.g., "ORD-2024-001"
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    subscriptionId: text('subscription_id').notNull(),
    planId: text('plan_id').notNull(),
    amount: text('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('CNY'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    autoRenew: boolean('auto_renew').notNull().default(false),
    metadata: jsonb('metadata').$type<OrderMetadata>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('user_orders_user_id_idx').on(table.userId),
    index('user_orders_subscription_id_idx').on(table.subscriptionId),
    index('user_orders_status_idx').on(table.status),
    index('user_orders_start_date_idx').on(table.startDate)
  ]
)

// User metrics/portrait type definition
// 用户画像指标类型，支持动态扩展
export interface UserMetric {
  // 指标值可以是数字、字符串、布尔值、对象或数组
  value: number | string | boolean | Record<string, unknown> | unknown[]
  // 指标单位（可选）
  unit?: string
  // 指标描述（可选）
  description?: string
  // 指标计算时间（可选）
  calculatedAt?: string
  // 其他扩展字段
  [key: string]: unknown
}

// 用户画像数据，使用 Record 支持动态指标扩展
export interface UserPortraitData {
  // 指标集合，key 为指标名称，value 为指标数据
  metrics: Record<string, UserMetric>
  // 画像版本，用于追踪指标结构变化
  version?: string
  // 计算来源（可选）
  source?: string
  // 其他扩展字段
  [key: string]: unknown
}

// User Job Context type definition
export interface UserJobContext {
  // Task generation specific context
  source?: string // Source of the job (e.g., 'api', 'scheduled', 'manual')
  [key: string]: unknown
}

// User Jobs table for async task generation
export const userJobs = pgTable(
  'app_user_jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    jobType: varchar('job_type', { length: 50 })
      .notNull()
      .default('task_generation'), // job type: task_generation, etc.
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed
    context: jsonb('context').$type<UserJobContext>(), // Store job context and metadata
    result: jsonb('result'), // Store job result data
    errorMessage: text('error_message'), // Store error message if failed
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
  },
  (table) => [
    index('user_jobs_user_id_idx').on(table.userId),
    index('user_jobs_status_idx').on(table.status),
    index('user_jobs_job_type_idx').on(table.jobType),
    index('user_jobs_created_at_idx').on(table.createdAt)
  ]
)

// User Portrait table for storing dynamically calculated user metrics
// 用户画像表，用于存储动态计算的用户指标
export const userPortrait = pgTable(
  'app_user_portrait',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 用户画像数据，包含所有动态指标
    data: jsonb('data').$type<UserPortraitData>().notNull(),
    // 画像版本，用于追踪指标结构变化
    version: varchar('version', { length: 50 }),
    // 计算来源（如：scheduled_job, manual_calculation, api_trigger）
    source: varchar('source', { length: 50 }),
    // 计算时间
    calculatedAt: timestamp('calculated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('user_portrait_user_id_idx').on(table.userId),
    index('user_portrait_version_idx').on(table.version),
    index('user_portrait_source_idx').on(table.source)
  ]
)
