const express = require('express');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const path = require('path');
const router = express.Router();

const isWin = process.platform === 'win32';
const nginxPath = isWin ? 'C:\\nginx\\nginx.exe' : '/usr/sbin/nginx';
const configPath = isWin ? 'C:\\nginx\\conf\\nginx.conf' : '/etc/nginx/nginx.conf';
const sitesEnabled = isWin ? path.join(path.dirname(configPath), 'sites-enabled') : '/etc/nginx/sites-enabled';
const sitesAvailable = isWin ? path.join(path.dirname(configPath), 'sites-available') : '/etc/nginx/sites-available';
const panelConfigs = path.join(__dirname, '..', '..', 'nginx-sites');

[panelConfigs, sitesAvailable, sitesEnabled].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
  }
});

function runNginxCmd(args) {
  return new Promise((resolve, reject) => {
    const cmd = isWin ? `"${nginxPath}" ${args}` : `sudo ${nginxPath} ${args}`;
    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error && !stdout.includes('test failed')) {
        reject((stderr || error.message).trim());
      } else {
        resolve((stdout || stderr || 'OK').trim());
      }
    });
  });
}

router.get('/status', async (req, res) => {
  try {
    let running = false;
    try {
      if (isWin) {
        const result = execSync('tasklist /FI "IMAGENAME eq nginx.exe"', { timeout: 5000 }).toString();
        running = result.includes('nginx.exe');
      } else {
        const result = execSync('pgrep nginx', { timeout: 5000 }).toString();
        running = result.trim().length > 0;
      }
    } catch (e) { running = false; }
    res.json({ running });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', async (req, res) => {
  try {
    const result = await runNginxCmd('');
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', async (req, res) => {
  try {
    const result = await runNginxCmd('-s stop');
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reload', async (req, res) => {
  try {
    const result = await runNginxCmd('-s reload');
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const result = await runNginxCmd('-t');
    res.json({ success: true, message: result });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/config', (req, res) => {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      res.json({ content, path: configPath });
    } else {
      res.status(404).json({ error: '配置文件不存在' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config', (req, res) => {
  const { content } = req.body;
  if (content === undefined) return res.status(400).json({ error: '内容不能为空' });
  try {
    fs.writeFileSync(configPath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sites', (req, res) => {
  const sites = [];
  const dirs = [panelConfigs, sitesAvailable].filter(d => fs.existsSync(d));
  const seen = new Set();
  for (const dir of dirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (seen.has(file)) continue;
        seen.add(file);
        const filePath = path.join(dir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          let enabled = false;
          try { enabled = fs.existsSync(path.join(sitesEnabled, file)); } catch (e) { }
          const type = content.includes('PANEL_GENERATED') ? 'simple' : 'advanced';
          let info = { name: file, enabled, content, path: filePath, type };
          if (type === 'simple') {
            const lines = content.split('\n');
            info.domain = '';
            info.root = '';
            info.proxyPass = '';
            info.ssl = false;
            for (const line of lines) {
              if (line.startsWith('# DOMAIN:')) info.domain = line.replace('# DOMAIN:', '').trim();
              if (line.startsWith('# ROOT:')) info.root = line.replace('# ROOT:', '').trim();
              if (line.startsWith('# PROXY:')) info.proxyPass = line.replace('# PROXY:', '').trim();
              if (line.startsWith('# SSL:')) info.ssl = line.replace('# SSL:', '').trim() === 'true';
            }
          }
          sites.push(info);
        } catch (e) { }
      }
    } catch (e) { }
  }
  res.json({ sites });
});

router.post('/sites/generate', (req, res) => {
  const { name, domain, root, proxyPass, ssl, sslCert, sslKey } = req.body;
  if (!name) return res.status(400).json({ error: '站点名称不能为空' });
  if (!domain) return res.status(400).json({ error: '域名不能为空' });
  if (!root && !proxyPass) return res.status(400).json({ error: '请填写网站目录或反向代理地址' });

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const serverName = domain.replace(/https?:\/\//, '').split('/')[0];

  let config = `# PANEL_GENERATED - 由面板自动生成\n`;
  config += `# DOMAIN: ${serverName}\n`;
  if (root) config += `# ROOT: ${root}\n`;
  if (proxyPass) config += `# PROXY: ${proxyPass}\n`;
  config += `# SSL: ${!!ssl}\n\n`;

  const listen80 = ssl ? `\n    listen 80;\n    return 301 https://$host$request_uri;` : '';

  config += `server {${listen80}\n`;
  config += `    listen ${ssl ? '443 ssl' : '80'};\n`;
  config += `    server_name ${serverName};\n\n`;

  if (ssl) {
    config += `    ssl_certificate ${sslCert || `/etc/letsencrypt/live/${serverName}/fullchain.pem`};\n`;
    config += `    ssl_certificate_key ${sslKey || `/etc/letsencrypt/live/${serverName}/privkey.pem`};\n`;
    config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
    config += `    ssl_ciphers HIGH:!aNULL:!MD5;\n\n`;
  }

  if (proxyPass) {
    config += `    location / {\n`;
    config += `        proxy_pass ${proxyPass};\n`;
    config += `        proxy_set_header Host \$host;\n`;
    config += `        proxy_set_header X-Real-IP \$remote_addr;\n`;
    config += `        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n`;
    config += `        proxy_set_header X-Forwarded-Proto \$scheme;\n`;
    config += `        proxy_read_timeout 300;\n`;
    config += `        proxy_connect_timeout 300;\n`;
    config += `    }\n`;
  } else if (root) {
    config += `    root ${root};\n`;
    config += `    index index.html index.htm index.php;\n\n`;
    config += `    location / {\n`;
    config += `        try_files \$uri \$uri/ /index.html;\n`;
    config += `    }\n\n`;
    config += `    location ~ \.php$ {\n`;
    config += `        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;\n`;
    config += `        fastcgi_index index.php;\n`;
    config += `        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;\n`;
    config += `        include fastcgi_params;\n`;
    config += `    }\n`;
  }

  config += `\n    access_log /var/log/nginx/${safeName}_access.log;\n`;
  config += `    error_log /var/log/nginx/${safeName}_error.log;\n`;
  config += `}\n`;

  const filePath = path.join(panelConfigs, safeName);
  fs.writeFileSync(filePath, config, 'utf-8');

  if (fs.existsSync(sitesAvailable)) {
    const linkPath = path.join(sitesAvailable, safeName);
    if (!fs.existsSync(linkPath)) {
      try { fs.symlinkSync(filePath, linkPath); } catch (e) {
        try { fs.copyFileSync(filePath, linkPath); } catch (e2) { }
      }
    }
  }
  if (fs.existsSync(sitesEnabled)) {
    const linkPath = path.join(sitesEnabled, safeName);
    if (!fs.existsSync(linkPath)) {
      try { fs.symlinkSync(filePath, linkPath); } catch (e) {
        try { fs.copyFileSync(filePath, linkPath); } catch (e2) { }
      }
    }
  }

  res.json({ success: true, name: safeName, filePath });
});

router.post('/sites/:name/toggle', (req, res) => {
  const { name } = req.params;
  const sourceDirs = [panelConfigs, sitesAvailable].filter(d => fs.existsSync(d));
  let sourcePath = null;
  for (const dir of sourceDirs) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) { sourcePath = p; break; }
  }
  if (!sourcePath) return res.status(404).json({ error: '站点不存在' });

  const enabledPath = path.join(sitesEnabled, name);
  try {
    if (fs.existsSync(enabledPath)) {
      fs.unlinkSync(enabledPath);
      res.json({ enabled: false });
    } else {
      try { fs.symlinkSync(sourcePath, enabledPath); } catch (e) {
        fs.copyFileSync(sourcePath, enabledPath);
      }
      res.json({ enabled: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sites/:name', (req, res) => {
  const { name } = req.params;
  const dirs = [panelConfigs, sitesAvailable, sitesEnabled];
  for (const dir of dirs) {
    const p = path.join(dir, name);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { }
  }
  res.json({ success: true });
});

module.exports = router;