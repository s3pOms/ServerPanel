let dashboardTimer = null;
let prevData = null;

async function renderDashboard(el) {
  showSkeleton(el);
  const data = await apiRequest('GET', '/system/info');
  if (!data) { el.innerHTML = '<div class="error-page">获取系统信息失败</div>'; return; }
  buildDashboard(el, data);
  scheduleRefresh(el);
}

function showSkeleton(el) {
  el.innerHTML = `
    <div class="dash-page stagger">
      <div class="dash-row">
        ${[0,1,2,3].map(i => `
          <div class="card dash-card dash-card-skeleton">
            <div class="dash-card-body">
              <div class="skeleton-icon"></div>
              <div class="skeleton-line w-60"></div>
              <div class="skeleton-line w-40 h-32"></div>
              <div class="skeleton-line w-50"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="dash-grid">
        <div class="card">
          <div class="card-header">系统信息</div>
          <div class="card-body">
            ${[0,1,2,3,4,5,6,7].map(() => '<div class="info-row"><span class="skeleton-line w-30"></span><span class="skeleton-line w-50"></span></div>').join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header">资源监控</div>
          <div class="card-body">
            ${[0,1,2,3].map(() => `
              <div style="margin-bottom:20px">
                <div class="skeleton-line w-30" style="margin-bottom:8px"></div>
                <div class="skeleton-bar"></div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function buildDashboard(el, data) {
  const d = parseData(data);
  el.innerHTML = `
    <div class="dash-page stagger">
      <div class="dash-row">
        <div class="card dash-card" style="--card-accent:#22c55e">
          <div class="dash-card-body">
            <div class="dash-card-icon" style="background:rgba(34,197,94,0.12);color:#22c55e"><i class="fas fa-microchip"></i></div>
            <div class="dash-card-label">CPU 使用率</div>
            <div class="dash-card-value" id="z-cpu">${d.cpuPct}%</div>
            <div class="dash-card-trend ${d.cpuTrend >= 0 ? 'up' : 'down'}" id="z-cpu-trend"><i class="fas fa-arrow-${d.cpuTrend >= 0 ? 'up' : 'down'}"></i> ${Math.abs(d.cpuTrend).toFixed(1)}% <span>vs 上次刷新</span></div>
          </div>
        </div>
        <div class="card dash-card" style="--card-accent:#3b82f6">
          <div class="dash-card-body">
            <div class="dash-card-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6"><i class="fas fa-memory"></i></div>
            <div class="dash-card-label">内存使用率</div>
            <div class="dash-card-value" id="z-mem">${d.memPct}%</div>
            <div class="dash-card-trend ${d.memTrend >= 0 ? 'up' : 'down'}" id="z-mem-trend"><i class="fas fa-arrow-${d.memTrend >= 0 ? 'up' : 'down'}"></i> ${Math.abs(d.memTrend).toFixed(1)}% <span>vs 上次刷新</span></div>
          </div>
        </div>
        <div class="card dash-card" style="--card-accent:#f59e0b">
          <div class="dash-card-body">
            <div class="dash-card-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b"><i class="fas fa-hdd"></i></div>
            <div class="dash-card-label">磁盘使用率</div>
            <div class="dash-card-value" id="z-disk">${d.diskPct}%</div>
            <div class="dash-card-trend up" id="z-disk-trend"><span>已用 ${d.diskUsed} / ${d.diskTotal}</span></div>
          </div>
        </div>
        <div class="card dash-card" style="--card-accent:#a855f7">
          <div class="dash-card-body">
            <div class="dash-card-icon" style="background:rgba(168,85,247,0.12);color:#a855f7"><i class="fas fa-network-wired"></i></div>
            <div class="dash-card-label">网络流量</div>
            <div class="dash-card-value" id="z-net">↓${d.netDown}</div>
            <div class="dash-card-trend up" id="z-net-trend"><span>↑ ${d.netUp}/s · ${d.netIface}</span></div>
          </div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card-header"><i class="fas fa-server"></i> 系统信息</div>
          <div class="card-body">
            <div class="info-row"><span class="info-label">主机名</span><span class="info-value" id="z-hostname">${d.hostname}</span></div>
            <div class="info-row"><span class="info-label">系统</span><span class="info-value" id="z-os">${d.os}</span></div>
            <div class="info-row"><span class="info-label">内核</span><span class="info-value" id="z-kernel">${d.kernel}</span></div>
            <div class="info-row"><span class="info-label">架构</span><span class="info-value" id="z-arch">${d.arch}</span></div>
            <div class="info-row"><span class="info-label">运行时间</span><span class="info-value" id="z-uptime">${d.uptime}</span></div>
            <div class="info-row"><span class="info-label">负载</span><span class="info-value" id="z-load">${d.load}</span></div>
            <div class="info-row"><span class="info-label">CPU 型号</span><span class="info-value" id="z-brand">${d.brand}</span></div>
            <div class="info-row"><span class="info-label">进程数</span><span class="info-value" id="z-procs">${d.procAll} (运行 ${d.procRun})</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><i class="fas fa-chart-simple"></i> 资源监控</div>
          <div class="card-body">
            <div class="dash-goal">
              <div class="dash-goal-head"><span class="info-label">CPU</span><span id="z-g-cpu">${d.cpuPct}%</span></div>
              <div class="progress-bar"><div class="progress-fill" id="z-b-cpu" style="width:${d.cpuPct}%;background:#22c55e"></div></div>
            </div>
            <div class="dash-goal">
              <div class="dash-goal-head"><span class="info-label">内存</span><span id="z-g-mem">${d.memPct}%</span></div>
              <div class="progress-bar"><div class="progress-fill" id="z-b-mem" style="width:${d.memPct}%;background:#3b82f6"></div></div>
            </div>
            <div class="dash-goal">
              <div class="dash-goal-head"><span class="info-label">磁盘</span><span id="z-g-disk">${d.diskPct}%</span></div>
              <div class="progress-bar"><div class="progress-fill" id="z-b-disk" style="width:${d.diskPct}%;background:#f59e0b"></div></div>
            </div>
            <div class="dash-goal">
              <div class="dash-goal-head"><span class="info-label">负载</span><span id="z-g-load">${d.loadAvg1}</span></div>
              <div class="progress-bar"><div class="progress-fill" id="z-b-load" style="width:${Math.min(d.loadAvg1 / d.cpuCores * 100, 100).toFixed(0)}%;background:#a855f7"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  el._data = data;
  prevData = data;
}

function parseData(data) {
  const { cpu, memory, disks, os, network, processes, loadAverage } = data;
  const totalSize = disks.reduce((s, d) => s + (d.size || 0), 0);
  const totalUsed = disks.reduce((s, d) => s + (d.used || 0), 0);
  const cpuPct = Math.min(cpu.load, 100).toFixed(1);
  const memPct = parseFloat(memory.usedPercent).toFixed(1);
  const diskPct = totalSize > 0 ? ((totalUsed / totalSize) * 100).toFixed(1) : '0.0';
  const wlo1 = network.find(n => n.iface === 'wlo1') || network[0] || {};
  const cpuTrend = prevData ? cpu.load - prevData.cpu.load : 0;
  const memTrend = prevData ? parseFloat(memory.usedPercent) - parseFloat(prevData.memory.usedPercent) : 0;
  return {
    cpuPct, memPct, diskPct,
    cpuTrend, memTrend,
    diskUsed: formatSize(totalUsed), diskTotal: formatSize(totalSize),
    netDown: formatSize(wlo1.rxSec || 0) + '/s',
    netUp: formatSize(wlo1.txSec || 0),
    netIface: wlo1.iface || '网络',
    hostname: escapeHtml(os.hostname),
    os: escapeHtml(os.distro) + ' ' + escapeHtml(os.release),
    kernel: escapeHtml(os.kernel),
    arch: os.arch,
    uptime: formatUptime(os.uptime),
    load: loadAverage.map(v => v.toFixed(2)).join(' / '),
    loadAvg1: loadAverage[0].toFixed(2),
    brand: cpu.brand,
    procAll: processes.all, procRun: processes.running,
    cpuCores: cpu.cores || 8
  };
}

function scheduleRefresh(el) {
  if (dashboardTimer) clearTimeout(dashboardTimer);
  const tick = async () => {
    if (currentPage !== 'dashboard') return;
    const t0 = Date.now();
    const data = await apiRequest('GET', '/system/info');
    if (data) { el._data = data; updateDashboardValues(data); prevData = data; }
    const delay = Math.max(200, 1500 - (Date.now() - t0));
    dashboardTimer = setTimeout(tick, delay);
  };
  dashboardTimer = setTimeout(tick, 1500);
}

function updateDashboardValues(data) {
  const d = parseData(data);
  setText('z-cpu', d.cpuPct + '%');
  setText('z-mem', d.memPct + '%');
  setText('z-disk', d.diskPct + '%');
  setText('z-net', '↓' + d.netDown);
  setText('z-g-cpu', d.cpuPct + '%');
  setText('z-g-mem', d.memPct + '%');
  setText('z-g-disk', d.diskPct + '%');
  setText('z-g-load', d.loadAvg1);
  setBar('z-b-cpu', d.cpuPct, '#22c55e');
  setBar('z-b-mem', d.memPct, '#3b82f6');
  setBar('z-b-disk', d.diskPct, '#f59e0b');
  setBar('z-b-load', Math.min(d.loadAvg1 / d.cpuCores * 100, 100).toFixed(0), '#a855f7');
  setText('z-hostname', d.hostname);
  setText('z-os', d.os);
  setText('z-kernel', d.kernel);
  setText('z-arch', d.arch);
  setText('z-uptime', d.uptime);
  setText('z-load', d.load);
  setText('z-brand', d.brand);
  setText('z-procs', d.procAll + ' (运行 ' + d.procRun + ')');
  const cpuTrendEl = document.getElementById('z-cpu-trend');
  if (cpuTrendEl) {
    cpuTrendEl.className = 'dash-card-trend ' + (d.cpuTrend >= 0 ? 'up' : 'down');
    cpuTrendEl.innerHTML = `<i class="fas fa-arrow-${d.cpuTrend >= 0 ? 'up' : 'down'}"></i> ${Math.abs(d.cpuTrend).toFixed(1)}% <span>vs 上次刷新</span>`;
  }
  const memTrendEl = document.getElementById('z-mem-trend');
  if (memTrendEl) {
    memTrendEl.className = 'dash-card-trend ' + (d.memTrend >= 0 ? 'up' : 'down');
    memTrendEl.innerHTML = `<i class="fas fa-arrow-${d.memTrend >= 0 ? 'up' : 'down'}"></i> ${Math.abs(d.memTrend).toFixed(1)}% <span>vs 上次刷新</span>`;
  }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setBar(id, pct, color) { const el = document.getElementById(id); if (el) { el.style.width = pct + '%'; el.style.background = color; } }
function formatUptime(seconds) { const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60); return d + '天 ' + h + '小时 ' + m + '分钟'; }