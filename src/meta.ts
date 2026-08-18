import type { UserScript } from 'vite-plugin-monkey'

// 油猴脚本元数据
// name/version/namespace 用于 Tampermonkey 唯一标识一个脚本
export const meta: UserScript = {
  name: 'AI 整页翻译 (DeepSeek)',
  namespace: 'https://github.com/your-name/ai-page-translator',
  version: '0.1.0',
  description: '一键翻译当前页面外文为中文，使用 DeepSeek；跨端可用（桌面/Android/iOS）。',
  author: 'your-name',
  // 默认对所有 http(s) 页面生效
  match: ['*://*/*'],
  icon: 'https://www.deepseek.com/favicon.ico',
  grant: [
    'GM_xmlhttpRequest', // 跨域调用 DeepSeek API
    'GM_setValue',       // 持久化 API Key
    'GM_getValue',
    'GM_registerMenuCommand', // 油猴菜单触发整页翻译
  ],
  // Tampermonkey 跨域请求需要声明连接的目标域名
  connect: ['api.deepseek.com'],
}
