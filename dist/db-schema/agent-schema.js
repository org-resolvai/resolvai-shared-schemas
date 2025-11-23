import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
// (removed) legacy conversation message types
// Memory enums
export const memoryTypeEnum = pgEnum('memory_type', [
    'action',
    'memory',
    'fact',
    'task'
]);
export const memoryStatusEnum = pgEnum('memory_status', [
    'active',
    'done',
    'ignored',
    'overridden'
]);
// Agent table
export const agents = pgTable('app_agents', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    configuration: jsonb('configuration').$type().notNull(),
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
}, (table) => [
    index('agents_created_by_idx').on(table.createdBy),
    index('agents_is_active_idx').on(table.isActive),
    unique('agents_name_unique').on(table.name) // Ensure agent names are unique
]);
// (removed) legacy agent_conversations table
// (removed) agent_usage_logs table
// User Memories table
export const userMemories = pgTable('app_user_memories', {
    id: text('id').primaryKey(),
    // User reference
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    // 1. 数据来源（通道标签，如：gmail, notion, drive）
    channelLabel: text('channel_label').notNull(),
    // 2. 引用Id - 供应商的唯一ID
    refId: text('ref_id').notNull(),
    // 3. metadata - 原始数据
    metadata: jsonb('metadata').$type(),
    // 4. 类型（任务、记忆、事实）
    type: memoryTypeEnum('type').notNull(),
    // 5. 标题
    title: text('title').notNull(),
    // 6. 内容 - JSON
    content: jsonb('content').$type().notNull(),
    // 7. 截止日期（必须由 agent 生成）
    dueDate: timestamp('due_date', { withTimezone: true }),
    // 7. 状态（活跃、完成、忽略、覆盖）
    status: memoryStatusEnum('status').notNull().default('active'),
    // 8. 标签（用户添加标签）
    labels: jsonb('labels').$type().default([]),
    // 9. 标签（用户添加标签）
    tags: jsonb('tags').$type().default([]),
    // 9. 优先级
    priority: integer('priority').default(0), // 0-5, 0 is lowest
    // 10. 描述（内容简短描述）
    description: text('description'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
}, (table) => [
    index('user_memories_user_id_idx').on(table.userId),
    index('user_memories_channel_label_idx').on(table.channelLabel),
    index('user_memories_ref_id_idx').on(table.refId),
    index('user_memories_type_idx').on(table.type),
    index('user_memories_status_idx').on(table.status),
    index('user_memories_priority_idx').on(table.priority),
    index('user_memories_created_at_idx').on(table.createdAt),
    unique('user_memories_channel_ref_unique').on(table.channelLabel, table.refId) // Ensure unique combination of channelLabel and refId
]);
