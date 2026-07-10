let token = null;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(n) { return '₹ ' + Math.round(n).toLocaleString('en-IN'); }

async function api(path, opts = {}) {
  opts.headers = Object.assign({}, opts.headers, token ? { Authorization: 'Bearer ' + token } : {});
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) { logout(); throw new Error('Session expired — please log in again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function setSession(t) {
  token = t;
  sessionStorage_set(t);
}
// Keeps the admin logged in across a page refresh. sessionStorage clears when the browser tab closes.
function sessionStorage_set(t) {
  try { window.sessionStorage.setItem('admin_token', t); } catch (e) { /* storage unavailable */ }
}
function sessionStorage_get() {
  try { return window.sessionStorage.getItem('admin_token'); } catch (e) { return null; }
}

async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  try {
    const res = await api('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    setSession(res.token);
    enterDashboard();
  } catch (e) {
    err.textContent = e.message;
  }
}
function logout() {
  token = null;
  try { window.sessionStorage.removeItem('admin_token'); } catch (e) {}
  document.getElementById('loginPanel').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
}

function enterDashboard() {
  document.getElementById('loginPanel').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'inline-flex';
  loadCatalog();
  loadOrders();
}

function showTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
}

/* ---------- Catalog ---------- */
async function loadCatalog() {
  try {
    const products = await api('/products');
    document.getElementById('catalogCount').textContent = products.length;
    document.getElementById('catalogList').innerHTML = products.map(p => `
      <div class="list-row">
        <div>${escapeHtml(p.name)} <span class="meta">— ${p.category} · ₹${p.price}/${p.unit} · ${p.per_person}/person</span></div>
        <span class="del" onclick="deleteProduct(${p.id})">Remove</span>
      </div>`).join('') || `<div style="color:var(--muted); font-size:14px;">No items yet.</div>`;
  } catch (e) { showToast(e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('productError');
    const btn = document.getElementById('productSubmitBtn');
    errEl.textContent = '';
    const fd = new FormData();
    fd.append('name', document.getElementById('pName').value);
    fd.append('category', document.getElementById('pCategory').value);
    fd.append('description', document.getElementById('pDescription').value);
    fd.append('price', document.getElementById('pPrice').value);
    fd.append('unit', document.getElementById('pUnit').value);
    fd.append('per_person', document.getElementById('pPerPerson').value);
    fd.append('min_qty', document.getElementById('pMinQty').value || '1');
    const file = document.getElementById('pImage').files[0];
    if (file) fd.append('image', file);

    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await api('/products', { method: 'POST', body: fd });
      document.getElementById('productForm').reset();
      showToast('Item added to catalog');
      loadCatalog();
    } catch (e2) {
      errEl.textContent = e2.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Add to catalog';
    }
  });

  const saved = sessionStorage_get();
  if (saved) { token = saved; enterDashboard(); }
});

async function deleteProduct(id) {
  if (!confirm('Remove this item from the catalog?')) return;
  try { await api('/products/' + id, { method: 'DELETE' }); showToast('Removed'); loadCatalog(); }
  catch (e) { showToast(e.message); }
}

/* ---------- Orders ---------- */
async function loadOrders() {
  try {
    const orders = await api('/orders');
    document.getElementById('orderCount').textContent = orders.length;
    document.getElementById('orderList').innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-top">
          <div><strong>${o.requisition_no}</strong> — ${escapeHtml(o.org_name || o.contact_name)}</div>
          <div>${money(o.total)}</div>
        </div>
        <div class="order-items">
          ${o.items.map(i => `${escapeHtml(i.name)} × ${i.qty}${i.unit} (${i.headcount} people) — ${money(i.lineTotal)}`).join('<br>')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <span class="meta">${o.payment_method.toUpperCase()} · ${o.payment_status} · ${new Date(o.created_at).toLocaleString()}</span>
          <select class="status-select" onchange="updateStatus(${o.id}, this.value)">
            ${['received', 'confirmed', 'dispatched', 'delivered'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>`).join('') || `<div style="color:var(--muted); font-size:14px;">No orders yet.</div>`;
  } catch (e) { showToast(e.message); }
}

async function updateStatus(id, status) {
  try { await api(`/orders/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); showToast('Status updated'); }
  catch (e) { showToast(e.message); }
}
