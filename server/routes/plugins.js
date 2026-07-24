const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const AdmZip = require('adm-zip');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

function loadPluginManifest(name) {
  const pdir = path.join(PLUGINS_DIR, name);
  const mfile = path.join(pdir, 'plugin.json');
  if (!fs.existsSync(mfile)) return null;
  try {
    return JSON.parse(fs.readFileSync(mfile, 'utf-8'));
  } catch { return null; }
}

function listPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  return fs.readdirSync(PLUGINS_DIR).filter(d => {
    if (d.startsWith('.')) return false;
    const pdir = path.join(PLUGINS_DIR, d);
    return fs.statSync(pdir).isDirectory() && fs.existsSync(path.join(pdir, 'plugin.json'));
  });
}

// List all plugins
router.get('/', (req, res) => {
  const names = listPlugins();
  const plugins = names.map(name => {
    const manifest = loadPluginManifest(name);
    const pdir = path.join(PLUGINS_DIR, name);
    const configFile = path.join(pdir, 'config.json');
    const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf-8')) : {};
    const hasPython = fs.existsSync(path.join(pdir, 'server.py')) || fs.existsSync(path.join(pdir, 'main.py'));
    return {
      name,
      manifest: manifest || { title: name, version: '0.0.0', description: '', icon: 'fa-puzzle-piece' },
      config,
      hasPython,
      hasFrontend: fs.existsSync(path.join(pdir, 'index.html'))
    };
  });
  res.json({ success: true, plugins });
});

// Get single plugin detail
router.get('/:name', (req, res) => {
  const { name } = req.params;
  const pdir = path.join(PLUGINS_DIR, name);
  if (!fs.existsSync(pdir)) return res.status(404).json({ success: false, error: '插件不存在' });
  const manifest = loadPluginManifest(name);
  const configFile = path.join(pdir, 'config.json');
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf-8')) : {};
  const hasPython = fs.existsSync(path.join(pdir, 'server.py')) || fs.existsSync(path.join(pdir, 'main.py'));
  const files = [];
  try {
    fs.readdirSync(pdir).forEach(f => {
      const fpath = path.join(pdir, f);
      if (f !== 'config.json') files.push({ name: f, size: fs.statSync(fpath).size });
    });
  } catch {}
  res.json({ success: true, plugin: { name, manifest, config, hasPython, hasFrontend: fs.existsSync(path.join(pdir, 'index.html')), files } });
});

// Install plugin from zip upload
router.post('/install', (req, res) => {
  if (!req.body || !req.body.zip) return res.status(400).json({ success: false, error: '缺少压缩包数据' });
  try {
    const zip = new AdmZip(Buffer.from(req.body.zip, 'base64'));
    const entries = zip.getEntries();
    const rootDirs = new Set();
    entries.forEach(e => {
      const top = e.entryName.split('/')[0];
      if (top) rootDirs.add(top);
    });
    let pluginName = null;
    for (const dir of rootDirs) {
      const testManifest = zip.getEntry(dir + '/plugin.json');
      if (testManifest) { pluginName = dir; break; }
    }
    if (!pluginName) return res.status(400).json({ success: false, error: '压缩包中未找到 plugin.json' });
    const targetDir = path.join(PLUGINS_DIR, pluginName);
    if (fs.existsSync(targetDir)) return res.status(409).json({ success: false, error: '插件 ' + pluginName + ' 已存在' });
    zip.extractAllTo(PLUGINS_DIR, true);
    const manifest = loadPluginManifest(pluginName);
    if (!manifest) return res.status(400).json({ success: false, error: '插件清单无效' });
    res.json({ success: true, plugin: { name: pluginName, manifest }, message: '插件 ' + (manifest.title || pluginName) + ' 安装成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: '安装失败: ' + e.message });
  }
});

// Uninstall plugin
router.delete('/:name', (req, res) => {
  const { name } = req.params;
  const pdir = path.join(PLUGINS_DIR, name);
  if (!fs.existsSync(pdir)) return res.status(404).json({ success: false, error: '插件不存在' });
  try {
    fs.rmSync(pdir, { recursive: true, force: true });
    res.json({ success: true, message: '插件 ' + name + ' 已卸载' });
  } catch (e) {
    res.status(500).json({ success: false, error: '卸载失败: ' + e.message });
  }
});

// Get plugin config
router.get('/:name/config', (req, res) => {
  const { name } = req.params;
  const pdir = path.join(PLUGINS_DIR, name);
  const configFile = path.join(pdir, 'config.json');
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf-8')) : {};
  res.json({ success: true, config });
});

// Save plugin config
router.put('/:name/config', (req, res) => {
  const { name } = req.params;
  const pdir = path.join(PLUGINS_DIR, name);
  if (!fs.existsSync(pdir)) return res.status(404).json({ success: false, error: '插件不存在' });
  const configFile = path.join(pdir, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(req.body.config || {}, null, 2), 'utf-8');
  res.json({ success: true, message: '配置已保存' });
});

// Execute plugin Python script
function findPython() {
  const candidates = ['python3', 'python'];
  for (const cmd of candidates) {
    try { require('child_process').execSync(cmd + ' --version', { stdio: 'ignore' }); return cmd; }
    catch { continue; }
  }
  return null;
}

const _pythonCmd = findPython();

router.post('/:name/execute', (req, res) => {
  const { name } = req.params;
  if (!_pythonCmd) return res.status(500).json({ success: false, error: '系统未安装 Python' });
  const pdir = path.join(PLUGINS_DIR, name);
  const pythonFile = fs.existsSync(path.join(pdir, 'server.py')) ? 'server.py' : 'main.py';
  const scriptPath = path.join(pdir, pythonFile);
  if (!fs.existsSync(scriptPath)) return res.status(404).json({ success: false, error: '插件没有 Python 后端脚本' });
  const input = JSON.stringify(req.body.args || {});
  const child = spawn(_pythonCmd, [scriptPath], { cwd: pdir, env: { ...process.env, PLUGIN_DIR: pdir } });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => stdout += d.toString());
  child.stderr.on('data', d => stderr += d.toString());
  child.on('error', err => {
    clearTimeout(timer);
    res.status(500).json({ success: false, error: 'Python 执行失败: ' + err.message });
  });
  child.stdin.write(input);
  child.stdin.end();
  const timer = setTimeout(() => { child.kill(); res.status(504).json({ success: false, error: '脚本执行超时' }); }, 30000);
  child.on('close', code => {
    clearTimeout(timer);
    try {
      const result = stdout.trim() ? JSON.parse(stdout) : {};
      res.json({ success: code === 0, result, error: stderr || undefined });
    } catch {
      res.json({ success: code === 0, output: stdout.trim(), error: stderr || undefined });
    }
  });
});

module.exports = { router, listPlugins, loadPluginManifest };