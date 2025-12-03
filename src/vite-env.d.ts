/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Electron API 类型
interface Window {
  electronAPI: {
    pty: {
      create: (options?: {
        cols?: number
        rows?: number
        cwd?: string
        shell?: string
        env?: Record<string, string>
      }) => Promise<string>
      write: (id: string, data: string) => Promise<void>
      resize: (id: string, cols: number, rows: number) => Promise<void>
      dispose: (id: string) => Promise<void>
      onData: (id: string, callback: (data: string) => void) => () => void
    }
    ssh: {
      connect: (config: {
        host: string
        port: number
        username: string
        password?: string
        privateKey?: string
        passphrase?: string
        cols?: number
        rows?: number
      }) => Promise<string>
      write: (id: string, data: string) => Promise<void>
      resize: (id: string, cols: number, rows: number) => Promise<void>
      disconnect: (id: string) => Promise<void>
      onData: (id: string, callback: (data: string) => void) => () => void
    }
    ai: {
      chat: (
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        profileId?: string
      ) => Promise<string>
      chatStream: (
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        onChunk: (chunk: string) => void,
        onDone: () => void,
        onError: (error: string) => void,
        profileId?: string
      ) => void
    }
    config: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<void>
      getAll: () => Promise<Record<string, unknown>>
      getAiProfiles: () => Promise<
        Array<{
          id: string
          name: string
          apiUrl: string
          apiKey: string
          model: string
          proxy?: string
        }>
      >
      setAiProfiles: (
        profiles: Array<{
          id: string
          name: string
          apiUrl: string
          apiKey: string
          model: string
          proxy?: string
        }>
      ) => Promise<void>
      getActiveAiProfile: () => Promise<string>
      setActiveAiProfile: (profileId: string) => Promise<void>
      getSshSessions: () => Promise<
        Array<{
          id: string
          name: string
          host: string
          port: number
          username: string
          authType: 'password' | 'privateKey'
          password?: string
          privateKeyPath?: string
          passphrase?: string
          group?: string
        }>
      >
      setSshSessions: (
        sessions: Array<{
          id: string
          name: string
          host: string
          port: number
          username: string
          authType: 'password' | 'privateKey'
          password?: string
          privateKeyPath?: string
          passphrase?: string
          group?: string
        }>
      ) => Promise<void>
      getTheme: () => Promise<string>
      setTheme: (theme: string) => Promise<void>
    }
  }
}

