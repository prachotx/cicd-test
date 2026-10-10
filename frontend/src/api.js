const BASE = '/api/items';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const getItems = () => request(BASE);
export const createItem = (item) => request(BASE, { method: 'POST', body: JSON.stringify(item) });
export const updateItem = (id, item) => request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(item) });
export const deleteItem = (id) => request(`${BASE}/${id}`, { method: 'DELETE' });
