const puppeteer = require('puppeteer');
const fs = require('fs');

class BrowserManager {
  static resolveExecutablePath() {
    const envPath = process.env.CHROME_PATH;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }

    const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macChromePath)) {
      return macChromePath;
    }

    if (typeof puppeteer.executablePath === 'function') {
      const bundled = puppeteer.executablePath();
      if (bundled && fs.existsSync(bundled)) {
        return bundled;
      }
    }

    return undefined;
  }

  /**
   * 启动浏览器实例
   * @param {Object} options - 配置选项
   * @param {number} options.width - 视口宽度，默认 1280
   * @param {number} options.height - 视口高度，默认 720
   * @param {boolean} options.headless - 是否无头模式，默认 true
   * @param {string} options.device - 设备类型：'pc' 或 'mobile'，默认 'pc'
   * @returns {Promise<Browser>} Puppeteer 浏览器实例
   */
  static async launch(options = {}) {
    const {
      width = 1280,
      height = 720,
      headless = true,
      device = 'pc',
      dpi = 1  // 使用 1x DPI（避免缩放损失）
    } = options;

    console.log(`🔧 启动浏览器实例 (${device}模式, ${dpi}x DPI)...`);

    // 智能尺寸限制：最大 1920x1080
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;

    // 限制尺寸，保持宽高比
    let limitedWidth = width;
    let limitedHeight = height;

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      limitedWidth = Math.round(width * ratio);
      limitedHeight = Math.round(height * ratio);
      console.log(`📐 尺寸限制: ${width}x${height} → ${limitedWidth}x${limitedHeight}`);
    }

    // 设备配置（支持高 DPI）
    const deviceConfig = {
      pc: {
        width: limitedWidth,
        height: limitedHeight,
        deviceScaleFactor: dpi,  // 关键：设置设备缩放因子
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { 
          width: limitedWidth, 
          height: limitedHeight, 
          isMobile: false, 
          hasTouch: false, 
          isLandscape: true,
          deviceScaleFactor: dpi  // 高 DPI 支持
        }
      },
      mobile: {
        width: limitedWidth,
        height: limitedHeight,
        deviceScaleFactor: dpi,  // 关键：设置设备缩放因子
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: { 
          width: limitedWidth, 
          height: limitedHeight, 
          isMobile: true, 
          hasTouch: true, 
          isLandscape: false,
          deviceScaleFactor: dpi  // 高 DPI 支持
        }
      }
    };

    const config = deviceConfig[device] || deviceConfig.pc;

    const executablePath = this.resolveExecutablePath();
    if (executablePath) {
      console.log(`🔧 使用浏览器: ${executablePath}`);
    } else {
      console.log('⚠️  未指定浏览器路径，使用 Puppeteer 默认浏览器');
    }

    const browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-default-apps',
        '--no-first-run',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-cache',
        '--disable-application-cache',
        '--disable-offline-load-stale-cache',
        '--disk-cache-size=0',
        '--media-cache-size=0',
        '--high-dpi-support',
        '--force-device-scale-factor=' + dpi,
        '--disable-smooth-scrolling'
      ],
      defaultViewport: config.viewport,
      timeout: 60000,
      dumpio: false
    });

    return browser;
  }

  /**
   * 关闭浏览器实例
   * @param {Browser} browser - 浏览器实例
   */
  static async close(browser) {
    if (browser) {
      await browser.close();
      console.log('✅ 浏览器已关闭');
    }
  }
}

module.exports = BrowserManager;
