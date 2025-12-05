/**
 * 下载 sherpa-onnx 语音识别模型
 * 使用 streaming-zipformer-bilingual-zh-en INT8 量化版
 * 
 * 使用方法:
 *   node scripts/download-speech-model.js              # 不使用代理
 *   node scripts/download-speech-model.js --proxy      # 使用默认代理 (127.0.0.1:10809)
 *   node scripts/download-speech-model.js --proxy http://127.0.0.1:7890  # 自定义代理
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const MODEL_DIR = path.join(__dirname, '..', 'resources', 'models', 'speech')

// Hugging Face 直接下载链接
const HF_BASE = 'https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/resolve/main'

// 需要下载的模型文件
const MODEL_FILES = [
  'encoder-epoch-99-avg-1.int8.onnx',
  'decoder-epoch-99-avg-1.int8.onnx',
  'joiner-epoch-99-avg-1.int8.onnx',
  'tokens.txt'
]

// 默认代理地址 (v2rayn 默认 HTTP 代理端口)
const DEFAULT_PROXY = 'http://127.0.0.1:10808'

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2)
  let proxyUrl = null
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--proxy') {
      // 检查下一个参数是否是代理地址
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        proxyUrl = args[i + 1]
        i++
      } else {
        proxyUrl = DEFAULT_PROXY
      }
    }
  }
  
  // 也支持环境变量
  if (!proxyUrl && (process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY)) {
    proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY
  }
  
  return { proxyUrl }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// 创建代理 agent
function createProxyAgent(proxyUrl) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent')
    return new HttpsProxyAgent(proxyUrl)
  } catch (e) {
    console.error('❌ 无法加载 https-proxy-agent，请确保已安装依赖')
    console.error('   运行: npm install')
    process.exit(1)
  }
}

function downloadFile(url, dest, agent) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    
    const options = {
      agent: agent
    }
    
    const request = https.get(url, options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        downloadFile(response.headers.location, dest, agent).then(resolve).catch(reject)
        return
      }
      
      if (response.statusCode !== 200) {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(new Error(`Download failed: ${response.statusCode}`))
        return
      }
      
      const total = parseInt(response.headers['content-length'], 10)
      let downloaded = 0
      
      response.on('data', (chunk) => {
        downloaded += chunk.length
        if (total) {
          const percent = ((downloaded / total) * 100).toFixed(1)
          const mb = (downloaded / 1024 / 1024).toFixed(1)
          process.stdout.write(`\r  Progress: ${percent}% (${mb}MB)`)
        }
      })
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        console.log(' ✓')
        resolve()
      })
    })
    
    request.on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      reject(err)
    })
    
    // 设置超时
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('连接超时'))
    })
  })
}

async function main() {
  console.log('=== Sherpa-ONNX 语音识别模型下载器 ===\n')
  
  const { proxyUrl } = parseArgs()
  let agent = undefined
  
  if (proxyUrl) {
    console.log(`🌐 使用代理: ${proxyUrl}\n`)
    agent = createProxyAgent(proxyUrl)
  } else {
    console.log('💡 提示: 如需使用代理，请运行:')
    console.log('   node scripts/download-speech-model.js --proxy')
    console.log('   或指定代理地址: --proxy http://127.0.0.1:7890\n')
  }
  
  ensureDir(MODEL_DIR)
  
  let downloadCount = 0
  
  for (const file of MODEL_FILES) {
    const filePath = path.join(MODEL_DIR, file)
    
    if (fs.existsSync(filePath)) {
      console.log(`✓ ${file} (已存在)`)
      continue
    }
    
    const url = `${HF_BASE}/${file}`
    console.log(`⬇ ${file}`)
    
    try {
      await downloadFile(url, filePath, agent)
      downloadCount++
    } catch (e) {
      console.error(`\n❌ 下载失败: ${e.message}`)
      if (!proxyUrl) {
        console.log('💡 建议: 尝试使用代理下载')
        console.log('   node scripts/download-speech-model.js --proxy')
      }
      console.log(`📎 或手动下载: ${url}`)
    }
  }
  
  console.log('')
  if (downloadCount > 0) {
    console.log(`✅ 下载完成！共下载 ${downloadCount} 个文件`)
  } else {
    console.log('✅ 所有模型文件已就绪')
  }
}

main()
