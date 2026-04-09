function success(res, data = null, message, statusCode = 200) {
  const payload = { success: true };

  if (message !== undefined) payload.message = message;
  if (data !== undefined) payload.data = data;

  return res.status(statusCode).json(payload);
}

function fail(res, statusCode = 400, message = '请求失败', data, extra) {
  const payload = { success: false, message };

  if (data !== undefined) payload.data = data;
  if (extra && typeof extra === 'object') Object.assign(payload, extra);

  return res.status(statusCode).json(payload);
}

// 兼容历史 controller 内部命名
function successResponse(res, data = null, message = '操作成功', statusCode = 200) {
  return success(res, data, message, statusCode);
}

function errorResponse(res, code, message) {
  return fail(res, code, message);
}

module.exports = {
  success,
  fail,
  successResponse,
  errorResponse
};
