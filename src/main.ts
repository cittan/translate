// 脚本入口
//
// 流程：
// 1. 注册油猴菜单项：设置 API Key / 切换模型 / 翻译当前页面
// 2. 初始化右下角悬浮按钮（点击触发整页翻译）
// 3. 翻译流程：extract -> translateBatch -> ui.showResults
// 4. 翻译失败时清理标记，避免下次无法重新提取

import { clearMarks, extractForeignText } from './extract'
import { loadConfig, saveApiKey, saveModel } from './config'
import {
  init as initUi,
  openPanel,
  setOnFabClick,
  showError,
  showLoading,
  showResults,
  updateProgress,
} from './ui'
import { translateBatch } from './translator'

declare const GM_registerMenuCommand: (
  name: string,
  fn: () => void,
  opts?: { id?: string; autoClose?: boolean },
) => void
declare const GM_setValue: (key: string, value: unknown) => void
declare const GM_getValue: <T = unknown>(key: string, defaultValue: T) => T

const LOG_PREFIX = '[AI翻译]'

function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(LOG_PREFIX, ...args)
}

// 简易 prompt 包装，便于在油猴菜单中收集输入
function promptString(message: string, defaultValue = ''): string | null {
  // 浏览器原生 prompt 在移动端 Tampermonkey 中也可用
  return window.prompt(message, defaultValue)
}

function menuSetApiKey(): void {
  const current = GM_getValue<string>('ds_api_key', '')
  const input = promptString('请输入 DeepSeek API Key（sk- 开头）：', current)
  if (input == null) return
  saveApiKey(input)
  alert(input.trim() ? 'API Key 已保存' : 'API Key 已清空')
}

function menuSetModel(): void {
  const current = GM_getValue<string>('ds_model', 'deepseek-v4-pro')
  const input = promptString(
    '请输入模型名（deepseek-v4-pro 更准 / deepseek-v4-flash 更快）：',
    current,
  )
  if (input == null) return
  saveModel(input)
  alert('模型已保存：' + input.trim())
}

let translating = false
async function translateCurrentPage(): Promise<void> {
  if (translating) return
  translating = true

  const config = loadConfig()
  if (!config.apiKey) {
    alert('请先通过油猴菜单「设置 DeepSeek API Key」配置密钥')
    translating = false
    return
  }

  openPanel({ title: 'AI 翻译' })
  showLoading('正在提取页面外文…')

  try {
    const items = extractForeignText(document.body)
    if (items.length === 0) {
      showResults([])
      return
    }

    showLoading(`正在翻译 0/${items.length}（0%）`)
    const results = await translateBatch(
      config,
      items.map((i) => ({ id: i.id, text: i.original })),
      (done, total) => updateProgress(done, total),
    )
    showResults(results)
    log(`翻译完成：${results.length} 条，失败 ${results.filter((r) => r.error).length} 条`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    showError(`翻译失败：${msg}`)
    log('翻译失败', err)
    // 失败时清理标记，便于用户重试
    clearMarks(document.body)
  } finally {
    translating = false
  }
}

function bootstrap(): void {
  GM_registerMenuCommand('🔍 翻译当前页面', translateCurrentPage)
  GM_registerMenuCommand('🔑 设置 DeepSeek API Key', menuSetApiKey)
  GM_registerMenuCommand('🛠 设置模型', menuSetModel)

  initUi()
  setOnFabClick(translateCurrentPage)

  log('脚本已加载，菜单项已注册，悬浮按钮已就绪')
}

bootstrap()
