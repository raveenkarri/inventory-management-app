const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const dbPromise = require('./db');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use(
  cors({
    origin: ['http://localhost:3000', 'https://inventory-management-app-nine-kappa.vercel.app/'],
    credentials: false
  })
);


const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.get('/api/products', async (req, res) => {
  try {
    const db = await dbPromise;
    const { search, category, sort = 'name', order = 'asc' } = req.query;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('name LIKE ?');
      params.push(`%${search}%`);
    }
    if (category && category !== 'All') {
      conditions.push('category = ?');
      params.push(category);
    }
    let sql = 'SELECT * FROM products';
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    const allowedSort = ['name', 'category', 'brand', 'stock'];
    const sortField = allowedSort.includes(sort) ? sort : 'name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${sortField} ${sortOrder}`;
    const products = await db.all(sql, params);
    res.json({ products });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/categories', async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""');
    const categories = rows.map(r => r.category);
    res.json({ categories });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post(
  '/api/products',
  [
    body('name').notEmpty(),
    body('stock').isInt({ min: 0 }).toInt()
  ],
  async (req, res) => {
    try {
      const db = await dbPromise;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, unit, category, brand, stock, status, image } = req.body;
      const existing = await db.get('SELECT id FROM products WHERE name = ?', [name]);
      if (existing) {
        return res.status(400).json({ error: 'Product name must be unique' });
      }
      const result = await db.run(
        'INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, unit || '', category || '', brand || '', stock || 0, status || '', image || '']
      );
      const product = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
      res.status(201).json({ product });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

app.put(
  '/api/products/:id',
  [
    body('name').notEmpty(),
    body('stock').isInt({ min: 0 }).toInt()
  ],
  async (req, res) => {
    try {
      const db = await dbPromise;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { id } = req.params;
      const { name, unit, category, brand, stock, status, image, userInfo } = req.body;
      const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const nameOwner = await db.get('SELECT id FROM products WHERE name = ? AND id != ?', [name, id]);
      if (nameOwner) {
        return res.status(400).json({ error: 'Product name must be unique' });
      }
      if (product.stock !== stock) {
        await db.run(
          'INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_date, user_info) VALUES (?, ?, ?, ?, ?)',
          [id, product.stock, stock, new Date().toISOString(), userInfo || 'system']
        );
      }
      await db.run(
        'UPDATE products SET name = ?, unit = ?, category = ?, brand = ?, stock = ?, status = ?, image = ? WHERE id = ?',
        [name, unit || '', category || '', brand || '', stock || 0, status || '', image || '', id]
      );
      const updated = await db.get('SELECT * FROM products WHERE id = ?', [id]);
      res.json({ product: updated });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

app.delete('/api/products/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const { id } = req.params;
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await db.run('DELETE FROM inventory_history WHERE product_id = ?', [id]);
    await db.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.get('/api/products/:id/history', async (req, res) => {
  try {
    const db = await dbPromise;
    const { id } = req.params;
    const history = await db.all(
      'SELECT * FROM inventory_history WHERE product_id = ? ORDER BY change_date DESC',
      [id]
    );
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/api/products/import', upload.single('file'), async (req, res) => {
  try {
    const db = await dbPromise;
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    const filePath = req.file.path;
    let added = 0;
    let skipped = 0;
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data => {
        rows.push(data);
      })
      .on('end', async () => {
        for (const row of rows) {
          const name = row.name;
          if (!name) {
            skipped += 1;
            continue;
          }
          const existing = await db.get('SELECT id FROM products WHERE name = ?', [name]);
          if (existing) {
            skipped += 1;
            continue;
          }
          const unit = row.unit || '';
          const category = row.category || '';
          const brand = row.brand || '';
          const stock = row.stock ? parseInt(row.stock, 10) || 0 : 0;
          const status = row.status || '';
          const image = row.image || '';
          await db.run(
            'INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, unit, category, brand, stock, status, image]
          );
          added += 1;
        }
        fs.unlinkSync(filePath);
        res.json({ added, skipped });
      });
  } catch (e) {
    res.status(500).json({ error: 'Failed to import products' });
  }
});

app.get('/api/products/export', async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT * FROM products');
    let csvStr = 'id,name,unit,category,brand,stock,status,image\n';
    for (const row of rows) {
      const values = [
        row.id,
        row.name || '',
        row.unit || '',
        row.category || '',
        row.brand || '',
        row.stock != null ? row.stock : '',
        row.status || '',
        row.image || ''
      ]
        .map(v => {
          const s = String(v);
          if (s.includes(',') || s.includes('"')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(',');
      csvStr += values + '\n';
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.status(200).send(csvStr);
  } catch (e) {
    res.status(500).json({ error: 'Failed to export products' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
