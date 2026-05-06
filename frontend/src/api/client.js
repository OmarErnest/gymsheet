const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

const OFFLINE_QUEUE_KEY = 'gym_offline_queue';

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function syncOfflineData() {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const item of queue) {
    try {
      await api(item.path, {
        method: item.method,
        body: item.body,
        _isSync: true, // Internal flag to avoid recursive queueing
      });
    } catch (err) {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
  window.dispatchEvent(new CustomEvent('queue-updated', { detail: remaining.length }));
  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'finished' }));
}

const CACHE_KEY_PREFIX = 'gym_cache_';

export async function api(path, options = {}) {
  const token = getToken();
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // For GET, try network, fallback to cache if failure
  if (method === 'GET') {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      });
      let data = null;
      const text = await response.text();
      if (text) {
        try { data = JSON.parse(text); } catch { data = { detail: text }; }
      }
      if (response.ok) {
        localStorage.setItem(CACHE_KEY_PREFIX + path, JSON.stringify(data));
        return data;
      }
      throw new Error(extractError(data));
    } catch (err) {
      const cached = localStorage.getItem(CACHE_KEY_PREFIX + path);
      if (cached) {
        console.warn("Using offline cache for", path);
        return JSON.parse(cached);
      }
      throw err;
    }
  }

  // For mutations (POST/PUT/PATCH/DELETE)
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    let data = null;
    const text = await response.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { detail: text }; }
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearTokens();
        // Discard the queue on 401 because the requests are invalid with an expired token
        saveQueue([]);
        window.location.href = '/'; // Force redirect to login
        return { _error: 'Session expired' };
      }
      throw new Error(extractError(data));
    }
    return data;
  } catch (err) {
    // ONLY queue mutations if it's a network failure (fetch throws TypeError)
    // and NOT an HTTP error (which we throw above)
    const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch' || err.name === 'TypeError';

    if (isNetworkError && method !== 'GET' && !options._isSync) {
      const queue = getQueue();
      queue.push({ path, method, body: options.body, timestamp: Date.now() });
      saveQueue(queue);
      window.dispatchEvent(new CustomEvent('queue-updated', { detail: queue.length }));
      console.warn("Offline: Request queued due to network error", path);
      return { _queued: true };
    }
    throw err;
  }
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
