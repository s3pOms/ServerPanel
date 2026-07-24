async function renderNginx(el) {
  el.innerHTML = `
    <div class="nginx-container stagger">
      <div class="card">
        <div class="card-header"><i class="fas fa-globe"></i> Nginx 状态</div>
        <div class="card-body">
          <div id="nginx-status-bar" class="nginx-status"><i class="fas fa-spinner fa-spin"></i> 检测中...</div>
          <div class="form-actions">
            <button class="btn btn-success" onclick="nginxAction('start')" id="nginx-start-btn"><i class="fas fa-play"></i> 启动</button>
            <button class="btn btn-danger" onclick="nginxAction('stop')" id="nginx-stop-btn" style="display:none"><i class="fas fa-stop"></i> 停止</button>
            <button class="btn btn-outline" onclick="nginxAction('reload')"><i class="fas fa-sync-alt"></i> 重载</button>
            <button class="btn btn-outline" onclick="nginxTest()"><i class="fas fa-check"></i> 测试</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-plus-circle"></i> 快速创建站点</div>
        <div class="card-body">
          <div class="nginx-form">
            <div class="form-row">
              <div class="form-group"><label>站点名称</label><input type="text" id="ns-name" class="form-control" placeholder="my-site"></div>
              <div class="form-group"><label>域名</label><input type="text" id="ns-domain" class="form-control" placeholder="example.com"></div>
            </div>
            <div class="form-group"><label>网站目录 (静态站点)</label>
              <input type="text" id="ns-root" class="form-control" placeholder="/var/www/example.com">
            </div>
            <div class="form-divider"><span>或</span></div>
            <div class="form-group"><label>反向代理地址</label>
              <input type="text" id="ns-proxy" class="form-control" placeholder="http://127.0.0.1:3000">
            </div>
            <div class="form-row">
              <div class="form-group sm">
                <label>启用SSL</label>
                <label class="toggle"><input type="checkbox" id="ns-ssl" onchange="nginxToggleSslFields()"><span class="toggle-slider"></span></label>
              </div>
              <div class="form-group" id="ns-ssl-cert-group" style="display:none"><label>SSL证书路径</label><input type="text" id="ns-ssl-cert" class="form-control" placeholder="证书路径"></div>
              <div class="form-group" id="ns-ssl-key-group" style="display:none"><label>SSL私钥路径</label><input type="text" id="ns-ssl-key" class="form-control" placeholder="私钥路径"></div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" onclick="nginxGenerateSite()"><i class="fas fa-magic"></i> 生成配置</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-sitemap"></i> 站点列表</div>
        <div class="card-body">
          <div id="nginx-sites-area">
            <div class="page-loading"><i class="fas fa-spinner fa-spin"></i> 加载站点...</div>
          </div>
        </div>
      </div>
    </div>`;
  animateStagger(el.querySelector('.stagger'));
  await Promise.all([nginxLoadStatus(), nginxLoadSites()]);
}

function nginxToggleSslFields() {
  const checked = document.getElementById('ns-ssl').checked;
  document.getElementById('ns-ssl-cert-group').style.display = checked ? 'block' : 'none';
  document.getElementById('ns-ssl-key-group').style.display = checked ? 'block' : 'none';
}

async function nginxLoadStatus() {
  const data = await apiRequest('GET', '/nginx/status');
  if (!data) return;
  const el = document.getElementById('nginx-status-bar');
  if (data.running) {
    el.innerHTML = '<span class="status-dot green"></span> Nginx 运行中';
    document.getElementById('nginx-start-btn').style.display = 'none';
    document.getElementById('nginx-stop-btn').style.display = 'inline-flex';
  } else {
    el.innerHTML = '<span class="status-dot red"></span> Nginx 未运行';
    document.getElementById('nginx-start-btn').style.display = 'inline-flex';
    document.getElementById('nginx-stop-btn').style.display = 'none';
  }
}

async function nginxLoadSites() {
  const data = await apiRequest('GET', '/nginx/sites');
  const el = document.getElementById('nginx-sites-area');
  if (!data || !data.sites || data.sites.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-globe" style="font-size:40px;color:var(--md-outline);display:block;margin-bottom:12px"></i>还没有站点，在上方快速创建</div>';
    return;
  }
  el.innerHTML = `<div class="sites-grid stagger">
    ${data.sites.map(s => {
      const badge = s.enabled ? 'badge-success' : '';
      const statusText = s.enabled ? '已启用' : '已禁用';
      const typeIcon = s.type === 'simple' ? 'fa-magic' : 'fa-code';
      const typeLabel = s.type === 'simple' ? '快速' : '自定义';
      let infoHtml = '';
      if (s.domain) infoHtml += `<div class="site-info-item"><i class="fas fa-globe"></i> ${escapeHtml(s.domain)}</div>`;
      if (s.root) infoHtml += `<div class="site-info-item"><i class="fas fa-folder"></i> ${escapeHtml(s.root)}</div>`;
      if (s.proxyPass) infoHtml += `<div class="site-info-item"><i class="fas fa-exchange-alt"></i> ${escapeHtml(s.proxyPass)}</div>`;
      if (s.ssl) infoHtml += `<div class="site-info-item"><i class="fas fa-lock" style="color:var(--md-success)"></i> SSL已启用</div>`;
      return `<div class="site-card">
        <div class="site-header">
          <div class="site-name"><i class="fas ${typeIcon}" style="color:var(--md-primary)"></i> ${escapeHtml(s.name)} <span class="badge ${badge}">${statusText}</span> <span class="badge" style="font-size:10px">${typeLabel}</span></div>
        </div>
        ${infoHtml ? `<div class="site-info">${infoHtml}</div>` : ''}
        <div class="site-actions">
          <button class="btn btn-sm ${s.enabled ? 'btn-warning' : 'btn-success'}" onclick="nginxToggleSite('${escapeHtml(s.name)}')">
            <i class="fas ${s.enabled ? 'fa-pause' : 'fa-play'}"></i> ${s.enabled ? '禁用' : '启用'}
          </button>
          <button class="btn btn-sm btn-outline" onclick="nginxViewSiteConfig('${escapeHtml(s.name)}')"><i class="fas fa-file-code"></i></button>
          <button class="btn btn-sm btn-danger" onclick="nginxDeleteSite('${escapeHtml(s.name)}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
  const grid = el.querySelector('.stagger');
  if (grid) animateStagger(grid);
}

async function nginxGenerateSite() {
  const name = document.getElementById('ns-name').value.trim();
  const domain = document.getElementById('ns-domain').value.trim();
  const root = document.getElementById('ns-root').value.trim();
  const proxyPass = document.getElementById('ns-proxy').value.trim();
  const ssl = document.getElementById('ns-ssl').checked;
  const sslCert = document.getElementById('ns-ssl-cert').value.trim();
  const sslKey = document.getElementById('ns-ssl-key').value.trim();

  if (!name) { showToast('请输入站点名称', 'error'); return; }
  if (!domain) { showToast('请输入域名', 'error'); return; }
  if (!root && !proxyPass) { showToast('请填写网站目录或反向代理地址', 'error'); return; }

  showLoading(true);
  const result = await apiRequest('POST', '/nginx/sites/generate', { name, domain, root, proxyPass, ssl, sslCert, sslKey });
  showLoading(false);
  if (result && result.success) {
    showToast('站点配置生成成功');
    nginxLoadSites();
    document.getElementById('ns-name').value = '';
    document.getElementById('ns-domain').value = '';
    document.getElementById('ns-root').value = '';
    document.getElementById('ns-proxy').value = '';
    document.getElementById('ns-ssl').checked = false;
    nginxToggleSslFields();
  } else {
    showToast(result?.error || '生成失败', 'error');
  }
}

async function nginxAction(action) {
  showLoading(true);
  const result = await apiRequest('POST', `/nginx/${action}`);
  showLoading(false);
  if (result && result.success) { showToast(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重载'}成功`); await nginxLoadStatus(); }
  else showToast(result?.error || `${action}失败`, 'error');
}

async function nginxTest() {
  const result = await apiRequest('POST', '/nginx/test');
  if (result) {
    showToast(result.success ? '配置测试通过' : '配置测试失败: ' + (result.message || ''), result.success ? 'success' : 'error');
  }
}

async function nginxToggleSite(name) {
  showLoading(true);
  const result = await apiRequest('POST', `/nginx/sites/${encodeURIComponent(name)}/toggle`);
  showLoading(false);
  if (result) { nginxLoadSites(); showToast('切换成功'); }
}

async function nginxViewSiteConfig(name) {
  const data = await apiRequest('GET', '/nginx/sites');
  const site = data?.sites?.find(s => s.name === name);
  if (!site) { showToast('未找到站点配置', 'error'); return; }
  createModal(`配置: ${escapeHtml(name)}`,
    `<textarea class="file-editor" style="height:400px" readonly spellcheck="false">${escapeHtml(site.content)}</textarea>`,
    `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`
  );
}

async function nginxDeleteSite(name) {
  showConfirm('确定删除站点 ' + name + '？', async () => {
    showLoading(true);
    const result = await apiRequest('DELETE', `/nginx/sites/${encodeURIComponent(name)}`);
    showLoading(false);
    if (result && result.success) { nginxLoadSites(); showToast('删除成功'); }
  });
}
