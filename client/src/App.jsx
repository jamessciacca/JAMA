import { useState } from 'react';
import { checkSiteHealth } from './services/api';
import jamaLogo from './assets/jama-logo.png';
import './App.css';

const metricHelp = {
  healthScore: {
    title: 'Health Score',
    explanation:
      'This is a simple overall score for the site based on uptime and response speed. Higher scores usually mean the site is both reachable and reasonably fast.',
  },
  averageSpeed: {
    title: 'Average Speed',
    explanation:
      'Average speed is the average response time across the probe samples in this scan. Lower numbers usually mean users get a faster first experience.',
  },
  uptime: {
    title: 'Uptime',
    explanation:
      'Uptime shows how many scan probes succeeded. A value below 100% means some requests failed or timed out during this check.',
  },
  jitter: {
    title: 'Jitter',
    explanation:
      'Jitter measures how much the response time changed between the fastest and slowest sample. Lower jitter usually means more consistent performance.',
  },
  host: {
    title: 'Host',
    explanation:
      'The host is the domain name that was checked, such as example.com. It identifies the target server or service you are testing.',
  },
  httpStatus: {
    title: 'HTTP Status',
    explanation:
      'HTTP status is the code returned by the website, like 200 for success or 503 for service unavailable. It helps show whether the request succeeded and how the server responded.',
  },
  ipAddress: {
    title: 'IP Address',
    explanation:
      'This is the resolved network address for the domain. It shows which server or edge endpoint the hostname currently points to.',
  },
  protocol: {
    title: 'Protocol',
    explanation:
      'Protocol shows whether the site was checked over HTTP or HTTPS. HTTPS means the connection uses encryption.',
  },
  finalUrl: {
    title: 'Final URL',
    explanation:
      'The final URL is where the request ended after following redirects. It helps show whether the site forwards traffic to another page or domain.',
  },
  cdnEdge: {
    title: 'CDN / Edge',
    explanation:
      'This is a best-effort guess at which content delivery network or edge platform is serving the site. CDNs can improve speed by placing content closer to users.',
  },
  responseTrend: {
    title: 'Response Trend',
    explanation:
      'This chart shows the response time for each probe in the current scan. It helps you see whether the site stayed steady or became slower during testing.',
  },
  speedBreakdown: {
    title: 'Speed Breakdown',
    explanation:
      'This is an estimated split of where request time is spent, such as DNS, TLS, server processing, and transfer. It is useful as a teaching aid rather than a packet-level measurement.',
  },
  dns: {
    title: 'DNS',
    explanation:
      'DNS is the system that translates a domain name into network addresses and related records. If DNS is wrong or slow, users may fail to reach the site before the page even loads.',
  },
  tls: {
    title: 'TLS Certificate Health',
    explanation:
      'TLS is the security layer behind HTTPS. Certificate details help show who issued the certificate, when it expires, and whether secure connections should still be trusted.',
  },
  headers: {
    title: 'Headers',
    explanation:
      'Headers are small pieces of metadata returned with the response. They often reveal the server software, caching behavior, content type, and other useful diagnostics.',
  },
  routing: {
    title: 'Redirect Chain',
    explanation:
      'A redirect chain shows each hop from the original URL to the final destination. Too many redirects can slow users down and sometimes point to configuration problems.',
  },
  history: {
    title: 'Recent Checks',
    explanation:
      'Recent checks show how the latest scans compared with each other. This helps you spot whether a slowdown was just one bad sample or part of a pattern.',
  },
};

function formatTime(value) {
  return `${Math.round(value)} ms`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Unavailable';
  }

  return String(value);
}

function formatDate(value) {
  if (!value) {
    return 'Unknown time';
  }

  return new Date(value).toLocaleString();
}

function formatRecordList(values, formatter = (value) => value) {
  if (!values?.length) {
    return 'Unavailable';
  }

  return values.map(formatter).join(', ');
}

function buildLinePath(points, width, height) {
  if (!points.length) {
    return '';
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const stepX = points.length === 1 ? width / 2 : width / (points.length - 1);

  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - (point.value / maxValue) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function LearnMoreButton({ topic, onOpen }) {
  return (
    <button
      type="button"
      className="learn-more-button"
      onClick={() => onOpen(metricHelp[topic])}
      aria-label={`Learn more about ${metricHelp[topic].title}`}
    >
      Learn more
    </button>
  );
}

function MetricLabel({ label, topic, onOpen }) {
  return (
    <span className="metric-label">
      <span>{label}</span>
      <LearnMoreButton topic={topic} onOpen={onOpen} />
    </span>
  );
}

function LearnMoreModal({ content, onClose }) {
  if (!content) {
    return null;
  }

  return (
    <div className="learn-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="learn-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learn-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="learn-modal-header">
          <div>
            <span className="section-kicker">Learn More</span>
            <h3 id="learn-modal-title">{content.title}</h3>
          </div>
          <button type="button" className="learn-close-button" onClick={onClose} aria-label="Close help">
            Close
          </button>
        </div>
        <p>{content.explanation}</p>
      </div>
    </div>
  );
}

function LineChart({ data, formatter, onOpen }) {
  const width = 320;
  const height = 120;
  const points = data.map((item) => ({ label: item.label, value: item.responseTime || 0 }));
  const path = buildLinePath(points, width, height);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const stepX = points.length === 1 ? width / 2 : width / Math.max(points.length - 1, 1);

  return (
    <div className="chart-card">
      <div className="chart-heading">
        <div className="metric-heading">
          <h3>Response Trend</h3>
          <LearnMoreButton topic="responseTrend" onOpen={onOpen} />
        </div>
        <span>{formatter(maxValue)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="line-chart" role="img" aria-label="Site speed trend">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            y1={height * ratio}
            x2={width}
            y2={height * ratio}
            className="chart-grid"
          />
        ))}
        <path d={path} className="chart-line" />
        {points.map((point, index) => {
          const x = index * stepX;
          const y = height - (point.value / maxValue) * height;
          return (
            <g key={point.label}>
              <circle cx={x} cy={y} r="4.5" className="chart-point" />
              <text x={x} y={height + 18} textAnchor="middle" className="chart-label">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarChart({ data, onOpen }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="chart-card">
      <div className="chart-heading">
        <div className="metric-heading">
          <h3>Speed Breakdown</h3>
          <LearnMoreButton topic="speedBreakdown" onOpen={onOpen} />
        </div>
        <span>Estimated request phases</span>
      </div>
      <div className="bars">
        {data.map((item) => (
          <div key={item.label} className="bar-row">
            <div className="bar-meta">
              <strong>{item.label}</strong>
              <span>{formatTime(item.value)}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ kicker, title, topic, onOpen }) {
  return (
    <div>
      <span className="section-kicker">{kicker}</span>
      <div className="metric-heading">
        <h3>{title}</h3>
        <LearnMoreButton topic={topic} onOpen={onOpen} />
      </div>
    </div>
  );
}

function App() {
  const [siteUrl, setSiteUrl] = useState('');
  const [siteResult, setSiteResult] = useState(null);
  const [message, setMessage] = useState('Search a website to map speed, uptime, and service health.');
  const [isChecking, setIsChecking] = useState(false);
  const [helpContent, setHelpContent] = useState(null);

  const handleSiteCheck = async () => {
    if (!siteUrl.trim()) {
      setMessage('Enter a website URL or domain first.');
      return;
    }

    setIsChecking(true);
    setMessage(`Running telemetry for ${siteUrl.trim()}...`);

    try {
      const result = await checkSiteHealth(siteUrl);
      setSiteResult(result);
      setSiteUrl('');
      setMessage(`Telemetry finished for ${result.host}.`);
    } catch (error) {
      setSiteResult(null);
      setMessage(error.message);
    } finally {
      setIsChecking(false);
    }
  };

  const summaryCards = siteResult
    ? [
        { label: 'Health Score', value: `${siteResult.score}/100`, tone: 'primary', topic: 'healthScore' },
        { label: 'Average Speed', value: formatTime(siteResult.averageResponseTime), tone: 'neutral', topic: 'averageSpeed' },
        { label: 'Uptime', value: `${siteResult.uptimePercentage}%`, tone: 'neutral', topic: 'uptime' },
        { label: 'Jitter', value: formatTime(siteResult.jitter), tone: 'neutral', topic: 'jitter' },
      ]
    : [];

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="hero-card">
        <div className="hero-copy">
          <div className="brand-lockup">
            <img src={jamaLogo} alt="JAMA logo" className="brand-logo" />
          </div>
          <h1>Dark telemetry for website speed, health, and diagnostics.</h1>
          <p>
            Search any website to inspect live speed samples, availability trends, request-phase charts,
            DNS lookups, TLS health, headers, and redirect paths.
          </p>
        </div>

        <div className={`search-card ${isChecking ? 'is-scanning' : ''}`}>
          <label htmlFor="site-search">Website target</label>
          <div className="search-row">
            <input
              id="site-search"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="example.com"
            />
            <button onClick={handleSiteCheck} disabled={isChecking}>
              {isChecking ? 'Scanning...' : 'Run scan'}
            </button>
          </div>
          <p className="status-copy">{message}</p>
        </div>
      </header>

      <main className="dashboard-grid dashboard-grid-single">
        <section className="panel panel-wide">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Live Search Telemetry</span>
              <h2>Performance command center</h2>
            </div>
            {siteResult && (
              <span className={`performance-pill ${siteResult.performance.tone}`}>
                {siteResult.performance.label}
              </span>
            )}
          </div>

          {siteResult ? (
            <>
              <div className="stat-grid">
                {summaryCards.map((card, index) => (
                  <article
                    key={card.label}
                    className={`stat-card ${card.tone}`}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <MetricLabel label={card.label} topic={card.topic} onOpen={setHelpContent} />
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </div>

              <div className="site-meta">
                <div>
                  <MetricLabel label="Host" topic="host" onOpen={setHelpContent} />
                  <strong>{siteResult.host}</strong>
                </div>
                <div>
                  <MetricLabel label="HTTP Status" topic="httpStatus" onOpen={setHelpContent} />
                  <strong>{siteResult.status}</strong>
                </div>
                <div>
                  <MetricLabel label="IP Address" topic="ipAddress" onOpen={setHelpContent} />
                  <strong>{siteResult.address}</strong>
                </div>
                <div>
                  <MetricLabel label="Protocol" topic="protocol" onOpen={setHelpContent} />
                  <strong>{siteResult.protocol}</strong>
                </div>
                <div>
                  <MetricLabel label="Final URL" topic="finalUrl" onOpen={setHelpContent} />
                  <strong>{siteResult.finalUrl}</strong>
                </div>
                <div>
                  <MetricLabel label="CDN / Edge" topic="cdnEdge" onOpen={setHelpContent} />
                  <strong>{siteResult.diagnostics.cdnProvider}</strong>
                </div>
              </div>

              <p className="panel-summary">{siteResult.performance.summary}</p>

              <div className="chart-grid">
                <LineChart data={siteResult.samples} formatter={formatTime} onOpen={setHelpContent} />
                <BarChart data={siteResult.speedBreakdown} onOpen={setHelpContent} />
              </div>

              <div className="diagnostics-grid">
                <div className="history-card">
                  <div className="panel-header compact">
                    <SectionTitle kicker="DNS" title="Name resolution" topic="dns" onOpen={setHelpContent} />
                  </div>
                  <div className="diagnostic-list">
                    <div>
                      <span>A</span>
                      <strong>{formatRecordList(siteResult.diagnostics.dns.a)}</strong>
                    </div>
                    <div>
                      <span>AAAA</span>
                      <strong>{formatRecordList(siteResult.diagnostics.dns.aaaa)}</strong>
                    </div>
                    <div>
                      <span>CNAME</span>
                      <strong>{formatRecordList(siteResult.diagnostics.dns.cname)}</strong>
                    </div>
                    <div>
                      <span>MX</span>
                      <strong>
                        {formatRecordList(
                          siteResult.diagnostics.dns.mx,
                          (record) => `${record.exchange} (${record.priority})`
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="history-card">
                  <div className="panel-header compact">
                    <SectionTitle kicker="TLS" title="Certificate health" topic="tls" onOpen={setHelpContent} />
                  </div>
                  <div className="diagnostic-list">
                    <div>
                      <span>Issuer</span>
                      <strong>{formatValue(siteResult.diagnostics.tlsCertificate.issuer)}</strong>
                    </div>
                    <div>
                      <span>Subject</span>
                      <strong>{formatValue(siteResult.diagnostics.tlsCertificate.subject)}</strong>
                    </div>
                    <div>
                      <span>Expires</span>
                      <strong>{formatDate(siteResult.diagnostics.tlsCertificate.validTo)}</strong>
                    </div>
                    <div>
                      <span>Days left</span>
                      <strong>
                        {siteResult.diagnostics.tlsCertificate.available
                          ? `${siteResult.diagnostics.tlsCertificate.daysRemaining} days`
                          : formatValue(siteResult.diagnostics.tlsCertificate.error)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="history-card">
                  <div className="panel-header compact">
                    <SectionTitle kicker="Headers" title="Edge response" topic="headers" onOpen={setHelpContent} />
                  </div>
                  <div className="diagnostic-list">
                    <div>
                      <span>Server</span>
                      <strong>{formatValue(siteResult.diagnostics.headers.server)}</strong>
                    </div>
                    <div>
                      <span>Content-Type</span>
                      <strong>{formatValue(siteResult.diagnostics.headers.contentType)}</strong>
                    </div>
                    <div>
                      <span>Cache</span>
                      <strong>{formatValue(siteResult.diagnostics.headers.cacheStatus)}</strong>
                    </div>
                    <div>
                      <span>Length</span>
                      <strong>{formatValue(siteResult.diagnostics.headers.contentLength)}</strong>
                    </div>
                  </div>
                </div>

                <div className="history-card">
                  <div className="panel-header compact">
                    <SectionTitle kicker="Routing" title="Redirect chain" topic="routing" onOpen={setHelpContent} />
                  </div>
                  <div className="redirect-list">
                    {siteResult.diagnostics.redirectTrace.length ? (
                      siteResult.diagnostics.redirectTrace.map((hop, index) => (
                        <div key={`${hop.url}-${index}`} className="redirect-item">
                          <span>{hop.status}</span>
                          <strong>{hop.url}</strong>
                          <p>{hop.location || 'Final destination'}</p>
                        </div>
                      ))
                    ) : (
                      <div className="redirect-item">
                        <span>200</span>
                        <strong>{siteResult.finalUrl}</strong>
                        <p>No redirects detected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="history-card">
                <div className="panel-header compact">
                  <SectionTitle kicker="Recent Checks" title="Stability history" topic="history" onOpen={setHelpContent} />
                </div>
                <div className="history-row">
                  {(siteResult.history.length ? siteResult.history : siteResult.samples).map((entry) => (
                    <div key={`${entry.label}-${entry.checkedAt}`} className={`history-chip ${entry.ok ? 'up' : 'down'}`}>
                      <span>{entry.label}</span>
                      <strong>{formatTime(entry.responseTime)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No site scanned yet</h3>
              <p>Run a search to unlock the dark dashboard, charts, and diagnostics.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p className="footer-signoff">
          Created by James Sciacca.
          {' '}
          <a href="https://www.jamessciacca.com" target="_blank" rel="noreferrer">
            www.jamessciacca.com
          </a>
        </p>
      </footer>

      <LearnMoreModal content={helpContent} onClose={() => setHelpContent(null)} />
    </div>
  );
}

export default App;
