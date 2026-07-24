const COLOR_THEMES = [
  { id: 'sky',      label: '天空', color: '#89C2FF' },
  { id: 'pink',     label: '粉红', color: '#FF8A9B' },
  { id: 'lavender', label: '淡紫', color: '#6750A4' },
  { id: 'emerald',  label: '翡翠', color: '#31A062' },
  { id: 'tangerine',label: '橘黄', color: '#FF9800' },
  { id: 'ocean',    label: '海洋', color: '#009688' },
  { id: 'rose',     label: '玫瑰', color: '#E86D8A' },
  { id: 'indigo',   label: '靛蓝', color: '#5C6BC0' },
];

let _settingsData = null;
let _bgPreviewUrl = '';

async function renderSettings(el) {
  const s = _settingsData || {};
  el.innerHTML = `
    <div class="page-header">
      <h2>系统设置</h2>
    </div>
    <div class="settings-page">
      <div class="card">
        <div class="card-header"><i class="fas fa-palette"></i> <h3>外观主题</h3></div>
        <div class="card-body">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">主题配色</div>
              <div class="settings-row-desc">选择你喜欢的颜色主题</div>
            </div>
          </div>
          <div class="color-picker" id="color-picker">
            ${COLOR_THEMES.map(t => `
              <label class="color-swatch${(s.color || 'sky') === t.id ? ' active' : ''}" style="background:${t.color}" title="${t.label}" data-color="${t.id}">
                <input type="radio" name="color-theme" value="${t.id}" ${(s.color || 'sky') === t.id ? 'checked' : ''} onchange="settingsPickColor('${t.id}')">
              </label>
            `).join('')}
          </div>
          <div class="settings-row" style="margin-top:8px;border:none">
            <div class="settings-row-info">
              <div class="settings-row-label">深色模式</div>
              <div class="settings-row-desc">切换深色/浅色主题</div>
            </div>
            <div class="settings-row-action">
              <label class="toggle">
                <input type="checkbox" id="settings-theme" onchange="settingsToggleTheme()">
                <span class="toggle-slider"></span>
              </label>
              <span id="settings-theme-label" style="margin-left:8px;font-size:14px;font-weight:500;min-width:32px">浅色</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-layer-group"></i> <h3>界面特效</h3></div>
        <div class="card-body">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">侧栏毛玻璃</div>
              <div class="settings-row-desc">侧边栏高斯模糊效果</div>
            </div>
            <div class="settings-row-action">
              <label class="toggle">
                <input type="checkbox" id="settings-glass" onchange="settingsSave()">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">毛玻璃强度</div>
              <div class="settings-row-desc">侧栏模糊程度 (1-30px)</div>
            </div>
            <div class="settings-row-action" style="gap:10px">
              <input type="range" id="settings-sidebar-blur" min="1" max="30" value="10" oninput="settingsSidebarBlurChange()" style="width:120px">
              <span id="settings-sidebar-blur-val" style="font-size:14px;font-weight:500;min-width:28px">10</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-image"></i> <h3>自定义背景</h3></div>
        <div class="card-body">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">背景图片</div>
              <div class="settings-row-desc">输入图片 URL 或清空以禁用</div>
            </div>
            <div class="settings-row-action" style="flex-direction:column;align-items:stretch;gap:6px">
              <input type="text" id="settings-bg-url" class="form-control sm" placeholder="https://example.com/bg.jpg" style="width:240px">
              <div style="display:flex;gap:6px;align-items:center">
                <button class="btn btn-sm btn-primary" onclick="settingsApplyBg()"><i class="fas fa-check"></i> 应用</button>
                <button class="btn btn-sm btn-ghost" onclick="settingsClearBg()"><i class="fas fa-times"></i> 清除</button>
                <span id="settings-bg-status" style="font-size:12px;color:var(--md-on-surface-variant)"></span>
              </div>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">背景模糊</div>
              <div class="settings-row-desc">主区域高斯模糊程度 (0-30px)</div>
            </div>
            <div class="settings-row-action" style="gap:10px">
              <input type="range" id="settings-bg-blur" min="0" max="30" value="20" oninput="settingsBgBlurChange()" style="width:120px">
              <span id="settings-bg-blur-val" style="font-size:14px;font-weight:500;min-width:28px">20</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">卡片模糊</div>
              <div class="settings-row-desc">所有卡片/面板高斯模糊程度 (0-30px)</div>
            </div>
            <div class="settings-row-action" style="gap:10px">
              <input type="range" id="settings-card-blur" min="0" max="30" value="12" oninput="settingsCardBlurChange()" style="width:120px">
              <span id="settings-card-blur-val" style="font-size:14px;font-weight:500;min-width:28px">12</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">卡片透明度</div>
              <div class="settings-row-desc">卡片背景不透明度 (10%-100%)</div>
            </div>
            <div class="settings-row-action" style="gap:10px">
              <input type="range" id="settings-card-opacity" min="10" max="100" value="75" oninput="settingsCardOpacityChange()" style="width:120px">
              <span id="settings-card-opacity-val" style="font-size:14px;font-weight:500;min-width:40px">75%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-tag"></i> <h3>面板标识</h3></div>
        <div class="card-body">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">面板名称</div>
              <div class="settings-row-desc">显示在侧栏、登录页和浏览器标题</div>
            </div>
            <div class="settings-row-action">
              <input type="text" id="settings-panel-name" class="form-control sm" style="width:180px" placeholder="ServerPanel" onchange="settingsSave()">
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">面板图标</div>
              <div class="settings-row-desc">Font Awesome 图标类名，如 fa-server</div>
            </div>
            <div class="settings-row-action" style="gap:8px;flex-wrap:wrap">
              <input type="text" id="settings-panel-icon" class="form-control sm" style="width:160px" placeholder="fa-server" oninput="settingsPanelIconPreview()" onchange="settingsSave()">
              <span id="settings-panel-icon-preview" style="font-size:20px;width:32px;text-align:center;color:var(--md-primary)"><i class="fas fa-server"></i></span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-network-wired"></i> <h3>网络访问</h3></div>
        <div class="card-body">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">监听地址</div>
              <div class="settings-row-desc">服务绑定 IP 地址（重启后生效）</div>
            </div>
            <div class="settings-row-action">
              <input type="text" id="settings-bind-host" class="form-control sm" style="width:160px">
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">监听端口</div>
              <div class="settings-row-desc">服务端口号（重启后生效）</div>
            </div>
            <div class="settings-row-action">
              <input type="number" id="settings-port" class="form-control sm" style="width:120px" min="1" max="65535">
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">禁止公网访问</div>
              <div class="settings-row-desc">开启后仅允许局域网 (192.168/10/172.16) 和本机访问</div>
            </div>
            <div class="settings-row-action">
              <label class="toggle">
                <input type="checkbox" id="settings-block-public" onchange="settingsSave()">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="fas fa-save"></i> <h3>保存</h3></div>
        <div class="card-body" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span id="settings-restart-note" style="display:none;font-size:13px;color:var(--md-warning);background:var(--md-warning-container);padding:6px 14px;border-radius:50px">
            <i class="fas fa-exclamation-triangle"></i> 部分设置需重启服务后生效
          </span>
        </div>
      </div>
    </div>`;
  await settingsLoad();
}

async function settingsLoad() {
  const res = await apiRequest('GET', '/settings');
  if (!res || !res.settings) return;
  _settingsData = res.settings;
  const s = res.settings;
  document.getElementById('settings-bind-host').value = s.bindHost || '0.0.0.0';
  document.getElementById('settings-port').value = s.port || 8888;
  document.getElementById('settings-block-public').checked = !!s.blockPublic;
  const isDark = s.theme === 'dark';
  document.getElementById('settings-theme').checked = isDark;
  document.getElementById('settings-theme-label').textContent = isDark ? '深色' : '浅色';
  const color = s.color || 'sky';
  document.querySelectorAll('.color-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.color === color);
    const radio = el.querySelector('input');
    if (radio) radio.checked = el.dataset.color === color;
  });
  document.getElementById('settings-glass').checked = !!s.sidebarGlass;
  document.getElementById('settings-sidebar-blur').value = s.sidebarBlur || 10;
  document.getElementById('settings-sidebar-blur-val').textContent = s.sidebarBlur || 10;
  document.getElementById('settings-bg-url').value = s.bgImage || '';
  document.getElementById('settings-bg-blur').value = s.bgBlur || 20;
  document.getElementById('settings-bg-blur-val').textContent = s.bgBlur || 20;
  document.getElementById('settings-card-blur').value = s.cardBlur ?? 12;
  document.getElementById('settings-card-blur-val').textContent = s.cardBlur ?? 12;
  document.getElementById('settings-card-opacity').value = s.cardOpacity ?? 75;
  document.getElementById('settings-card-opacity-val').textContent = (s.cardOpacity ?? 75) + '%';
  document.getElementById('settings-panel-name').value = s.panelName || 'ServerPanel';
  document.getElementById('settings-panel-icon').value = s.panelIcon || 'fa-server';
  const previewIcon = document.getElementById('settings-panel-icon-preview');
  if (previewIcon) previewIcon.innerHTML = '<i class="fas ' + (s.panelIcon || 'fa-server') + '"></i>';
  applyBgEffects(s);
}

function applyBgEffects(s) {
  const hasGlass = !!s.sidebarGlass;
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('glass', hasGlass);
  if (hasGlass) {
    const blur = s.sidebarBlur || 10;
    sidebar.style.setProperty('--sidebar-blur', blur + 'px');
  }
  const bgUrl = s.bgImage || '';
  document.body.classList.toggle('has-bg', !!bgUrl);
  if (bgUrl) {
    document.body.style.setProperty('--bg-image', `url("${bgUrl}")`);
    const bgBlur = s.bgBlur || 0;
    document.body.style.setProperty('--bg-blur', bgBlur + 'px');
  } else {
    document.body.style.removeProperty('--bg-image');
    document.body.style.removeProperty('--bg-blur');
  }
  const cardBlur = s.cardBlur ?? 12;
  const cardOpacity = (s.cardOpacity ?? 75) / 100;
  document.body.style.setProperty('--card-blur', cardBlur + 'px');
  document.body.style.setProperty('--card-opacity', cardOpacity);
}

function settingsPickColor(colorId) {
  document.querySelectorAll('.color-swatch').forEach(el => el.classList.toggle('active', el.dataset.color === colorId));
  applyColor(colorId);
  settingsSaveWithColor(colorId);
}

function settingsToggleTheme() {
  const cb = document.getElementById('settings-theme');
  const isDark = cb.checked;
  document.getElementById('settings-theme-label').textContent = isDark ? '深色' : '浅色';
  applyTheme(isDark ? 'dark' : 'light');
  settingsSaveWithTheme(isDark ? 'dark' : 'light');
}

function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

function applyColor(colorId) {
  if (!colorId || colorId === 'sky') document.documentElement.removeAttribute('data-color');
  else document.documentElement.setAttribute('data-color', colorId);
}

function settingsSaveWithColor(color) {
  const theme = document.getElementById('settings-theme').checked ? 'dark' : 'light';
  apiRequest('PUT', '/settings', { theme, color }).then(res => { if (res?.success) _settingsData = res.settings; });
}

function settingsSaveWithTheme(theme) {
  const color = document.querySelector('.color-swatch.active')?.dataset.color || 'sky';
  apiRequest('PUT', '/settings', { theme, color }).then(res => { if (res?.success) _settingsData = res.settings; });
}

function settingsSidebarBlurChange() {
  const val = document.getElementById('settings-sidebar-blur').value;
  document.getElementById('settings-sidebar-blur-val').textContent = val;
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('glass')) {
    sidebar.style.setProperty('--sidebar-blur', val + 'px');
  }
}

function settingsBgBlurChange() {
  const val = document.getElementById('settings-bg-blur').value;
  document.getElementById('settings-bg-blur-val').textContent = val;
  if (document.body.classList.contains('has-bg')) {
    document.body.style.setProperty('--bg-blur', val + 'px');
  }
}

function settingsCardBlurChange() {
  const val = document.getElementById('settings-card-blur').value;
  document.getElementById('settings-card-blur-val').textContent = val;
  document.body.style.setProperty('--card-blur', val + 'px');
}

function settingsCardOpacityChange() {
  const val = document.getElementById('settings-card-opacity').value;
  document.getElementById('settings-card-opacity-val').textContent = val + '%';
  document.body.style.setProperty('--card-opacity', val / 100);
}

function settingsPanelIconPreview() {
  const icon = document.getElementById('settings-panel-icon').value.trim() || 'fa-server';
  const preview = document.getElementById('settings-panel-icon-preview');
  if (preview) preview.innerHTML = '<i class="fas ' + icon + '"></i>';
}

function settingsApplyBg() {
  const url = document.getElementById('settings-bg-url').value.trim();
  const bgBlur = parseInt(document.getElementById('settings-bg-blur').value) || 20;
  const cardBlur = parseInt(document.getElementById('settings-card-blur').value) || 12;
  const cardOpacity = parseInt(document.getElementById('settings-card-opacity').value) || 75;
  document.body.classList.toggle('has-bg', !!url);
  if (url) {
    document.body.style.setProperty('--bg-image', `url("${url}")`);
    document.body.style.setProperty('--bg-blur', bgBlur + 'px');
  } else {
    document.body.style.removeProperty('--bg-image');
    document.body.style.removeProperty('--bg-blur');
  }
  document.body.style.setProperty('--card-blur', cardBlur + 'px');
  document.body.style.setProperty('--card-opacity', cardOpacity / 100);
  const sidebarGlass = document.getElementById('settings-glass').checked;
  const sidebarBlur = parseInt(document.getElementById('settings-sidebar-blur').value) || 10;
  const theme = document.getElementById('settings-theme').checked ? 'dark' : 'light';
  const color = document.querySelector('.color-swatch.active')?.dataset.color || 'sky';
  const payload = { theme, color, bgImage: url, bgBlur, sidebarGlass, sidebarBlur, cardBlur, cardOpacity };
  apiRequest('PUT', '/settings', payload).then(res => {
    if (res?.success) { _settingsData = res.settings; showToast('背景已应用'); document.getElementById('settings-bg-status').textContent = '已应用'; }
  });
}

function settingsClearBg() {
  document.getElementById('settings-bg-url').value = '';
  document.getElementById('settings-bg-blur').value = '20';
  document.getElementById('settings-bg-blur-val').textContent = '20';
  document.body.classList.remove('has-bg');
  document.body.style.removeProperty('--bg-image');
  document.body.style.removeProperty('--bg-blur');
  const sidebarGlass = document.getElementById('settings-glass').checked;
  const sidebarBlur = parseInt(document.getElementById('settings-sidebar-blur').value) || 10;
  const cardBlur = parseInt(document.getElementById('settings-card-blur').value) || 12;
  const cardOpacity = parseInt(document.getElementById('settings-card-opacity').value) || 75;
  const theme = document.getElementById('settings-theme').checked ? 'dark' : 'light';
  const color = document.querySelector('.color-swatch.active')?.dataset.color || 'sky';
  apiRequest('PUT', '/settings', { theme, color, bgImage: '', bgBlur: 20, sidebarGlass, sidebarBlur, cardBlur, cardOpacity }).then(res => {
    if (res?.success) { _settingsData = res.settings; showToast('背景已清除'); }
  });
}

async function settingsSave() {
  const theme = document.getElementById('settings-theme').checked ? 'dark' : 'light';
  const color = document.querySelector('.color-swatch.active')?.dataset.color || 'sky';
  const bindHost = document.getElementById('settings-bind-host').value.trim() || '0.0.0.0';
  const port = parseInt(document.getElementById('settings-port').value) || 8888;
  const blockPublic = document.getElementById('settings-block-public').checked;
  const sidebarGlass = document.getElementById('settings-glass').checked;
  const sidebarBlur = parseInt(document.getElementById('settings-sidebar-blur').value) || 10;
  const bgImage = document.getElementById('settings-bg-url').value.trim();
  const bgBlur = parseInt(document.getElementById('settings-bg-blur').value) || 20;
  const cardBlur = parseInt(document.getElementById('settings-card-blur').value) || 12;
  const cardOpacity = parseInt(document.getElementById('settings-card-opacity').value) || 75;
  const panelName = document.getElementById('settings-panel-name').value.trim() || 'ServerPanel';
  const panelIcon = document.getElementById('settings-panel-icon').value.trim() || 'fa-server';
  const payload = { theme, color, bindHost, port, blockPublic, sidebarGlass, sidebarBlur, bgImage, bgBlur, cardBlur, cardOpacity, panelName, panelIcon };
  const res = await apiRequest('PUT', '/settings', payload);
  if (res && res.success) {
    _settingsData = res.settings;
    applyBgEffects(res.settings);
    applyPanelBranding(res.settings);
    showToast('设置已保存');
    if (res.restartRequired) document.getElementById('settings-restart-note').style.display = 'inline-flex';
  } else {
    showToast(res?.error || '保存失败', 'error');
  }
}

async function initSettingsTheme() {
  const res = await apiRequest('GET', '/settings');
  if (res && res.settings) {
    applyTheme(res.settings.theme);
    applyColor(res.settings.color);
    applyBgEffects(res.settings);
    applyPanelBranding(res.settings);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initSettingsTheme());
} else {
  initSettingsTheme();
}