const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb, isSetupComplete } = require('../services/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Check if setup is needed (first run)
router.get('/setup-status', (req, res) => {
  res.json({ setupComplete: isSetupComplete() });
});

// Initialize first user and db password
router.post('/setup', (req, res) => {
  if (isSetupComplete()) return res.status(400).json({ error: '已完成初始化' });
  const { username, password, dbPassword } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (password.length < 4) return res.status(400).json({ error: '密码长度至少4位' });
  const db2 = getDb();
  const hashed = bcrypt.hashSync(password, 10);
  db2.prepare('INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(username, hashed, 'admin');
  // Store db password hash for verification (optional)
  if (dbPassword) {
    const dbKeyHash = bcrypt.hashSync(dbPassword, 10);
    db2.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('db_password_hash', dbKeyHash);
  }
  res.json({ success: true, message: '初始化完成' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  const db2 = getDb();
  const user = db2.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: '用户名或密码错误' });
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.user) res.json({ user: req.session.user });
  else res.status(401).json({ error: '未登录' });
});

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const db2 = getDb();
  const users = db2.prepare('SELECT id, username, role, created_at FROM users').all();
  res.json(users);
});

router.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  const db2 = getDb();
  const existing = db2.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已存在' });
  const hashed = bcrypt.hashSync(password, 10);
  const result = db2.prepare('INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(username, hashed, role || 'user');
  res.json({ success: true, user: { id: result.lastInsertRowid, username, role: role || 'user' } });
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const db2 = getDb();
  db2.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/users/:id/password', requireAuth, requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '密码不能为空' });
  const hashed = bcrypt.hashSync(password, 10);
  const db2 = getDb();
  db2.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.params.id);
  res.json({ success: true });
});

module.exports = router;