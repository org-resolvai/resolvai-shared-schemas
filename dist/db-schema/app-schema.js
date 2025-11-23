import { bigint, boolean, index, jsonb, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
// ============================================================================
// Application-Specific Tables (PostgreSQL)
// ============================================================================
// OAuth2 提供商配置表
export const oauth2Providers = pgTable('app_oauth2_providers', {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(), // google, microsoft, notion, github, etc.
    displayName: text('display_name').notNull(),
    logo: text('logo'),
    config: jsonb('config').$type().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
});
// OAuth2 用户连接表
export const oauth2Connections = pgTable('app_oauth2_connections', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
        .notNull()
        .references(() => oauth2Providers.id, { onDelete: 'cascade' }),
    credentials: jsonb('credentials').$type().notNull(),
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
}, (table) => [
    // 唯一约束：每个用户每个提供商只能有一个连接
    unique('user_provider_unique').on(table.userId, table.providerId),
    // 索引
    index('oauth2_connections_user_id_idx').on(table.userId),
    index('oauth2_connections_provider_id_idx').on(table.providerId),
    index('oauth2_connections_status_idx').on(table.status),
    index('oauth2_connections_expires_at_idx').on(table.expiresAt)
]);
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
});
export const userProfile = pgTable('app_user_profile', {
    userId: text('user_id')
        .primaryKey()
        .references(() => user.id, { onDelete: 'cascade' }),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    locale: text('locale').default('en'),
    timezone: text('timezone'),
    location: jsonb('location').$type(),
    notificationSettings: jsonb('notification_settings').$type(),
    privacySettings: jsonb('privacy_settings').$type(),
    personalizedSettings: jsonb('personalized_settings').$type(),
    metadata: jsonb('metadata').$type(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
});
export const deviceTokens = pgTable('app_device_tokens', {
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
    metadata: jsonb('metadata').$type(), // JSON: Additional device info
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
}, (table) => [
    // Unique constraint: one device per user
    unique('user_device_unique').on(table.userId, table.deviceId),
    // Index for faster queries
    index('device_user_id_idx').on(table.userId),
    index('device_platform_idx').on(table.platform),
    index('device_last_used_idx').on(table.lastUsedAt)
]);
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
});
export const processedMessages = pgTable('app_processed_messages', {
    messageId: text('message_id').primaryKey(),
    phoneNumber: text('phone_number').notNull(),
    body: jsonb('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull()
}, (table) => [
    index('processed_messages_phone_number_idx').on(table.phoneNumber)
]);
export const userOrders = pgTable('app_user_orders', {
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
    metadata: jsonb('metadata').$type(), // Store additional information like payment details, coupons, etc.
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
}, (table) => [
    index('user_orders_user_id_idx').on(table.userId),
    index('user_orders_subscription_id_idx').on(table.subscriptionId),
    index('user_orders_status_idx').on(table.status),
    index('user_orders_start_date_idx').on(table.startDate)
]);
// User Jobs table for async task generation
export const userJobs = pgTable('app_user_jobs', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    jobType: varchar('job_type', { length: 50 })
        .notNull()
        .default('task_generation'), // job type: task_generation, etc.
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed
    context: jsonb('context').$type(), // Store job context and metadata
    result: jsonb('result'), // Store job result data
    errorMessage: text('error_message'), // Store error message if failed
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
}, (table) => [
    index('user_jobs_user_id_idx').on(table.userId),
    index('user_jobs_status_idx').on(table.status),
    index('user_jobs_job_type_idx').on(table.jobType),
    index('user_jobs_created_at_idx').on(table.createdAt)
]);
// Invite codes table
export const inviteCodes = pgTable('app_invite_codes', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    identifier: text('identifier'),
    status: varchar('status', { length: 20 })
        .notNull()
        .default('active')
        .$type(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    createdBy: text('created_by').references(() => user.id, {
        onDelete: 'set null'
    })
}, (table) => [
    index('invite_codes_code_idx').on(table.code),
    index('invite_codes_status_idx').on(table.status),
    index('invite_codes_identifier_idx').on(table.identifier),
    index('invite_codes_created_at_idx').on(table.createdAt)
]);
