import { useState } from 'react';
import { checkSiteHealth } from '../services/api';

export default function WebsiteChecker() {
  const [siteUrl, setSiteUrl] = useState('');
  const [siteResult, setSiteResult] = useState(null);
  const [message, setMessage] = useState('Enter a website to check availability.');

  const handleSiteCheck = async () => {
    if (!siteUrl) {
      setMessage('Please enter a website URL first.');
      return;
    }

    try {
      const result = await checkSiteHealth(siteUrl);
      setSiteResult(result);
      setMessage(`Health check finished for ${result.url}.`);
    } catch (error) {
      setSiteResult(null);
      setMessage(error.message);
    }
  };

  return (
    <section className="checker-card">
      <div className="checker-header">
        <h1>Website Health Checker</h1>
        <p>Test a website and see availability, status code, and response time in one place.</p>
      </div>

      <div className="health-card">
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="Enter URL or domain, e.g. google.com"
        />
        <button onClick={handleSiteCheck}>Check health</button>
      </div>

      {siteResult && (
        <div className="result-card">
          <div><strong>URL:</strong> {siteResult.url}</div>
          <div><strong>Status:</strong> {siteResult.ok ? 'Reachable ✅' : 'Unavailable ❌'}</div>
          <div><strong>HTTP status:</strong> {siteResult.status}</div>
          <div><strong>Latency:</strong> {siteResult.responseTime} ms</div>
          <div><strong>Checked at:</strong> {siteResult.checkedAt}</div>
        </div>
      )}

      <p className="message-bar">{message}</p>
    </section>
  );
}
