/**
 * 上下文统计 composable
 * 估算 Token 使用量和上下文统计
 */
import { computed, Ref, ComputedRef } from 'vue'
import type { AiMessage, AgentStep } from '../stores/terminal'

// Agent 状态类型
interface AgentState {
  isRunning: boolean
  agentId?: string
  steps: AgentStep[]
  pendingConfirm?: unknown
  userTask?: string
  finalResult?: string
  history: Array<{ userTask: string; finalResult: string }>
}

// AI Profile 类型
interface AiProfile {
  id: string
  name: string
  apiUrl: string
  apiKey: string
  model: string
  proxy?: string
  contextLength?: number
}

// 上下文统计结果
export interface ContextStatsResult {
  messageCount: number
  tokenEstimate: number
  maxTokens: number
  percentage: number
}

export function useContextStats(
  agentMode: Ref<boolean>,
  messages: ComputedRef<AiMessage[]>,
  agentState: ComputedRef<AgentState | undefined>,
  agentUserTask: ComputedRef<string | undefined>,
  activeAiProfile: ComputedRef<AiProfile | null | undefined>
) {
  // 估算文本的 token 数量
  // 中文：约 1.5 字符/token，英文：约 4 字符/token
  const estimateTokens = (text: string): number => {
    if (!text) return 0
    
    // 统计中文字符数量
    const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
    // 非中文字符数量
    const otherChars = text.length - chineseChars
    
    // 中文约 1.5 字符/token，英文约 4 字符/token
    return Math.ceil(chineseChars / 1.5 + otherChars / 4)
  }

  // 计算上下文使用情况
  // 这个估算反映的是发送给 AI 的实际上下文大小
  const contextStats = computed((): ContextStatsResult => {
    let totalTokens = 0
    let messageCount = 0
    
    if (agentMode.value) {
      // Agent 模式：计算发送给 AI 的实际上下文
      // 1. System prompt (~200 tokens) + 工具定义 (~400 tokens)
      totalTokens += 600
      
      // 2. 历史任务（作为 user/assistant 消息对发送）
      const history = agentState.value?.history || []
      for (const item of history) {
        totalTokens += estimateTokens(item.userTask) + 3  // user 消息 + 格式开销
        totalTokens += estimateTokens(item.finalResult) + 3  // assistant 消息 + 格式开销
        messageCount += 2
      }
      
      // 3. 当前用户任务
      if (agentUserTask.value) {
        totalTokens += estimateTokens(agentUserTask.value) + 3
        messageCount++
      }
      
      // 4. Agent 执行过程中的消息累积
      // 每个步骤 = AI 回复 + 工具调用 + 工具结果
      const allSteps = agentState.value?.steps || []
      for (const step of allSteps) {
        if (step.type === 'message' || step.type === 'thinking') {
          // AI 的文字回复
          totalTokens += estimateTokens(step.content) + 3
        } else if (step.type === 'tool_call' || step.type === 'tool_result') {
          // 工具调用参数 + 工具结果
          totalTokens += estimateTokens(step.content) + 10  // 工具调用有更多格式开销
          if (step.toolResult) {
            totalTokens += estimateTokens(step.toolResult) + 5
          }
        }
      }
    } else {
      // 普通对话模式
      // System prompt (~100 tokens)
      totalTokens += 100
      
      const msgs = messages.value.filter(msg => !msg.content.includes('中...'))
      messageCount = msgs.length
      
      for (const msg of msgs) {
        totalTokens += estimateTokens(msg.content)
        // 每条消息格式开销（role 标记等）约 3 tokens
        totalTokens += 3
      }
    }
    
    // 从当前 AI 配置获取上下文长度，默认 8000
    const maxTokens = activeAiProfile.value?.contextLength || 8000
    
    return {
      messageCount,
      tokenEstimate: totalTokens,
      maxTokens,
      percentage: Math.min(100, Math.round((totalTokens / maxTokens) * 100))
    }
  })

  return {
    estimateTokens,
    contextStats
  }
}
