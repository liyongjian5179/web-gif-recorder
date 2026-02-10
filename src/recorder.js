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
   * 智能探测页面类型
   * @param {Page} page - Puppeteer 页面实例
   * @param {number} viewportHeight - 视口高度
   * @returns {Promise<{shouldScroll: boolean, method: 'native'|'wheel'}>}
   */
  async detectPageType(page, viewportHeight) {
    // 1. 基础高度检测
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    
    if (pageHeight > viewportHeight * 1.5) {
      console.log('🔍 检测结果: 普通长页面 (基于高度)');
      return { shouldScroll: true, method: 'native' };
    }

    // 2. 视觉探测 (针对 SPA/全屏滚动网站)
    console.log('🕵️ 页面高度较小，启动视觉探测...');
    
    // 记录原始状态
    const initialBuffer = await page.screenshot({ encoding: 'binary' });
    
    // 模拟滚轮
    try {
      // 确保鼠标在视口中心
      const viewport = page.viewport();
      if (viewport) {
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
      }
      
      await page.mouse.wheel({ deltaY: viewportHeight });
      await page.waitForTimeout(1000); // 等待潜在的动画
    } catch (e) {
      // 忽略错误
    }
    
    const afterScrollBuffer = await page.screenshot({ encoding: 'binary' });
    
    // 3. Buffer 比较
    const hasVisualChange = Buffer.compare(initialBuffer, afterScrollBuffer) !== 0;
    
    if (hasVisualChange) {
      console.log('🔍 检测结果: 隐式滚动/SPA 网站 (基于视觉变化)');
      // 探测破坏了页面状态，需要刷新
      console.log('🔄 刷新页面以重置状态...');
      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000); // 等待重载稳定
      
      return { shouldScroll: true, method: 'wheel' };
    }

    console.log('🔍 检测结果: 固定单页 (无视觉变化)');
    return { shouldScroll: false, method: 'native' };
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

    // 注入 Cookies (如果有)
    const cookies = options.cookies;
    if (cookies) {
      const fs = require('fs');
      try {
        // ... (省略解析代码，保持不变) ...
        let cookiesObj;
        let sourceInfo = '';

        // 1. 尝试作为文件读取
        if (fs.existsSync(cookies)) {
          const cookiesContent = fs.readFileSync(cookies, 'utf8');
          try {
             cookiesObj = JSON.parse(cookiesContent);
             sourceInfo = `文件 ${cookies}`;
          } catch (e) {
             console.error(`❌ Cookie 文件解析失败: ${e.message}`);
             throw e;
          }
        } 
        // 2. 尝试作为 JSON 字符串解析
        else if (cookies.trim().startsWith('[') || cookies.trim().startsWith('{')) {
           try {
             cookiesObj = JSON.parse(cookies);
             sourceInfo = 'JSON 字符串';
           } catch (e) {
             console.warn(`⚠️  Cookie JSON 解析失败，尝试按 Key-Value 解析: ${e.message}`);
           }
        }
        
        // 3. 拒绝原始 Key-Value 字符串
        if (!cookiesObj && cookies.includes('=')) {
           console.error('❌ 错误: 不支持 Key=Value 字符串格式 (缺少 HttpOnly/Secure 关键信息)');
           console.error('👉 请使用 "EditThisCookie" 插件导出为 JSON 格式，然后保存为文件或直接作为参数传入。');
           console.error('   示例: [{"domain":".example.com", "name":"session_id", "value":"...", ...}]');
           throw new Error('不支持的 Cookie 格式: 请使用 JSON');
        }

        if (cookiesObj) {
          // 策略：先访问页面建立上下文，再注入 Cookie，然后刷新
          // 这能解决绝大多数 Domain 匹配失败或上下文丢失的问题
          console.log('🌐 预访问页面以建立 Cookie 上下文...');
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch (e) {
            console.warn(`⚠️  预访问失败 (可能需要登录): ${e.message}`);
          }

          // 确保 cookies 是数组
          const cookiesList = Array.isArray(cookiesObj) ? cookiesObj : [cookiesObj];
          
          // 过滤有效字段并设置
          const urlObj = new URL(url);
          const validCookies = cookiesList.map(c => {
             const cookie = { ...c };
             
             // 移除不支持的字段
             delete cookie.hostOnly;
             delete cookie.session;
             delete cookie.storeId;
             delete cookie.id;
             
             // 修正 sameSite
             if (cookie.sameSite && !['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
               delete cookie.sameSite;
             }
             
             // 修正 domain: 去除开头的点
             if (cookie.domain && cookie.domain.startsWith('.')) {
                cookie.domain = cookie.domain.substring(1);
             }

             // 确保 domain 存在
             if (!cookie.domain && !cookie.url) {
                cookie.domain = urlObj.hostname;
             }
             
             // 如果提供了 domain，但与当前 URL 不匹配 (且不是父域)，则强制修正为当前 host
             // 这一步是为了防止用户复制了错误的 domain 导致注入失败
             // 但如果用户提供了正确的父域 (如 mioffice.cn)，我们应该保留它以支持 SSO
             if (cookie.domain) {
                const host = urlObj.hostname;
                const domain = cookie.domain;
                // 如果 host 不包含 domain (即 domain 不是 host 的后缀)，则认为 domain 无效，强制修正
                if (!host.endsWith(domain) && host !== domain) {
                   cookie.domain = host;
                }
             }

             // 移除 expirationDate，将其转换为会话 Cookie
             // 避免因时间同步或格式问题导致 Cookie 被浏览器立即丢弃
             delete cookie.expirationDate;
             delete cookie.expires; // 有些工具导出的是 expires

             // 移除 url 属性
             if (cookie.url) {
                delete cookie.url; 
             }
             
             // 强制 Secure (如果当前是 HTTPS)
             if (url.startsWith('https://')) {
                cookie.secure = true;
             }
             
             // 如果 sameSite 是 None 且不是 Secure，Chrome 会拒绝
             if (cookie.sameSite === 'None') {
                cookie.secure = true;
             }

             // 只有当 sameSite 无效时才删除，否则保留原值 (特别是 None)
             if (cookie.sameSite && !['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
               delete cookie.sameSite;
             }
             
             // 移除 httpOnly，避免干扰
             // delete cookie.httpOnly; // 保留 httpOnly 其实通常没问题，但为了极端稳妥也可以移除

             return cookie;
          });
          
          if (validCookies.length > 0) {
            console.log(`🍪 调试: 首个 Cookie 预览: ${JSON.stringify(validCookies[0])}`);
          }

          await page.setCookie(...validCookies);
          
          // 验证注入结果 (显式指定 URL，避免因页面重定向导致检测当前页面 Cookie 失败)
          const currentCookies = await page.cookies(url);
          console.log(`🍪 已注入 Cookies (${sourceInfo}): 请求 ${validCookies.length} 个, 针对 ${url} 有效 ${currentCookies.length} 个`);
          
          if (currentCookies.length === 0 && validCookies.length > 0) {
             console.warn('⚠️  警告: Cookie 注入后未生效，请检查 Domain 是否匹配');
             console.log(`ℹ️  当前页面 URL: ${page.url()}`);
          }
          
          // 刷新页面以应用 Cookie -> 改为不操作，让后续的主流程 goto 重新访问
          // 因为如果当前在登录页，刷新还是登录页。我们需要重新访问目标 URL。
          console.log('🔄 Cookie 注入完成，准备重新访问目标 URL...');
          // await page.reload({ waitUntil: 'networkidle2' }); // 移除 reload
        } else {
          console.warn(`⚠️  无法解析 Cookies 参数: ${cookies}`);
        }
      } catch (e) {
        console.error(`❌ Cookie 注入失败: ${e.message}`);
      }
    }

    // 只有当没有注入 Cookie 时，或者注入失败时，才执行常规的 goto
    // 但上面的逻辑是：预访问 -> 注入 -> 刷新。
    // 如果我们不阻止下面的 goto，它会再次访问。
    // 为了稳妥，我们可以在这里直接 return 吗？不行，后面还有 resize 逻辑。
    // 我们修改一下下面的 try-catch 块，判断是否已经加载过。
    
    // 实际上，再次 goto 并没有害处，反而能确保状态。
    // 如果已经登录，goto 会直接进入后台。
    
    if (!cookies) {
       // 如果没有 cookies，才需要首次访问
       // 但为了保持原有逻辑结构，我们让后续的 goto 继续执行
       // 只是上面的预访问已经消耗了一次加载时间
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

      // 准备临时目录 (每个会话独立)
      const sessionTempDir = FileManager.createSessionDir();
      console.log(`📁 临时目录: ${sessionTempDir}`);

      // 智能选择录制方式
      const detectResult = await this.detectPageType(page, height);
      let screenshotPaths;

      if (detectResult.shouldScroll) {
        console.log(`🔄 启用${detectResult.method === 'wheel' ? '模拟滚轮' : '原生滚动'}录制...`);
        const scrollRecorder = new ScrollRecorder(page, height, sessionTempDir);
        
        if (detectResult.method === 'wheel') {
          screenshotPaths = await scrollRecorder.captureWithWheel(duration, fps);
        } else {
          screenshotPaths = await scrollRecorder.captureWithScroll(duration, fps);
        }
      } else {
        console.log('📱 短页面，固定视口录制...');
        const scrollRecorder = new ScrollRecorder(page, height, sessionTempDir);
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
        // 仅清理本次会话的目录
        FileManager.cleanupDir(sessionTempDir, false);
      } else {
        console.log('⚠️  跳过临时文件清理（--no-cleanup）');
        console.log(`   目录保留: ${sessionTempDir}`);
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
