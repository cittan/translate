// 脚本入口：第 1 步仅注册占位菜单，确认骨架跑通
// 后续步骤将把 extract / translator / ui 串接到此处

declare const GM_registerMenuCommand: (
  name: string,
  fn: () => void,
  opts?: { id?: string; autoClose?: boolean },
) => void

const LOG_PREFIX = '[AI翻译]'

function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(LOG_PREFIX, ...args)
}

function bootstrap(): void {
  GM_registerMenuCommand('🔍 翻译当前页面（占位）', () => {
    log('骨架已就绪，待接入翻译流程')
    alert('AI 翻译：骨架已就绪，待接入提取/翻译/UI 模块')
  })

  log('脚本已加载，菜单项已注册')
}

bootstrap()
