import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

// Device metadata type definition
export interface DeviceMetadata {
  ipAddress?: string // IP地址
  userAgent?: string // 用户代理
  deviceType?: 'mobile' | 'tablet' | 'desktop' // 设备类型
  location?: string // 位置信息
}

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
export interface UserProfileMetadata {
  stripe_customer_id?: string
  order?: UserOrder // Legacy: Single order per user (deprecated, use subscriptions instead)
  subscriptions?: Record<string, UserOrder> // Multiple subscriptions keyed by planId
  [key: string]: unknown
}

export interface UserLocation {
  latitude?: number
  longitude?: number
  [key: string]: unknown
}

// Notification settings type definition
export interface NotificationSettings {
  email: boolean
  push: boolean
  phone: boolean
  whatsapp: boolean
}

// Privacy settings type definition
export interface PrivacySettings {
  profileVisible: boolean
  emailVisible: boolean
  topicPreferences: string[]
  excludeKeywords: string[]
}
// Privacy settings type definition
export interface PersonalizedSettings {
  labels: string[]
  tags: string[]
  [key: string]: unknown
}

// OAuth2 Provider configuration
export interface OAuth2ProviderConfig {
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  scope: string[]
  redirectUri: string
  responseType?: 'code' | 'token'
  grantType?: 'authorization_code' | 'refresh_token'
  additionalParams?: Record<string, string>
}

// OAuth2 Credentials (通用格式，支持不同提供商)
export interface OAuth2Credentials {
  // OAuth2 标准字段
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  expires_at?: number
  scope?: string

  // OAuth1 字段
  oauth_token?: string
  oauth_token_secret?: string

  // API Key 字段
  api_key?: string

  // Basic Auth 字段
  username?: string
  password?: string

  // 提供商特定字段
  provider_specific?: {
    google?: {
      refreshToken?: string
      scope?: string[]
      [key: string]: unknown
    }
    microsoft?: {
      refreshToken?: string
      scope?: string[]
      [key: string]: unknown
    }
    [provider: string]: unknown
  }

  // 元数据
  metadata?: {
    user_id?: string
    email?: string
    name?: string
    avatar_url?: string
    organization?: string
    [key: string]: unknown
  }
}

// ============================================================================
// Application-Specific Tables (PostgreSQL)
// ============================================================================

// OAuth2 提供商配置表
export const oauth2Providers = pgTable('app_oauth2_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // google, microsoft, notion, github, etc.
  displayName: text('display_name').notNull(),
  logo: text('logo'),
  config: jsonb('config').$type<OAuth2ProviderConfig>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
})

// OAuth2 用户连接表
export const oauth2Connections = pgTable(
  'app_oauth2_connections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
      .notNull()
      .references(() => oauth2Providers.id, { onDelete: 'cascade' }),
    credentials: jsonb('credentials').$type<OAuth2Credentials>().notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, expired, revoked, error
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    errorCount: bigint('error_count', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    // 唯一约束：每个用户每个提供商只能有一个连接
    unique('user_provider_unique').on(table.userId, table.providerId),
    // 索引
    index('oauth2_connections_user_id_idx').on(table.userId),
    index('oauth2_connections_provider_id_idx').on(table.providerId),
    index('oauth2_connections_status_idx').on(table.status),
    index('oauth2_connections_expires_at_idx').on(table.expiresAt)
  ]
)

export const activityLogs = pgTable('app_activity_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  integrationId: text('integration_id').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull()
})

export const userProfile = pgTable('app_user_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  locale: text('locale').default('en'),
  timezone: text('timezone'),
  location: jsonb('location').$type<UserLocation>(),
  notificationSettings: jsonb(
    'notification_settings'
  ).$type<NotificationSettings>(),
  privacySettings: jsonb('privacy_settings').$type<PrivacySettings>(),
  personalizedSettings: jsonb(
    'personalized_settings'
  ).$type<PersonalizedSettings>(),
  metadata: jsonb('metadata').$type<UserProfileMetadata>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
})

export const deviceTokens = pgTable(
  'app_device_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    token: text('token').notNull(),
    platform: varchar('platform', { length: 20 }).notNull(), // 'ios' | 'android' | 'web' | 'desktop'
    deviceName: text('device_name'),
    lastUsedAt: bigint('last_used_at', { mode: 'number' }).notNull(),
    isActive: boolean('is_active').notNull().default(true), // Device is active/enabled
    isTrusted: boolean('is_trusted').notNull().default(false), // Trusted device for security
    metadata: jsonb('metadata').$type<DeviceMetadata>(), // JSON: Additional device info
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    // Unique constraint: one device per user
    unique('user_device_unique').on(table.userId, table.deviceId),
    // Index for faster queries
    index('device_user_id_idx').on(table.userId),
    index('device_platform_idx').on(table.platform),
    index('device_last_used_idx').on(table.lastUsedAt)
  ]
)

export const whatsappBinding = pgTable('app_whatsapp_binding', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  phoneNumber: text('phone_number').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  usedBy: text('used_by').references(() => user.id, { onDelete: 'cascade' }),
  usedAt: bigint('used_at', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
})

export const processedMessages = pgTable(
  'app_processed_messages',
  {
    messageId: text('message_id').primaryKey(),
    phoneNumber: text('phone_number').notNull(),
    body: jsonb('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('processed_messages_phone_number_idx').on(table.phoneNumber)
  ]
)

export const userOrders = pgTable(
  'app_user_orders',
  {
    id: text('id').primaryKey(), // Order number, e.g., "ORD-2024-001"
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),

    // stripe subscription id
    subscriptionId: text('subscription_id').notNull(), // subscription id from stripe
    // Plan information
    planId: text('plan_id').notNull(), // Plan ID for linking to plan configuration

    // Amount and payment
    amount: text('amount').notNull(), // Amount (using text for precise calculation)
    currency: varchar('currency', { length: 3 }).notNull().default('CNY'), // Currency type

    // Order status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'active' | 'expired' | 'cancelled'

    // Validity period
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),

    // Auto renewal
    autoRenew: boolean('auto_renew').notNull().default(false),

    // Metadata
    metadata: jsonb('metadata').$type<OrderMetadata>(), // Store additional information like payment details, coupons, etc.

    // Timestamps
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

// Invite codes table
export const inviteCodes = pgTable(
  'app_invite_codes',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    identifier: text('identifier'),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('active')
      .$type<'active' | 'used' | 'expired' | 'disabled'>(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null'
    })
  },
  (table) => [
    index('invite_codes_code_idx').on(table.code),
    index('invite_codes_status_idx').on(table.status),
    index('invite_codes_identifier_idx').on(table.identifier),
    index('invite_codes_created_at_idx').on(table.createdAt)
  ]
)
