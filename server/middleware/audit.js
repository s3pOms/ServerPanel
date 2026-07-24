const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'logs');

function auditLog(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (req.session && req.session.user) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        user: req.session.user.username,
        userId: req.session.user.id,
        method: req.method,
        path: req.originalUrl,
        body: sanitizeBody(req.body),
        statusCode: res.statusCode,
        ip: req.ip
      };
      const logFile = path.join(logDir, `audit-${new Date().toISOString().slice(0, 10)}.log`);
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    }
    return originalJson(body);
  };
  next();
}

function sanitizeBody(body) {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.token;
  return sanitized;
}

function getLogs(days = 7) {
  const logs = [];
  const files = fs.readdirSync(logDir).filter(f => f.startsWith('audit-'));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  for (const file of files) {
    const filePath = path.join(logDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').filter(Boolean).forEach(line => {
      try {
        const entry = JSON.parse(line);
        if (new Date(entry.timestamp) >= cutoff) {
          logs.push(entry);
        }
      } catch (e) { }
    });
  }
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = { auditLog, getLogs };