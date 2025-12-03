<script setup lang="ts">
import { computed } from 'vue'
import { useTerminalStore } from '../stores/terminal'
import Terminal from './Terminal.vue'

const terminalStore = useTerminalStore()

const _activeTab = computed(() => terminalStore.activeTab)
</script>

<template>
  <div class="terminal-container">
    <template v-if="terminalStore.tabs.length > 0">
      <div
        v-for="tab in terminalStore.tabs"
        :key="tab.id"
        class="terminal-wrapper"
        :class="{ active: tab.id === terminalStore.activeTabId }"
      >
        <Terminal
          v-if="tab.ptyId"
          :tab-id="tab.id"
          :pty-id="tab.ptyId"
          :type="tab.type"
          :is-active="tab.id === terminalStore.activeTabId"
        />
        <div v-else-if="tab.isLoading" class="terminal-loading">
          <div class="loading-spinner"></div>
          <span>正在连接...</span>
        </div>
        <div v-else class="terminal-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>连接失败</span>
          <button class="btn btn-sm" @click="terminalStore.closeTab(tab.id)">关闭</button>
        </div>
      </div>
    </template>
    <div v-else class="terminal-empty">
      <div class="empty-content">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        <h3>欢迎使用旗鱼终端</h3>
        <p>点击 + 按钮创建新的终端会话</p>
        <button class="btn btn-primary" @click="terminalStore.createTab('local')">
          新建本地终端
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.terminal-wrapper {
  display: none;
  flex: 1;
  overflow: hidden;
}

.terminal-wrapper.active {
  display: flex;
}

.terminal-loading,
.terminal-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bg-surface);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.terminal-error svg {
  color: var(--accent-error);
  opacity: 0.8;
}

.terminal-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.empty-content h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-content p {
  font-size: 14px;
  color: var(--text-muted);
}
</style>

