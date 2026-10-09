import { useEffect, useState } from 'react';
import { getItems, createItem, updateItem, deleteItem, getHealth } from './api';

const emptyForm = { name: '', description: '', price: '' };

export default function App() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('');

  const load = async () => {
    try {
      setItems(await getItems());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getHealth()
      .then((h) => setVersion(h.version))
      .catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, price: Number(form.price) || 0 };
    try {
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        await createItem(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name, description: item.description || '', price: item.price });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    if (!confirm('ต้องการลบรายการนี้ใช่ไหม?')) return;
    try {
      await deleteItem(id);
      if (editingId === id) handleCancel();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">📦 Items CRUD</h1>

      {error && (
        <div className="mb-4 rounded bg-red-100 text-red-700 px-4 py-2">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-700">
          {editingId ? `แก้ไขรายการ #${editingId}` : 'เพิ่มรายการใหม่'}
        </h2>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="ชื่อ"
          required
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="รายละเอียด"
          rows="2"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          name="price"
          type="number"
          step="0.01"
          value={form.price}
          onChange={handleChange}
          placeholder="ราคา"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            {editingId ? 'บันทึก' : 'เพิ่ม'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-4 text-gray-500">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-gray-500">ยังไม่มีข้อมูล</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">ชื่อ</th>
                <th className="px-4 py-2">รายละเอียด</th>
                <th className="px-4 py-2 text-right">ราคา</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2 text-gray-500">{item.id}</td>
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-gray-600">{item.description}</td>
                  <td className="px-4 py-2 text-right">{Number(item.price).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">
                      แก้ไข
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {version && <p className="mt-4 text-center text-xs text-gray-400">version {version}</p>}
    </div>
  );
}
