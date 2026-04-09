const express = require('express');
const cors = require('cors');
const dns = require('node:dns').promises;
const tls = require('node:tls');

const deviceRoutes = require('./routes/devices');
const networkRoutes = require('./routes/networks');

const app = express();
const PORT = process.env.PORT || 5001;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

const recentChecks = [];
const outageEvents = [];
const outageCache = {
  data: null,
  fetchedAt: 0,
};

const MONITORED_SERVICES = [
  {
    name: 'OpenAI',
    host: 'status.openai.com',
    type: 'summary',
    url: 'https://status.openai.com/api/v2/summary.json',
  },
  {
    name: 'GitHub',
    host: 'www.githubstatus.com',
    type: 'incidents',
    url: 'https://www.githubstatus.com/api/v2/incidents/unresolved.json',
  },
  {
    name: 'Cloudflare',
    host: 'www.cloudflarestatus.com',
    type: 'incidents',
    url: 'https://www.cloudflarestatus.com/api/v2/incidents/unresolved.json',
  },
  {
    name: 'Discord',
    host: 'discordstatus.com',
    type: 'incidents',
    url: 'https://discordstatus.com/api/v2/incidents/unresolved.json',
  },
  {
    name: 'Vercel',
    host: 'www.vercel-status.com',
    type: 'incidents',
    url: 'https://www.vercel-status.com/api/v2/incidents/unresolved.json',
  },
];

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'JAMA API',
    status: 'ok',
    message: 'API is running. Use /api/check-site to scan a website.',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

function normalizeUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    throw new Error('URL is required');
  }

  const withProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;

  return new URL(withProtocol);
}

async function fetchJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function runProbe(targetUrl, timeout = 8000) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    let response = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
    }

    clearTimeout(timer);
    const responseTime = Date.now() - startedAt;

    return {
      ok: response.ok,
      status: response.status,
      responseTime,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 'DOWN',
      responseTime: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      error: error.name === 'AbortError' ? 'Request timed out' : error.message,
    };
  }
}

async function traceRedirects(startUrl, limit = 5) {
  const hops = [];
  let currentUrl = startUrl;

  for (let index = 0; index < limit; index += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });

      const location = response.headers.get('location');
      hops.push({
        url: currentUrl,
        status: response.status,
        location: location ? new URL(location, currentUrl).toString() : null,
      });

      clearTimeout(timer);

      if (!location || response.status < 300 || response.status >= 400) {
        return {
          finalUrl: currentUrl,
          hops,
        };
      }

      currentUrl = new URL(location, currentUrl).toString();
    } catch (error) {
      clearTimeout(timer);
      hops.push({
        url: currentUrl,
        status: 'ERROR',
        location: null,
        error: error.name === 'AbortError' ? 'Request timed out' : error.message,
      });
      return {
        finalUrl: currentUrl,
        hops,
      };
    }
  }

  return {
    finalUrl: currentUrl,
    hops,
  };
}

async function fetchResponseDetails(targetUrl, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    const headers = Object.fromEntries(response.headers.entries());
    return {
      finalUrl: response.url,
      headers,
      status: response.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function collectDnsDiagnostics(host) {
  const [a, aaaa, cname, mx, ns] = await Promise.allSettled([
    dns.resolve4(host),
    dns.resolve6(host),
    dns.resolveCname(host),
    dns.resolveMx(host),
    dns.resolveNs(host),
  ]);

  return {
    a: a.status === 'fulfilled' ? a.value : [],
    aaaa: aaaa.status === 'fulfilled' ? aaaa.value : [],
    cname: cname.status === 'fulfilled' ? cname.value : [],
    mx: mx.status === 'fulfilled' ? mx.value : [],
    ns: ns.status === 'fulfilled' ? ns.value : [],
  };
}

function getIssuerName(issuer) {
  if (!issuer) {
    return 'Unavailable';
  }

  return issuer.O || issuer.CN || Object.values(issuer)[0] || 'Unavailable';
}

async function collectTlsCertificate(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000,
      },
      () => {
        const certificate = socket.getPeerCertificate();
        socket.end();

        if (!certificate || !certificate.valid_to) {
          resolve({
            available: false,
            error: 'Certificate details unavailable',
          });
          return;
        }

        const validTo = new Date(certificate.valid_to);
        const validFrom = new Date(certificate.valid_from);
        const daysRemaining = Math.ceil((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        resolve({
          available: true,
          issuer: getIssuerName(certificate.issuer),
          subject: certificate.subject?.CN || hostname,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining,
          expired: daysRemaining < 0,
        });
      }
    );

    socket.on('error', (error) => {
      resolve({
        available: false,
        error: error.message,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        available: false,
        error: 'TLS connection timed out',
      });
    });
  });
}

function detectCdn(host, headers, dnsDiagnostics) {
  const values = [
    host,
    headers.server,
    headers.via,
    headers['x-cache'],
    headers['cf-ray'],
    ...(dnsDiagnostics.cname || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (values.includes('cloudflare') || headers['cf-ray']) {
    return 'Cloudflare';
  }
  if (values.includes('fastly')) {
    return 'Fastly';
  }
  if (values.includes('akamai')) {
    return 'Akamai';
  }
  if (values.includes('vercel')) {
    return 'Vercel Edge';
  }
  if (values.includes('amazon') || values.includes('cloudfront')) {
    return 'CloudFront';
  }
  if (values.includes('netlify')) {
    return 'Netlify';
  }
  return 'Unknown';
}

function summarizeHeaderDiagnostics(headers) {
  return {
    server: headers.server || 'Unavailable',
    cacheControl: headers['cache-control'] || 'Unavailable',
    contentType: headers['content-type'] || 'Unavailable',
    contentLength: headers['content-length'] || 'Unavailable',
    poweredBy: headers['x-powered-by'] || 'Unavailable',
    cacheStatus: headers['cf-cache-status'] || headers['x-cache'] || 'Unavailable',
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildSpeedBreakdown(avgLatency) {
  const safeLatency = Math.max(avgLatency, 60);
  return [
    { label: 'DNS', value: round(safeLatency * 0.12) },
    { label: 'TLS', value: round(safeLatency * 0.18) },
    { label: 'Server', value: round(safeLatency * 0.46) },
    { label: 'Transfer', value: round(safeLatency * 0.24) },
  ];
}

function classifyPerformance(avgLatency, uptime) {
  if (uptime < 60) {
    return {
      tone: 'critical',
      label: 'Degraded',
      summary: 'Recurring failures suggest an active outage or serious instability.',
    };
  }

  if (avgLatency <= 250 && uptime >= 95) {
    return {
      tone: 'good',
      label: 'Fast',
      summary: 'The site is responding quickly with healthy availability.',
    };
  }

  if (avgLatency <= 700 && uptime >= 80) {
    return {
      tone: 'watch',
      label: 'Watch',
      summary: 'The site is reachable, but latency or intermittent failures need attention.',
    };
  }

  return {
    tone: 'critical',
    label: 'Slow',
    summary: 'The site is responding slowly or inconsistently and may impact users.',
  };
}

function recordCheck(result) {
  recentChecks.unshift(result);
  if (recentChecks.length > 40) {
    recentChecks.length = 40;
  }

  if (!result.ok) {
    outageEvents.unshift({
      id: `local-${result.host}-${Date.now()}`,
      host: result.host,
      service: result.host,
      title: `Site check failed for ${result.host}`,
      summary: result.error || 'Availability check failed',
      status: result.status,
      error: result.error || 'Availability check failed',
      startedAt: result.checkedAt,
      responseTime: result.responseTime,
      severity: result.responseTime > 5000 ? 'high' : 'medium',
      sourceType: 'local',
      sourceLabel: 'Local monitor',
      sourceUrl: result.url,
    });
  }

  const cutoff = Date.now() - 1000 * 60 * 60 * 6;
  while (
    outageEvents.length &&
    new Date(outageEvents[outageEvents.length - 1].startedAt).getTime() < cutoff
  ) {
    outageEvents.pop();
  }
}

function getLocalOutages() {
  const latestByHost = new Map();

  for (const outage of outageEvents) {
    if (!latestByHost.has(outage.host)) {
      latestByHost.set(outage.host, outage);
    }
  }

  return [...latestByHost.values()].slice(0, 6);
}

function normalizeSeverity(impact) {
  const level = String(impact || '').toLowerCase();
  if (level.includes('critical') || level.includes('major')) {
    return 'high';
  }
  if (level.includes('minor')) {
    return 'low';
  }
  return 'medium';
}

async function fetchServiceIncidents(service) {
  const payload = await fetchJson(service.url);

  if (service.type === 'summary') {
    const indicator = payload?.status?.indicator || 'none';
    if (indicator === 'none') {
      return [];
    }

    return [
      {
        id: `summary-${service.name.toLowerCase()}`,
        host: service.host,
        service: service.name,
        title: payload?.status?.description || `${service.name} status issue`,
        summary: `${service.name} reports ${payload?.status?.description || 'service disruption'}.`,
        status: String(indicator).toUpperCase(),
        error: payload?.status?.description || 'Reported service issue',
        startedAt: payload?.page?.updated_at || new Date().toISOString(),
        responseTime: 0,
        severity: normalizeSeverity(indicator),
        sourceType: 'status',
        sourceLabel: 'Official status page',
        sourceUrl: payload?.page?.url || `https://${service.host}`,
      },
    ];
  }

  const incidents = Array.isArray(payload?.incidents) ? payload.incidents : [];
  return incidents.map((incident) => ({
    id: `${service.name}-${incident.id}`,
    host: service.host,
    service: service.name,
    title: incident.name || `${service.name} incident`,
    summary: incident.incident_updates?.[0]?.body || incident.status || 'Active incident reported',
    status: String(incident.status || 'investigating').toUpperCase(),
    error: incident.name || 'Active incident reported',
    startedAt: incident.created_at || new Date().toISOString(),
    responseTime: 0,
    severity: normalizeSeverity(incident.impact),
    sourceType: 'status',
    sourceLabel: 'Official status page',
    sourceUrl: incident.shortlink || payload?.page?.url || `https://${service.host}`,
  }));
}

async function fetchOfficialOutages() {
  const results = await Promise.allSettled(
    MONITORED_SERVICES.map((service) => fetchServiceIncidents(service))
  );

  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

async function fetchOutageNews(services) {
  if (!GNEWS_API_KEY) {
    return [];
  }

  const serviceTerms = services.map((service) => service.name).join(' OR ');
  const query = encodeURIComponent(`(${serviceTerms}) AND (outage OR downtime OR incident)`);
  const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6&apikey=${GNEWS_API_KEY}`;

  try {
    const payload = await fetchJson(url);
    const articles = Array.isArray(payload?.articles) ? payload.articles : [];

    return articles.map((article, index) => ({
      id: `news-${index}-${article.publishedAt || Date.now()}`,
      title: article.title,
      description: article.description || article.content || 'News article related to a service outage.',
      url: article.url,
      source: article.source?.name || 'News',
      publishedAt: article.publishedAt,
      image: article.image || null,
    }));
  } catch (error) {
    return [];
  }
}

async function buildHybridOutages() {
  const now = Date.now();
  if (outageCache.data && now - outageCache.fetchedAt < 1000 * 60 * 5) {
    return outageCache.data;
  }

  const [officialOutages, news] = await Promise.all([
    fetchOfficialOutages(),
    fetchOutageNews(MONITORED_SERVICES),
  ]);

  const mergedOutages = [...officialOutages, ...getLocalOutages()]
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, 10);

  const data = {
    checkedAt: new Date().toISOString(),
    total: mergedOutages.length,
    outages: mergedOutages,
    news,
    providers: {
      officialStatusPages: MONITORED_SERVICES.map((service) => ({
        name: service.name,
        type: service.type,
        url: service.url,
      })),
      news: GNEWS_API_KEY ? 'GNews' : 'disabled',
      strategy: 'hybrid',
    },
  };

  outageCache.data = data;
  outageCache.fetchedAt = now;
  return data;
}

app.use('/api/devices', deviceRoutes);
app.use('/api/networks', networkRoutes);

app.get('/api/check-site', async (req, res) => {
  const { url } = req.query;

  try {
    const parsedUrl = normalizeUrl(url);
    const host = parsedUrl.hostname;
    const [redirectTraceResult, responseDetailsResult, dnsDiagnosticsResult, tlsCertificateResult] =
      await Promise.allSettled([
        traceRedirects(parsedUrl.toString()),
        fetchResponseDetails(parsedUrl.toString()),
        collectDnsDiagnostics(host),
        parsedUrl.protocol === 'https:'
          ? collectTlsCertificate(host)
          : Promise.resolve({
              available: false,
              error: 'TLS certificate only applies to HTTPS targets',
            }),
      ]);

    const redirectTrace = redirectTraceResult.status === 'fulfilled'
      ? redirectTraceResult.value
      : { finalUrl: parsedUrl.toString(), hops: [] };
    const responseDetails = responseDetailsResult.status === 'fulfilled'
      ? responseDetailsResult.value
      : { finalUrl: parsedUrl.toString(), headers: {}, status: null };
    const dnsDiagnostics = dnsDiagnosticsResult.status === 'fulfilled'
      ? dnsDiagnosticsResult.value
      : { a: [], aaaa: [], cname: [], mx: [], ns: [] };
    const tlsCertificate = tlsCertificateResult.status === 'fulfilled'
      ? tlsCertificateResult.value
      : { available: false, error: 'TLS inspection failed' };
    const samples = [];

    for (let index = 0; index < 6; index += 1) {
      const probe = await runProbe(parsedUrl.toString());
      samples.push({
        index: index + 1,
        label: `P${index + 1}`,
        responseTime: probe.responseTime,
        ok: probe.ok,
        status: probe.status,
        checkedAt: probe.checkedAt,
        error: probe.error,
      });
    }

    const latencyValues = samples.map((sample) => sample.responseTime);
    const successfulSamples = samples.filter((sample) => sample.ok).length;
    const avgLatency = round(average(latencyValues));
    const minLatency = Math.min(...latencyValues);
    const maxLatency = Math.max(...latencyValues);
    const jitter = round(maxLatency - minLatency);
    const uptimePercentage = round((successfulSamples / samples.length) * 100);
    const score = Math.max(1, Math.min(100, Math.round(uptimePercentage - avgLatency / 18 + 18)));
    const performance = classifyPerformance(avgLatency, uptimePercentage);

    let address = 'Unavailable';
    try {
      const dnsLookup = await dns.lookup(host);
      address = dnsLookup.address;
    } catch (error) {
      address = 'DNS lookup failed';
    }

    const lastSample = samples[samples.length - 1];
    const headerDiagnostics = summarizeHeaderDiagnostics(responseDetails.headers);
    const cdnProvider = detectCdn(host, responseDetails.headers, dnsDiagnostics);
    const result = {
      url: parsedUrl.toString(),
      host,
      ok: successfulSamples > 0,
      status: lastSample.status,
      responseTime: lastSample.responseTime,
      checkedAt: lastSample.checkedAt,
      error: lastSample.error,
      samples,
      averageResponseTime: avgLatency,
      minResponseTime: minLatency,
      maxResponseTime: maxLatency,
      jitter,
      uptimePercentage,
      score,
      address,
      protocol: parsedUrl.protocol.replace(':', '').toUpperCase(),
      finalUrl: responseDetails.finalUrl,
      performance,
      speedBreakdown: buildSpeedBreakdown(avgLatency),
      diagnostics: {
        dns: dnsDiagnostics,
        redirectTrace: redirectTrace.hops,
        headers: headerDiagnostics,
        cdnProvider,
        tlsCertificate,
      },
      history: recentChecks
        .filter((entry) => entry.host === host)
        .slice(0, 8)
        .map((entry, index) => ({
          label: `H${index + 1}`,
          responseTime: entry.responseTime,
          ok: entry.ok,
          checkedAt: entry.checkedAt,
        })),
    };

    recordCheck(result);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'URL is required' });
  }
});

app.get('/api/outages', async (req, res) => {
  try {
    const payload = await buildHybridOutages();
    res.json(payload);
  } catch (error) {
    res.json({
      checkedAt: new Date().toISOString(),
      total: getLocalOutages().length,
      outages: getLocalOutages(),
      news: [],
      providers: {
        officialStatusPages: MONITORED_SERVICES.map((service) => service.name),
        news: GNEWS_API_KEY ? 'GNews' : 'disabled',
        strategy: 'hybrid-fallback-local',
      },
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
