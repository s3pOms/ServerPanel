async function renderLogs(el) {
  if (currentUser.role !== 'admin') {
    el.innerHTML = '<div class="error-page"><i class="fas fa-lock"></i><p>需要管理员权限</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <i class="fas fa-history"></i> 操作日志
        <div class="header-actions" style="margin-left:auto">
          <select id="log-days" class="form-control sm" onchange="logRefresh()">
            <option value="1">最近1天</option>
            <option value="3">最近3天</option>
            <option value="7" selected>最近7天</option>
            <option value="30">最近30天</option>
          </select>
          <button class="btn btn-icon btn-sm" onclick="logRefresh()" title="刷新"><i class="fas fa-sync-alt"></i></button>
        </div>
      </div>
      <div class="card-body">
        <div id="logs-content">
          <div class="page-loading"><i class="fas fa-spinner fa-spin"></i> 加载日志...</div>
        </div>
      </div>
    </div>`;
  await logRefresh();
}

async function logRefresh() {
  const days = document.getElementById('log-days')?.value || 7;
  const data = await apiRequest('GET', `/logs?days=${days}`);
  const el = document.getElementById('logs-content');
  if (!data || !data.logs || data.logs.length === 0) {
    el.innerHTML = '<div class="empty-state">没有操作日志</div>';
    return;
  }
  el.innerHTML = `<div class="logs-list stagger">
    ${data.logs.map(log => {
      const iconMap = { GET: 'search', POST: 'plus-circle', DELETE: 'trash', PUT: 'edit' };
      return `<div class="log-item">
        <div class="log-icon"><i class="fas fa-${iconMap[log.method] || 'info-circle'}"></i></div>
        <div class="log-info">
          <div class="log-action">
            <strong>${escapeHtml(log.user)}</strong>
            <span class="badge badge-${log.method}">${log.method}</span>
            <code>${escapeHtml(log.path)}</code>
          </div>
          <div class="log-meta">
            <span><i class="fas fa-clock"></i> ${formatDate(log.timestamp)}</span>
            <span><i class="fas fa-globe"></i> ${log.ip || '-'}</span>
            <span class="badge">${log.statusCode || '-'}</span>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
  const list = el.querySelector('.stagger');
  if (list) animateStagger(list);
}
