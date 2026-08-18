// DeepSeek 翻译模块
//
// 设计要点：
// 1. 使用 GM_xmlhttpRequest 跨域调用 https://api.deepseek.com/chat/completions
//    （元数据 @connect api.deepseek.com 已声明）
// 2. 批量翻译：把多条原文用 JSON 数组传给模型，要求返回 [{id, translation}]
//    一次性翻译，减少请求数与 token 浪费
// 3. 内存级缓存：同一段原文不重复请求
// 4. 失败时降级为"逐条单独翻译"，避免一条失败影响整批
// 5. 提供进度回调，UI 层可显示已翻译数量

import type { AppConfig } from './config'

export interface TranslateItem {
  id: string
  text: string
}

export interface TranslateResult {
  id: string
  original: string
  translation: string
  error?: string
}

export type ProgressFn = (done: number, total: number) => void

const API_URL = 'https://api.deepseek.com/chat/completions'

// 内存缓存：原文 -> 译文（同次会话内有效）
const cache = new Map<string, string>()

// 油猴 GM_xmlhttpRequest 的最小声明
interface GMResponse {
  status: number
  statusText: string
  responseText: string
}
type GMRequestDetails = {
  method: 'GET' | 'POST'
  url: string
  headers?: Record<string, string>
  data?: string
  timeout?: number
  onload: (res: GMResponse) => void
  onerror: (err: unknown) => void
  ontimeout?: () => void
}
declare const GM_xmlhttpRequest: (details: GMRequestDetails) => void

// gmFetch 入参：不包含回调字段（由 Promise 内部注入）
type GmFetchOptions = Omit<GMRequestDetails, 'onload' | 'onerror' | 'ontimeout'>

function gmFetch(opts: GmFetchOptions): Promise<GMResponse> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      ...opts,
      timeout: opts.timeout ?? 60000,
      onload: resolve,
      onerror: reject,
      ontimeout: () => reject(new Error('DeepSeek 请求超时')),
    })
  })
}

// 调用 DeepSeek chat 接口完成一次补全
// 适配新模型：deepseek-v4-pro / deepseek-v4-flash（支持 thinking 与 reasoning_effort）
// 兼容旧模型：deepseek-chat / deepseek-reasoner（不带这两个字段）
async function chat(config: AppConfig, system: string, user: string): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    stream: false,
  }

  // v4 系列支持 thinking + reasoning_effort；旧模型忽略这两个字段
  if (/^deepseek-v4/.test(config.model)) {
    body.thinking = { type: 'enabled' }
    body.reasoning_effort = 'high'
  }

  const res = await gmFetch({
    method: 'POST',
    url: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    data: JSON.stringify(body),
  })

  if (res.status === 401) throw new Error('API Key 无效或已过期')
  if (res.status === 429) throw new Error('请求过于频繁，请稍后再试')
  if (res.status >= 500) throw new Error(`DeepSeek 服务异常 (${res.status})`)
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`DeepSeek 请求失败：${res.status} ${res.statusText}`)
  }

  // v4 thinking 模型可能返回 reasoning_content + content，仅取最终 content
  let payload: {
    choices?: { message?: { content?: string; reasoning_content?: string } }[]
  }
  try {
    payload = JSON.parse(res.responseText)
  } catch {
    throw new Error('DeepSeek 返回非 JSON')
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 返回为空')
  return content
}

// 解析模型返回的 JSON 数组，容错处理代码块包裹
function parseBatch(content: string, expectedIds: Set<string>): TranslateResult[] {
  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/g, '').trim()
  let arr: unknown
  try {
    arr = JSON.parse(cleaned)
  } catch {
    // 尝试截取首个 [ 到末尾 ] 之间的内容
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1) throw new Error('无法解析批量翻译返回')
    arr = JSON.parse(cleaned.slice(start, end + 1))
  }
  if (!Array.isArray(arr)) throw new Error('批量翻译返回非数组')

  return (arr as Array<{ id?: string; translation?: string; text?: string; original?: string }>).map(
    (item) => {
      const id = String(item.id ?? '')
      const translation = String(item.translation ?? item.text ?? '').trim()
      return {
        id,
        original: '', // 由上层回填
        translation,
        error: expectedIds.has(id) && translation ? undefined : '返回缺失字段',
      }
    },
  )
}

// 批量翻译：一次请求处理多条
export async function translateBatch(
  config: AppConfig,
  items: TranslateItem[],
  onProgress?: ProgressFn,
): Promise<TranslateResult[]> {
  if (!config.apiKey) {
    throw new Error('未配置 DeepSeek API Key，请通过菜单设置')
  }

  // 命中缓存的不进入请求
  const todo: TranslateItem[] = []
  const results: TranslateResult[] = []
  for (const item of items) {
    const cached = cache.get(item.text)
    if (cached) {
      results.push({ id: item.id, original: item.text, translation: cached })
    } else {
      todo.push(item)
    }
  }
  onProgress?.(results.length, items.length)

  if (todo.length === 0) return results

  const expectedIds = new Set(todo.map((i) => i.id))
  const system = [
    `你是一个专业翻译引擎。把用户提供的 JSON 数组里每条 text 翻译成${config.targetLang}。`,
    '严格输出 JSON 数组，元素形如 {"id":原id, "translation":译文}，不要添加解释或多余文本。',
    '保留原文中的代码、URL、变量名占位符（如 {name}、%s）不变。',
  ].join('\n')

  const user = JSON.stringify(
    todo.map((i) => ({ id: i.id, text: i.text })),
  )

  let batchResult: TranslateResult[]
  try {
    const content = await chat(config, system, user)
    batchResult = parseBatch(content, expectedIds)
  } catch (err) {
    // 整批失败：降级为逐条单独翻译，尽量保住结果
    batchResult = await translateOneByOne(config, todo)
  }

  // 按 id 对齐原文，命中缓存
  const byId = new Map(batchResult.map((r) => [r.id, r]))
  for (const item of todo) {
    const r = byId.get(item.id)
    const translation = r?.translation ?? ''
    const error = r?.error || (translation ? undefined : '未返回译文')
    if (translation) cache.set(item.text, translation)
    results.push({ id: item.id, original: item.text, translation, error })
    onProgress?.(results.length, items.length)
  }

  return results
}

// 降级：逐条单独翻译
async function translateOneByOne(
  config: AppConfig,
  items: TranslateItem[],
): Promise<TranslateResult[]> {
  const out: TranslateResult[] = []
  for (const item of items) {
    try {
      const content = await chat(
        config,
        `你是一个专业翻译引擎，把用户文本翻译成${config.targetLang}，仅输出译文。`,
        item.text,
      )
      const translation = content.trim()
      if (translation) cache.set(item.text, translation)
      out.push({ id: item.id, original: item.text, translation })
    } catch (err) {
      out.push({
        id: item.id,
        original: item.text,
        translation: '',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}
