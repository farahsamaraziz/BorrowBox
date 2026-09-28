import axios from 'axios';

const TOKEN_KEY = 'borrowbox_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: send the stored JWT as a Bearer token on every call.
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: hand callers the response body, and turn any failure into
// an ApiClientError whose message is the API's own error text.
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    let message = data?.error;
    if (Array.isArray(data?.details) && data.details.length > 0) {
      // "Validation failed." is not helpful on its own; show what was actually wrong.
      message = data.details.map((d) => d.message).join(' ');
    }
    if (!message) {
      message = error.response
        ? `Request failed with status ${status}`
        : 'Cannot reach the server. Is the API running?';
    }

    // A stored token the server no longer accepts (expired, user removed): drop it
    // so the app falls back to the logged-out state.
    if (status === 401 && getToken()) {
      setToken(null);
      window.dispatchEvent(new Event('auth:expired'));
    }

    return Promise.reject(new ApiClientError(message, status, data?.details));
  }
);

// Query-string values that are empty are left out so URLs stay clean.
const clean = (params) =>
  params && Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const api = {
  get: (path, params) => http.get(path, { params: clean(params) }),
  post: (path, body) => http.post(path, body),
  put: (path, body) => http.put(path, body),
  patch: (path, body) => http.patch(path, body),
  del: (path) => http.delete(path),
};
