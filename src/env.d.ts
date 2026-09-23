/// <reference types="vite/client" />

/**
 * 构建期注入的飞书配置（见 vite.config.ts 的 define）。
 *
 * 值来自 GitHub Actions Secret；本地不设环境变量时是空串，
 * 页面走演示模式 —— 这是安全的默认值，不会误发。
 */
declare const __FEISHU_WEBHOOK__: string
declare const __FEISHU_SECRET__: string
declare const __FEISHU_MESSAGE_TYPE__: string
