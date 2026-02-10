const FileManager = require('./utils/file-manager');

class ScrollRecorder {
  /**
   * 滚动录制器
   * @param {Page} page - Puppeteer 页面实例
   * @param {number} viewportHeight - 视口高度
   * @param {string} tempDir - 临时文件保存目录
   */
  constructor(page, viewportHeight, tempDir = null) {
    this.page = page;
    this.viewportHeight = viewportHeight;
    this.tempDir = tempDir || FileManager.getTempDir();
    FileManager.ensureDir(this.tempDir);
  }

  /**
   * 滚动录制长页面
   * @param {number} duration - 录制时长（毫秒）
   * @param {number} fps - 帧率
   * @returns {Promise<string[]>} 截图文件路径数组
   */
  async captureWithScroll(duration, fps) {
    // 获取页面总高度
    const totalHeight = await this.page.evaluate(() => 
      document.body.scrollHeight
    );

    const totalFrames = Math.max(1, Math.floor((duration / 1000) * fps));
    const maxSteps = Math.max(1, Math.ceil(totalHeight / this.viewportHeight));
    const stepCount = Math.min(maxSteps, totalFrames);
    const framesBase = Math.floor(totalFrames / stepCount);
    const framesRemainder = totalFrames % stepCount;

    console.log(`📊 页面分析: ${stepCount} 段, 总帧 ${totalFrames}`);

    const tempDir = this.tempDir;
    
    let frameIndex = 0;
    const screenshotPaths = [];

    const scrollMaxY = Math.max(0, totalHeight - this.viewportHeight);
    const frameIntervalMs = 1000 / fps;
    const startTime = Date.now();
    const settleMs = Math.max(150, Math.min(600, Math.round(frameIntervalMs)));

    for (let step = 0; step < stepCount; step++) {
      const stepFrames = framesBase + (step < framesRemainder ? 1 : 0);
      const stepProgress = stepCount === 1 ? 0 : step / (stepCount - 1);
      const targetY = Math.round(scrollMaxY * stepProgress);

      await this.page.evaluate((y) => {
        window.scrollTo(0, y);
      }, targetY);
      await this.page.waitForTimeout(settleMs);

      for (let i = 0; i < stepFrames; i++) {
        const screenshot = await this.page.screenshot({
          type: 'png',
          encoding: 'binary',
          optimizeForSpeed: false
        });

        const filepath = FileManager.saveScreenshot(screenshot, frameIndex, tempDir);
        screenshotPaths.push(filepath);

        if (frameIndex === 0) {
          console.log(`📸 第一帧: ${screenshot.length} bytes`);
        } else if (frameIndex === Math.floor(screenshotPaths.length / 2)) {
          console.log(`📸 中间帧 (${frameIndex}): ${screenshot.length} bytes`);
        }

        frameIndex++;

        const targetTime = startTime + frameIndex * frameIntervalMs;
        const remaining = targetTime - Date.now();
        if (remaining > 0) {
          await this.page.waitForTimeout(remaining);
        }
      }
    }

    console.log(`📸 最后一帧 (${frameIndex - 1}): ${screenshotPaths.length > 0 ? require('fs').statSync(screenshotPaths[screenshotPaths.length - 1]).size : 0} bytes`);
    
    return screenshotPaths;
  }

  /**
   * 模拟滚轮录制（适用于全屏滚动/SPA网站）
   * @param {number} duration - 录制时长（毫秒）
   * @param {number} fps - 帧率
   * @returns {Promise<string[]>} 截图文件路径数组
   */
  async captureWithWheel(duration, fps) {
    // 获取页面总高度
    let totalHeight = await this.page.evaluate(() => document.body.scrollHeight);
    
    // 智能节奏控制策略 (Smart Rhythm Control)
    // 目标：在 1.2s - 2.0s 之间寻找最佳节奏，优先保证动画完整性
    
    // 假设：用户如果设置了很长的录制时间（如 30s+），通常期望看得很仔细，节奏可以慢一点（2.0s）
    // 如果用户设置了短时间（如 10s），通常期望快速预览，节奏可以快一点（1.2s）
    
    const MIN_INTERVAL_MS = 1200; // 最快 1.2s 一屏 (保证动画不被吞)
    const MAX_INTERVAL_MS = 2000; // 最慢 2.0s 一屏 (保证不拖沓)
    
    // 动态计算间隔：根据总时长线性映射
    // 10s -> 1.2s
    // 30s -> 2.0s
    // 映射公式: interval = 1.2 + (duration - 10000) / (30000 - 10000) * (2.0 - 1.2)
    let intervalMs = MIN_INTERVAL_MS;
    if (duration > 10000) {
      const ratio = Math.min(1, (duration - 10000) / 20000); // 0.0 - 1.0
      intervalMs = MIN_INTERVAL_MS + ratio * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
    }
    
    const scrollIntervalSeconds = intervalMs / 1000;
    
    // 计算基于时间预算的最大滚动次数 (Time Budgeting)
    // 这是一个"尽力而为"的上限，实际可能会因为提前到底而停止
    const maxScrolls = Math.floor(duration / intervalMs);
    
    // 强制设置虚拟高度，确保 stepCount 计算正确
    // 我们给予一个非常大的虚拟高度，确保逻辑上能滚完 maxScrolls
    if (totalHeight <= this.viewportHeight) {
      totalHeight = this.viewportHeight * (maxScrolls + 2);
      console.log(`⚠️ 检测到短页面，启用智能滚动模式:`);
      console.log(`   - 滚动间隔: ${scrollIntervalSeconds.toFixed(2)}s`);
      console.log(`   - 预计滚动: ${maxScrolls} 屏`);
    }

    const totalFrames = Math.max(1, Math.floor((duration / 1000) * fps));
    
    // 使用最大滚动次数作为计划步数
    const stepCount = maxScrolls;
    
    const framesBase = Math.floor(totalFrames / stepCount);
    const framesRemainder = totalFrames % stepCount;

    console.log(`📊 滚轮模式: 计划 ${stepCount} 次滚动 (间隔 ${scrollIntervalSeconds.toFixed(2)}s), 总帧 ${totalFrames}`);

    const tempDir = this.tempDir;
    
    let frameIndex = 0;
    const screenshotPaths = [];
    const frameIntervalMs = 1000 / fps;
    const startTime = Date.now();
    
    // 每次滚动的距离（一屏）
    const scrollDelta = this.viewportHeight;
    
    // 用于视觉去重的 Buffer
    let lastScreenBuffer = null;
    let isBottomReached = false;
    
    // 确保鼠标在视口中心
    try {
      const viewport = this.page.viewport();
      if (viewport) {
        await this.page.mouse.move(viewport.width / 2, viewport.height / 2);
      }
    } catch (e) {}

    // 动态调整动画等待时间：留出 500ms 给截图操作，其余时间用于等待动画
    const animationWaitMs = Math.max(800, intervalMs - 500);

    for (let step = 0; step < stepCount; step++) {
      // 如果已经到底，直接退出循环
      if (isBottomReached) {
        console.log(`🏁 页面已到底，提前结束录制 (Step ${step}/${stepCount})`);
        break;
      }

      const stepFrames = framesBase + (step < framesRemainder ? 1 : 0);
      
      // 执行滚轮操作
      if (step > 0) { // 第一段不需要滚动
        console.log(`🖱️ 模拟滚轮向下: ${scrollDelta}px`);
        await this.page.mouse.wheel({ deltaY: scrollDelta });
        
        // 等待动画完成
        await this.page.waitForTimeout(animationWaitMs);
      }

      for (let i = 0; i < stepFrames; i++) {
        let screenshot;
        try {
          screenshot = await this.page.screenshot({
            type: 'png',
            encoding: 'binary',
            optimizeForSpeed: false
          });
        } catch (e) {
          console.warn(`⚠️ 截图失败 (帧 ${frameIndex}): ${e.message}`);
          continue; 
        }

        // 更新上一帧 Buffer 用于比对
        // 我们只在每段的第一帧更新 lastScreenBuffer，用于下一段滚动后的比对
        if (i === 0) {
            if (lastScreenBuffer && Buffer.compare(lastScreenBuffer, screenshot) === 0 && step > 0) {
                console.log('🛑 检测到画面静止（已到底部）');
                isBottomReached = true;
                // 不要 break，把这一帧存下来作为最后一帧，然后外层循环会 break
            }
            lastScreenBuffer = screenshot;
        }
        
        if (isBottomReached && i > 0) {
            // 如果已经判定到底，且不是该段第一帧，就不再重复截图了，直接退出内层循环
            break; 
        }

        try {
          const filepath = FileManager.saveScreenshot(screenshot, frameIndex, tempDir);
          screenshotPaths.push(filepath);
        } catch (e) {
           console.error(`❌ 保存截图失败 (帧 ${frameIndex}):`, e);
           throw e;
        }

        frameIndex++;

        const targetTime = startTime + frameIndex * frameIntervalMs;
        const remaining = targetTime - Date.now();
        if (remaining > 0) {
          await this.page.waitForTimeout(remaining);
        }
      }
    }
    
    return screenshotPaths;
  }

  /**
   * 固定视口录制（短页面）
   * @param {number} duration - 录制时长（毫秒）
   * @param {number} fps - 帧率
   * @returns {Promise<string[]>} 截图文件路径数组
   */
  async captureFixed(duration, fps) {
    const tempDir = this.tempDir;
    
    const frameCount = Math.max(1, Math.floor((duration / 1000) * fps));
    const screenshotPaths = [];
    const frameIntervalMs = 1000 / fps;
    const startTime = Date.now();

    console.log(`📊 固定视口录制: ${frameCount} 帧`);

    for (let i = 0; i < frameCount; i++) {
      const screenshot = await this.page.screenshot({
        type: 'png',
        encoding: 'binary',
        optimizeForSpeed: false
      });

      const filepath = FileManager.saveScreenshot(screenshot, i, tempDir);
      screenshotPaths.push(filepath);

      if (i === 0) {
        console.log(`📸 第一帧: ${screenshot.length} bytes`);
      } else if (i === Math.floor(frameCount / 2)) {
        console.log(`📸 中间帧 (${i}): ${screenshot.length} bytes`);
      }

      const targetTime = startTime + (i + 1) * frameIntervalMs;
      const remaining = targetTime - Date.now();
      if (remaining > 0) {
        await this.page.waitForTimeout(remaining);
      }
    }

    console.log(`📸 最后一帧 (${frameCount - 1}): ${screenshotPaths.length > 0 ? require('fs').statSync(screenshotPaths[screenshotPaths.length - 1]).size : 0} bytes`);
    
    return screenshotPaths;
  }
}

module.exports = ScrollRecorder;
