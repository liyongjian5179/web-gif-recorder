const url = require('url');

class ParamParser {
  static splitFirst(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index === -1) {
      return [str.trim(), ''];
    }
    const first = str.slice(0, index).trim();
    const rest = str.slice(index + delimiter.length).trim();
    return [first, rest];
  }

  /**
   * 解析网站参数
   * @param {string} urlStr - URL 字符串
   * @param {string} paramsStr - 参数字符串，格式如 "lang:en,theme:dark"
   * @returns {string} 处理后的 URL
   */
  static parse(urlStr, paramsStr) {
    if (!paramsStr) {
      return urlStr;
    }

    try {
      const urlObj = new URL(urlStr);
      
      // 解析参数字符串
      const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);
      
      params.forEach(param => {
        const [key, value] = this.splitFirst(param, ':');
        
        if (key && value) {
          // 处理特殊参数
          if (key === 'lang') {
            // 语言参数 - 添加到 URL 查询参数
            urlObj.searchParams.set('lang', value);
          } else if (key === 'theme') {
            // 主题参数
            urlObj.searchParams.set('theme', value);
          } else if (key === 'mode') {
            // 模式参数
            urlObj.searchParams.set('mode', value);
          } else {
            // 其他参数直接添加
            urlObj.searchParams.set(key, value);
          }
        }
      });

      return urlObj.toString();
    } catch (e) {
      console.warn(`⚠️  参数解析失败: ${e.message}`);
      return urlStr;
    }
  }

  /**
   * 执行页面操作（JavaScript代码）
   * @param {Page} page - Puppeteer 页面实例
   * @param {string} actionsStr - 操作字符串，格式如 "click:#button,scroll:1000"
   * @returns {Promise<void>}
   */
  static async executeActions(page, actionsStr) {
    if (!actionsStr) {
      return;
    }

    try {
      const actions = actionsStr.split(',').map(a => a.trim()).filter(a => a);
      
      for (const action of actions) {
        const [actionType, value] = this.splitFirst(action, ':');
        
        switch (actionType) {
          case 'scroll':
            // 滚动到指定位置
            const scrollY = parseInt(value) || 0;
            await page.evaluate((y) => {
              window.scrollTo({ top: y, behavior: 'smooth' });
            }, scrollY);
            await page.waitForTimeout(500);
            break;
            
          case 'click':
            // 点击元素
            try {
              await page.waitForSelector(value, { timeout: 3000 });
              await page.click(value);
              await page.waitForTimeout(500);
            } catch (e) {
              console.warn(`⚠️  点击失败: ${value} - ${e.message}`);
            }
            break;
            
          case 'wait':
            // 等待指定时间（毫秒）
            const waitTime = parseInt(value) || 1000;
            await page.waitForTimeout(waitTime);
            break;
            
          case 'hover':
            // 悬停元素
            try {
              await page.waitForSelector(value, { timeout: 3000 });
              await page.hover(value);
              await page.waitForTimeout(500);
            } catch (e) {
              console.warn(`⚠️  悬停失败: ${value} - ${e.message}`);
            }
            break;
            
          case 'type':
            // 输入文本（需要配合选择器）
            // 格式: type:#input:text
            const [selector, text] = this.splitFirst(value, ':');
            if (selector && text !== undefined) {
              try {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.type(selector, text);
                await page.waitForTimeout(500);
              } catch (e) {
                console.warn(`⚠️  输入失败: ${selector} - ${e.message}`);
              }
            } else {
              console.warn(`⚠️  输入参数格式错误: ${action}`);
            }
            break;
            
          case 'js':
            // 执行 JavaScript 代码
            // 格式: js:document.documentElement.setAttribute('data-theme', 'dark')
            try {
              // 使用 Function 构造函数避免 eval 的作用域问题
              await page.evaluate((jsCode) => {
                try {
                  // 直接执行代码
                  const func = new Function(jsCode);
                  func();
                } catch (e) {
                  console.error('JavaScript 执行错误:', e.message);
                }
              }, value);
              await page.waitForTimeout(500);
              console.log(`✅ 执行 JavaScript: ${value}`);
            } catch (e) {
              console.warn(`⚠️  JavaScript 执行失败: ${e.message}`);
            }
            break;
            
          case 'waitfor':
            // 等待特定元素出现
            // 格式: waitfor:[data-theme="dark"]
            try {
              await page.waitForSelector(value, { timeout: 5000 });
              console.log(`✅ 等待元素出现: ${value}`);
            } catch (e) {
              console.warn(`⚠️  等待元素失败: ${value} - ${e.message}`);
            }
            break;
          
          default:
            console.warn(`⚠️  未知操作: ${actionType}`);
            break;
        }
      }
    } catch (e) {
      console.warn(`⚠️  操作执行失败: ${e.message}`);
    }
  }

  /**
   * 获取参数说明
   * @returns {string} 参数说明
   */
  static getHelp() {
    return `
网站参数说明:
  lang:en          - 设置语言为英文
  lang:zh          - 设置语言为中文
  theme:dark       - 设置深色主题
  theme:light      - 设置浅色主题
  mode:mobile      - 设置移动端模式
  mode:desktop     - 设置桌面端模式

页面操作说明:
  scroll:1000      - 滚动到 1000px 位置
  click:#button    - 点击元素
  wait:1000        - 等待 1000ms
  hover:#element   - 悬停元素
  type:#input:text - 输入文本
  js:CODE          - 执行 JavaScript 代码
  waitfor:SELECTOR - 等待元素出现

示例:
  # 基本参数
  --params "lang:en,theme:dark"
  
  # 执行 JavaScript 切换主题
  --actions "js:document.documentElement.setAttribute('data-theme', 'dark')"
  
  # 组合使用
  --params "lang:en" --actions "js:document.documentElement.classList.add('dark'),wait:1000"
  
  # 点击主题切换按钮
  --actions "click:#theme-toggle,wait:1000"
    `;
  }
}

module.exports = ParamParser;
