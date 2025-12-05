/**
 * 语音识别服务
 * 支持三种模式：
 * 1. 本地 sherpa-onnx（内置模型）
 * 2. OpenAI Whisper 兼容接口（REST）
 * 3. FunASR WebSocket
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import { EventEmitter } from 'events'
import { ConfigService, SpeechSettings } from './config.service'

// WebSocket 类型（延迟加载）
type WebSocketType = import('ws').WebSocket

// 语音识别配置（与 SpeechSettings 兼容）
export interface SpeechConfig {
  mode: 'local' | 'openai-whisper' | 'funasr'
  // OpenAI Whisper 兼容配置
  whisperApiUrl?: string
  whisperApiKey?: string
  // FunASR 配置
  funasrWsUrl?: string
}

// 识别结果
export interface SpeechResult {
  text: string
  isFinal: boolean
  confidence?: number
}

// 录音状态
export type RecordingState = 'idle' | 'recording' | 'processing'

// 默认配置
const defaultConfig: SpeechConfig = {
  mode: 'local'
}

/**
 * 语音识别服务类
 */
export class SpeechService extends EventEmitter {
  private config: SpeechConfig = defaultConfig
  private state: RecordingState = 'idle'
  private audioChunks: Buffer[] = []
  private configService: ConfigService
  
  // sherpa-onnx 相关（延迟加载）
  private sherpaRecognizer: any = null
  private sherpaStream: any = null
  
  // FunASR WebSocket
  private funasrWs: WebSocketType | null = null

  constructor() {
    super()
    this.configService = new ConfigService()
    this.loadConfig()
  }

  /**
   * 从配置服务加载配置
   */
  private loadConfig(): void {
    const saved = this.configService.getSpeechSettings()
    this.config = {
      mode: saved.mode || 'local',
      whisperApiUrl: saved.whisperApiUrl,
      whisperApiKey: saved.whisperApiKey,
      funasrWsUrl: saved.funasrWsUrl
    }
  }

  /**
   * 保存配置到配置服务
   */
  private saveConfig(): void {
    this.configService.setSpeechSettings(this.config as SpeechSettings)
  }

  /**
   * 获取配置
   */
  getConfig(): SpeechConfig {
    return { ...this.config }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<SpeechConfig>): void {
    this.config = { ...this.config, ...config }
    // 保存配置
    this.saveConfig()
    // 配置改变时重置连接
    this.cleanup()
  }

  /**
   * 获取当前状态
   */
  getState(): RecordingState {
    return this.state
  }

  /**
   * 检查本地模型是否可用
   */
  async checkLocalModelAvailable(): Promise<boolean> {
    const modelPath = this.getModelPath()
    console.log('[Speech] Checking model at:', modelPath)
    
    // 检查核心模型文件
    const requiredFiles = [
      'encoder-epoch-99-avg-1.int8.onnx',
      'decoder-epoch-99-avg-1.int8.onnx',
      'joiner-epoch-99-avg-1.int8.onnx',
      'tokens.txt'
    ]
    
    for (const file of requiredFiles) {
      const filePath = path.join(modelPath, file)
      const exists = fs.existsSync(filePath)
      console.log(`[Speech] ${file}: ${exists ? 'OK' : 'MISSING'} (${filePath})`)
      if (!exists) {
        return false
      }
    }
    return true
  }

  /**
   * 获取模型路径
   */
  private getModelPath(): string {
    // 开发环境：__dirname 是 dist-electron，需要回到项目根目录
    if (!app.isPackaged) {
      return path.join(
        app.getAppPath(),
        'resources',
        'models',
        'speech'
      )
    }
    // 生产环境
    return path.join(
      process.resourcesPath,
      'models',
      'speech'
    )
  }

  /**
   * 初始化本地 sherpa-onnx 识别器
   */
  private async initSherpaRecognizer(): Promise<boolean> {
    if (this.sherpaRecognizer) {
      return true
    }

    const modelPath = this.getModelPath()
    console.log('[Speech] Model path:', modelPath)

    try {
      // 检查模型文件
      if (!await this.checkLocalModelAvailable()) {
        console.error('[Speech] Local model not found at:', modelPath)
        return false
      }
      console.log('[Speech] Model files verified')

      // 动态导入 sherpa-onnx-node
      console.log('[Speech] Loading sherpa-onnx-node...')
      const sherpa = await import('sherpa-onnx-node')
      console.log('[Speech] sherpa-onnx-node loaded, available exports:', Object.keys(sherpa))
      
      // 创建识别器配置 - 使用 sherpa-onnx-node 的正确 API
      const config = {
        featConfig: {
          sampleRate: 16000,
          featureDim: 80
        },
        modelConfig: {
          transducer: {
            encoder: path.join(modelPath, 'encoder-epoch-99-avg-1.int8.onnx'),
            decoder: path.join(modelPath, 'decoder-epoch-99-avg-1.int8.onnx'),
            joiner: path.join(modelPath, 'joiner-epoch-99-avg-1.int8.onnx')
          },
          tokens: path.join(modelPath, 'tokens.txt'),
          numThreads: 2,
          provider: 'cpu',
          debug: true
        },
        decodingMethod: 'greedy_search',
        maxActivePaths: 4
      }
      console.log('[Speech] Creating recognizer with config:', JSON.stringify(config, null, 2))

      // 尝试创建识别器
      if (sherpa.OnlineRecognizer) {
        this.sherpaRecognizer = new sherpa.OnlineRecognizer(config)
      } else if (sherpa.default?.OnlineRecognizer) {
        this.sherpaRecognizer = new sherpa.default.OnlineRecognizer(config)
      } else {
        console.error('[Speech] OnlineRecognizer not found in sherpa-onnx-node')
        return false
      }
      console.log('[Speech] Sherpa-ONNX recognizer initialized')
      return true
    } catch (e) {
      console.error('[Speech] Failed to initialize sherpa-onnx:', e)
      return false
    }
  }

  /**
   * 开始录音
   */
  async startRecording(): Promise<boolean> {
    if (this.state !== 'idle') {
      console.warn('[Speech] Already recording')
      return false
    }

    this.audioChunks = []
    this.state = 'recording'
    this.emit('stateChange', this.state)

    try {
      switch (this.config.mode) {
        case 'local':
          return await this.startLocalRecording()
        case 'openai-whisper':
          return await this.startWhisperRecording()
        case 'funasr':
          return await this.startFunasrRecording()
        default:
          throw new Error(`Unknown mode: ${this.config.mode}`)
      }
    } catch (e) {
      console.error('[Speech] Failed to start recording:', e)
      this.state = 'idle'
      this.emit('stateChange', this.state)
      this.emit('error', (e as Error).message)
      return false
    }
  }

  /**
   * 本地 sherpa-onnx 录音
   */
  private async startLocalRecording(): Promise<boolean> {
    // 初始化识别器
    if (!await this.initSherpaRecognizer()) {
      throw new Error('Failed to initialize local recognizer. Please check if model files exist.')
    }

    // 创建识别流
    this.sherpaStream = this.sherpaRecognizer.createStream()

    // 开始录音
    return this.startMicRecording((audioData: Buffer) => {
      // 将音频数据转换为 Float32Array
      const samples = this.bufferToFloat32(audioData)
      
      // 送入识别器
      this.sherpaStream.acceptWaveform(16000, samples)
      
      // 检查是否有结果
      while (this.sherpaRecognizer.isReady(this.sherpaStream)) {
        this.sherpaRecognizer.decode(this.sherpaStream)
      }
      
      // 获取部分结果
      const result = this.sherpaRecognizer.getResult(this.sherpaStream)
      if (result.text) {
        this.emit('partialResult', {
          text: result.text,
          isFinal: false
        } as SpeechResult)
      }
    })
  }

  /**
   * OpenAI Whisper 兼容接口录音（录完后一次性发送）
   */
  private async startWhisperRecording(): Promise<boolean> {
    if (!this.config.whisperApiUrl) {
      throw new Error('Whisper API URL not configured')
    }

    // 简单录音，不做实时识别
    return this.startMicRecording((audioData: Buffer) => {
      this.audioChunks.push(audioData)
    })
  }

  /**
   * FunASR WebSocket 录音（实时流式）
   */
  private async startFunasrRecording(): Promise<boolean> {
    if (!this.config.funasrWsUrl) {
      throw new Error('FunASR WebSocket URL not configured')
    }

    // 动态导入 ws 模块
    const WebSocket = (await import('ws')).default

    // 连接 FunASR WebSocket
    return new Promise((resolve, reject) => {
      try {
        this.funasrWs = new WebSocket(this.config.funasrWsUrl!) as WebSocketType
        
        this.funasrWs.on('open', () => {
          console.log('[Speech] FunASR WebSocket connected')
          
          // 发送初始配置
          const config = {
            mode: 'online',
            chunk_size: [5, 10, 5],
            wav_name: 'microphone',
            is_speaking: true,
            chunk_interval: 10,
            itn: true
          }
          this.funasrWs!.send(JSON.stringify(config))
          
          // 开始录音
          this.startMicRecording((audioData: Buffer) => {
            if (this.funasrWs?.readyState === 1) { // WebSocket.OPEN = 1
              this.funasrWs.send(audioData)
            }
          }).then(resolve).catch(reject)
        })
        
        this.funasrWs.on('message', (data: Buffer | string) => {
          try {
            const result = JSON.parse(data.toString())
            if (result.text) {
              this.emit('partialResult', {
                text: result.text,
                isFinal: result.is_final || false
              } as SpeechResult)
            }
          } catch (e) {
            console.error('[Speech] Failed to parse FunASR result:', e)
          }
        })
        
        this.funasrWs.on('error', (err) => {
          console.error('[Speech] FunASR WebSocket error:', err)
          this.emit('error', err.message)
          reject(err)
        })
        
        this.funasrWs.on('close', () => {
          console.log('[Speech] FunASR WebSocket closed')
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
   * 设置音频数据回调（由渲染进程调用）
   */
  private audioDataCallback: ((audioData: Buffer) => void) | null = null

  /**
   * 接收来自渲染进程的音频数据
   */
  receiveAudioData(audioData: Float32Array): void {
    if (this.audioDataCallback) {
      // 将 Float32Array 转换为 16-bit PCM Buffer
      const buffer = Buffer.alloc(audioData.length * 2)
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]))
        buffer.writeInt16LE(Math.round(sample * 32767), i * 2)
      }
      this.audioDataCallback(buffer)
    }
  }

  /**
   * 启动麦克风录音（使用渲染进程的 Web Audio API）
   */
  private async startMicRecording(
    onData: (audioData: Buffer) => void
  ): Promise<boolean> {
    // 保存回调，等待渲染进程发送音频数据
    this.audioDataCallback = onData
    console.log('[Speech] Waiting for audio data from renderer...')
    return true
  }

  /**
   * 停止录音
   */
  async stopRecording(): Promise<SpeechResult | null> {
    if (this.state !== 'recording') {
      return null
    }

    this.state = 'processing'
    this.emit('stateChange', this.state)

    try {
      // 停止麦克风
      if (this.micInstance) {
        this.micInstance.stop()
        this.micInstance = null
        this.micInputStream = null
      }

      let result: SpeechResult | null = null

      switch (this.config.mode) {
        case 'local':
          result = await this.finishLocalRecording()
          break
        case 'openai-whisper':
          result = await this.finishWhisperRecording()
          break
        case 'funasr':
          result = await this.finishFunasrRecording()
          break
      }

      return result
    } finally {
      this.state = 'idle'
      this.emit('stateChange', this.state)
    }
  }

  /**
   * 完成本地识别
   */
  private async finishLocalRecording(): Promise<SpeechResult | null> {
    if (!this.sherpaStream || !this.sherpaRecognizer) {
      return null
    }

    // 输入结束标记
    this.sherpaStream.inputFinished()
    
    // 解码剩余内容
    while (this.sherpaRecognizer.isReady(this.sherpaStream)) {
      this.sherpaRecognizer.decode(this.sherpaStream)
    }
    
    // 获取最终结果
    const result = this.sherpaRecognizer.getResult(this.sherpaStream)
    
    // 清理
    this.sherpaStream = null

    if (result.text) {
      return {
        text: result.text.trim(),
        isFinal: true
      }
    }
    return null
  }

  /**
   * 完成 Whisper 识别
   */
  private async finishWhisperRecording(): Promise<SpeechResult | null> {
    if (this.audioChunks.length === 0) {
      return null
    }

    // 合并音频数据
    const audioBuffer = Buffer.concat(this.audioChunks)
    this.audioChunks = []

    // 转换为 WAV 格式
    const wavBuffer = this.createWavBuffer(audioBuffer)

    // 发送到 Whisper API
    try {
      const result = await this.sendToWhisperApi(wavBuffer)
      return result
    } catch (e) {
      console.error('[Speech] Whisper API error:', e)
      this.emit('error', (e as Error).message)
      return null
    }
  }

  /**
   * 完成 FunASR 识别
   */
  private async finishFunasrRecording(): Promise<SpeechResult | null> {
    if (this.funasrWs) {
      // 发送结束标记
      const endMsg = JSON.stringify({ is_speaking: false })
      if (this.funasrWs.readyState === 1) { // WebSocket.OPEN = 1
        this.funasrWs.send(endMsg)
      }
      
      // 等待最终结果（最多等待 3 秒）
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.funasrWs?.close()
          this.funasrWs = null
          resolve(null)
        }, 3000)
        
        this.funasrWs!.once('message', (data: Buffer | string) => {
          clearTimeout(timeout)
          try {
            const result = JSON.parse(data.toString())
            this.funasrWs?.close()
            this.funasrWs = null
            if (result.text) {
              resolve({
                text: result.text,
                isFinal: true
              })
            } else {
              resolve(null)
            }
          } catch (e) {
            resolve(null)
          }
        })
      })
    }
    return null
  }

  /**
   * 发送音频到 Whisper API
   */
  private sendToWhisperApi(wavBuffer: Buffer): Promise<SpeechResult | null> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.whisperApiUrl!)
      const isHttps = url.protocol === 'https:'
      const httpModule = isHttps ? https : http

      // 创建 multipart form data
      const boundary = '----FormBoundary' + Math.random().toString(36).substr(2)
      
      const formParts: Buffer[] = []
      
      // 添加文件字段
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
        `Content-Type: audio/wav\r\n\r\n`
      ))
      formParts.push(wavBuffer)
      formParts.push(Buffer.from('\r\n'))
      
      // 添加 model 字段
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `whisper-1\r\n`
      ))
      
      // 添加 language 字段（优先中文）
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="language"\r\n\r\n` +
        `zh\r\n`
      ))
      
      // 结束边界
      formParts.push(Buffer.from(`--${boundary}--\r\n`))
      
      const body = Buffer.concat(formParts)

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString()
        }
      }

      // 添加 API Key（如果有）
      if (this.config.whisperApiKey) {
        options.headers!['Authorization'] = `Bearer ${this.config.whisperApiKey}`
      }

      const req = httpModule.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data)
              resolve({
                text: result.text || '',
                isFinal: true
              })
            } catch (e) {
              reject(new Error('Failed to parse Whisper API response'))
            }
          } else {
            reject(new Error(`Whisper API error: ${res.statusCode} - ${data}`))
          }
        })
      })

      req.on('error', (err) => {
        reject(err)
      })

      req.write(body)
      req.end()
    })
  }

  /**
   * Buffer 转 Float32Array（16-bit PCM to float）
   */
  private bufferToFloat32(buffer: Buffer): Float32Array {
    const samples = new Float32Array(buffer.length / 2)
    for (let i = 0; i < samples.length; i++) {
      const sample = buffer.readInt16LE(i * 2)
      samples[i] = sample / 32768.0
    }
    return samples
  }

  /**
   * 创建 WAV 文件 Buffer
   */
  private createWavBuffer(pcmData: Buffer): Buffer {
    const sampleRate = 16000
    const numChannels = 1
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * bitsPerSample / 8
    const blockAlign = numChannels * bitsPerSample / 8
    const dataSize = pcmData.length
    const fileSize = 36 + dataSize

    const header = Buffer.alloc(44)
    
    // RIFF header
    header.write('RIFF', 0)
    header.writeUInt32LE(fileSize, 4)
    header.write('WAVE', 8)
    
    // fmt chunk
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)  // chunk size
    header.writeUInt16LE(1, 20)   // audio format (PCM)
    header.writeUInt16LE(numChannels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    
    // data chunk
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return Buffer.concat([header, pcmData])
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理音频回调
    this.audioDataCallback = null
    
    // 关闭 FunASR 连接
    if (this.funasrWs) {
      this.funasrWs.close()
      this.funasrWs = null
    }
    
    // 清理 sherpa 流
    this.sherpaStream = null
    
    this.audioChunks = []
    this.state = 'idle'
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.cleanup()
    this.sherpaRecognizer = null
    this.removeAllListeners()
  }
}

// 单例
let speechServiceInstance: SpeechService | null = null

export function getSpeechService(): SpeechService {
  if (!speechServiceInstance) {
    speechServiceInstance = new SpeechService()
  }
  return speechServiceInstance
}

