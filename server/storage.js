const fs = require('fs');
const path = require('path');

const storePath = path.resolve(__dirname, 'data.json');

function ensureStore() {
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ devices: [], networks: [] }, null, 2));
  }
}

async function readStore() {
  ensureStore();
  const raw = await fs.promises.readFile(storePath, 'utf8');
  return raw ? JSON.parse(raw) : { devices: [], networks: [] };
}

async function writeStore(data) {
  await fs.promises.writeFile(storePath, JSON.stringify(data, null, 2));
}

function buildId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getDevices() {
  const store = await readStore();
  return store.devices || [];
}

async function getNetworks() {
  const store = await readStore();
  return store.networks || [];
}

async function getDeviceById(id) {
  const devices = await getDevices();
  return devices.find((device) => device.id === id);
}

async function getNetworkById(id) {
  const networks = await getNetworks();
  return networks.find((network) => network.id === id);
}

async function addDevice(device) {
  const store = await readStore();
  const newDevice = { id: buildId(), status: 'unknown', lastCheckedAt: null, ...device };
  store.devices = [newDevice, ...(store.devices || [])];
  await writeStore(store);
  return newDevice;
}

async function updateDevice(id, updates) {
  const store = await readStore();
  store.devices = (store.devices || []).map((device) =>
    device.id === id ? { ...device, ...updates } : device
  );
  await writeStore(store);
  return await getDeviceById(id);
}

async function removeDevice(id) {
  const store = await readStore();
  store.devices = (store.devices || []).filter((device) => device.id !== id);
  await writeStore(store);
}

async function addNetwork(network) {
  const store = await readStore();
  const newNetwork = { id: buildId(), status: 'unknown', lastCheckedAt: null, ...network };
  store.networks = [newNetwork, ...(store.networks || [])];
  await writeStore(store);
  return newNetwork;
}

async function updateNetwork(id, updates) {
  const store = await readStore();
  store.networks = (store.networks || []).map((network) =>
    network.id === id ? { ...network, ...updates } : network
  );
  await writeStore(store);
  return await getNetworkById(id);
}

async function removeNetwork(id) {
  const store = await readStore();
  store.networks = (store.networks || []).filter((network) => network.id !== id);
  await writeStore(store);
}

module.exports = {
  getDevices,
  getNetworks,
  getDeviceById,
  getNetworkById,
  addDevice,
  updateDevice,
  removeDevice,
  addNetwork,
  updateNetwork,
  removeNetwork,
};
