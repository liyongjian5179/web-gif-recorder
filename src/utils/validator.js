class Validator {
  /**
   * 验证 URL 格式
   * @param {string} url - URL 字符串
   * @returns {boolean} 是否有效
   */
  static validateUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /**
   * 验证录制时长
   * @param {number} duration - 时长（秒）
   * @returns {boolean} 是否有效
   */
  static validateDuration(duration) {
    const d = parseInt(duration);
    return d > 0 && d <= 60; // 1-60秒
  }

  /**
   * 验证帧率
   * @param {number} fps - 帧率
   * @returns {boolean} 是否有效
   */
  static validateFps(fps) {
    const f = parseInt(fps);
    return f >= 5 && f <= 30; // 5-30 FPS
  }

  /**
   * 验证分辨率
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @returns {boolean} 是否有效
   */
  static validateResolution(width, height) {
    const w = parseInt(width);
    const h = parseInt(height);
    return w >= 320 && w <= 4096 && h >= 240 && h <= 4096;
  }

  /**
   * 验证文件名格式
   * @param {string} filename - 文件名（不含扩展名）
   * @returns {boolean} 是否有效
   */
  static validateFilename(filename) {
    if (!filename || typeof filename !== 'string') return false;
    if (filename.length < 1 || filename.length > 100) return false;
    // 只允许字母、数字、下划线、连字符、点
    return /^[a-zA-Z0-9_.-]+$/.test(filename);
  }

  static validateQuality(quality) {
    return ['ultra', 'high', 'medium', 'low'].includes(String(quality || '').toLowerCase());
  }

  static validateDpi(dpi) {
    const value = Number(dpi);
    if (!Number.isFinite(value)) return false;
    if (!Number.isInteger(value)) return false;
    return value >= 1 && value <= 3;
  }

  /**
   * 清理文件名中的非法字符
   * @param {string} filename - 文件名
   * @returns {string} 清理后的文件名
   */
  static sanitizeFilename(filename) {
    if (!filename) return '';
    // 移除非法字符，替换为下划线
    return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }
}

module.exports = Validator;
