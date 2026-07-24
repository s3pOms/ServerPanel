function isPrivateIP(ip) {
  if (!ip) return true;
  const cleaned = ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
  const parts = cleaned.split('.').map(Number);
  if (parts.length !== 4) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function ipFilter(settingsLoader) {
  return (req, res, next) => {
    const settings = settingsLoader();
    if (!settings.blockPublic) return next();
    const ip = req.ip || req.connection.remoteAddress || '';
    if (isPrivateIP(ip)) return next();
    res.status(403).json({ error: '公网访问已禁止，请使用内网或本地连接' });
  };
}

module.exports = { ipFilter, isPrivateIP };