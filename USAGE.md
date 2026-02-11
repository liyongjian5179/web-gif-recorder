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
./record.sh \
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

**自适应节奏 (Smart Rhythm)**：
工具会根据你设置的 `--duration` 智能计算滚动速度：
- **短录制 (10s)**：节奏紧凑，快速展示页面概览。
- **长录制 (30s)**：节奏从容，平滑展示细节。

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

## 🖱️ 场景 5：全屏滚动与 SPA 网站录制（智能自动探测）

对于像小米汽车官网、Apple 官网这类使用全屏滚动（Fullpage Scroll）或单页应用（SPA）技术的网站，传统的滚动录制可能会失效。

**现在，你不需要做任何额外配置！** 工具内置了**智能视觉探测 (Visual Scroll Probing)** 技术：

1.  **自动识别**：当检测到页面高度较小（类似单页应用）时，工具会自动启动探测模式，识别是否需要模拟滚轮操作。
2.  **智能节奏**：根据录制时长自动规划滚动间隔（1.2s - 2.0s）。
3.  **自动去重**：实时监测画面变化，如果滚到底部（画面静止），会自动提前结束录制，避免无效时长。

你只需要像往常一样运行命令：

```bash
# 无需参数，自动识别！
./record.sh --url https://www.xiaomiev.com --duration 10
```

## 🔐 场景 6：录制需要登录的网站 (Cookie 注入)

对于内部系统、Grafana 看板等需要登录的网站，我们可以通过**注入 Cookie** 来跳过登录页。

**重要提示**：由于安全限制，不支持直接复制 `document.cookie` 字符串。必须使用 JSON 格式。

### 步骤 1：获取 Cookie (必须使用插件)

为了获取完整的登录状态（包括 **HttpOnly** Cookie），**必须**使用浏览器插件导出完整的 Cookie 数据。

1. 在 Chrome 中安装 **[EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg)** 插件。
2. 登录目标网站。
3. 点击插件图标 -> 点击 "导出" (Export) 按钮（这会将 JSON 格式的 Cookie 复制到剪贴板）。
4. 新建一个文件（如 `cookies.json`），将内容粘贴进去并保存。

### 步骤 2：使用 Cookie 录制

```bash
# 方式 A: 使用 Cookie 文件 (推荐)
./record.sh --url https://internal-system.com --cookies ./cookies.json

# 方式 B: 直接传递 JSON 字符串 (适合 CI/CD)
./record.sh --url https://internal-system.com --cookies '[{"domain":".example.com","name":"session_id","value":"...","path":"/","httpOnly":true,"secure":true}]'
```

> **注意**：
> 1. 请确保导出的 JSON 中包含 `domain` 字段。
> 2. 工具会自动处理 Domain 匹配问题，并支持父域 Cookie (SSO)。
> 3. 为了安全，录制完成后请妥善处理或删除 Cookie 文件。

## 🚀 场景 7：并发录制与自动化流水线

本工具支持在 CI/CD 流水线中并行执行多个录制任务。

**并发安全设计**：
- 工具会自动为每次录制创建**独立的临时目录**（基于时间戳和随机ID）。
- 即使同时运行 10 个录制任务，它们的截图文件也不会相互冲突。
- 录制结束后，会自动清理各自的临时目录。

```bash
# 示例：同时录制 PC 和 移动端效果
./record.sh --url https://example.com --device pc &
./record.sh --url https://example.com --device mobile &
wait
```

## 🎨 场景 8：添加浏览器外壳 (Browser Frame)

如果你希望录制的视频看起来像是在浏览器窗口中运行，可以使用 `--frame` 参数。

**✨ 外壳特性**：
- **macOS 风格设计**：经典的红黄绿圆形按钮，高度还原 macOS 窗口质感。
- **智能主题适配**：自动检测网站的 Light/Dark 模式，并切换对应颜色的外壳（白/黑）。
- **移动端适配**：
  - **PC 模式**：显示标准地址栏和窗口控制按钮。
  - **Mobile 模式**：显示 iOS 风格状态栏（时间、信号、WiFi、电池）和地址栏。
- **真实地址显示**：地址栏会自动显示当前录制的 URL。

```bash
# 自动添加浏览器外壳 (自动适配 PC/Mobile 和 Light/Dark)
./record.sh --url https://example.com --frame

# 移动端带壳录制 (iOS 风格)
./record.sh --url https://m.example.com --device mobile --frame --format mp4
```
> **注意**：开启外壳后，视频高度会自动增加（PC +40px, Mobile +88px）。

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
