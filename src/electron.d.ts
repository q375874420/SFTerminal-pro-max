// Electron API 类型声明

interface PtyOptions {
  cols?: number
  rows?: number
  cwd?: string
  shell?: string
  env?: Record<string, string>
}

interface SshConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  cols?: number
  rows?: number
}

interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AiProfile {
  id: string
  name: string
  apiUrl: string
  apiKey: string
  model: string
  proxy?: string
}

interface SshSession {
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
}

interface XshellSession {
  name: string
  host: string
  port: number
  username: string
  password?: string
  privateKeyPath?: string
  group?: string
}

interface ImportResult {
  success: boolean
  sessions: XshellSession[]
  errors: string[]
}

interface ElectronAPI {
  pty: {
    create: (options?: PtyOptions) => Promise<string>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    dispose: (id: string) => Promise<void>
    onData: (id: string, callback: (data: string) => void) => () => void
  }
  ssh: {
    connect: (config: SshConfig) => Promise<string>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    disconnect: (id: string) => Promise<void>
    onData: (id: string, callback: (data: string) => void) => () => void
  }
  ai: {
    chat: (messages: AiMessage[], profileId?: string) => Promise<string>
    chatStream: (
      messages: AiMessage[],
      onChunk: (chunk: string) => void,
      onDone: () => void,
      onError: (error: string) => void,
      profileId?: string,
      requestId?: string
    ) => void
    abort: (requestId?: string) => Promise<void>
  }
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    getAll: () => Promise<Record<string, unknown>>
    getAiProfiles: () => Promise<AiProfile[]>
    setAiProfiles: (profiles: AiProfile[]) => Promise<void>
    getActiveAiProfile: () => Promise<string>
    setActiveAiProfile: (profileId: string) => Promise<void>
    getSshSessions: () => Promise<SshSession[]>
    setSshSessions: (sessions: SshSession[]) => Promise<void>
    getTheme: () => Promise<string>
    setTheme: (theme: string) => Promise<void>
  }
  xshell: {
    selectFiles: () => Promise<{ canceled: boolean; filePaths: string[] }>
    selectDirectory: () => Promise<{ canceled: boolean; dirPath: string }>
    importFiles: (filePaths: string[]) => Promise<ImportResult>
    importDirectory: (dirPath: string) => Promise<ImportResult>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}

