/**
 * 文档解析服务集成代码
 * 
 * 此文件包含需要添加到 main.ts 和 preload.ts 的代码片段
 * 在合适的时机，将这些代码整合到对应的文件中
 */

// ============================================================
// 以下代码需要添加到 electron/main.ts
// ============================================================

import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { 
  getDocumentParserService, 
  UploadedFile, 
  ParseOptions,
  ParsedDocument 
} from './document-parser.service'

// 获取文档解析服务实例
const documentParserService = getDocumentParserService()

/**
 * 注册文档解析相关的 IPC 处理器
 * 调用此函数来注册所有处理器
 */
export function registerDocumentParserHandlers(): void {
  
  // 选择文件对话框
  ipcMain.handle('document:selectFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择文档',
      filters: [
        { name: '支持的文档', extensions: ['pdf', 'docx', 'doc', 'txt', 'md', 'json', 'xml', 'html', 'csv'] },
        { name: 'PDF 文档', extensions: ['pdf'] },
        { name: 'Word 文档', extensions: ['docx', 'doc'] },
        { name: '文本文件', extensions: ['txt', 'md'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, files: [] }
    }
    
    // 获取文件信息
    const files: UploadedFile[] = result.filePaths.map(filePath => {
      const stats = fs.statSync(filePath)
      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size
      }
    })
    
    return { canceled: false, files }
  })

  // 解析单个文档
  ipcMain.handle('document:parse', async (_event, file: UploadedFile, options?: ParseOptions) => {
    return documentParserService.parseDocument(file, options)
  })

  // 批量解析文档
  ipcMain.handle('document:parseMultiple', async (_event, files: UploadedFile[], options?: ParseOptions) => {
    return documentParserService.parseDocuments(files, options)
  })

  // 格式化为 AI 上下文
  ipcMain.handle('document:formatAsContext', async (_event, docs: ParsedDocument[]) => {
    return documentParserService.formatAsContext(docs)
  })

  // 生成文档摘要
  ipcMain.handle('document:generateSummary', async (_event, doc: ParsedDocument) => {
    return documentParserService.generateSummary(doc)
  })

  // 检查解析能力
  ipcMain.handle('document:checkCapabilities', async () => {
    return documentParserService.checkCapabilities()
  })

  // 获取支持的文件类型
  ipcMain.handle('document:getSupportedTypes', async () => {
    return documentParserService.getSupportedTypes()
  })
}

// ============================================================
// 以下代码需要添加到 electron/preload.ts 的 electronAPI 对象中
// ============================================================

/*
// 在 preload.ts 中的 electronAPI 对象末尾添加：

// 文档解析操作
document: {
  // 选择文件
  selectFiles: () => ipcRenderer.invoke('document:selectFiles') as Promise<{
    canceled: boolean
    files: Array<{
      name: string
      path: string
      size: number
    }>
  }>,

  // 解析单个文档
  parse: (file: {
    name: string
    path: string
    size: number
    mimeType?: string
  }, options?: {
    maxFileSize?: number
    maxTextLength?: number
    extractMetadata?: boolean
  }) => ipcRenderer.invoke('document:parse', file, options) as Promise<{
    filename: string
    fileType: string
    content: string
    fileSize: number
    parseTime: number
    pageCount?: number
    metadata?: Record<string, string>
    error?: string
  }>,

  // 批量解析文档
  parseMultiple: (files: Array<{
    name: string
    path: string
    size: number
    mimeType?: string
  }>, options?: {
    maxFileSize?: number
    maxTextLength?: number
    extractMetadata?: boolean
  }) => ipcRenderer.invoke('document:parseMultiple', files, options) as Promise<Array<{
    filename: string
    fileType: string
    content: string
    fileSize: number
    parseTime: number
    pageCount?: number
    metadata?: Record<string, string>
    error?: string
  }>>,

  // 格式化为 AI 上下文
  formatAsContext: (docs: Array<{
    filename: string
    fileType: string
    content: string
    fileSize: number
    parseTime: number
    pageCount?: number
    metadata?: Record<string, string>
    error?: string
  }>) => ipcRenderer.invoke('document:formatAsContext', docs) as Promise<string>,

  // 生成文档摘要
  generateSummary: (doc: {
    filename: string
    fileType: string
    content: string
    fileSize: number
    parseTime: number
    pageCount?: number
    error?: string
  }) => ipcRenderer.invoke('document:generateSummary', doc) as Promise<string>,

  // 检查解析能力
  checkCapabilities: () => ipcRenderer.invoke('document:checkCapabilities') as Promise<{
    pdf: boolean
    docx: boolean
    doc: boolean
    text: boolean
  }>,

  // 获取支持的文件类型
  getSupportedTypes: () => ipcRenderer.invoke('document:getSupportedTypes') as Promise<Array<{
    extension: string
    description: string
    available: boolean
  }>>
}
*/

// ============================================================
// 使用说明
// ============================================================

/*
在 main.ts 中的使用方法：

1. 在文件顶部添加导入：
   import { registerDocumentParserHandlers } from './services/document-parser.integration'

2. 在 app.whenReady() 回调中调用：
   registerDocumentParserHandlers()

或者，直接将 registerDocumentParserHandlers 函数中的代码复制到 main.ts 的 IPC 处理器区域。
*/
