# Web GIF Recorder 高级使用指南

本文档提供针对特定场景的高级配置和最佳实践建议。

## 🎬 场景 1：录制超高清移动端演示视频 (App Store 预览级别)

如果你需要录制类似 App Store 预览视频的超高清移动端演示，请使用 **MP4 格式** 配合 **High DPI**。

```bash
# 模拟 iPhone 视网膜屏幕 (750x1334)
./record.sh --url https://m.example.com --device mobile --format mp4 --quality ultra

# 如果你需要更高的清晰度 (3x DPI, iPhone Pro Max 级别)
./record.sh --url https://m.example.com --device mobile --format mp4 --dpi 3
```
> **原理**：`ultra` 质量会自动开启 2x DPI。MP4 模式下，我们会保留物理像素分辨率，确保每一个像素都清晰锐利。

## 🖥️ 场景 2：录制桌面端高清操作流程

录制 PC 网页操作流程，推荐使用 `1280x720` 或 `1920x1080` 分辨率。

```bash
# 录制 1080p 高清视频 (推荐 MP4)
node examples/record-gif.js \
  --url https://www.google.com \
  --width 1920 --height 1080 \
  --format mp4 \
  --duration 20

# 录制高质量 GIF (自动抗锯齿)
# 注意：GIF 模式下，即使开启 high quality，最终输出也会缩放回逻辑分辨率 (1280x720) 以控制体积
./record.sh --url https://example.com --quality ultra
```

## 📜 场景 3：长页面滚动录制

工具会自动检测页面高度。如果页面高度超过视口的 1.5 倍，会自动触发滚动录制。

```bash
# 录制长文章或落地页 (建议增加时长)
./record.sh --url https://example.com/long-page --duration 30
```
> **提示**：滚动录制时，建议 FPS 设置在 15-20 之间，过高的 FPS 会导致滚动过快或文件体积过大。

## 🎮 场景 4：自定义页面交互 (点击、输入、等待)

你可以通过 `--actions` 参数在录制前执行一系列操作。

支持的操作类型：
- `wait:1000` (等待 1000 毫秒)
- `click:.submit-btn` (点击 CSS 选择器)
- `scroll:500` (滚动到 500px 位置)
- `js:document.title="Hello"` (执行自定义 JS)

**示例：先点击按钮，等待弹窗，然后开始录制**
```bash
./record.sh \
  --url https://example.com \
  --actions "wait:1000,click:#login-btn,wait:2000"
```

## ⚖️ GIF vs MP4：如何选择？

| 特性 | GIF | MP4 (推荐) |
|------|-----|------------|
| **清晰度** | 一般 (256色) | **极高** (真彩, H.264) |
| **DPI 支持** | 仅逻辑分辨率 | **支持物理分辨率 (2x/3x)** |
| **文件体积** | 大 (容易超过 5MB) | **极小** (通常 < 1MB) |
| **兼容性** | 极好 (所有浏览器/IM) | 很好 (现代浏览器/手机) |
| **适用场景** | 简单的 UI 动画展示、邮件嵌入 | 产品演示视频、高保真归档、移动端展示 |

**结论**：除非必须使用 GIF (如 GitHub Readme 或旧版邮件客户端)，否则**强烈建议始终使用 MP4**。

## 🔧 性能调优参考

| 目标 | 建议配置 |
|------|----------|
| **最小体积** | `--format mp4 --quality medium` |
| **最高画质** | `--format mp4 --quality ultra --dpi 3` |
| **平衡推荐** | `--format mp4 --quality high` |
| **快速预览** | `--format gif --quality low --duration 5` |
