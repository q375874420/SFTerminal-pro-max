<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useConfigStore } from '../stores/config'
import { useTerminalStore } from '../stores/terminal'
import { getTheme } from '../themes'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{
  tabId: string
  ptyId: string
  type: 'local' | 'ssh'
  isActive: boolean
}>()

const configStore = useConfigStore()
const terminalStore = useTerminalStore()

const terminalRef = ref<HTMLDivElement | null>(null)
let terminal: XTerm | null = null
let fitAddon: FitAddon | null = null
let searchAddon: SearchAddon | null = null
let unsubscribe: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

// 初始化终端
onMounted(async () => {
  if (!terminalRef.value) return

  // 获取主题
  const theme = getTheme(configStore.currentTheme)
  const settings = configStore.terminalSettings

  // 创建终端实例
  terminal = new XTerm({
    theme,
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    cursorBlink: settings.cursorBlink,
    cursorStyle: settings.cursorStyle,
    scrollback: settings.scrollback,
    allowProposedApi: true,
    convertEol: true
  })

  // 加载插件
  fitAddon = new FitAddon()
  searchAddon = new SearchAddon()
  const webLinksAddon = new WebLinksAddon()

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.loadAddon(webLinksAddon)

  // 挂载到 DOM
  terminal.open(terminalRef.value)

  // 适配大小
  await nextTick()
  fitAddon.fit()

  // 更新后端 PTY 大小
  const { cols, rows } = terminal
  await terminalStore.resizeTerminal(props.tabId, cols, rows)

  // 监听用户输入
  terminal.onData(data => {
    terminalStore.writeToTerminal(props.tabId, data)
  })

  // 订阅后端数据
  if (props.type === 'local') {
    unsubscribe = window.electronAPI.pty.onData(props.ptyId, (data: string) => {
      terminal?.write(data)
    })
  } else {
    unsubscribe = window.electronAPI.ssh.onData(props.ptyId, (data: string) => {
      terminal?.write(data)
    })
  }

  // 监听窗口大小变化
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon && props.isActive) {
      fitAddon.fit()
      if (terminal) {
        terminalStore.resizeTerminal(props.tabId, terminal.cols, terminal.rows)
      }
    }
  })
  resizeObserver.observe(terminalRef.value)
})

// 清理
onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (terminal) {
    terminal.dispose()
  }
})

// 当标签页激活时，重新适配大小并聚焦
watch(
  () => props.isActive,
  async active => {
    if (active && terminal && fitAddon) {
      await nextTick()
      fitAddon.fit()
      terminal.focus()
      await terminalStore.resizeTerminal(props.tabId, terminal.cols, terminal.rows)
    }
  }
)

// 监听主题变化
watch(
  () => configStore.currentTheme,
  themeName => {
    if (terminal) {
      const theme = getTheme(themeName)
      terminal.options.theme = theme
    }
  }
)

// 暴露方法供外部调用
defineExpose({
  focus: () => terminal?.focus(),
  search: (text: string) => searchAddon?.findNext(text),
  clear: () => terminal?.clear()
})
</script>

<template>
  <div ref="terminalRef" class="terminal"></div>
</template>

<style scoped>
.terminal {
  width: 100%;
  height: 100%;
  padding: 8px;
}

.terminal :deep(.xterm) {
  height: 100%;
}

.terminal :deep(.xterm-viewport) {
  overflow-y: auto;
}

.terminal :deep(.xterm-screen) {
  height: 100%;
}
</style>

