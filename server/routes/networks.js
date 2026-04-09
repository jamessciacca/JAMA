const express = require('express');
const storage = require('../storage');
const { checkHostReachable } = require('../utils/health');

const router = express.Router();

router.get('/', async (req, res) => {
  const networks = await storage.getNetworks();
  res.json(networks);
});

router.get('/status', async (req, res) => {
  const networks = await storage.getNetworks();
  const summary = networks.map((network) => ({
    id: network.id,
    name: network.name,
    gateway: network.gateway,
    status: network.status,
    lastCheckedAt: network.lastCheckedAt,
  }));
  res.json({ total: networks.length, networks: summary });
});

router.post('/', async (req, res) => {
  const { name, cidr, gateway } = req.body;
  if (!name || !cidr) {
    return res.status(400).json({ error: 'Network name and CIDR are required.' });
  }

  const newNetwork = await storage.addNetwork({
    name,
    cidr,
    gateway: gateway || '',
  });

  res.status(201).json(newNetwork);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cidr, gateway } = req.body;
  const network = await storage.getNetworkById(id);
  if (!network) {
    return res.status(404).json({ error: 'Network not found.' });
  }

  const updated = await storage.updateNetwork(id, { name, cidr, gateway });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const network = await storage.getNetworkById(id);
  if (!network) {
    return res.status(404).json({ error: 'Network not found.' });
  }

  await storage.removeNetwork(id);
  res.status(204).send();
});

router.post('/:id/check', async (req, res) => {
  const { id } = req.params;
  const network = await storage.getNetworkById(id);
  if (!network) {
    return res.status(404).json({ error: 'Network not found.' });
  }

  const target = network.gateway || network.cidr;
  const payload = target ? await checkHostReachable(target) : { ok: false, status: 'NO_GATEWAY', checkedAt: new Date().toISOString() };
  const updated = await storage.updateNetwork(id, {
    status: payload.ok ? 'online' : 'offline',
    lastCheckedAt: payload.checkedAt,
  });

  res.json({ ...updated, health: payload });
});

module.exports = router;
