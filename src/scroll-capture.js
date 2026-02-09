const FileManager = require('./utils/file-manager');

class ScrollRecorder {
  /**
   * 滚动录制器
   * @param {Page} page - Puppeteer 页面实例
   * @param {number} viewportHeight - 视口高度
   */
  constructor(page, viewportHeight) {
    this.page = page;
    this.viewportHeight = viewportHeight;
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

    const tempDir = FileManager.getTempDir();
    FileManager.ensureDir(tempDir);

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
   * 固定视口录制（短页面）
   * @param {number} duration - 录制时长（毫秒）
   * @param {number} fps - 帧率
   * @returns {Promise<string[]>} 截图文件路径数组
   */
  async captureFixed(duration, fps) {
    const tempDir = FileManager.getTempDir();
    FileManager.ensureDir(tempDir);

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
