const API = '/api';
let currentUser = null;
let currentPage = '';
let wsConnections = {};
let pageTimers = {};

async function apiRequest(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };
  if (body && !(body instanceof FormData)) opts.body = JSON.stringify(body);
  if (body instanceof FormData) { delete opts.headers['Content-Type']; opts.body = body; }
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok && res.status === 401) {
    showLoginPage();
    return null;
  }
  return data;
}

async function initApp() {
  const me = await apiRequest('GET', '/auth/me');
  if (me && me.user) {
    currentUser = me.user;
    showMainApp();
    updateClock();
    setInterval(updateClock, 1000);
  } else {
    showLoginPage();
  }
  setupRipple();
}

function setupRipple() {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn, .nav-item, .nav-bottom-item, .context-item, .sheet-item, .chip, .tab-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x - size / 2 + 'px';
    ripple.style.top = y - size / 2 + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

function showLoginPage() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  if (typeof initSettingsTheme === 'function') initSettingsTheme();
}

function showMainApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  document.getElementById('sidebar-username').textContent = currentUser.username;
  if (typeof initSettingsTheme === 'function') initSettingsTheme();
  else applyPanelBranding(null);
  initSidebar();
  switchPage('dashboard');
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');
  if (!username || !password) { errorEl.textContent = '请输入用户名和密码'; return; }
  const result = await apiRequest('POST', '/auth/login', { username, password });
  if (result && result.success) {
    currentUser = result.user;
    showMainApp();
    updateClock();
    setInterval(updateClock, 1000);
  } else {
    errorEl.textContent = result?.error || '登录失败';
  }
}

async function handleLogout() {
  await apiRequest('POST', '/auth/logout');
  closeAllWs();
  clearAllTimers();
  showLoginPage();
}

function closeAllWs() {
  if (typeof terminalWS !== 'undefined' && terminalWS) { try { terminalWS.close(); } catch(e) {} terminalWS = null; }
  if (typeof termResizeObserver !== 'undefined' && termResizeObserver) { termResizeObserver.disconnect(); termResizeObserver = null; }
  Object.values(wsConnections).forEach(ws => { try { ws.close(); } catch(e) {} });
  wsConnections = {};
}

function clearAllTimers() {
  Object.values(pageTimers).forEach(t => clearTimeout(t));
  pageTimers = {};
}

function switchPage(page) {
  if (page === currentPage && document.getElementById('page-content').children.length > 0) return;
  closeAllWs();
  clearAllTimers();

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-bottom-item').forEach(el => el.classList.remove('active'));
  const sidebarItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  const bottomItem = document.querySelector(`.nav-bottom-item[data-page="${page}"]`);
  if (sidebarItem) sidebarItem.classList.add('active');
  if (bottomItem) bottomItem.classList.add('active');

  currentPage = page;
  const titles = {
    dashboard: '仪表盘', files: '文件管理', terminal: 'SSH终端',
    docker: 'Docker管理', nginx: 'Nginx管理', users: '用户管理', logs: '操作日志',
    settings: '系统设置', 'plugin-page': '模块页面', 'plugin-manager': '管理模块'
  };
  const title = titles[page] || page;
  document.getElementById('page-title').textContent = title;
  const appBarTitle = document.getElementById('app-bar-title');
  if (appBarTitle) appBarTitle.textContent = title;

  const contentEl = document.getElementById('page-content');
  contentEl.style.padding = '';
  contentEl.className = `page-content page-${page} page-enter`;
  contentEl.innerHTML = '';

  switch (page) {
    case 'dashboard': renderDashboard(contentEl); break;
    case 'files': renderFiles(contentEl); break;
    case 'terminal': renderTerminal(contentEl); break;
    case 'docker': renderDocker(contentEl); break;
    case 'nginx': renderNginx(contentEl); break;
    case 'users': renderUsers(contentEl); break;
    case 'logs': renderLogs(contentEl); break;
    case 'settings': renderSettings(contentEl); break;
    case 'plugin-page': renderPluginPage(contentEl); break;
    case 'plugin-manager': renderPluginManager(contentEl); break;
  }

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

function toggleCollapse() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
  const btn = sidebar.querySelector('.btn-collapse i');
  if (btn) btn.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
}

function initSidebar() {
  if (window.innerWidth > 768 && localStorage.getItem('sidebarCollapsed') === '1') {
    document.getElementById('sidebar').classList.add('collapsed');
    const btn = document.querySelector('.btn-collapse i');
    if (btn) btn.className = 'fas fa-chevron-right';
  }
  // Restore expanded groups
  document.querySelectorAll('.sidebar-group-toggle').forEach(el => {
    const group = el.dataset.group;
    if (group && localStorage.getItem('sidebarGroup_' + group) === '1') {
      el.classList.add('expanded');
      el.nextElementSibling?.classList.add('open');
    }
  });
}

function toggleSidebarGroup(el) {
  el.classList.toggle('expanded');
  const subnav = el.nextElementSibling;
  if (subnav) subnav.classList.toggle('open');
  const group = el.dataset.group;
  if (group) {
    localStorage.setItem('sidebarGroup_' + group, el.classList.contains('expanded') ? '1' : '0');
  }
}

document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.sidebar-toggle');
    if (!sidebar.contains(e.target) && !toggle?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});

function applyPanelBranding(s) {
  if (!s) { s = { panelName: 'ServerPanel', panelIcon: 'fa-server' }; }
  const name = s.panelName || 'ServerPanel';
  const icon = s.panelIcon || 'fa-server';
  // Sidebar
  const logoIcon = document.getElementById('sidebar-logo-icon');
  const logoText = document.getElementById('sidebar-logo-text');
  if (logoIcon) { logoIcon.className = 'fas ' + icon; }
  if (logoText) logoText.textContent = name;
  // Login
  const loginIcon = document.getElementById('login-logo-icon');
  const loginName = document.getElementById('login-panel-name');
  if (loginIcon) loginIcon.className = 'fas ' + icon;
  if (loginName) loginName.textContent = name;
  // Title
  const titleEl = document.getElementById('page-title-tag');
  if (titleEl) titleEl.textContent = name + ' - 服务器管理面板';
}

function updateClock() {
  const now = new Date();
  const str = now.toLocaleString('zh-CN');
  const el1 = document.getElementById('header-time');
  const el2 = document.getElementById('header-time-mobile');
  if (el1) el1.textContent = str;
  if (el2) el2.textContent = str;
}

function showLoading(show = true) {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function showToast(msg, type = 'success') {
  let toast = document.querySelector('.toast.show');
  if (toast) { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }

  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
  t.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    t.classList.add('show');
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  });
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('zh-CN');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showConfirm(msg, onConfirm) {
  createModal('确认操作',
    `<p style="color:var(--md-on-surface-variant);margin-bottom:8px">${escapeHtml(msg)}</p>`,
    `<button class="btn btn-danger" id="confirm-yes"><i class="fas fa-check"></i> 确认</button>
     <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>`
  );
  document.getElementById('confirm-yes')?.addEventListener('click', () => {
    document.querySelector('.modal-overlay')?.remove();
    onConfirm();
  });
}

function showPrompt(msg, def, onConfirm) {
  const id = 'prompt-' + Math.random().toString(36).slice(2, 8);
  createModal(msg,
    `<div class="form-group"><input type="text" id="${id}" class="form-control" value="${escapeHtml(def || '')}"></div>`,
    `<button class="btn btn-primary" id="${id}-ok"><i class="fas fa-check"></i> 确认</button>
     <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>`
  );
  const input = document.getElementById(id);
  setTimeout(() => input?.focus(), 100);
  document.getElementById(`${id}-ok`)?.addEventListener('click', () => {
    const val = input?.value.trim();
    if (val) { document.querySelector('.modal-overlay')?.remove(); onConfirm(val); }
  });
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById(`${id}-ok`)?.click();
  });
}

function animateStagger(el) {
  if (el) el.dataset.animated = 'true';
}

function openContextMenu(e, items) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  menu.innerHTML = items.map(item => {
    if (item.id === 'divider') return '<div class="context-separator"></div>';
    const isFn = typeof item.action === 'function';
    const id = 'ctx_' + Math.random().toString(36).slice(2, 8);
    if (isFn) menu._actions = menu._actions || {};
    if (isFn) menu._actions[id] = item.action;
    return `<button class="context-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}" ${item.disabled ? 'disabled' : `onclick="contextAction(this, '${id}')"`}>${item.icon ? '<i class="fas fa-' + item.icon + '"></i>' : ''}${item.label}</button>`;
  }).join('');
  menu._actions = menu._actions || {};
  menu.style.display = 'block';
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - 300);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.addEventListener('click', closeContextMenu, { once: true });
}

function closeContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
}

function contextAction(el, id) {
  const menu = document.getElementById('context-menu');
  const action = menu._actions ? menu._actions[id] : null;
  if (action) action();
  closeContextMenu();
}

function createModal(title, content, footer) {
  document.querySelector('.modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">${content}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

function showBottomSheet(title, items) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.onclick = () => { overlay.remove(); document.querySelector('.sheet')?.remove(); };
  document.body.appendChild(overlay);

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    ${title ? `<div class="sheet-header">${title}</div>` : ''}
    <div class="sheet-body">
      ${items.map(item => {
        if (item.id === 'divider') return '<div class="context-separator"></div>';
        return `<button class="sheet-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}" data-action="${item.id}" ${item.disabled ? 'disabled' : ''}>
          ${item.icon ? `<i class="fas fa-${item.icon}"></i>` : ''}
          ${item.label}
        </button>`;
      }).join('')}
    </div>`;
  document.body.appendChild(sheet);

  sheet.querySelectorAll('.sheet-item').forEach(el => {
    el.addEventListener('click', () => {
      if (el.disabled) return;
      const id = el.dataset.action;
      const item = items.find(i => i.id === id);
      if (item && item.action) item.action();
      overlay.remove();
      sheet.remove();
    });
  });
}
window.addEventListener('load', () => requestAnimationFrame(() => document.body.classList.remove('preload')));
setTimeout(() => document.body.classList.remove('preload'), 1500);
