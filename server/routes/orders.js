const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function generateRequisitionNo() {
  const stamp = Date.now().toString().slice(-8);
  return `REQ-${stamp}`;
}

function recalcAndValidate(items) {
  // Re-derive prices server-side from the current catalog so a client can't submit fake totals.
  let total = 0;
  const resolved = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product) throw new Error(`Item ${item.product_id} no longer exists in the catalog.`);
    let qty = Math.ceil((item.headcount * product.per_person) * 100) / 100;
    if (qty < product.min_qty) qty = product.min_qty;
    const lineTotal = Math.round(qty * product.price * 100) / 100;
    total += lineTotal;
    resolved.push({ product_id: product.id, name: product.name, headcount: item.headcount, qty, unit: product.unit, price: product.price, lineTotal });
  }
  return { items: resolved, total: Math.round(total * 100) / 100 };
}

// Public: submit an order (COD / advance). Online payment uses the /payments routes below.
router.post('/', (req, res) => {
  try {
    const { org_name, contact_name, phone, address, delivery_date, gstin, instructions, payment_method, items } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'Order has no items.' });
    if (!contact_name || !phone || !address) return res.status(400).json({ error: 'Contact name, phone, and address are required.' });

    const { items: resolvedItems, total } = recalcAndValidate(items);
    const requisition_no = generateRequisitionNo();

    db.prepare(`INSERT INTO orders (requisition_no, org_name, contact_name, phone, address, delivery_date, gstin, instructions, payment_method, payment_status, items_json, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(requisition_no, org_name || '', contact_name, phone, address, delivery_date || '', gstin || '', instructions || '',
        payment_method || 'cod', payment_method === 'online' ? 'pending' : 'not_required', JSON.stringify(resolvedItems), total);

    res.status(201).json({ requisition_no, total, items: resolvedItems });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Public: create a Razorpay order for online payment (call before showing the Razorpay checkout widget).
router.post('/payments/create', (req, res) => {
  if (!razorpay) return res.status(503).json({ error: 'Online payment is not configured yet. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to .env.' });
  const { requisition_no } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE requisition_no = ?').get(requisition_no);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  razorpay.orders.create({
    amount: Math.round(order.total * 100), // paise
    currency: 'INR',
    receipt: order.requisition_no,
  }).then((rpOrder) => {
    db.prepare('UPDATE orders SET razorpay_order_id = ? WHERE id = ?').run(rpOrder.id, order.id);
    res.json({ razorpay_order_id: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, key_id: process.env.RAZORPAY_KEY_ID });
  }).catch((e) => res.status(500).json({ error: e.message }));
});

// Public: verify payment signature after Razorpay checkout completes client-side.
router.post('/payments/verify', (req, res) => {
  const { requisition_no, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed.' });
  }
  db.prepare('UPDATE orders SET payment_status = ? WHERE requisition_no = ?').run('paid', requisition_no);
  res.json({ ok: true });
});

// Admin: list all orders
router.get('/', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(rows.map((r) => ({ ...r, items: JSON.parse(r.items_json) })));
});

// Admin: update order status (e.g. mark dispatched / delivered)
router.patch('/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required.' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
