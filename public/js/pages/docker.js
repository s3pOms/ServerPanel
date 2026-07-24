let dockerRefreshInterval = null;
let dockerRefreshToken = 0;
const dockerTabCache = {};
const dockerStatsCache = new Map();

function dockerDataFingerprint(tab, data) {
  if (tab === 'containers') {
    return JSON.stringify((data || []).map(container => [container.Id, container.State, container.Status, container.Image, container.Ports]));
  }
  return JSON.stringify(data);
}

function dockerSummarySkeleton() {
  return Array.from({ length: 6 }, () => `
    <div class="docker-summary-item docker-skeleton-card">
      <span class="skeleton-line w-50"></span>
      <span class="skeleton-line w-60 h-32"></span>
    </div>`).join('');
}

function dockerContentSkeleton() {
  return `<div class="docker-container-grid">${Array.from({ length: 3 }, () => `
    <div class="card docker-container-card docker-skeleton-card">
      <div class="card-header"><span class="skeleton-line w-50"></span></div>
      <div class="card-body">
        <span class="skeleton-line w-60"></span>
        <span class="skeleton-line w-40"></span>
        <div class="skeleton-bar"></div>
      </div>
    </div>`).join('')}</div>`;
}

function renderDocker(el) {
  el.innerHTML = `
    <div class="docker-container">
      <div class="docker-header">
        <div class="tabs">
          <button class="tab-btn active" data-tab="containers" onclick="switchDockerTab('containers')"><i class="fas fa-cube"></i> 容器</button>
          <button class="tab-btn" data-tab="images" onclick="switchDockerTab('images')"><i class="fas fa-layer-group"></i> 镜像</button>
          <button class="tab-btn" data-tab="networks" onclick="switchDockerTab('networks')"><i class="fas fa-network-wired"></i> 网络</button>
          <button class="tab-btn" data-tab="volumes" onclick="switchDockerTab('volumes')"><i class="fas fa-database"></i> 卷</button>
        </div>
        <div class="docker-header-actions">
          <button class="btn btn-icon btn-sm" onclick="dockerRefresh({ force: true })" title="刷新"><i class="fas fa-sync-alt"></i></button>
          <button class="btn btn-sm btn-primary" onclick="dockerCreateContainer()"><i class="fas fa-plus"></i><span>创建容器</span></button>
          <button class="btn btn-sm btn-outline" onclick="dockerPullImage()"><i class="fas fa-download"></i><span>拉取镜像</span></button>
          <button class="btn btn-sm btn-warning" onclick="dockerPrune()"><i class="fas fa-broom"></i><span>清理</span></button>
        </div>
      </div>
      <div id="docker-summary" class="docker-summary">${dockerSummarySkeleton()}</div>
      <div id="docker-content" class="docker-content">${dockerContentSkeleton()}</div>
    </div>`;

  loadDockerSummary();
  dockerRefresh({ initial: true });
  if (dockerRefreshInterval) clearInterval(dockerRefreshInterval);
  dockerRefreshInterval = setInterval(() => {
    if (currentPage === 'docker') {
      loadDockerSummary(true);
      dockerRefresh({ silent: true });
    }
  }, 10000);
}

function switchDockerTab(tab) {
  document.querySelectorAll('.docker-header .tab-btn').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  const content = document.getElementById('docker-content');
  if (!content) return;
  if (dockerTabCache[tab]) renderDockerTab(tab, dockerTabCache[tab], content);
  else content.innerHTML = tab === 'containers' ? dockerContentSkeleton() : '<div class="docker-inline-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
  dockerRefresh({ tab, initial: !dockerTabCache[tab] });
}

async function loadDockerSummary(silent = false) {
  const el = document.getElementById('docker-summary');
  if (!el) return;
  const data = await apiRequest('GET', '/docker/info');
  if (!data || data.error) {
    if (!silent) el.innerHTML = `<div class="docker-inline-error">${escapeHtml(data?.error || '无法读取 Docker 信息')}</div>`;
    return;
  }
  const values = [
    ['运行中', data.containersRunning, 'success'],
    ['已停止', data.containersStopped, 'error'],
    ['镜像', data.imagesTotal, ''],
    ['CPU', `${data.cpuCores} 核`, ''],
    ['内存', formatSize(data.memory), ''],
    ['版本', data.version, 'small']
  ];
  if (el.querySelector('[data-summary]')) {
    values.forEach(([label, value]) => {
      const target = el.querySelector(`[data-summary="${label}"]`);
      if (target) target.textContent = value;
    });
    return;
  }
  el.innerHTML = values.map(([label, value, variant]) => `
    <div class="docker-summary-item">
      <span class="docker-summary-label">${label}</span>
      <span class="docker-summary-value ${variant}" data-summary="${label}">${value}</span>
    </div>`).join('');
}

async function dockerRefresh(options = {}) {
  const tab = options.tab || document.querySelector('.docker-header .tab-btn.active')?.dataset.tab || 'containers';
  const content = document.getElementById('docker-content');
  if (!content) return;
  const token = ++dockerRefreshToken;
  const data = await apiRequest('GET', `/docker/${tab}`);
  if (token !== dockerRefreshToken || currentPage !== 'docker') return;
  if (!data || data.error) {
    if (options.initial || !content.children.length) {
      content.innerHTML = `<div class="error-page"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(data?.error || 'Docker 未运行或未安装')}</div>`;
    }
    return;
  }
  const unchanged = options.silent && dockerTabCache[tab] && dockerDataFingerprint(tab, dockerTabCache[tab]) === dockerDataFingerprint(tab, data);
  dockerTabCache[tab] = data;
  if (!unchanged) renderDockerTab(tab, data, content);
  if (tab === 'containers') loadContainerDetails(data, token);
}

function renderDockerTab(tab, data, content) {
  if (tab === 'containers') renderContainers(data, content);
  else if (tab === 'images') renderImages(data, content);
  else if (tab === 'networks') renderNetworks(data, content);
  else renderVolumes(data, content);
}

function renderContainers(containers, el) {
  if (!Array.isArray(containers) || containers.length === 0) {
    el.innerHTML = '<div class="empty-state">没有容器</div>';
    return;
  }
  el.innerHTML = `<div class="docker-container-grid">${containers.map(container => {
    const running = container.State === 'running';
    const name = container.Names?.[0]?.replace(/^\//, '') || '-';
    const ports = (container.Ports || []).filter(port => port.PublicPort).map(port => `${port.PublicPort}:${port.PrivatePort}`).join(', ') || '-';
    const mounts = (container.Mounts || []).map(mount => `${mount.Type}:${mount.Destination}`).join(', ') || '-';
    const cached = dockerStatsCache.get(container.Id);
    const cpuLabel = cached ? `${cached.cpuPct}%` : '';
    const memLabel = cached ? `${cached.memUsed} / ${cached.memLimit}` : '';
    const cpuWidth = cached ? Math.min(cached.cpuPct, 100) : 0;
    const memWidth = cached ? Math.min(cached.memPct, 100) : 0;
    return `<article class="card docker-container-card" data-container-id="${container.Id}">
      <div class="card-header">
        <span class="status-dot ${running ? 'green' : 'red'}"></span>
        <span class="docker-container-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <span class="badge ${running ? 'badge-success' : 'badge-error'}">${escapeHtml(container.State)}</span>
      </div>
      <div class="card-body">
        <div class="docker-container-meta">
          <span class="meta-label">镜像</span><span class="meta-value" title="${escapeHtml(container.Image)}">${escapeHtml(container.Image || '-')}</span>
          <span class="meta-label">端口</span><span class="meta-value">${ports}</span>
          <span class="meta-label">挂载</span><span class="meta-value docker-mounts" title="${escapeHtml(mounts)}">${escapeHtml(mounts)}</span>
          <span class="meta-label">创建</span><span class="meta-value">${formatDate(container.Created * 1000)}</span>
        </div>
        ${running ? `<div class="docker-stats-bar" data-stats>
          <div class="stat-row"><span>CPU</span><span data-cpu>${cpuLabel}</span></div>
          <div class="progress-bar"><div class="progress-fill" data-cpu-bar style="width:${cpuWidth}%"></div></div>
          <div class="stat-row"><span>内存</span><span data-memory>${memLabel}</span></div>
          <div class="progress-bar"><div class="progress-fill docker-memory-fill" data-memory-bar style="width:${memWidth}%"></div></div>
        </div>` : ''}
        <div class="docker-container-actions">
          ${running
            ? `<button class="btn btn-icon btn-sm" onclick="dockerContainerAction('${container.Id}','stop')" title="停止"><i class="fas fa-stop"></i></button>
               <button class="btn btn-icon btn-sm" onclick="dockerContainerAction('${container.Id}','restart')" title="重启"><i class="fas fa-sync-alt"></i></button>`
            : `<button class="btn btn-icon btn-sm btn-primary" onclick="dockerContainerAction('${container.Id}','start')" title="启动"><i class="fas fa-play"></i></button>`}
          <button class="btn btn-icon btn-sm btn-danger" onclick="dockerContainerAction('${container.Id}','remove')" title="删除"><i class="fas fa-trash"></i></button>
          <button class="btn btn-icon btn-sm" onclick="dockerContainerLogs('${container.Id}')" title="日志"><i class="fas fa-file-alt"></i></button>
          <button class="btn btn-icon btn-sm" onclick="dockerInspect('${container.Id}')" title="详情"><i class="fas fa-search"></i></button>
        </div>
      </div>
    </article>`;
  }).join('')}</div>`;
}

async function loadContainerDetails(containers, token) {
  const running = containers.filter(container => container.State === 'running');
  await Promise.all(running.map(async container => {
    const details = await apiRequest('GET', `/docker/containers/${container.Id}/details`);
    if (!details || details.error || token !== dockerRefreshToken || currentPage !== 'docker') return;
    const card = document.querySelector(`[data-container-id="${container.Id}"]`);
    if (!card) return;
    const cpu = Math.max(0, Number(details.cpu) || 0);
    const cpuPct = Number(cpu.toFixed(1));
    const memPct = details.memoryLimit ? (details.memory / details.memoryLimit) * 100 : 0;
    const memUsed = formatSize(details.memory);
    const memLimit = formatSize(details.memoryLimit);
    dockerStatsCache.set(container.Id, { cpuPct, memPct, memUsed, memLimit });
    const mounts = (details.mounts || []).map(mount => `${mount.Type}:${mount.Destination}`).join(', ') || '-';
    const mountEl = card.querySelector('.docker-mounts');
    if (mountEl) { mountEl.textContent = mounts; mountEl.title = mounts; }
    card.querySelector('[data-cpu]').textContent = `${cpuPct}%`;
    card.querySelector('[data-cpu-bar]').style.width = `${Math.min(cpuPct, 100)}%`;
    card.querySelector('[data-memory]').textContent = `${memUsed} / ${memLimit}`;
    card.querySelector('[data-memory-bar]').style.width = `${Math.min(memPct, 100)}%`;
  }));
}

function renderImages(images, el) {
  if (!Array.isArray(images) || images.length === 0) { el.innerHTML = '<div class="empty-state">没有镜像</div>'; return; }
  el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>仓库</th><th>标签</th><th>镜像 ID</th><th>大小</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${images.map(image => {
    const tag = image.RepoTags?.[0] || '-';
    const split = tag.lastIndexOf(':');
    return `<tr><td>${escapeHtml(split > 0 ? tag.slice(0, split) : tag)}</td><td><span class="badge badge-primary">${escapeHtml(split > 0 ? tag.slice(split + 1) : '-')}</span></td><td><code>${image.Id.slice(7, 19)}</code></td><td>${formatSize(image.Size)}</td><td>${formatDate(image.Created * 1000)}</td><td class="actions"><button class="btn btn-icon btn-sm btn-danger" onclick="dockerRemoveImage('${image.Id}')" title="删除"><i class="fas fa-trash"></i></button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderNetworks(networks, el) {
  if (!Array.isArray(networks) || networks.length === 0) { el.innerHTML = '<div class="empty-state">没有网络</div>'; return; }
  el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>名称</th><th>驱动</th><th>范围</th><th>子网</th><th>网关</th></tr></thead><tbody>${networks.map(network => {
    const ipam = network.IPAM?.Config?.[0] || {};
    return `<tr><td>${escapeHtml(network.Name)}</td><td>${escapeHtml(network.Driver)}</td><td>${escapeHtml(network.Scope)}</td><td>${escapeHtml(ipam.Subnet || '-')}</td><td>${escapeHtml(ipam.Gateway || '-')}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderVolumes(data, el) {
  const volumes = data?.Volumes || [];
  if (volumes.length === 0) { el.innerHTML = '<div class="empty-state">没有卷</div>'; return; }
  el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>名称</th><th>驱动</th><th>挂载点</th><th>创建时间</th></tr></thead><tbody>${volumes.map(volume => `<tr><td>${escapeHtml(volume.Name)}</td><td>${escapeHtml(volume.Driver)}</td><td><code>${escapeHtml(volume.Mountpoint)}</code></td><td>${formatDate(volume.CreatedAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function dockerContainerAction(id, action) {
  if (action === 'remove') {
    showConfirm('确定删除此容器？', () => doContainerAction(id, action));
    return;
  }
  doContainerAction(id, action);
}

async function doContainerAction(id, action) {
  showLoading(true);
  const result = await apiRequest('POST', `/docker/containers/${id}/${action}`);
  showLoading(false);
  if (result?.success) {
    showToast(`${action} 成功`);
    await Promise.all([dockerRefresh({ force: true }), loadDockerSummary(true)]);
  } else showToast(result?.error || '操作失败', 'error');
}

async function dockerRemoveImage(id) {
  showConfirm('确定删除此镜像？', async () => {
    const result = await apiRequest('POST', `/docker/images/remove/${id}`);
    if (result?.success) { showToast('删除成功'); dockerRefresh({ force: true }); loadDockerSummary(true); }
    else showToast(result?.error || '删除失败', 'error');
  });
}

async function dockerContainerLogs(id) {
  const data = await apiRequest('GET', `/docker/containers/${id}/logs`);
  if (data?.logs !== undefined) createModal('容器日志', `<pre class="docker-inspect-pre">${escapeHtml(data.logs)}</pre>`, `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`);
}

async function dockerInspect(id) {
  const data = await apiRequest('GET', `/docker/containers/${id}/inspect`);
  if (data) createModal(`容器详情 ${id.slice(0, 12)}`, `<pre class="docker-inspect-pre">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`, `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`);
}

function dockerCreateContainer() {
  createModal('创建容器', `
    <div class="form-group"><label>镜像 (必填)</label><input type="text" id="dc-image" class="form-control" placeholder="nginx:latest"></div>
    <div class="form-group"><label>容器名称</label><input type="text" id="dc-name" class="form-control"></div>
    <div class="form-group"><label>端口映射 (宿主机:容器，逗号分隔)</label><input type="text" id="dc-ports" class="form-control" placeholder="8080:80,8443:443"></div>
    <div class="form-group"><label>环境变量 (KEY=VALUE，逗号分隔)</label><input type="text" id="dc-env" class="form-control"></div>
    <div class="form-group"><label>卷挂载 (宿主机:容器，逗号分隔)</label><input type="text" id="dc-volumes" class="form-control" placeholder="/data:/app/data"></div>
    <div class="form-group"><label>重启策略</label><select id="dc-restart" class="form-control"><option value="">无</option><option value="always">always</option><option value="unless-stopped">unless-stopped</option><option value="on-failure">on-failure</option></select></div>`, `
    <button class="btn btn-primary" onclick="dockerDoCreate()"><i class="fas fa-play"></i> 创建并启动</button><button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>`);
}

async function dockerDoCreate() {
  const image = document.getElementById('dc-image').value.trim();
  if (!image) { showToast('镜像名不能为空', 'error'); return; }
  const ports = {};
  document.getElementById('dc-ports').value.split(',').forEach(value => {
    const [host, container] = value.trim().split(':');
    if (host && container) ports[host] = container;
  });
  const splitValues = id => document.getElementById(id).value.split(',').map(value => value.trim()).filter(Boolean);
  const result = await apiRequest('POST', '/docker/containers/create', {
    image,
    name: document.getElementById('dc-name').value.trim() || undefined,
    ports,
    env: splitValues('dc-env'),
    volumes: splitValues('dc-volumes'),
    restartPolicy: document.getElementById('dc-restart').value || undefined
  });
  if (result?.success) { document.querySelector('.modal-overlay')?.remove(); showToast('容器创建成功'); dockerRefresh({ force: true }); loadDockerSummary(true); }
  else showToast(result?.error || '创建失败', 'error');
}

function dockerPullImage() {
  createModal('拉取镜像', `<div class="form-group"><label>镜像名称</label><input type="text" id="dpi-name" class="form-control" placeholder="ubuntu:latest"></div>`, `<button class="btn btn-primary" onclick="dockerDoPull()"><i class="fas fa-download"></i> 拉取</button><button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>`);
}

async function dockerDoPull() {
  const name = document.getElementById('dpi-name').value.trim();
  if (!name) { showToast('镜像名不能为空', 'error'); return; }
  const result = await apiRequest('POST', '/docker/images/pull', { name });
  if (result?.success) { document.querySelector('.modal-overlay')?.remove(); showToast('拉取成功'); dockerRefresh({ force: true }); loadDockerSummary(true); }
  else showToast(result?.error || '拉取失败', 'error');
}

function dockerPrune() {
  createModal('清理 Docker 资源', `<p class="docker-prune-copy">选择要清理的资源类型。清理操作不可撤销。</p><div class="docker-prune-actions">
    <button class="btn btn-warning" onclick="dockerDoPrune('containers')"><i class="fas fa-cube"></i><span>已停止的容器</span></button>
    <button class="btn btn-warning" onclick="dockerDoPrune('images')"><i class="fas fa-layer-group"></i><span>未使用的镜像</span></button>
    <button class="btn btn-warning" onclick="dockerDoPrune('volumes')"><i class="fas fa-database"></i><span>未使用的卷</span></button>
  </div>`, `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>`);
}

async function dockerDoPrune(type) {
  const result = await apiRequest('POST', `/docker/prune/${type}`);
  if (result?.error) { showToast(result.error, 'error'); return; }
  document.querySelector('.modal-overlay')?.remove();
  const space = result?.SpaceReclaimed ? `，释放 ${formatSize(result.SpaceReclaimed)}` : '';
  showToast(`清理完成${space}`);
  dockerRefresh({ force: true });
  loadDockerSummary(true);
}
