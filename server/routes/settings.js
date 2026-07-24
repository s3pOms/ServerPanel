const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

let cachedSettings = null;

function loadSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    cachedSettings = JSON.parse(raw);
  } catch {
    cachedSettings = { theme: 'light', color: 'sky', bindHost: '0.0.0.0', port: 8888, blockPublic: false, sidebarGlass: false, sidebarBlur: 10, bgImage: '', bgBlur: 20, cardBlur: 12, cardOpacity: 75, panelName: 'ServerPanel', panelIcon: 'fa-server' };
  }
  return cachedSettings;
}

function saveSettings(s) {
  cachedSettings = s;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s), 'utf-8');
}

router.get('/', (req, res) => {
  const s = loadSettings();
  res.json({ success: true, settings: s });
});

router.put('/', requireAuth, (req, res) => {
  const { theme, color, bindHost, port, blockPublic, sidebarGlass, sidebarBlur, bgImage, bgBlur, cardBlur, cardOpacity } = req.body;
  const s = loadSettings();
  if (theme === 'light' || theme === 'dark') s.theme = theme;
  if (color && /^[a-z]+$/.test(color)) s.color = color;
  if (bindHost !== undefined) s.bindHost = bindHost;
  if (port !== undefined && port > 0 && port < 65536) s.port = port;
  if (blockPublic !== undefined) s.blockPublic = !!blockPublic;
  if (sidebarGlass !== undefined) s.sidebarGlass = !!sidebarGlass;
  if (sidebarBlur !== undefined && sidebarBlur >= 0 && sidebarBlur <= 50) s.sidebarBlur = sidebarBlur;
  if (bgImage !== undefined) s.bgImage = bgImage;
  if (bgBlur !== undefined && bgBlur >= 0 && bgBlur <= 50) s.bgBlur = bgBlur;
  if (cardBlur !== undefined && cardBlur >= 0 && cardBlur <= 30) s.cardBlur = cardBlur;
  if (cardOpacity !== undefined && cardOpacity >= 10 && cardOpacity <= 100) s.cardOpacity = cardOpacity;
  if (panelName !== undefined) s.panelName = panelName;
  if (panelIcon !== undefined) s.panelIcon = panelIcon;
  saveSettings(s);
  res.json({ success: true, settings: s, restartRequired: true });
});

module.exports = { router, loadSettings };