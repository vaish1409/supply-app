const ICONS = {
  Food: `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="var(--gold-bright)" stroke-width="1.6"><circle cx="32" cy="32" r="20"/><path d="M20 32a12 12 0 0 1 24 0"/><path d="M32 12v6M18 18l4 4M46 18l-4 4"/></svg>`,
  Apparel: `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="var(--gold-bright)" stroke-width="1.6"><path d="M24 10 14 18v10h6v26h24V28h6V18L40 10a8 8 0 0 1-16 0Z"/></svg>`,
  Gear: `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="var(--gold-bright)" stroke-width="1.6"><rect x="14" y="24" width="36" height="26" rx="2"/><path d="M22 24v-6a10 10 0 0 1 20 0v6"/></svg>`,
  Equipment: `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="var(--gold-bright)" stroke-width="1.6"><rect x="12" y="14" width="40" height="36" rx="2"/><path d="M20 24h24M20 32h24M20 40h14"/></svg>`,
};

let products = [];
let cart = {}; // product_id -> { product, headcount, qty }
let activeCategory = 'All';

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function money(n) { return '₹ ' + Math.round(n).toLocaleString('en-IN'); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Load catalog ---------- */
async function loadProducts() {
  try { products = await api('/products'); } catch (e) { products = []; showToast('Could not load catalog — is the server running?'); }
}

function renderChips() {
  const cats = ['All', ...new Set(products.map(p => p.category))];
  document.getElementById('chips').innerHTML = cats.map(c =>
    `<button class="chip ${c === activeCategory ? 'active' : ''}" onclick="setCategory('${c}')">${c}</button>`
  ).join('');
}
function setCategory(c) { activeCategory = c; renderChips(); renderProducts(); }

function computeQty(product, headcount) {
  let qty = Math.ceil(headcount * product.per_person * 100) / 100;
  if (qty < product.min_qty) qty = product.min_qty;
  return qty;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const list = activeCategory === 'All' ? products : products.filter(p => p.category === activeCategory);
  document.getElementById('emptyState').style.display = products.length ? 'none' : 'block';
  grid.innerHTML = list.map(p => `
    <div class="card reveal in">
      <div class="card-media">
        <div class="card-cat">${p.category.toUpperCase()}</div>
        ${p.image_path ? `<img src="${p.image_path}" alt="${escapeHtml(p.name)}">` : (ICONS[p.category] || ICONS.Equipment)}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="card-price">₹${p.price} / ${p.unit} &middot; ${p.per_person} ${p.unit} per person</div>
        <div class="field-row">
          <label>Personnel</label>
          <input type="number" min="0" class="qty-input" placeholder="e.g. 100" id="hc-${p.id}" oninput="previewQty(${p.id})">
        </div>
        <div class="preview-line" id="preview-${p.id}"></div>
        <button class="btn btn-gold btn-block" onclick="addToCart(${p.id})">Add to manifest</button>
      </div>
    </div>`).join('');
}

function previewQty(id) {
  const p = products.find(x => x.id === id);
  const hc = parseFloat(document.getElementById('hc-' + id).value) || 0;
  const el = document.getElementById('preview-' + id);
  if (hc <= 0) { el.textContent = ''; return; }
  const qty = computeQty(p, hc);
  const total = qty * p.price;
  el.innerHTML = `≈ ${qty} ${p.unit} &middot; ${money(total)}${qty === p.min_qty && hc * p.per_person < p.min_qty ? ' (min order)' : ''}`;
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  const input = document.getElementById('hc-' + id);
  const hc = parseFloat(input.value) || 0;
  if (hc <= 0) { showToast('Enter a personnel count first'); return; }
  cart[id] = { product: p, headcount: hc, qty: computeQty(p, hc) };
  renderCart();
  showToast(`Added ${p.name} to manifest`);
}
function removeFromCart(id) { delete cart[id]; renderCart(); }
function cartTotal() { return Object.values(cart).reduce((s, c) => s + c.qty * c.product.price, 0); }

function renderCart() {
  const items = Object.entries(cart);
  document.getElementById('cartCount').textContent = items.length;
  document.getElementById('cartItemCount').textContent = items.length;
  document.getElementById('cartTotal').textContent = money(cartTotal());
  const wrap = document.getElementById('cartItems');
  wrap.innerHTML = items.length === 0
    ? `<div style="text-align:center; color:var(--muted); margin-top:40px; font-size:14px;">Manifest is empty.</div>`
    : items.map(([id, c]) => `
      <div class="cart-item">
        <div class="cart-item-top">
          <div style="font-weight:600; font-size:14.5px;">${escapeHtml(c.product.name)}</div>
          <span class="cart-item-remove" onclick="removeFromCart(${id})">Remove</span>
        </div>
        <div class="cart-meta">${c.headcount} people &middot; ${c.qty} ${c.product.unit}</div>
        <div class="cart-line-total">${money(c.qty * c.product.price)}</div>
      </div>`).join('');
}

function toggleCart(open) {
  document.getElementById('drawer').classList.toggle('open', open);
  document.getElementById('scrim').classList.toggle('open', open);
}

/* ---------- Hero scale slider ---------- */
function updateScale() {
  const slider = document.getElementById('scaleSlider');
  const hc = parseInt(slider.value, 10);
  slider.style.setProperty('--fill', ((hc - 1) / 9999 * 100) + '%');
  document.getElementById('scaleNumber').textContent = hc.toLocaleString('en-IN');
  const rice = Math.round(hc * 0.25);
  const caps = hc;
  const kits = Math.round(hc * 0.1);
  document.getElementById('scaleRice').textContent = rice.toLocaleString('en-IN') + ' kg';
  document.getElementById('scaleCaps').textContent = caps.toLocaleString('en-IN') + ' units';
  document.getElementById('scaleKits').textContent = kits.toLocaleString('en-IN') + ' kits';
  const total = rice * 60 + caps * 180 + kits * 890;
  document.getElementById('scaleTotal').textContent = money(total);
}

/* ---------- Checkout flow ---------- */
function openCheckout() {
  if (Object.keys(cart).length === 0) { showToast('Add items to the manifest first'); return; }
  document.getElementById('checkoutScrim').classList.add('open');
  goStep(1);
}
function closeCheckout() { document.getElementById('checkoutScrim').classList.remove('open'); }

function goStep(n) {
  [1, 2, 3, 4].forEach(i => document.getElementById('step' + i).style.display = (i === n ? 'block' : 'none'));
  [1, 2, 3].forEach(i => { const d = document.getElementById('dot' + i); if (d) d.classList.toggle('active', i <= n); });
  const labels = { 1: 'STEP 1 OF 3 — DELIVERY', 2: 'STEP 2 OF 3 — PAYMENT', 3: 'STEP 3 OF 3 — REVIEW' };
  if (labels[n]) document.getElementById('stepLabel').textContent = labels[n];
  if (n === 3) {
    document.getElementById('reviewItems').innerHTML = Object.values(cart).map(c =>
      `<div class="review-item"><span>${escapeHtml(c.product.name)} × ${c.qty}${c.product.unit}</span><span>${money(c.qty * c.product.price)}</span></div>`
    ).join('');
    document.getElementById('reviewTotal').textContent = money(cartTotal());
  }
}

function validateStep1() {
  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const addr = document.getElementById('deliveryAddr').value.trim();
  const err = document.getElementById('step1Error');
  if (!name || !phone || !addr) { err.textContent = 'Contact name, phone, and address are required.'; return; }
  err.textContent = '';
  goStep(2);
}

function collectOrderPayload() {
  return {
    org_name: document.getElementById('orgName').value,
    contact_name: document.getElementById('contactName').value,
    phone: document.getElementById('contactPhone').value,
    address: document.getElementById('deliveryAddr').value,
    delivery_date: document.getElementById('deliveryDate').value,
    gstin: document.getElementById('gstin').value,
    instructions: document.getElementById('specialInstr').value,
    payment_method: document.querySelector('input[name=pay]:checked').value,
    items: Object.entries(cart).map(([id, c]) => ({ product_id: parseInt(id, 10), headcount: c.headcount })),
  };
}

async function submitOrder() {
  const btn = document.getElementById('confirmBtn');
  const errEl = document.getElementById('step3Error');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Placing order…';
  try {
    const payload = collectOrderPayload();
    const order = await api('/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    if (payload.payment_method === 'online') {
      await payOnline(order);
    } else {
      finishOrder(order.requisition_no);
    }
  } catch (e) {
    errEl.textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Confirm order';
  }
}

function finishOrder(reqNo) {
  document.getElementById('confirmOrderId').textContent = reqNo;
  goStep(4);
  cart = {};
  renderCart();
}

async function payOnline(order) {
  const errEl = document.getElementById('step3Error');
  let session;
  try {
    session = await api('/orders/payments/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requisition_no: order.requisition_no }) });
  } catch (e) {
    errEl.textContent = e.message + ' — order saved as pending; you can still complete payment on delivery.';
    finishOrder(order.requisition_no);
    return;
  }
  await loadRazorpayScript();
  const rzp = new Razorpay({
    key: session.key_id,
    amount: session.amount,
    currency: session.currency,
    order_id: session.razorpay_order_id,
    name: 'Bulk & Institutional Supply',
    description: 'Requisition ' + order.requisition_no,
    handler: async function (response) {
      try {
        await api('/orders/payments/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requisition_no: order.requisition_no, ...response }),
        });
        finishOrder(order.requisition_no);
      } catch (e) {
        errEl.textContent = 'Payment succeeded but verification failed — contact support with order ' + order.requisition_no;
      }
    },
    theme: { color: '#D4A537' },
  });
  rzp.open();
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
}

/* ---------- Scroll reveal ---------- */
function initReveal() {
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

(async function init() {
  document.getElementById('year').textContent = new Date().getFullYear();
  updateScale();
  await loadProducts();
  renderChips();
  renderProducts();
  renderCart();
  initReveal();
})();
