const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

async function parseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'API request failed');
  }
  return data;
}

export async function checkSiteHealth(url) {
  const response = await fetch(`${API_URL}/check-site?url=${encodeURIComponent(url)}`);
  return parseJson(response);
}
