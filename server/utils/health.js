const AbortController = globalThis.AbortController;

async function checkHostReachable(target, timeout = 7000) {
  const url = target.startsWith('http://') || target.startsWith('https://')
    ? target
    : `http://${target}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return {
      ok: response.ok,
      status: response.status,
      checkedAt: new Date().toISOString(),
      responseTime: null,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 'DOWN',
      checkedAt: new Date().toISOString(),
      responseTime: null,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
    };
  }
}

module.exports = { checkHostReachable };
