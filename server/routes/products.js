const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only jpg, png, or webp images are allowed.'), ok);
  },
});

// Public: list catalog
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(rows);
});

// Admin: create product
router.post('/', requireAdmin, upload.single('image'), (req, res) => {
  const { name, category, description, price, unit, per_person, min_qty } = req.body;
  if (!name || !category || !price || !unit || !per_person) {
    return res.status(400).json({ error: 'name, category, price, unit, and per_person are required.' });
  }
  const image_path = req.file ? `/uploads/${req.file.filename}` : '';
  const result = db.prepare(`INSERT INTO products (name, category, description, price, unit, per_person, min_qty, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, category, description || '', parseFloat(price), unit, parseFloat(per_person), parseFloat(min_qty) || 1, image_path);
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Admin: update product
router.put('/:id', requireAdmin, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found.' });

  const { name, category, description, price, unit, per_person, min_qty } = req.body;
  const image_path = req.file ? `/uploads/${req.file.filename}` : existing.image_path;

  db.prepare(`UPDATE products SET name=?, category=?, description=?, price=?, unit=?, per_person=?, min_qty=?, image_path=? WHERE id=?`)
    .run(
      name ?? existing.name,
      category ?? existing.category,
      description ?? existing.description,
      price !== undefined ? parseFloat(price) : existing.price,
      unit ?? existing.unit,
      per_person !== undefined ? parseFloat(per_person) : existing.per_person,
      min_qty !== undefined ? parseFloat(min_qty) : existing.min_qty,
      image_path,
      req.params.id
    );

  if (req.file && existing.image_path) {
    const oldFile = path.join(uploadDir, path.basename(existing.image_path));
    fs.unlink(oldFile, () => {});
  }

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

// Admin: delete product
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (existing.image_path) {
    fs.unlink(path.join(uploadDir, path.basename(existing.image_path)), () => {});
  }
  res.json({ ok: true });
});

module.exports = router;
