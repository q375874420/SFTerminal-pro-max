# 语音识别模型

本目录存放 sherpa-onnx 语音识别模型文件。

## 模型说明

使用 sherpa-onnx-streaming-zipformer-bilingual-zh-en INT8 量化版本：
- 支持中英文实时流式识别
- 模型大小约 189MB
- 适合本地运行

## 下载模型

**方法一：直接下载**

从 Hugging Face 下载并解压到本目录：
https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/tree/main

需要下载以下文件放到本目录：
- `encoder-epoch-99-avg-1.int8.onnx`
- `decoder-epoch-99-avg-1.int8.onnx`
- `joiner-epoch-99-avg-1.int8.onnx`
- `tokens.txt`

**方法二：使用下载脚本**

```bash
node scripts/download-speech-model.js
```

## 文件结构

下载完成后，本目录应包含：
```
resources/models/speech/
├── encoder-epoch-99-avg-1.int8.onnx  (编码器)
├── decoder-epoch-99-avg-1.int8.onnx  (解码器)
├── joiner-epoch-99-avg-1.int8.onnx   (联合器)
├── tokens.txt                         (词表)
└── README.md                          (本文件)
```

## 注意

模型文件较大，已在 `.gitignore` 中排除，不会提交到 Git 仓库。
