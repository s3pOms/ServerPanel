const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const unzipper = require('unzipper');
const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '..', '..', 'uploads') });

router.get('/list', (req, res) => {
  let dirPath = req.query.path || '/';
  if (process.platform === 'win32' && dirPath === '/') {
    return listDrives(res);
  }
  try {
    dirPath = decodeURIComponent(dirPath);
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = items.map(item => {
      const fullPath = path.join(dirPath, item.name);
      let stats;
      try { stats = fs.statSync(fullPath); } catch (e) { return null; }
      if (!stats) return null;
      return {
        name: item.name,
        path: fullPath,
        isDirectory: item.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        permissions: getPermissions(fullPath)
      };
    }).filter(Boolean);
    const sorted = result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ items: sorted, currentPath: dirPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function listDrives(res) {
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    try {
      const stats = fs.statSync(letter + ':\\');
      drives.push({ name: letter + ':\\', path: letter + ':\\', isDirectory: true, isDrive: true, size: 0, modified: stats.mtime, free: 0 });
    } catch (e) { }
  }
  res.json({ items: drives, currentPath: '/' });
}

function getPermissions(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const mode = stats.mode;
    if (process.platform === 'win32') {
      let perms = '';
      try { fs.accessSync(filePath, fs.constants.R_OK); perms += 'r'; } catch (e) { perms += '-'; }
      try { fs.accessSync(filePath, fs.constants.W_OK); perms += 'w'; } catch (e) { perms += '-'; }
      return perms;
    }
    return (mode & 0o777).toString(8);
  } catch (e) { return '---'; }
}

router.get('/search', (req, res) => {
  const { q, dir } = req.query;
  if (!q) return res.json({ items: [] });
  const searchDir = dir || (process.platform === 'win32' ? 'C:\\' : '/');
  const results = [];
  try {
    function searchRecursive(directory, depth = 0) {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);
          if (entry.name.toLowerCase().includes(q.toLowerCase())) {
            try {
              const stats = fs.statSync(fullPath);
              results.push({ name: entry.name, path: fullPath, isDirectory: entry.isDirectory(), size: stats.size });
            } catch (e) { }
          }
          if (entry.isDirectory()) searchRecursive(fullPath, depth + 1);
        }
      } catch (e) { }
    }
    searchRecursive(searchDir);
    res.json({ items: results.slice(0, 200) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload', upload.array('files'), (req, res) => {
  const targetDir = req.body.path || (process.platform === 'win32' ? 'C:\\' : '/');
  const uploaded = [];
  for (const file of req.files) {
    const targetPath = path.join(targetDir, file.originalname);
    try {
      fs.renameSync(file.path, targetPath);
      uploaded.push({ name: file.originalname, path: targetPath });
    } catch (e) {
      fs.copyFileSync(file.path, targetPath);
      fs.unlinkSync(file.path);
      uploaded.push({ name: file.originalname, path: targetPath });
    }
  }
  res.json({ success: true, files: uploaded });
});

router.get('/download', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: '路径不能为空' });
  try {
    if (fs.statSync(filePath).isDirectory()) {
      const archive = archiver('zip', { zlib: { level: 5 } });
      res.attachment(path.basename(filePath) + '.zip');
      archive.directory(filePath, false);
      archive.pipe(res);
      archive.finalize();
    } else {
      res.download(filePath);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/download-multiple', (req, res) => {
  const { paths } = req.body;
  if (!paths || !paths.length) return res.status(400).json({ error: '请选择文件' });
  const archive = archiver('zip', { zlib: { level: 5 } });
  res.attachment('download.zip');
  archive.pipe(res);
  for (const filePath of paths) {
    try {
      const s = fs.statSync(filePath);
      if (s.isDirectory()) archive.directory(filePath, path.basename(filePath));
      else archive.file(filePath, { name: path.basename(filePath) });
    } catch (e) { }
  }
  archive.finalize();
});

router.post('/delete', (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: '路径不能为空' });
  try {
    if (fs.statSync(filePath).isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
    else fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rename', (req, res) => {
  const { path: oldPath, newName } = req.body;
  if (!oldPath || !newName) return res.status(400).json({ error: '参数不能为空' });
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    fs.renameSync(oldPath, newPath);
    res.json({ success: true, newPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/mkdir', (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: '路径不能为空' });
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/mkfile', (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: '路径不能为空' });
  try {
    fs.writeFileSync(filePath, '', 'utf-8');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/copy', (req, res) => {
  const { source, dest } = req.body;
  if (!source || !dest) return res.status(400).json({ error: '参数不能为空' });
  try {
    if (fs.statSync(source).isDirectory()) fs.cpSync(source, dest, { recursive: true });
    else fs.copyFileSync(source, dest);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/move', (req, res) => {
  const { source, dest } = req.body;
  if (!source || !dest) return res.status(400).json({ error: '参数不能为空' });
  try {
    fs.renameSync(source, dest);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/duplicate', (req, res) => {
  const { path: srcPath } = req.body;
  if (!srcPath) return res.status(400).json({ error: '路径不能为空' });
  try {
    const dir = path.dirname(srcPath);
    const base = path.basename(srcPath);
    const ext = path.extname(base);
    const name = path.basename(base, ext);
    let newPath = path.join(dir, name + ' - 副本' + ext);
    let counter = 2;
    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, name + ' - 副本(' + counter + ')' + ext);
      counter++;
    }
    if (fs.statSync(srcPath).isDirectory()) fs.cpSync(srcPath, newPath, { recursive: true });
    else fs.copyFileSync(srcPath, newPath);
    res.json({ success: true, newPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/compress', (req, res) => {
  const { paths: filePaths, dest, name } = req.body;
  if (!filePaths || !filePaths.length || !dest || !name) return res.status(400).json({ error: '参数不能为空' });
  const outputPath = path.join(dest, name);
  try {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(output);
    for (const p of filePaths) {
      try {
        const s = fs.statSync(p);
        if (s.isDirectory()) archive.directory(p, path.basename(p));
        else archive.file(p, { name: path.basename(p) });
      } catch (e) { }
    }
    output.on('close', () => res.json({ success: true, path: outputPath, size: archive.pointer() }));
    archive.on('error', (err) => { output.destroy(); res.status(500).json({ error: err.message }); });
    archive.finalize();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/extract', (req, res) => {
  const { path: zipPath, dest: extractDest } = req.body;
  if (!zipPath) return res.status(400).json({ error: '路径不能为空' });
  const extractDir = extractDest || path.dirname(zipPath);
  try {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .on('close', () => res.json({ success: true }))
      .on('error', (err) => res.status(500).json({ error: err.message }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/chmod', (req, res) => {
  const { path: filePath, mode } = req.body;
  if (!filePath || !mode) return res.status(400).json({ error: '参数不能为空' });
  try {
    const modeNum = parseInt(mode, 8);
    if (isNaN(modeNum)) return res.status(400).json({ error: '无效的权限值' });
    fs.chmodSync(filePath, modeNum);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/preview', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: '路径不能为空' });
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
      '.webp': 'image/webp', '.ico': 'image/x-icon',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
      '.ogg': 'audio/ogg', '.aac': 'audio/aac',
    };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', chunkSize);
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/info', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: '路径不能为空' });
  try {
    const stats = fs.statSync(filePath);
    res.json({ name: path.basename(filePath), path: filePath, isDirectory: stats.isDirectory(), size: stats.size, modified: stats.mtime, created: stats.birthtime, permissions: getPermissions(filePath) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/read', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: '路径不能为空' });
  try {
    const ext = path.extname(filePath).toLowerCase();
    const textExts = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.yaml', '.yml', '.ini', '.cfg', '.conf', '.log', '.env', '.gitignore', '.npmrc', '.dockerfile', '.sh', '.bat', '.ps1', '.sql', '.rb', '.go', '.rs', '.php', '.pl', '.lua', '.r', '.m', '.swift', '.kt', '.scala', '.groovy', '.tf', '.vue', '.svelte', '.jsx', '.tsx', '.sass', '.scss', '.less', '.styl', '.toml', '.lock', '.patch', '.diff', '.csv', '.tsv'];
    if (textExts.includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.json({ type: 'text', content, name: path.basename(filePath) });
    } else {
      const stats = fs.statSync(filePath);
      res.json({ type: 'binary', name: path.basename(filePath), size: stats.size });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/save', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: '参数不能为空' });
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
