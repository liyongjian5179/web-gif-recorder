const BrowserManager = require('./utils/browser');
const ScrollRecorder = require('./scroll-capture');
const GifConverter = require('./gif-converter');
const FileManager = require('./utils/file-manager');
const ParamParser = require('./utils/param-parser');

class WebGifRecorder {
  /**
   * 网站动图录制器
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = {
      width: 1280,
      height: 720,
      fps: 15,
      duration: 15000,
      ...options
    };
  }

  /**
   * 录制网站并生成 GIF
   * @param {string} url - 网站 URL
   * @param {Object} options - 录制选项
   * @param {number} options.duration - 录制时长（毫秒）
   * @param {number} options.fps - 帧率
   * @param {number} options.width - 视口宽度
   * @param {number} options.height - 视口高度
   * @param {string} options.device - 设备类型
   * @param {boolean} options.noCleanup - 是否不清理临时文件
    * @param {string} options.quality - 质量级别（已移除，固定使用高质量）
   * @param {string} options.filename - 自定义文件名（不含扩展名）
   * @returns {Promise<string>} GIF 文件路径
   * @throws {Error} 如果录制失败
   */
  async record(url, options = {}) {
    let {
      duration = this.options.duration,
      fps = this.options.fps,
      width = this.options.width,
      height = this.options.height,
      device = 'pc',
      actions = '',
      noCleanup = false,
      filename,
      quality = 'high',
      dpi = 1,
      format = 'gif'
    } = options;

    console.log('🔍 启动浏览器...');

    const browser = await BrowserManager.launch({ width, height, device, dpi });
    const page = await browser.newPage();

    // 获取实际视口尺寸（可能被 BrowserManager 限制过）
    const viewport = page.viewport();
    if (viewport) {
      if (viewport.width !== width || viewport.height !== height) {
        console.log(`📐 实际视口调整: ${width}x${height} → ${viewport.width}x${viewport.height}`);
        width = viewport.width;
        height = viewport.height;
      }
    }

    // 清除浏览器数据（Cookie、LocalStorage等）
    try {
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');
      console.log('🧹 已清除浏览器缓存和Cookie');
    } catch (e) {
      console.log('⚠️  清除缓存失败（可忽略）');
    }

    try {
      // 访问目标网站
      console.log('🌐 加载页面...');
      
      // 简单访问，不添加缓存清除参数（避免破坏主题应用）
      console.log(`📊 访问 URL: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // 等待页面稳定（确保主题和动画已加载）
      console.log('⏳ 等待页面稳定...');
      
      // 检测主题状态（用于调试）
      const themeState = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body || {};
        const bodyStyles = window.getComputedStyle(body);
        
        return {
          hasDarkClass: html.classList.contains('dark'),
          dataTheme: html.getAttribute('data-theme'),
          bodyClass: body.className || '',
          bodyBg: bodyStyles.backgroundColor,
          bodyColor: bodyStyles.color,
          url: window.location.href,
          hasThemeParams: window.location.search.includes('theme=dark')
        };
      });
      
      console.log('📊 主题状态:', JSON.stringify(themeState, null, 2));
      
      // 通用页面稳定等待（3-5 秒）
      // 这比硬编码的元素检测更可靠，适用于各种网站
      // 延长等待时间确保主题完全应用
      await page.waitForTimeout(4000);
      
      // 再次检查主题状态（确保主题已应用）
      const finalThemeState = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body || {};
        const bodyStyles = window.getComputedStyle(body);
        
        return {
          hasDarkClass: html.classList.contains('dark'),
          bodyBg: bodyStyles.backgroundColor,
          bodyColor: bodyStyles.color
        };
      });
      
      console.log('📊 最终主题状态:', JSON.stringify(finalThemeState, null, 2));
      console.log('✅ 页面已稳定');

      // 执行页面操作
      if (actions) {
        console.log('🎬 执行页面操作...');
        await ParamParser.executeActions(page, actions);
      }

      // 获取页面信息
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      console.log(`📏 页面高度: ${pageHeight}px, 视口高度: ${height}px`);

      // 智能选择录制方式
      let screenshotPaths;
      if (pageHeight > height * 1.5) {
        console.log('🔄 长页面检测，启用滚动录制...');
        const scrollRecorder = new ScrollRecorder(page, height);
        screenshotPaths = await scrollRecorder.captureWithScroll(duration, fps);
      } else {
        console.log('📱 短页面，固定视口录制...');
        const scrollRecorder = new ScrollRecorder(page, height);
        screenshotPaths = await scrollRecorder.captureFixed(duration, fps);
      }

      console.log(`📊 录制完成: ${screenshotPaths.length} 帧`);

      // 关闭浏览器
      await BrowserManager.close(browser);

      // 生成 GIF/MP4
      const gifPath = await GifConverter.convert(screenshotPaths, { 
        width, height, fps, url, device, quality, filename, format, dpi
      });

      // 清理临时文件
      if (!noCleanup) {
        console.log('🧹 清理临时文件...');
        FileManager.cleanupDir(FileManager.getTempDir(), false);
      } else {
        console.log('⚠️  跳过临时文件清理（--no-cleanup）');
      }

      return gifPath;

    } catch (error) {
      // 确保关闭浏览器
      await BrowserManager.close(browser);
      throw error;
    }
  }
}

module.exports = WebGifRecorder;
