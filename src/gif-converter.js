const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const FileManager = require('./utils/file-manager');

class GifConverter {
  /**
   * GIF质量配置
   * 优化方向：
   * 1. 增强调色板质量（最多256色，full统计模式）
   * 2. 优化抖动算法（floyd_steinberg高质量抖动）
   * 3. 激进的锐化参数（提升清晰度，最大2.0）
   * 4. 高质量缩放算法（lanczos）
   */
  static QUALITY_PRESETS = {
    ultra: {
      max_colors: 256,
      dither: 'sierra2_4a',
      diff_mode: 'rectangle',
      unsharp: '3:3:0.5:3:3:0.0', // 降低锐化强度，减少锯齿
      scale_flags: 'lanczos+accurate_rnd',
      stats_mode: 'full',
      final_delay: 50
    },
    high: {
      max_colors: 256,
      dither: 'floyd_steinberg',
      diff_mode: 'rectangle',
      unsharp: '3:3:0.5:3:3:0.0', // 降低锐化强度
      scale_flags: 'lanczos+accurate_rnd',
      stats_mode: 'full',
      final_delay: 50
    },
    medium: {
      max_colors: 256,
      dither: 'floyd_steinberg',
      diff_mode: 'rectangle',
      unsharp: '3:3:0.5:3:3:0.0',
      scale_flags: 'lanczos+accurate_rnd',
      stats_mode: 'full',
      final_delay: 80
    },
    low: {
      max_colors: 256,
      dither: 'bayer',
      bayer_scale: 3,
      diff_mode: 'rectangle',
      unsharp: '3:3:0.5:3:3:0.0',
      scale_flags: 'lanczos+accurate_rnd',
      stats_mode: 'full',
      final_delay: 100
    }
  };

  /**
   * 将截图序列转换为 GIF（使用两步调色板优化）
   * @param {string[]} screenshotPaths - 截图文件路径数组
   * @param {Object} options - 配置选项
   * @param {number} options.width - GIF 宽度
   * @param {number} options.height - GIF 高度
   * @param {number} options.fps - GIF 帧率
   * @param {string} options.url - 网站 URL（用于文件命名）
   * @param {string} options.device - 设备类型：'pc' 或 'mobile'
   * @param {string} options.quality - 质量级别：'ultra'、'high'、'medium'、'low'（默认：'high'）
   * @param {string} options.filename - 自定义文件名（不含扩展名）
   * @param {string} options.format - 输出格式：'gif' 或 'mp4'（默认：'gif'）
   * @returns {Promise<string>} 文件路径
   */
  static async convert(screenshotPaths, options) {
    const { width, height, fps, url, device = 'pc', quality = 'high', filename, format = 'gif', dpi = 1, verbose = false, frame = false, theme = 'light' } = options;

    // 生成文件
    if (verbose) console.log(`🎨 生成 ${format.toUpperCase()}...`);
    const outputPath = await this.convertWithoutShell(screenshotPaths, width, height, fps, url, device, quality, filename, format, dpi, verbose, frame, theme);

    return outputPath;
  }

  /**
   * 生成文件
   * @param {string[]} screenshotPaths - 截图文件路径数组
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {number} fps - 帧率
   * @param {string} url - 网站 URL
   * @param {string} device - 设备类型
   * @param {string} quality - 质量级别
   * @param {string} filename - 自定义文件名
   * @param {string} format - 输出格式
   * @param {number} dpi - DPI 倍率
   * @param {boolean} verbose - 是否显示详细日志
   * @param {boolean} frame - 是否添加浏览器外壳
   * @param {string} theme - 主题模式 ('light' 或 'dark')
   * @returns {Promise<string>} 文件路径
   */
  static convertWithoutShell(screenshotPaths, width, height, fps, url, device, quality = 'high', filename = null, format = 'gif', dpi = 1, verbose = false, frame = false, theme = 'light') {
    return new Promise((resolve, reject) => {
      const outputDir = FileManager.getOutputDir();
      FileManager.ensureDir(outputDir);

      // 生成文件名
      let outputPath;
      const timestamp = `${Date.now()}`;
      
      if (filename) {
        // 使用自定义文件名
        const Validator = require('./utils/validator');
        const sanitizedFilename = Validator.sanitizeFilename(filename);
        outputPath = path.join(outputDir, `${sanitizedFilename}.${format}`);
      } else {
        // 使用默认文件名逻辑
        let urlPrefix = 'website';
        let urlPath = '';
        try {
          const urlObj = new URL(url);
          let hostname = urlObj.hostname.replace(/^www\./, '').replace(/:\d+$/, '');
          hostname = hostname.replace(/[^a-zA-Z0-9-]/g, '_');
          let pathname = urlObj.pathname.replace(/^\/|\/$/g, '');
          pathname = pathname.replace(/[^a-zA-Z0-9-_]/g, '_');
          if (pathname.length > 50) {
            pathname = pathname.substring(0, 50);
          }
          urlPrefix = hostname;
          urlPath = pathname ? `_${pathname}` : '';
        } catch (e) {
          urlPrefix = 'website';
        }

        const devicePrefix = device === 'mobile' ? 'm' : 'pc';
        const now = new Date();
        const timestampStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
        outputPath = path.join(outputDir, `${urlPrefix}${urlPath}_${devicePrefix}_${timestampStr}.${format}`);
      }
      
      if (verbose) {
        console.log(`🎨 正在生成 ${format.toUpperCase()}...`);
        console.log(`📊 输入: ${screenshotPaths.length} 帧`);
        console.log(`📊 帧率: ${fps} FPS`);
        console.log(`📊 分辨率: ${width}x${height}`);
      }
      
      const qualityConfig = this.QUALITY_PRESETS[quality] || this.QUALITY_PRESETS.high;

      // 获取截图目录和文件名模式
      const firstFrame = screenshotPaths[0];
      const frameDir = path.dirname(firstFrame);
      const framePattern = path.join(frameDir, 'frame_%04d.png');

      const command = ffmpeg()
        .input(framePattern)
        .inputOptions(['-framerate', String(fps)]);

      // 浏览器外壳滤镜（已移除，改用 DOM 注入）
      const frameFilters = [];


      if (format === 'mp4') {
        // MP4 转换逻辑
        // console.log('🔧 使用 H.264 编码 (YUV420P)...');
        
        // 计算 MP4 输出尺寸（确保偶数，且应用 DPI）
        const outputWidth = Math.round(width * dpi / 2) * 2;
        const outputHeight = Math.round(height * dpi / 2) * 2;

        if (dpi > 1) {
             // console.log(`🔍 启用高 DPI 输出: ${outputWidth}x${outputHeight}`);
        }
        
        const videoFilters = [
           `scale=${outputWidth}:${outputHeight}:flags=${qualityConfig.scale_flags}`,
           ...frameFilters
        ];

        command
          .output(outputPath)
          .videoCodec('libx264')
          .outputOptions([
            `-vf`, videoFilters.join(','),
            `-pix_fmt`, `yuv420p`, // 兼容性最好的像素格式
            `-crf`, `18`,          // 高质量 CRF
            `-preset`, `slow`,     // 更好的压缩率
            `-movflags`, `+faststart`, // Web 优化
            `-an`                  // 无音频
          ]);
      } else {
        // GIF 转换逻辑
        if (verbose) {
          console.log(`🔧 质量级别: ${quality}`);
          console.log(`📊 调色板颜色: ${qualityConfig.max_colors}`);
          console.log(`📊 抖动算法: ${qualityConfig.dither}`);
          console.log(`📊 锐化: ${qualityConfig.unsharp}`);
          console.log('🔧 使用高质量调色板和抗锯齿算法...');
        }
        
        const palettePath = path.join(outputDir, `palette_${timestamp}.png`);
        
        // 构建优化的滤镜链
        const filterParts = [
          `fps=${fps}`,
          `scale=${width}:${height}:flags=${qualityConfig.scale_flags}`,
          ...frameFilters
        ];

        if (qualityConfig.unsharp) {
          filterParts.push(`unsharp=${qualityConfig.unsharp}`);
        }

        const commonFilters = filterParts.join(',');
        const paletteGenParams = `max_colors=${qualityConfig.max_colors}:stats_mode=${qualityConfig.stats_mode}:reserve_transparent=0`;
        let paletteUseParams = `dither=${qualityConfig.dither}:diff_mode=${qualityConfig.diff_mode}:new=0`;
        if (qualityConfig.bayer_scale) {
          paletteUseParams += `:bayer_scale=${qualityConfig.bayer_scale}`;
        }

        const filterComplex = `${commonFilters},split[a][b];[a]palettegen=${paletteGenParams}[p];[b][p]paletteuse=${paletteUseParams}`;
        
        command
          .output(outputPath)
          .complexFilter(filterComplex)
          .outputOptions([
             // '-loop', '0', 
             `-final_delay`, `${qualityConfig.final_delay}`
          ]);
      }

      // 添加进度监控
      const totalFrames = screenshotPaths.length;
      let lastPercent = 0;
      
      // 初始显示 0%
      process.stdout.write(`\r⏳ 处理进度: 0% [0/${totalFrames}]`);
      
      command.on('progress', (progress) => {
        let percent = 0;
        
        if (progress.percent) {
          percent = Math.floor(progress.percent);
        } else if (progress.frames && totalFrames > 0) {
          // 某些复杂滤镜下 percent 可能不准，手动计算
          percent = Math.floor((progress.frames / totalFrames) * 100);
        }
        
        // 确保不超过 100%
        percent = Math.min(100, Math.max(0, percent));
        
        // 仅在进度变化时更新，避免过度刷新
        if (percent !== lastPercent) {
           const frames = progress.frames || 0;
           process.stdout.write(`\r⏳ 处理进度: ${percent}% [${frames}/${totalFrames}]`);
           lastPercent = percent;
        }
      })
        .on('end', () => {
          console.log(`\n✅ ${format.toUpperCase()} 生成完成`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`\n❌ ${format.toUpperCase()} 生成失败:`, err.message);
          reject(err);
        })
        .run();
    });
  }
}

module.exports = GifConverter;
