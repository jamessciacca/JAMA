const express = require('express');
const storage = require('../storage');
const { checkHostReachable } = require('../utils/health');

const router = express.Router();

router.get('/', async (req, res) => {
  const devices = await storage.getDevices();
  res.json(devices);
});

router.post('/', async (req, res) => {
  const { name, ip, type, location } = req.body;
  if (!name || !ip) {
    return res.status(400).json({ error: 'Device name and IP address are required.' });
  }

  const newDevice = await storage.addDevice({ name, ip, type: type || 'generic', location: location || 'unknown' });
  res.status(201).json(newDevice);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, ip, type, location } = req.body;
  const device = await storage.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  const updated = await storage.updateDevice(id, { name, ip, type, location });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const device = await storage.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  await storage.removeDevice(id);
  res.status(204).send();
});

router.post('/:id/check', async (req, res) => {
  const { id } = req.params;
  const device = await storage.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  const payload = await checkHostReachable(device.ip);
  const updated = await storage.updateDevice(id, {
    status: payload.ok ? 'online' : 'offline',
    lastCheckedAt: payload.checkedAt,
  });

  res.json({ ...updated, health: payload });
});

module.exports = router;
