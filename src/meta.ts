import type { UserScript } from 'vite-plugin-monkey'

// 油猴脚本元数据
// name/version/namespace 用于 Tampermonkey 唯一标识一个脚本
export const meta: UserScript = {
  name: 'AI 整页翻译 (DeepSeek)',
  namespace: 'https://github.com/your-name/ai-page-translator',
  version: '0.2.0',
  description: '一键翻译当前页面外文为中文（含图片 OCR），使用 DeepSeek；跨端可用。',
  author: 'your-name',
  // 默认对所有 http(s) 页面生效
  match: ['*://*/*'],
  icon: 'https://www.deepseek.com/favicon.ico',
  grant: [
    'GM_xmlhttpRequest', // 跨域调用 DeepSeek API
    'GM_setValue',       // 持久化 API Key
    'GM_getValue',
    'GM_registerMenuCommand', // 油猴菜单触发整页翻译
    'GM_getResourceText', // 读取 @require 资源
  ],
  // Tampermonkey 跨域请求需要声明连接的目标域名
  connect: ['api.deepseek.com'],
  // 引入 Tesseract.js 用于识别图片中的外文文字
  // 运行时会从 CDN 拉取 wasm 与 worker，首次识别较慢
  require: [
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  ],
}
