const express = require('express');
const si = require('systeminformation');
const os = require('os');
const router = express.Router();

let systemCache = null;
let cacheUpdating = false;

async function updateSystemCache() {
  if (cacheUpdating) return;
  cacheUpdating = true;
  try {
    const [cpu, mem, disks, osInfo, network, currentLoad, processes] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.networkStats(),
      si.currentLoad(),
      si.processes()
    ]);
    systemCache = {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        load: currentLoad.currentLoad,
        loadUser: currentLoad.currentLoadUser,
        loadSystem: currentLoad.currentLoadSystem
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        usedPercent: ((mem.used / mem.total) * 100).toFixed(1)
      },
      disks: disks
        .filter(d => {
          const virtTypes = ['tmpfs','devtmpfs','overlay','squashfs','proc','sysfs','cgroup','cgroup2','devpts','pstore','bpf','securityfs','hugetlbfs','mqueue','autofs','debugfs','tracefs','ramfs','configfs','fusectl','efivarfs','binfmt_misc','sunrpc','none'];
          const virtMounts = ['/snap/','/var/lib/docker/','/var/lib/lxd/','/dev/','/sys/','/proc/','/run/'];
          if (virtTypes.includes(d.type?.toLowerCase()) || virtMounts.some(m => d.mount?.startsWith(m))) return false;
          if (d.size <= 0) return false;
          return true;
        })
        .map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        mount: d.mount,
        usePercent: d.use
      })),
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptime: os.uptime()
      },
      network: network.map(n => ({
        iface: n.iface,
        operstate: n.operstate,
        rxSec: n.rx_sec,
        txSec: n.tx_sec,
        speed: n.speed
      })),
      processes: {
        all: processes.all,
        running: processes.running,
        blocked: processes.blocked,
        list: processes.list.slice(0, 20)
      },
      loadAverage: os.loadavg ? os.loadavg() : [0, 0, 0],
      _cachedAt: Date.now()
    };
  } catch (e) {
    console.error('系统信息缓存更新失败:', e.message);
  } finally {
    cacheUpdating = false;
  }
}

updateSystemCache();
setInterval(updateSystemCache, 5000);

router.get('/info', async (req, res) => {
  if (!systemCache) {
    res.status(503).json({ error: '系统信息初始化中...' });
    return;
  }
  res.json(systemCache);
});

router.get('/processes', async (req, res) => {
  try {
    const data = await si.processes();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/process/kill', async (req, res) => {
  const { pid } = req.body;
  if (!pid) return res.status(400).json({ error: 'PID不能为空' });
  try {
    process.kill(pid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/diskio', async (req, res) => {
  try {
    const data = await si.disksIO();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/network', async (req, res) => {
  try {
    const data = await si.networkStats();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/services', async (req, res) => {
  try {
    const data = await si.services('*');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;