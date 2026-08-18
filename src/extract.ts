// 页面外文文本提取
//
// 设计要点：
// 1. 用 TreeWalker 遍历文本节点，避免选中 script/style/textarea 等不可见或不可译内容
// 2. 通过"拉丁/西里尔/阿拉伯字符占比"判定外文，避免在中文页面误译
// 3. 返回结构化数组：原文 + 文本节点引用，便于 UI 并排展示或原地回填译文
// 4. 通过节点的 data-id 标记，保证同一段文本不会重复进入翻译队列

export interface ExtractedText {
  id: string        // 唯一标识（同时写入节点 data-ai-tr-id，便于回填）
  node: Text        // 原始文本节点引用
  original: string  // trim 后的原文（保留用于批量翻译）
}

// 不进入子树的元素：脚本/样式/输入/代码/可编辑区/已标记不译
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT',
  'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'BUTTON',
  'CODE', 'KBD', 'SAMP', 'VAR', 'PRE',
  'SVG', 'MATH', 'TEMPLATE',
])

const MARK_ATTR = 'data-ai-tr-id'

function isSkippable(el: Element | null): boolean {
  if (!el) return false
  if (SKIP_TAGS.has(el.tagName)) return true
  if (el.hasAttribute('contenteditable')) return true
  if (el.getAttribute('translate') === 'no') return true
  if (el.hasAttribute(MARK_ATTR)) return true // 已被收集过
  return false
}

// 判定为外文：拉丁字母数量 > CJK 数量，或含西里尔/阿拉伯等
function isForeign(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  // 纯数字/符号
  if (!/[A-Za-z\u00C0-\u024F]/.test(trimmed) && !/[\u0400-\u04FF\u0600-\u06FF]/.test(trimmed)) {
    return false
  }
  const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = (trimmed.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
  if (latin <= cjk) return false
  // 至少有一个 ≥2 字母的英文单词，避免 "x y" 这种零散字符
  return /[A-Za-z]{2,}/.test(trimmed)
}

let counter = 0
function nextId(): string {
  counter += 1
  return `ai-tr-${Date.now().toString(36)}-${counter}`
}

export function extractForeignText(root: Node = document.body): ExtractedText[] {
  const result: ExtractedText[] = []
  const seen = new Set<string>()

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text): number {
      const parent = node.parentElement
      if (isSkippable(parent)) return NodeFilter.FILTER_REJECT
      const text = node.nodeValue ?? ''
      if (!text.trim()) return NodeFilter.FILTER_REJECT
      if (!isForeign(text)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let current: Node | null
  while ((current = walker.nextNode())) {
    const textNode = current as Text
    const original = textNode.nodeValue?.trim() ?? ''
    if (!original || seen.has(original)) continue
    seen.add(original)

    const id = nextId()
    const parent = textNode.parentElement
    if (parent) parent.setAttribute(MARK_ATTR, id)

    result.push({ id, node: textNode, original })
  }

  return result
}

// 清理：移除本脚本写下的 data-ai-tr-id 标记
export function clearMarks(root: Node = document.body): void {
  const marked = (root as ParentNode).querySelectorAll(`[${MARK_ATTR}]`)
  marked.forEach((el) => el.removeAttribute(MARK_ATTR))
}
