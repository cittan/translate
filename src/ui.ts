// UI 浮层
//
// 设计要点：
// 1. 右下角悬浮面板：触发按钮 + 翻译结果并排展示区
// 2. 三种状态：idle（按钮）/ loading（进度）/ done（结果列表 + 关闭按钮）
// 3. 原文与译文成对展示，便于对照
// 4. 全部用 inline style + 唯一 id 命名空间，避免污染宿主页面样式
// 5. 支持移动端：触摸拖动面板，关闭按钮足够大

import type { TranslateResult } from './translator'

const ROOT_ID = 'ai-tr-root'
const STYLE_ID = 'ai-tr-style'

const STYLE = `
#${ROOT_ID} {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: #1f2328;
  border: 1px solid #d0d7de;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
}
#${ROOT_ID} * { box-sizing: border-box; }
#${ROOT_ID} .ai-tr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: #f6f8fa;
  border-bottom: 1px solid #d0d7de;
  cursor: move;
  user-select: none;
  touch-action: none;
}
#${ROOT_ID} .ai-tr-title { font-weight: 600; font-size: 14px; }
#${ROOT_ID} .ai-tr-close {
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  color: #57606a;
  border-radius: 6px;
}
#${ROOT_ID} .ai-tr-close:hover { background: #eaeef2; }
#${ROOT_ID} .ai-tr-body {
  padding: 12px 14px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
#${ROOT_ID} .ai-tr-item {
  border-bottom: 1px solid #eaeef2;
  padding: 8px 0;
}
#${ROOT_ID} .ai-tr-item:last-child { border-bottom: none; }
#${ROOT_ID} .ai-tr-orig {
  color: #57606a;
  font-size: 12px;
  margin-bottom: 4px;
}
#${ROOT_ID} .ai-tr-trans { color: #1f2328; }
#${ROOT_ID} .ai-tr-error { color: #cf222e; font-size: 12px; }
#${ROOT_ID} .ai-tr-empty { color: #57606a; text-align: center; padding: 24px 0; }
#${ROOT_ID} .ai-tr-progress {
  height: 4px;
  background: #eaeef2;
  border-radius: 2px;
  overflow: hidden;
  margin: 8px 0;
}
#${ROOT_ID} .ai-tr-progress-bar {
  height: 100%;
  background: #2f81f7;
  width: 0%;
  transition: width 0.2s ease;
}
#${ROOT_ID} .ai-tr-fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2f81f7;
  color: #ffffff;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
}
#${ROOT_ID} .ai-tr-fab:active { transform: scale(0.95); }
`

interface PanelHandles {
  root: HTMLElement
  body: HTMLElement
  progress?: HTMLDivElement
  progressText?: HTMLSpanElement
}

let fab: HTMLButtonElement | null = null
let panel: HTMLElement | null = null
let handles: PanelHandles | null = null

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE
  document.head.appendChild(style)
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID) as HTMLElement | null
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    document.documentElement.appendChild(root)
  }
  return root
}

function closePanel(): void {
  if (panel) {
    panel.remove()
    panel = null
    handles = null
  }
  if (!fab) showFab()
}

function showFab(): void {
  if (fab) return
  const root = ensureRoot()
  ensureStyle()
  fab = document.createElement('button')
  fab.className = 'ai-tr-fab'
  fab.type = 'button'
  fab.textContent = '文'
  fab.title = 'AI 整页翻译'
  fab.addEventListener('click', () => {
    fab?.remove()
    fab = null
    onFabClick()
  })
  root.appendChild(fab)
}

// 由 main.ts 注入的实际翻译入口
let onFabClick: () => void = () => {
  /* 默认 noop，由入口覆盖 */
}
export function setOnFabClick(fn: () => void): void {
  onFabClick = fn
}

export interface PanelOptions {
  title?: string
}

export function openPanel(opts: PanelOptions = {}): PanelHandles {
  ensureStyle()
  const root = ensureRoot()
  closePanel()

  panel = document.createElement('div')
  const header = document.createElement('div')
  header.className = 'ai-tr-header'
  const title = document.createElement('span')
  title.className = 'ai-tr-title'
  title.textContent = opts.title ?? 'AI 翻译'
  const closeBtn = document.createElement('button')
  closeBtn.className = 'ai-tr-close'
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', closePanel)
  header.appendChild(title)
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'ai-tr-body'

  panel.appendChild(header)
  panel.appendChild(body)
  root.appendChild(panel)

  enableDrag(panel, header)

  handles = { root: panel, body }
  return handles
}

export function showLoading(text: string = '正在提取并翻译…'): void {
  if (!handles) return
  handles.body.innerHTML = `
    <div class="ai-tr-empty">${escapeHtml(text)}</div>
    <div class="ai-tr-progress"><div class="ai-tr-progress-bar"></div></div>
  `
  handles.progress = handles.body.querySelector('.ai-tr-progress-bar') as HTMLDivElement
}

export function updateProgress(done: number, total: number): void {
  if (!handles?.progress) return
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  handles.progress.style.width = `${pct}%`
  const text = handles.body.querySelector('.ai-tr-empty')
  if (text) text.textContent = `正在翻译 ${done}/${total}（${pct}%）`
}

export function showResults(results: TranslateResult[]): void {
  if (!handles) return
  if (results.length === 0) {
    handles.body.innerHTML = '<div class="ai-tr-empty">未在页面发现可翻译的外文</div>'
    return
  }
  const items = results
    .map(
      (r) => `
      <div class="ai-tr-item">
        <div class="ai-tr-orig">${escapeHtml(r.original)}</div>
        ${
          r.error
            ? `<div class="ai-tr-error">翻译失败：${escapeHtml(r.error)}</div>`
            : `<div class="ai-tr-trans">${escapeHtml(r.translation)}</div>`
        }
      </div>
    `,
    )
    .join('')
  handles.body.innerHTML = items
}

export function showError(message: string): void {
  if (!handles) return
  handles.body.innerHTML = `<div class="ai-tr-error">${escapeHtml(message)}</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 拖动支持（移动端触摸 + 桌面鼠标）
function enableDrag(panel: HTMLElement, handle: HTMLElement): void {
  let startX = 0
  let startY = 0
  let origRight = 0
  let origBottom = 0
  let dragging = false

  function onMove(clientX: number, clientY: number): void {
    if (!dragging) return
    const dx = clientX - startX
    const dy = clientY - startY
    const newRight = Math.max(0, origRight - dx)
    const newBottom = Math.max(0, origBottom - dy)
    panel.style.right = `${newRight}px`
    panel.style.bottom = `${newBottom}px`
  }

  handle.addEventListener('mousedown', (e) => {
    dragging = true
    startX = e.clientX
    startY = e.clientY
    const rect = panel.getBoundingClientRect()
    origRight = window.innerWidth - rect.right
    origBottom = window.innerHeight - rect.bottom
    e.preventDefault()
  })
  handle.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    dragging = true
    startX = t.clientX
    startY = t.clientY
    const rect = panel.getBoundingClientRect()
    origRight = window.innerWidth - rect.right
    origBottom = window.innerHeight - rect.bottom
  }, { passive: true })

  document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY))
  document.addEventListener('mouseup', () => (dragging = false))
  document.addEventListener('touchmove', (e) => {
    if (!dragging) return
    const t = e.touches[0]
    onMove(t.clientX, t.clientY)
  }, { passive: true })
  document.addEventListener('touchend', () => (dragging = false))
}

export function init(): void {
  ensureStyle()
  ensureRoot()
  if (!fab && !panel) showFab()
}
