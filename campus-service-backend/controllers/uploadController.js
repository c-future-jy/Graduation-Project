const { pool } = require('../config/db');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/avatar');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * 上传头像
 * POST /api/upload/avatar
 */
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }
    
    // 生成新的文件名
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(req.file.originalname)}`;
    const filePath = path.join(uploadDir, filename);
    
    // 移动文件
    fs.renameSync(req.file.path, filePath);
    
    // 生成访问URL
    const avatarUrl = `/uploads/avatar/${filename}`;
    
    // 更新用户头像
    await pool.query(
      'UPDATE user SET avatar_url = ? WHERE id = ?',
      [avatarUrl, req.user.id]
    );
    
    res.json({
      success: true,
      data: {
        avatarUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 通用文件上传
 * POST /api/upload
 */
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }
    
    // 确保上传目录存在
    const uploadDir = path.join(__dirname, '../uploads/files');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 生成新的文件名
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(req.file.originalname)}`;
    const filePath = path.join(uploadDir, filename);
    
    // 移动文件
    fs.renameSync(req.file.path, filePath);
    
    // 生成访问URL
    const fileUrl = `/uploads/files/${filename}`;
    
    res.json({
      success: true,
      data: {
        url: fileUrl
      }
    });
  } catch (error) {
    next(error);
  }
};