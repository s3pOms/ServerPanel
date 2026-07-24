const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const { auditLog, getLogs } = require('./middleware/audit');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { ipFilter } = require('./middleware/ipfilter');
const { router: settingsRoutes, loadSettings } = require('./routes/settings');
const { router: pluginRoutes } = require('./routes/plugins');
const { getDb, isSetupComplete } = require('./services/database');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const systemRoutes = require('./routes/system');
const dockerRoutes = require('./routes/docker');
const nginxRoutes = require('./routes/nginx');
const { router: terminalRoutes, setupTerminalWebSocket } = require('./routes/terminal');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/api/terminal/ws' });

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
// Use db password hash for session secret if available, fall back to random key
let sessionSecret = 'server-panel-secret-key-2024';
try {
  const db = getDb();
  const pwRow = db.prepare("SELECT value FROM settings WHERE key = 'db_password_hash'").get();
  if (pwRow) sessionSecret = pwRow.value;
} catch {}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api', ipFilter(loadSettings));

app.use('/api/settings', settingsRoutes);  // GET public (theme), PUT needs auth via route itself
app.use('/api/auth', auditLog, authRoutes);
app.use('/api/files', requireAuth, auditLog, fileRoutes);
app.use('/api/system', requireAuth, systemRoutes);
app.use('/api/docker', requireAuth, auditLog, dockerRoutes);
app.use('/api/nginx', requireAuth, auditLog, nginxRoutes);
app.use('/api/terminal', requireAuth, auditLog, terminalRoutes);
app.use('/api/plugins', requireAuth, auditLog, pluginRoutes);

// Serve plugin static files
const pluginsDir = path.join(__dirname, 'plugins');
app.use('/plugins', (req, res, next) => {
  const parts = req.path.split('/');
  const pluginName = parts[1];
  if (!pluginName) return next();
  const pluginDir = path.join(pluginsDir, pluginName);
  if (!fs.existsSync(pluginDir)) return res.status(404).send('Plugin not found');
  const relPath = parts.slice(2).join('/') || 'index.html';
  const filePath = path.join(pluginDir, relPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

app.get('/api/logs', requireAuth, requireAdmin, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  res.json({ logs: getLogs(days) });
});

app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0', name: 'ServerPanel', build: '2024' });
});

setupTerminalWebSocket(wss);

// Setup guard: redirect all non-API, non-plugin requests to setup.html if not initialized
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/plugins') && req.path !== '/setup.html') {
    if (!isSetupComplete()) {
      return res.sendFile(path.join(__dirname, '..', 'public', 'setup.html'));
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

const settings = loadSettings();
const needSetup = !isSetupComplete();
server.listen(settings.port, settings.bindHost, () => {
  console.log(`========================================`);
  console.log(`  ServerPanel 服务管理面板`);
  console.log(`  http://${settings.bindHost}:${settings.port}`);
  if (needSetup) console.log(`  ⚠ 首次运行，请先完成初始化设置`);
  console.log(`========================================`);
});