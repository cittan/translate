// 图片文字 OCR 提取
//
// 设计要点：
// 1. 扫描页面所有 <img>，跳过太小（图标）与跨域加载失败
// 2. 调用 Tesseract.js（通过 @require 引入，挂在 window.Tesseract）
// 3. 仅识别英文（eng），把结果作为一段文本进入翻译批次
// 4. 失败的单张图片不阻断整体流程
// 5. 进度回调：每张图识别完都通知一次

import type { TranslateItem } from './translator'

// 声明 @require 注入的全局
declare global {
  interface Window {
    Tesseract?: {
      recognize: (
        image: HTMLImageElement | string,
        langs: string,
        options?: { logger?: (m: { status: string; progress: number }) => void },
      ) => Promise<{ data: { text: string } }>
    }
  }
}

// 跳过尺寸过小的图片（图标/装饰）
const MIN_WIDTH = 80
const MIN_HEIGHT = 32

export interface ImageExtractResult {
  items: TranslateItem[]      // 识别出的文本片段（已分配 id）
  totalImages: number        // 扫描到的图片总数
  recognized: number         // 成功识别出文字的图片数
  skipped: number            // 跳过的图片数（太小/跨域/无文字）
  errors: string[]           // 单张图片的错误信息
}

function ensureTesseractReady(): boolean {
  if (typeof window.Tesseract?.recognize !== 'function') {
    console.warn('[AI翻译] Tesseract.js 未加载，跳过图片 OCR')
    return false
  }
  return true
}

function shouldSkip(img: HTMLImageElement): string | null {
  if (!img.complete || img.naturalWidth === 0) return '未加载'
  if (img.naturalWidth < MIN_WIDTH || img.naturalHeight < MIN_HEIGHT) return '太小'
  // 跨域图片：canvas 取数据会抛错，但 Tesseract 用 fetch 加载，跨域需 CORS
  // 简单跳过明显跨域且无 CORS 头的图（运行时 fetch 失败会再过滤）
  return null
}

let imgCounter = 0
function nextImgId(): string {
  imgCounter += 1
  return `ai-tr-img-${Date.now().toString(36)}-${imgCounter}`
}

export async function extractImageText(
  root: Node = document.body,
  onProgress?: (done: number, total: number) => void,
): Promise<ImageExtractResult> {
  const result: ImageExtractResult = {
    items: [],
    totalImages: 0,
    recognized: 0,
    skipped: 0,
    errors: [],
  }

  if (!ensureTesseractReady()) return result

  const imgs = Array.from((root as ParentNode).querySelectorAll<HTMLImageElement>('img'))
  result.totalImages = imgs.length
  onProgress?.(0, result.totalImages)

  let done = 0
  for (const img of imgs) {
    const skipReason = shouldSkip(img)
    if (skipReason) {
      result.skipped += 1
      done += 1
      onProgress?.(done, result.totalImages)
      continue
    }

    try {
      const src = img.currentSrc || img.src
      const { data } = await window.Tesseract!.recognize(src, 'eng', {
        logger: (m) => {
          // 单张图的内部进度不外抛，避免 UI 抖动
          if (m.status === 'recognizing text') {
            // 可选：在这里更新单张图的状态
          }
        },
      })
      const text = (data?.text ?? '').trim()
      if (text.length >= 2) {
        result.items.push({ id: nextImgId(), text })
        result.recognized += 1
      } else {
        result.skipped += 1
      }
    } catch (err) {
      result.skipped += 1
      result.errors.push(
        `图片识别失败（${img.src.slice(0, 60)}）：${err instanceof Error ? err.message : String(err)}`,
      )
    }
    done += 1
    onProgress?.(done, result.totalImages)
  }

  return result
}
