// 用户配置：API Key 持久化在油猴存储中
// 首次运行时通过 GM 注册的菜单项输入，避免硬编码进 git

export interface AppConfig {
  apiKey: string
  model: string
  targetLang: string
}

const DEFAULTS: Omit<AppConfig, 'apiKey'> = {
  model: 'deepseek-chat',
  targetLang: '中文',
}

declare const GM_getValue: <T = unknown>(key: string, defaultValue: T) => T
declare const GM_setValue: (key: string, value: unknown) => void

const KEY_API_KEY = 'ds_api_key'
const KEY_MODEL = 'ds_model'
const KEY_LANG = 'ds_target_lang'

export function loadConfig(): AppConfig {
  return {
    apiKey: GM_getValue<string>(KEY_API_KEY, ''),
    model: GM_getValue<string>(KEY_MODEL, DEFAULTS.model),
    targetLang: GM_getValue<string>(KEY_LANG, DEFAULTS.targetLang),
  }
}

export function saveApiKey(key: string): void {
  GM_setValue(KEY_API_KEY, key.trim())
}

export function saveModel(model: string): void {
  GM_setValue(KEY_MODEL, model.trim() || DEFAULTS.model)
}
