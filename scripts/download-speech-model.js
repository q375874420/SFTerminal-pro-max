/**
 * 下载 sherpa-onnx 语音识别模型
 * 使用 streaming-zipformer-bilingual-zh-en INT8 量化版
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        downloadFile(response.headers.location, dest).then(resolve).catch(reject)
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
  })
}

async function main() {
  console.log('=== Sherpa-ONNX 语音识别模型下载器 ===\n')
  
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
      await downloadFile(url, filePath)
      downloadCount++
    } catch (e) {
      console.error(`\n❌ 下载失败: ${e.message}`)
      console.log(`请手动下载: ${url}`)
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
