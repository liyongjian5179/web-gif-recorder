const fs = require('fs');
const path = require('path');

class FileManager {
  /**
   * 确保目录存在
   * @param {string} dir - 目录路径
   */
  static ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 清理目录
   * @param {string} dir - 目录路径
   * @param {boolean} keepFirst - 是否保留第一张截图
   */
  static cleanupDir(dir, keepFirst = false) {
    if (fs.existsSync(dir)) {
      if (keepFirst) {
        // 保留第一张截图用于对比
        const files = fs.readdirSync(dir).sort();
        if (files.length > 1) {
          // 删除除第一张外的所有文件
          for (let i = 1; i < files.length; i++) {
            const file = path.join(dir, files[i]);
            fs.unlinkSync(file);
          }
          console.log('📸 保留第一张截图用于对比');
        }
      } else {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }

  /**
   * 保存截图
   * @param {Buffer} buffer - 截图数据
   * @param {number} index - 帧索引
   * @param {string} tempDir - 临时目录
   * @returns {string} 文件路径
   */
  static saveScreenshot(buffer, index, tempDir) {
    const filename = `frame_${String(index).padStart(4, '0')}.png`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
  }

  /**
   * 获取临时目录路径
   * @returns {string} 临时目录路径
   */
  static getTempDir() {
    return path.join(__dirname, '../../temp');
  }

  /**
   * 创建本次会话的临时目录
   * @returns {string} 会话临时目录路径
   */
  static createSessionDir() {
    const tempRoot = this.getTempDir();
    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionDir = path.join(tempRoot, sessionId);
    this.ensureDir(sessionDir);
    return sessionDir;
  }



  /**
   * 获取输出目录路径
   * @returns {string} 输出目录路径
   */
  static getOutputDir() {
    return path.join(__dirname, '../../output');
  }

  /**
   * 获取文件大小信息
   * @param {string} filepath - 文件路径
   * @returns {Object} 文件信息
   */
  static getFileStats(filepath) {
    if (!fs.existsSync(filepath)) {
      return null;
    }
    const stats = fs.statSync(filepath);
    return {
      size: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
      birthtime: stats.birthtime
    };
  }
}

module.exports = FileManager;
