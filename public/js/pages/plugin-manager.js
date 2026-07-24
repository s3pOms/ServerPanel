let _pmPlugins = [];

async function renderPluginManager(el) {
  el.innerHTML = `
    <div class="plugin-manager-container">
      <div class="card">
        <div class="card-header"><i class="fas fa-cubes"></i> 管理模块</div>
        <div class="card-body">
          <div class="pm-toolbar" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            <button class="btn btn-primary" onclick="pmInstallClick()"><i class="fas fa-upload"></i> 安装模块 (.zip)</button>
            <button class="btn btn-outline" onclick="pmReload()"><i class="fas fa-sync-alt"></i> 刷新</button>
            <span id="pm-count" style="margin-left:auto;font-size:13px;color:var(--md-on-surface-variant);align-self:center"></span>
          </div>
          <div id="pm-list" class="pm-list">
            <div class="page-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><i class="fas fa-info-circle"></i> 插件路径</div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--md-on-surface-variant);margin:0">将模块文件夹放入以下目录即可自动识别：</p>
          <code style="display:block;padding:10px 14px;background:var(--md-surface-variant);border-radius:8px;margin-top:8px;font-size:13px">server/plugins/&lt;模块名称&gt;/</code>
        </div>
      </div>
    </div>`;
  await pmReload();
}

async function pmReload() {
  const data = await apiRequest('GET', '/plugins');
  if (!data) return;
  _pmPlugins = data.plugins || [];
  pmRenderList();
}

function pmRenderList() {
  const el = document.getElementById('pm-list');
  const count = document.getElementById('pm-count');
  if (count) count.textContent = '共 ' + _pmPlugins.length + ' 个模块';
  if (!_pmPlugins.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-cubes" style="font-size:48px;color:var(--md-outline);display:block;margin-bottom:12px"></i>暂无模块</div>';
    return;
  }
  el.innerHTML = `<div class="stagger">${_pmPlugins.map((p,i) => {
    const m = p.manifest || {};
    const icon = m.icon || 'fa-puzzle-piece';
    const hasUI = p.hasFrontend;
    const hasPy = p.hasPython;
    return `<div class="pm-item card" style="margin-bottom:8px;padding:12px 16px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:var(--md-primary-container);border-radius:10px;flex-shrink:0">
        <i class="fas ${icon}" style="font-size:20px;color:var(--md-on-primary-container)"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:14px">${escapeHtml(m.title || p.name)} <span class="badge">v${escapeHtml(m.version || '0.0.0')}</span></div>
        <div style="font-size:12px;color:var(--md-on-surface-variant)">${escapeHtml(m.description || '无描述')}</div>
        <div style="font-size:11px;color:var(--md-outline);margin-top:2px">
          ${m.author ? '<span><i class="fas fa-user"></i> ' + escapeHtml(m.author) + '</span>' : ''}
          ${hasUI ? '<span style="margin-left:8px"><span class="badge badge-success" style="font-size:10px">前端</span></span>' : ''}
          ${hasPy ? '<span style="margin-left:4px"><span class="badge badge-info" style="font-size:10px">Python</span></span>' : ''}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        ${hasUI ? `<button class="btn btn-sm btn-outline" onclick="openPluginPage('${p.name}')" title="打开前端"><i class="fas fa-external-link-alt"></i></button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="pmShowConfig('${p.name}')" title="配置"><i class="fas fa-cog"></i></button>
        ${hasPy ? `<button class="btn btn-sm btn-outline" onclick="pmExecPython('${p.name}')" title="执行 Python"><i class="fab fa-python"></i></button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="pmUninstall('${p.name}')" title="卸载"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('')}</div>`;
  const stagger = el.querySelector('.stagger');
  if (stagger) animateStagger(stagger);
}

function pmInstallClick() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target.result.split(',')[1];
      showLoading(true);
      const res = await apiRequest('POST', '/plugins/install', { zip: base64 });
      showLoading(false);
      if (res && res.success) {
        showToast(res.message || '安装成功');
        pmReload();
      } else {
        showToast(res?.error || '安装失败', 'error');
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function pmUninstall(name) {
  showConfirm('确定卸载模块 ' + name + '？所有文件将被删除。', async () => {
    showLoading(true);
    const res = await apiRequest('DELETE', '/plugins/' + encodeURIComponent(name));
    showLoading(false);
    if (res && res.success) { showToast('已卸载'); pmReload(); }
    else showToast(res?.error || '卸载失败', 'error');
  });
}

async function pmShowConfig(name) {
  showLoading(true);
  const res = await apiRequest('GET', '/plugins/' + encodeURIComponent(name) + '/config');
  showLoading(false);
  if (!res) return;
  const cfg = res.config || {};
  const cfgStr = JSON.stringify(cfg, null, 2);
  const id = 'cfg-' + Math.random().toString(36).slice(2, 8);
  createModal('配置: ' + name,
    `<textarea id="${id}" class="file-editor" style="height:300px" spellcheck="false">${escapeHtml(cfgStr)}</textarea>`,
    `<button class="btn btn-primary" id="${id}-save"><i class="fas fa-save"></i> 保存</button>
     <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>`
  );
  document.getElementById(id + '-save')?.addEventListener('click', async () => {
    let parsed;
    try { parsed = JSON.parse(document.getElementById(id).value); }
    catch { showToast('JSON 格式错误', 'error'); return; }
    showLoading(true);
    const r = await apiRequest('PUT', '/plugins/' + encodeURIComponent(name) + '/config', { config: parsed });
    showLoading(false);
    if (r && r.success) { showToast('配置已保存'); document.querySelector('.modal-overlay')?.remove(); pmReload(); }
    else showToast(r?.error || '保存失败', 'error');
  });
}

async function pmExecPython(name) {
  const manifest = _pmPlugins.find(p => p.name === name)?.manifest || {};
  createModal('执行 Python: ' + name,
    `<div class="form-group"><label>参数 (JSON)</label><textarea id="py-args" class="file-editor" style="height:120px" spellcheck="false">{}</textarea></div>
     <div id="py-output" style="display:none;margin-top:8px"><label>输出</label><pre id="py-result" style="background:var(--md-surface-variant);padding:10px;border-radius:8px;font-size:12px;overflow:auto;max-height:200px;white-space:pre-wrap"></pre></div>`,
    `<button class="btn btn-primary" id="py-exec"><i class="fab fa-python"></i> 执行</button>
     <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`
  );
  document.getElementById('py-exec')?.addEventListener('click', async () => {
    let args;
    try { args = JSON.parse(document.getElementById('py-args').value); }
    catch { showToast('JSON 参数格式错误', 'error'); return; }
    const btn = document.getElementById('py-exec');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
    const res = await apiRequest('POST', '/plugins/' + encodeURIComponent(name) + '/execute', { args });
    btn.disabled = false; btn.innerHTML = '<i class="fab fa-python"></i> 执行';
    const out = document.getElementById('py-output');
    const result = document.getElementById('py-result');
    out.style.display = 'block';
    if (res && res.success) {
      result.innerHTML = '<span style="color:var(--md-success)">✓ 执行成功</span>\n\n' + escapeHtml(JSON.stringify(res.result || res.output || {}, null, 2));
    } else {
      result.innerHTML = '<span style="color:var(--md-error)">✗ 执行失败</span>\n' + escapeHtml(res?.error || res?.output || '无输出');
    }
  });
}