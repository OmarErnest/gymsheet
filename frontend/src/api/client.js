const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export function getToken() {
  return localStorage.getItem('gym_access');
}

export function setTokens(payload) {
  localStorage.setItem('gym_access', payload.access);
  localStorage.setItem('gym_refresh', payload.refresh);
  localStorage.setItem('gym_user', JSON.stringify(payload.user));
}

export function clearTokens() {
  localStorage.removeItem('gym_access');
  localStorage.removeItem('gym_refresh');
  localStorage.removeItem('gym_user');
}

function extractError(data) {
  if (!data) return 'Request failed';
  if (typeof data === 'string') {
    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
      return 'Server Error (500). Please contact admin.';
    }
    return data;
  }
  if (data.detail) {
    if (typeof data.detail === 'string' && (data.detail.trim().startsWith('<!DOCTYPE') || data.detail.trim().startsWith('<html'))) {
      return 'Server Error (500). Please contact admin.';
    }
    return data.detail;
  }
  if (data.message) return data.message;
  // DRF validation errors: { field: ["msg1", "msg2"], non_field_errors: ["..."] }
  const msgs = [];
  for (const [key, val] of Object.entries(data)) {
    const text = Array.isArray(val) ? val.join(', ') : String(val);
    msgs.push(key === 'non_field_errors' ? text : `${key}: ${text}`);
  }
  return msgs.join(' · ') || 'Request failed';
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    throw new Error(extractError(data));
  }
  return data;
}

export async function publicApi(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || JSON.stringify(data));
  }
  return data;
}
