let _pluginPageData = null;
let _pluginPageView = 'grid'; // 'grid' or 'plugin'

async function renderPluginPage(el) {
  _pluginPageView = 'grid';
  el.innerHTML = `
    <div class="plugin-page-container">
      <div id="plugin-page-toolbar" class="plugin-toolbar">
        <div class="plugin-toolbar-left">
          <button id="plugin-page-back" class="btn btn-sm btn-ghost" style="display:none" onclick="pluginPageBack()"><i class="fas fa-arrow-left"></i> 返回</button>
          <h3 id="plugin-page-title" style="margin:0;font-weight:500;display:inline-flex;align-items:center;gap:8px"><i class="fas fa-puzzle-piece"></i> 已安装模块</h3>
        </div>
        <div class="plugin-toolbar-right">
          <button class="btn btn-sm btn-outline" onclick="pluginPageRefresh()"><i class="fas fa-sync-alt"></i> 刷新</button>
        </div>
      </div>
      <div id="plugin-page-content" class="plugin-page-content">
        <div class="page-loading"><i class="fas fa-spinner fa-spin"></i> 加载模块中...</div>
      </div>
    </div>`;
  await pluginPageLoad();
}

async function pluginPageLoad() {
  const data = await apiRequest('GET', '/plugins');
  if (!data) return;
  _pluginPageData = data.plugins || [];
  renderPluginGrid();
}

function renderPluginGrid() {
  _pluginPageView = 'grid';
  const back = document.getElementById('plugin-page-back');
  const title = document.getElementById('plugin-page-title');
  if (back) back.style.display = 'none';
  if (title) title.innerHTML = '<i class="fas fa-puzzle-piece"></i> 已安装模块';

  const content = document.getElementById('plugin-page-content');
  if (!_pluginPageData || _pluginPageData.length === 0) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-puzzle-piece" style="font-size:48px;color:var(--md-outline);display:block;margin-bottom:12px"></i>暂无已安装模块<br><span style="font-size:13px;color:var(--md-on-surface-variant)">前往 "管理模块" 安装模块或手动放置到 server/plugins/</span></div>`;
    return;
  }
  content.innerHTML = `<div class="stagger plugin-grid-inner">${_pluginPageData.map(p => {
    const m = p.manifest || {};
    const icon = m.icon || 'fa-puzzle-piece';
    const hasUI = p.hasFrontend;
    const hasPy = p.hasPython;
    const cfgStr = p.config && Object.keys(p.config).length ? `<span class="badge badge-info">已配置</span>` : '';
    return `<div class="plugin-card card" onclick="${hasUI ? `openPluginPage('${p.name}')` : ''}" style="${hasUI ? 'cursor:pointer' : ''}">
      <div class="plugin-card-icon"><i class="fas ${icon}" style="font-size:32px;color:var(--md-primary)"></i></div>
      <div class="plugin-card-body">
        <div class="plugin-card-title">${escapeHtml(m.title || p.name)}</div>
        <div class="plugin-card-desc">${escapeHtml(m.description || '暂无描述')}</div>
        <div class="plugin-card-meta">
          <span class="badge">v${escapeHtml(m.version || '0.0.0')}</span>
          ${hasUI ? '<span class="badge badge-success"><i class="fas fa-code"></i> 前端</span>' : ''}
          ${hasPy ? '<span class="badge badge-info"><i class="fab fa-python"></i> Python</span>' : ''}
          ${cfgStr}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
  const stagger = content.querySelector('.stagger');
  if (stagger) animateStagger(stagger);
}

function openPluginPage(name) {
  _pluginPageView = 'plugin';
  const back = document.getElementById('plugin-page-back');
  const title = document.getElementById('plugin-page-title');
  if (back) back.style.display = 'inline-flex';
  if (title) title.innerHTML = '<i class="fas fa-puzzle-piece"></i> ' + escapeHtml(name) + ' - 模块页面';

  const content = document.getElementById('plugin-page-content');
  content.innerHTML = `<div class="plugin-inline-container">
    <iframe class="plugin-inline-iframe" src="/plugins/${encodeURIComponent(name)}/index.html" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
  </div>`;
}

function pluginPageBack() {
  renderPluginGrid();
}

async function pluginPageRefresh() {
  const content = document.getElementById('plugin-page-content');
  if (content && _pluginPageView === 'grid') {
    content.innerHTML = '<div class="page-loading"><i class="fas fa-spinner fa-spin"></i> 刷新中...</div>';
    await pluginPageLoad();
    showToast('已刷新');
  }
}