const CLERK_KEY = 'pk_test_ZW5nYWdlZC1ncmFja2xlLTkuY2xlcmsuYWNjb3VudHMuZGV2JA';

let clerk = null;
let activeFilter = 'All';
let selectedPlan = 'grove';
let pendingPaymentOpen = false;
let searchQuery = '';
let addCodeModalServiceId = null;

// Cached from API
let servicesData = [];
let currentUser = null;

// ── API HELPERS ──
async function authHeaders() {
  const token = clerk?.session ? await clerk.session.getToken() : null;
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path} → ${res.status}`);
  return res.json();
}

// ── LOAD SERVICES ──
async function loadServices() {
  try {
    servicesData = await apiFetch('/api/services');
    buildFilters();
    renderGrid();
  } catch (err) {
    console.error('loadServices:', err);
  }
}

// ── LOAD USER ──
async function loadUser() {
  if (!clerk?.user) { currentUser = null; return; }
  try {
    const headers = await authHeaders();
    currentUser = await apiFetch('/api/user', { headers });
  } catch (err) {
    console.error('loadUser:', err);
    currentUser = null;
  }
}

// ── STATS ──
async function updateStats() {
  try {
    const stats = await apiFetch('/api/stats');
    document.getElementById('stat-members').textContent = stats.members.toLocaleString();
    document.getElementById('stat-trees').textContent = stats.trees.toLocaleString();
    document.getElementById('stat-services').textContent = stats.services;
    document.getElementById('stat-codes').textContent = stats.codes;
  } catch {
    // non-critical — leave whatever is already displayed
  }
}

// ── DOMAIN / LOGO HELPERS ──
function extractDomain(input) {
  input = input.trim().toLowerCase();
  if (!input) return '';
  try {
    const url = new URL(input.startsWith('http') ? input : 'https://' + input);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^www\./, '').split('/')[0];
  }
}

function nameFromDomain(domain) {
  const base = domain.split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

let logoPreviewTimer = null;
function previewLogo(rawInput, imgId = 'domain-logo-img', previewId = 'domain-logo-preview', nameId = 'domain-detected-name') {
  clearTimeout(logoPreviewTimer);
  const domain = extractDomain(rawInput);
  const preview = document.getElementById(previewId);
  const nameEl = document.getElementById(nameId);

  if (!domain || !domain.includes('.')) {
    if (preview) preview.style.display = 'none';
    if (nameEl) nameEl.textContent = '';
    return;
  }

  logoPreviewTimer = setTimeout(() => {
    const img = document.getElementById(imgId);
    if (!img) return;
    img.src = logoUrl(domain);
    img.onload = () => { if (preview) preview.style.display = 'block'; };
    img.onerror = () => { if (preview) preview.style.display = 'none'; };
    if (nameEl) nameEl.textContent = '✓ ' + nameFromDomain(domain);
  }, 350);
}

function previewModalLogo(rawInput) {
  const domain = extractDomain(rawInput);
  previewLogo(rawInput, 'modal-logo-img', 'modal-logo-preview', null);
  const nameInput = document.getElementById('modal-service-name');
  if (nameInput && !nameInput.dataset.userEdited && domain && domain.includes('.')) {
    nameInput.value = nameFromDomain(domain);
  }
}

// ── UTILS ──
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ── PAYMENT MODAL STEPS ──
function goToPayStep(step) {
  document.querySelectorAll('.pay-step').forEach(el => el.classList.add('hidden'));
  document.getElementById(`pay-step-${step}`).classList.remove('hidden');
}

// ── REFERRAL CARDS ──
function buildCard(svc) {
  const iconHtml = `<img src="${logoUrl(svc.domain)}" alt="${svc.name}" class="service-logo"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
    <span class="service-logo-fallback" style="display:none">${svc.name.slice(0,2).toUpperCase()}</span>`;

  if (!svc.code) {
    return `
      <div class="referral-card" data-category="${svc.category}">
        <div class="card-header">
          <div class="service-icon" style="background:${svc.bg}">${iconHtml}</div>
          <div class="card-meta">
            <h3>${svc.name}</h3>
            <div class="category">${svc.category}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-reward">🎁 ${svc.reward || 'Referral bonus'}</div>
          <div class="code-row">
            <div class="code-box" style="color:var(--earth-400);letter-spacing:0;font-family:inherit;font-size:.85rem">
              No codes yet — be the first!
            </div>
          </div>
        </div>
        <div class="card-footer">
          <div class="contributor-info">0 contributors</div>
          <button class="btn btn-sm btn-primary" onclick="openAddCodeModal('${svc.id}')">Add mine</button>
        </div>
      </div>`;
  }

  return `
    <div class="referral-card" data-category="${svc.category}">
      <div class="card-header">
        <div class="service-icon" style="background:${svc.bg}">${iconHtml}</div>
        <div class="card-meta">
          <h3>${svc.name}</h3>
          <div class="category">${svc.category}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-reward">🎁 ${svc.reward || 'Referral bonus'}</div>
        <div class="code-row">
          <div class="code-box">${svc.code}</div>
          <button class="copy-btn" onclick="copyCode(this, '${svc.code}')">Copy</button>
        </div>
      </div>
      <div class="card-footer">
        <div class="contributor-info">
          By <strong>${svc.contributor}</strong> · ${svc.code_count} contributor${svc.code_count !== 1 ? 's' : ''}
        </div>
        <div class="tree-count">🌳 ${svc.contributor_trees} trees</div>
      </div>
    </div>`;
}

function renderGrid() {
  const grid = document.getElementById('referral-grid');
  const noResults = document.getElementById('no-results');

  const filtered = servicesData.filter(s => {
    if (activeFilter !== 'All' && s.category !== activeFilter) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery) && !s.domain?.includes(searchQuery)) return false;
    return true;
  });

  grid.innerHTML = filtered.map(buildCard).join('');

  if (noResults) {
    if (filtered.length === 0) {
      noResults.classList.remove('hidden');
      const qEl = document.getElementById('no-results-query');
      if (qEl) qEl.textContent = searchQuery || activeFilter;
    } else {
      noResults.classList.add('hidden');
    }
  }
}

// ── COPY ──
function copyCode(btn, code) {
  const finish = () => {
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    showToast('Code copied to clipboard 🌳');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  };
  navigator.clipboard?.writeText(code).then(finish).catch(() => {
    const el = document.createElement('textarea');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    finish();
  });
}

// ── SEARCH ──
function searchServices(query) {
  searchQuery = query.trim().toLowerCase();
  activeFilter = 'All';
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === 'All'));
  renderGrid();
}

// ── FILTERS ──
function buildFilters() {
  const cats = ['All', ...new Set(servicesData.map(s => s.category))];
  const container = document.getElementById('category-filters');
  container.innerHTML = cats.map(cat => `
    <button class="filter-btn ${cat === activeFilter ? 'active' : ''}" onclick="setFilter('${cat}', this)">${cat}</button>
  `).join('');
}

function setFilter(cat, btn) {
  activeFilter = cat;
  searchQuery = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid();
}

// ── NAV ──
function updateNav() {
  const authEl = document.getElementById('nav-auth');
  const user = clerk?.user;

  if (user) {
    const name = user.firstName || user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Member';
    authEl.innerHTML = `
      <span style="color:var(--green-400);font-size:.82rem;font-weight:600">🌳 ${currentUser?.trees || 0}</span>
      <a href="#" style="color:var(--green-100)" onclick="showDashboard(true)">${name}</a>
      <button class="btn btn-outline btn-sm" style="color:var(--green-100);border-color:rgba(255,255,255,.3)" onclick="clerk.signOut()">Sign out</button>
    `;
  } else {
    authEl.innerHTML = `
      <button class="btn btn-outline btn-sm" style="color:var(--green-100);border-color:rgba(255,255,255,.3)" onclick="clerk.openSignIn()">Sign in</button>
      <button class="btn btn-primary btn-sm" onclick="startJoin()">Join $3/mo</button>
    `;
  }
}

// ── JOIN FLOW ──
function startJoin(planId) {
  if (planId) selectedPlan = planId;
  if (!clerk?.user) {
    pendingPaymentOpen = true;
    clerk.openSignUp();
  } else {
    openPaymentModal();
  }
}

function openSignupWithPlan(planId) {
  startJoin(planId);
}

function openPaymentModal() {
  initPlanSelector();
  goToPayStep(1);
  openModal('payment-modal');
}

// ── PLAN SELECTOR ──
function initPlanSelector() {
  const grid = document.getElementById('plan-select-grid');
  grid.innerHTML = PLANS.map(p => `
    <div class="plan-option ${p.id === selectedPlan ? 'selected' : ''}"
         onclick="selectPlan('${p.id}', this)">
      <div class="po-price">$${p.price}/mo</div>
      <div class="po-name">${p.name}</div>
      <div class="po-trees">🌳 ${p.trees} trees</div>
    </div>
  `).join('');
  const plan = PLANS.find(p => p.id === selectedPlan);
  document.getElementById('pay-btn').textContent = `Complete & Start Planting — $${plan.price}/mo`;
}

function selectPlan(id, el) {
  selectedPlan = id;
  document.querySelectorAll('.plan-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  const plan = PLANS.find(p => p.id === id);
  document.getElementById('pay-btn').textContent = `Complete & Start Planting — $${plan.price}/mo`;
}

// ── PAYMENT ──
async function handlePayment(e) {
  e.preventDefault();
  const plan = PLANS.find(p => p.id === selectedPlan);
  const btn = document.getElementById('pay-btn');
  btn.textContent = 'Processing…';
  btn.disabled = true;

  try {
    const headers = await authHeaders();
    await apiFetch('/api/user/plan', {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan: plan.id, trees: plan.trees }),
    });
    await loadUser();
    goToPayStep(2);
    updateNav();
    updateStats();
  } catch (err) {
    console.error('handlePayment:', err);
    showToast('Something went wrong — please try again');
  } finally {
    btn.textContent = `Complete & Start Planting — $${plan.price}/mo`;
    btn.disabled = false;
  }
}

// ── ADD CODE MODAL ──
function openAddCodeModal(serviceId) {
  if (!clerk?.user) {
    pendingPaymentOpen = false;
    clerk.openSignIn();
    showToast('Sign in first to add your referral code!');
    return;
  }

  addCodeModalServiceId = serviceId || null;

  const svc = serviceId ? servicesData.find(s => s.id === serviceId) : null;
  const domainInput = document.getElementById('modal-domain-input');
  const nameInput = document.getElementById('modal-service-name');
  const codeInput = document.getElementById('add-code-input');
  const rewardInput = document.getElementById('modal-reward');

  if (svc) {
    domainInput.value = svc.domain || '';
    nameInput.value = svc.name;
    nameInput.dataset.userEdited = '1';
    rewardInput.value = svc.reward || '';
    previewLogo(svc.domain || '', 'modal-logo-img', 'modal-logo-preview', null);
    const existing = currentUser?.codes?.find(c => c.service_id === serviceId);
    codeInput.value = existing?.code || '';
  } else {
    domainInput.value = '';
    nameInput.value = '';
    nameInput.dataset.userEdited = '';
    rewardInput.value = '';
    codeInput.value = '';
    document.getElementById('modal-logo-preview').style.display = 'none';
  }

  openModal('add-code-modal');
}

async function handleAddCode(e) {
  e.preventDefault();
  const rawDomain = document.getElementById('modal-domain-input').value.trim();
  const domain = extractDomain(rawDomain);
  const name = document.getElementById('modal-service-name').value.trim();
  const code = document.getElementById('add-code-input').value.trim().toUpperCase();
  const reward = document.getElementById('modal-reward').value.trim();

  if (!domain || !name || !code) { showToast('Please fill in the website, name, and code'); return; }

  await addCodeForService({ domain, name, code, reward, serviceId: addCodeModalServiceId });
  closeModal('add-code-modal');
  showToast("Code saved — it's now live! 🎉");
}

// ── DASHBOARD ──
function showDashboard(show) {
  document.getElementById('main-page').style.display = show ? 'none' : 'block';
  document.getElementById('dashboard-page').style.display = show ? 'block' : 'none';
  if (show) renderDashboard();
}

function renderDashboard() {
  if (!clerk?.user) return;
  const plan = PLANS.find(p => p.id === currentUser?.plan) || PLANS[0];
  const name = clerk.user.firstName || clerk.user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Member';

  document.getElementById('dash-name').textContent = name + "'s Dashboard";
  document.getElementById('dash-plan').textContent = plan.name;
  document.getElementById('dash-trees-val').textContent = currentUser?.trees || 0;
  document.getElementById('dash-codes-val').textContent = currentUser?.codes?.length || 0;
  document.getElementById('dash-plan-val').textContent = `$${plan.price}/mo`;
  document.getElementById('dash-views-val').textContent = ((currentUser?.codes?.length || 0) * 847).toLocaleString();

  renderDashboardCodes();
}

function renderDashboardCodes() {
  const tbody = document.getElementById('codes-tbody');
  const codes = currentUser?.codes || [];

  if (codes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--earth-400);padding:2rem">
      No codes yet. Add your first referral code below!
    </td></tr>`;
    return;
  }

  tbody.innerHTML = codes.map(c => `
    <tr>
      <td>
        <img src="${logoUrl(c.domain)}" alt="" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:.4rem;border-radius:4px"
             onerror="this.style.display='none'" />
        ${c.service_name}
      </td>
      <td><span class="code-box" style="padding:.2rem .5rem;font-size:.85rem">${c.code}</span></td>
      <td><span class="status-pill status-active">● Active</span></td>
      <td>
        <button class="btn btn-sm" style="background:var(--earth-100);color:var(--earth-700)"
                onclick="openAddCodeModal('${c.service_id}')">Edit</button>
        <button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;margin-left:.3rem"
                onclick="removeCode('${c.service_id}')">Remove</button>
      </td>
    </tr>`).join('');
}

async function removeCode(serviceId) {
  try {
    const headers = await authHeaders();
    delete headers['Content-Type'];
    await apiFetch(`/api/user/codes/${serviceId}`, { method: 'DELETE', headers });
    await Promise.all([loadUser(), loadServices()]);
    renderDashboardCodes();
    updateStats();
    showToast('Code removed');
  } catch (err) {
    console.error('removeCode:', err);
    showToast('Failed to remove code');
  }
}

async function handleDashAddCode(e) {
  e.preventDefault();
  const rawDomain = document.getElementById('add-code-domain-input').value.trim();
  const domain = extractDomain(rawDomain);
  const code = document.getElementById('add-code-direct').value.trim().toUpperCase();

  if (!domain || !code) { showToast('Enter a website and a referral code'); return; }

  await addCodeForService({ domain, name: nameFromDomain(domain), code, reward: '' });

  document.getElementById('add-code-domain-input').value = '';
  document.getElementById('add-code-direct').value = '';
  document.getElementById('domain-logo-preview').style.display = 'none';
  document.getElementById('domain-detected-name').textContent = '';
  showToast('Code added and live! 🎉');
}

// ── SHARED: upsert a code via API ──
async function addCodeForService({ domain, name, code, reward, serviceId }) {
  try {
    const headers = await authHeaders();
    await apiFetch('/api/user/codes', {
      method: 'POST',
      headers,
      body: JSON.stringify({ domain, name, code, reward, serviceId }),
    });
    await Promise.all([loadUser(), loadServices()]);
    renderDashboard();
    updateStats();
  } catch (err) {
    console.error('addCodeForService:', err);
    showToast('Failed to save code — please try again');
  }
}

// ── INIT ──
async function init() {
  updateNav();
  loadServices();
  updateStats();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal(overlay.id);
        if (overlay.id === 'payment-modal') goToPayStep(1);
      }
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => {
        closeModal(m.id);
        if (m.id === 'payment-modal') goToPayStep(1);
      });
    }
  });

  // Re-fetch services every 30s to rotate codes server-side
  setInterval(loadServices, 30000);

  try {
    clerk = window.Clerk;
    await clerk.load();

    clerk.addListener(async ({ user }) => {
      if (user) {
        await loadUser();
      } else {
        currentUser = null;
      }
      updateNav();
      updateStats();
      if (user && pendingPaymentOpen) {
        pendingPaymentOpen = false;
        setTimeout(openPaymentModal, 300);
      }
      if (!user) showDashboard(false);
    });

    updateNav();
    if (clerk.user) {
      await loadUser();
      updateNav();
    }
    updateStats();
  } catch (err) {
    console.error('Clerk failed to load:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
