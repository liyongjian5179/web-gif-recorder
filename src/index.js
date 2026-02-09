const WebGifRecorder = require('./recorder');
const Validator = require('./utils/validator');
const FileManager = require('./utils/file-manager');
const ParamParser = require('./utils/param-parser');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Web GIF Recorder - 网站动图录制工具

用法:
  node examples/record-gif.js [选项]

必选参数:
  --url <url>              网站 URL

可选参数:
  -d, --device <type>      设备类型: pc 或 mobile (默认: pc)
  --duration <seconds>     录制时长: 1-60 秒 (默认: 15)
  --fps <number>           帧率: 5-30 FPS (默认: 15)
   --width <number>         视口宽度 (默认: PC=1280, Mobile=375)
   --height <number>        视口高度 (默认: PC=720, Mobile=667)
   --dpi <number>           截图 DPI 倍率: 1-3 (默认: ultra=2, 其它=1)
   --format <type>          输出格式: gif 或 mp4 (默认: gif)
   --quality <level>        质量级别: ultra/high/medium/low (默认: high)
  --params <string>        URL 参数: lang:en,theme:dark
  --actions <string>       页面操作: click:#button,wait:1000
    --filename <name>        自定义文件名（不含扩展名）
   --no-cleanup             不清理临时文件
   -h, --help               显示此帮助信息

使用示例:
  # PC端录制
  node examples/record-gif.js --url https://example.com --duration 10

  # Mobile端录制
  node examples/record-gif.js --url https://example.com --device mobile

  # 自定义分辨率
  node examples/record-gif.js --url https://example.com --width 1920 --height 1080

  # 高质量录制
  node examples/record-gif.js --url https://example.com --fps 30

  # 带URL参数
  node examples/record-gif.js --url https://example.com --params "lang:en,theme:dark"

   # 带页面操作
   node examples/record-gif.js --url https://example.com --actions "scroll:500,click:#button"

   # 自定义文件名
   node examples/record-gif.js --url https://example.com --filename my-recording

    # 调试模式（保留临时文件）
    node examples/record-gif.js --url https://example.com --no-cleanup true
   `);
  process.exit(0);
}

/**
 * 解析命令行参数
 * @param {string[]} args - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(args) {
  const params = {};
  const shortToLong = {
    '-d': 'device',
    '-h': 'help'
  };
  
  // 需要无参数的长选项
  const noParamLongOptions = ['no-cleanup', 'help'];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      // 长选项
      const key = arg.replace('--', '');
      if (key === 'help') {
        showHelp();
      }
      
      // 检查是否为无参数选项
      if (noParamLongOptions.includes(key)) {
        params[key] = true;
      } else {
        params[key] = args[i + 1];
        i++; // 跳过下一个参数（值）
      }
    } else if (arg.startsWith('-')) {
      // 短选项
      if (arg === '-h') {
        showHelp();
      } else if (arg === '-d') {
        // -d 需要参数
        params.device = args[i + 1];
        i++; // 跳过下一个参数（值）
      } else {
        console.error(`❌ 未知的短选项: ${arg}`);
        console.error('   支持的短选项: -d (device), -h (help)');
        process.exit(1);
      }
    }
  }
  
  return params;
}

/**
 * 主函数 - 解析命令行参数并执行录制
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const params = parseArgs(args);

  // 默认参数
  const originalUrl = params.url || 'https://liyongjian.top/v2';
  const durationSeconds = parseInt(params.duration) || 15;
  const duration = durationSeconds * 1000; // 转换为毫秒
  const fps = parseInt(params.fps) || 15;
  const device = params.device || 'pc'; // pc 或 mobile
  const paramsStr = params.params || ''; // 网站参数，如 "lang:en,theme:dark"
  const actionsStr = params.actions || ''; // 页面操作，如 "scroll:500,click:#button"
  const noCleanup = params['no-cleanup'] === true || params['no-cleanup'] === 'true' || params['no-cleanup'] === '1'; // 是否不清理临时文件
  const filename = params.filename || ''; // 自定义文件名
  const quality = (params.quality || 'high').toLowerCase();
  const format = (params.format || 'gif').toLowerCase();
  const defaultDpi = quality === 'ultra' ? 2 : 1;
  const dpi = params.dpi !== undefined ? parseInt(params.dpi) : defaultDpi;
  
  // 解析 URL 参数
  const url = ParamParser.parse(originalUrl, paramsStr);
  
  // 根据设备类型设置默认录屏尺寸（智能限制）
  let width = parseInt(params.width);
  let height = parseInt(params.height);
  
  if (!width || !height) {
    if (device === 'mobile') {
      width = width || 375;
      height = height || 667;
    } else {
      width = width || 1280;
      height = height || 720;
    }
  }
  
  // 智能尺寸限制：最大 1920x1080
  const MAX_WIDTH = 1920;
  const MAX_HEIGHT = 1080;
  
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    console.log(`📐 尺寸限制: ${width}x${height} (最大 ${MAX_WIDTH}x${MAX_HEIGHT})`);
  } else {
    console.log(`📐 录屏尺寸: ${width}x${height}`);
  }

  // 验证参数
  if (!Validator.validateUrl(url)) {
    console.error('❌ 无效的 URL:', url);
    console.error('   URL 必须以 http:// 或 https:// 开头');
    process.exit(1);
  }

  if (!Validator.validateDuration(durationSeconds)) {
    console.error('❌ 时长必须在 1-60 秒之间');
    process.exit(1);
  }

  if (!Validator.validateFps(fps)) {
    console.error('❌ FPS 必须在 5-30 之间');
    process.exit(1);
  }

  if (!Validator.validateResolution(width, height)) {
    console.error('❌ 分辨率超出有效范围 (320x240 - 3840x2160)');
    process.exit(1);
  }

  if (filename && !Validator.validateFilename(filename)) {
    console.error('❌ 无效的文件名:', filename);
    console.error('   文件名只能包含字母、数字、下划线、连字符和点，长度1-100字符');
    process.exit(1);
  }

  if (!Validator.validateQuality(quality)) {
    console.error('❌ 无效的质量级别:', quality);
    console.error('   质量级别必须是 ultra/high/medium/low');
    process.exit(1);
  }

  if (format !== 'gif' && format !== 'mp4') {
    console.error('❌ 无效的输出格式:', format);
    console.error('   输出格式必须是 gif 或 mp4');
    process.exit(1);
  }

  if (!Validator.validateDpi(dpi)) {
    console.error('❌ 无效的 DPI 倍率:', params.dpi);
    console.error('   DPI 倍率必须是 1-3 的整数');
    process.exit(1);
  }

  // 执行录制
  const recorder = new WebGifRecorder();
  const startTime = Date.now();
  
  try {
    console.log('');
    console.log('🚀 开始录制');
    console.log(`📊 URL: ${url}`);
    if (paramsStr) {
      console.log(`🔧 参数: ${paramsStr}`);
    }
    if (actionsStr) {
      console.log(`🎬 操作: ${actionsStr}`);
    }
    console.log(`⏱️  时长: ${(duration / 1000).toFixed(1)}秒`);
    console.log(`📊 帧率: ${fps} FPS`);
    console.log(`📐 分辨率: ${width}x${height}`);
    console.log(`🖼️  DPI: ${dpi}x`);
    console.log(`📱 设备: ${device}`);
    console.log(`🔧 质量: ${quality}`);
    console.log(`🎥 格式: ${format}`);
    if (filename) {
      console.log(`📁 文件名: ${filename}.${format}`);
    }
    if (paramsStr) {
      console.log(`🔧 参数: ${paramsStr}`);
    }
    if (actionsStr) {
      console.log(`🎬 操作: ${actionsStr}`);
    }
    if (noCleanup) {
      console.log(`⚠️  调试模式：保留临时文件`);
    }
    console.log('');
    
    // 执行录制
    const gifPath = await recorder.record(url, {
      duration,
      fps,
      width,
      height,
      device,
      actions: actionsStr,
      noCleanup,
      filename,
      quality,
      dpi,
      format
    });
    
    const endTime = Date.now();
    const fileStats = FileManager.getFileStats(gifPath);
    
    // 计算显示分辨率
    let displayWidth = width;
    let displayHeight = height;
    if (format === 'mp4' && dpi > 1) {
      displayWidth = Math.round(width * dpi / 2) * 2;
      displayHeight = Math.round(height * dpi / 2) * 2;
    }

    console.log('');
    console.log('✅ 录制完成！');
    console.log('');
    console.log('📊 文件信息:');
    console.log(`   - 路径: ${gifPath}`);
    console.log(`   - 大小: ${fileStats.sizeMB} MB`);
    console.log(`   - 时长: ${(duration / 1000).toFixed(1)} 秒`);
    console.log(`   - 分辨率: ${displayWidth}x${displayHeight}`);
    console.log(`   - 帧率: ${fps} FPS`);
    console.log(`   - 设备: ${device}`);
    console.log(`   - 生成时间: ${((endTime - startTime) / 1000).toFixed(1)} 秒`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 录制失败:', error.message);
    console.error('');
    
    if (error.message.includes('FFmpeg')) {
      console.error('💡 提示: 请确保已安装 FFmpeg');
      console.error('   macOS: brew install ffmpeg');
    } else if (error.message.includes('timeout')) {
      console.error('💡 提示: 页面加载超时，请检查网络连接');
    } else if (error.message.includes('net::')) {
      console.error('💡 提示: 网络错误，请检查 URL 和网络连接');
    }
    
    console.error('');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = main;
