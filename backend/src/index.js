const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// READ all
app.get('/api/items', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// READ one
app.get('/api/items/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE
app.post('/api/items', async (req, res) => {
  const { name, description = '', price = 0 } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO items (name, description, price) VALUES (?, ?, ?)',
      [name, description, price]
    );
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE
app.put('/api/items/:id', async (req, res) => {
  const { name, description = '', price = 0 } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const [result] = await pool.query(
      'UPDATE items SET name = ?, description = ?, price = ? WHERE id = ?',
      [name, description, price, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE
app.delete('/api/items/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
