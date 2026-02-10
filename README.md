# Web GIF Recorder

一个基于 Node.js 和 Puppeteer 的高性能网站动图/视频录制工具。支持生成高质量 GIF 和真彩 MP4 视频，完美支持 Retina/高分屏录制。

## ✨ 核心特性

- 🎬 **双格式支持**：支持生成通用 GIF 动图和高清 MP4 视频 (H.264)
- 👁️ **Retina 级清晰度**：支持 1x/2x/3x DPI 录制，完美还原移动端和高分屏细节
- 📱 **多设备模拟**：内置 PC 和 Mobile (iPhone) 预设，自动适配视口
- 🧠 **智能录制**：自动识别普通长页面和 SPA 全屏滚动，自适应调整滚动节奏
- 🎨 **画质增强**：内置智能锐化、去锯齿和高质量调色板算法
- ⚡ **高性能**：基于流式处理，10秒视频仅需约 15-20 秒生成
- ⚙️ **灵活配置**：支持自定义分辨率、帧率、时长、页面操作（点击/滚动/等待）
- 🚀 **并发安全**：支持同时运行多个录制任务，自动隔离临时文件，互不干扰

## 📋 系统要求

- **Node.js**: 16+
- **FFmpeg**: 必须安装 (macOS: `brew install ffmpeg`)
- **Chrome**: 必须安装 Google Chrome 浏览器

## 🚀 快速开始

### 1. 安装依赖

```bash
# 1. 安装 FFmpeg (macOS)
brew install ffmpeg

# 2. 安装项目依赖
npm install
```

### 2. 常用命令

推荐使用 `record.sh` 脚本，它会自动处理参数默认值。

```bash
# 基础录制 (默认生成 GIF, 15秒)
./record.sh --url https://example.com

# 录制高清 MP4 视频 (推荐用于移动端演示)
./record.sh --url https://example.com --format mp4

# 移动端录制 (模拟 iPhone)
./record.sh --url https://m.example.com --device mobile --format mp4

# 自定义时长和质量
./record.sh --url https://example.com --duration 10 --quality ultra
```

## 📖 命令行参数列表

支持两种调用方式：`./record.sh` (推荐) 或 `node examples/record-gif.js`。

| 参数 | 简写 | 说明 | 默认值 | 示例 |
|------|------|------|--------|------|
| `--url` | `-u` | 目标网站 URL | (必填) | `https://google.com` |
| `--format` | | 输出格式: `gif` 或 `mp4` | `gif` | `mp4` |
| `--dpi` | | 屏幕像素密度 (1-3) | 自动 | `2` (2x Retina) |
| `--quality` | `-q` | 质量预设: `ultra`, `high`, `medium`, `low` | `high` | `ultra` |
| `--device` | | 设备类型: `pc` 或 `mobile` | `pc` | `mobile` |
| `--duration` | `-d` | 录制时长 (秒) | `15` | `30` |
| `--fps` | `-f` | 帧率 (5-30) | `15` | `30` |
| `--width` | | 视口宽度 | `1280` / `375` | `1920` |
| `--height` | | 视口高度 | `720` / `667` | `1080` |
| `--filename` | | 自定义输出文件名 | 自动生成 | `demo-video` |
| `--actions` | | 页面操作指令 | 无 | `click:.btn,wait:1000` |
| `--no-cleanup`| | 保留临时文件 (调试用) | `false` | `true` |

> **💡 关于 DPI 的说明**：
> - **GIF 模式**：默认使用逻辑分辨率。`ultra` 模式下会使用 2x 截图再缩放，以获得抗锯齿效果。
> - **MP4 模式**：若指定 `--dpi 2`，将输出物理分辨率视频（如 iPhone 模式输出 750x1334）。

## 📂 输出文件

所有录制结果保存在 `output/` 目录下。

- **命名规则**：`{域名}_{路径}_{设备}_{时间戳}.{格式}`
- **示例**：
  - `example_com_pc_20260208_223015.gif`
  - `m_bilibili_com_mobile_20260208_223015.mp4`

## 🛠️ 常见问题 (Troubleshooting)

**Q: 为什么 GIF 文件很大？**
A: GIF 格式本身压缩率低。建议：
1. 缩短录制时长
2. 降低 FPS (如 10)
3. **推荐使用 MP4 格式** (`--format mp4`)，体积小且画质完美。

**Q: 移动端录制画面模糊？**
A: 请务必开启 `--format mp4` 和 `--quality ultra` (或 `--dpi 2`)。GIF 在高分屏下往往需要缩放，效果不如 MP4。

**Q: 报错 "FFmpeg not found"？**
A: 请确保终端能运行 `ffmpeg -version`。Mac 用户请运行 `brew install ffmpeg`。

## 📝 许可证

MIT License
