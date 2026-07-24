const express = require('express');
const Docker = require('dockerode');
const router = express.Router();

let docker;
try {
  docker = new Docker();
} catch (e) {
  docker = null;
}

function ensureDocker(req, res, next) {
  if (!docker) {
    return res.status(500).json({ error: 'Docker 未运行或未安装' });
  }
  next();
}

router.use(ensureDocker);

router.get('/info', async (req, res) => {
  try {
    const [info, containers, images] = await Promise.all([
      docker.info(),
      docker.listContainers({ all: true }),
      docker.listImages()
    ]);
    const running = containers.filter(c => c.State === 'running').length;
    const stopped = containers.filter(c => c.State !== 'running').length;
    res.json({
      containersTotal: containers.length,
      containersRunning: running,
      containersStopped: stopped,
      imagesTotal: images.length,
      version: info.ServerVersion,
      os: info.OperatingSystem,
      arch: info.Architecture,
      cpuCores: info.NCPU,
      memory: info.MemTotal,
      name: info.Name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/containers', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    res.json(containers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/start', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/stop', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/restart', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/remove', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.remove({ force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/containers/:id/logs', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({ stdout: true, stderr: true, tail: 200 });
    res.json({ logs: logs.toString('utf-8') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/containers/:id/inspect', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const data = await container.inspect();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/containers/:id/details', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const [inspect, stats] = await Promise.all([
      container.inspect(),
      container.stats({ stream: false })
    ]);
    const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
    const cpuCount = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
    res.json({
      mounts: inspect.Mounts || [],
      cpu: systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0,
      memory: stats.memory_stats?.usage || 0,
      memoryLimit: stats.memory_stats?.limit || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/containers/:id/stats', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const stats = await container.stats({ stream: false });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/images', async (req, res) => {
  try {
    const images = await docker.listImages({ all: true });
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/images/remove/:id', async (req, res) => {
  try {
    const image = docker.getImage(req.params.id);
    await image.remove();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/images/pull', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '镜像名不能为空' });
  try {
    const stream = await docker.pull(name);
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/containers/create', async (req, res) => {
  const { image, name, cmd, ports, env, volumes, restartPolicy } = req.body;
  if (!image) return res.status(400).json({ error: '镜像名不能为空' });
  try {
    const createOptions = {
      Image: image,
      name: name || undefined,
      Cmd: cmd || undefined,
      Env: env || undefined,
      ExposedPorts: {},
      HostConfig: {
        PortBindings: {},
        Binds: volumes || undefined,
        RestartPolicy: restartPolicy ? { Name: restartPolicy } : undefined
      }
    };
    if (ports) {
      for (const [host, container] of Object.entries(ports)) {
        createOptions.ExposedPorts[container + '/tcp'] = {};
        createOptions.HostConfig.PortBindings[container + '/tcp'] = [{ HostPort: host }];
      }
    }
    const container = await docker.createContainer(createOptions);
    await container.start();
    res.json({ success: true, id: container.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/prune/containers', async (req, res) => {
  try {
    const result = await docker.pruneContainers();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/prune/images', async (req, res) => {
  try {
    const result = await docker.pruneImages();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/prune/volumes', async (req, res) => {
  try {
    const result = await docker.pruneVolumes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/networks', async (req, res) => {
  try {
    const networks = await docker.listNetworks();
    res.json(networks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/volumes', async (req, res) => {
  try {
    const volumes = await docker.listVolumes();
    res.json(volumes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
