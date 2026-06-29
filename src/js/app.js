const CLERK_KEY = 'pk_test_ZW5nYWdlZC1ncmFja2xlLTkuY2xlcmsuYWNjb3VudHMuZGV2JA';

let clerk = null;
let activeFilter = 'All';
let selectedPlan = 'grove';
let pendingPaymentOpen = false; // set true when unauthenticated user tries to join

// ── PER-USER DATA (localStorage, keyed by Clerk user id) ──
function userKey(suffix) {
  return `tf_${clerk?.user?.id}_${suffix}`;
}
function getUserData() {
  if (!clerk?.user) return null;
  const stored = localStorage.getItem(userKey('data'));
  return stored ? JSON.parse(stored) : { plan: null, trees: 0, userCodes: [] };
}
function saveUserData(data) {
  if (!clerk?.user) return;
  localStorage.setItem(userKey('data'), JSON.stringify(data));
}

// ── UTILS ──
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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

// ── STATS ──
function updateStats() {
  const userData = getUserData();
  const totalMembers = DEMO_MEMBERS.length + (clerk?.user && userData?.plan ? 1 : 0);
  const totalTrees = DEMO_MEMBERS.reduce((s, m) => s + m.trees, 0) + (userData?.trees || 0);
  const totalCodes = SERVICES.reduce((s, svc) => s + svc.codes.length, 0);

  document.getElementById('stat-members').textContent = totalMembers.toLocaleString();
  document.getElementById('stat-trees').textContent = totalTrees.toLocaleString();
  document.getElementById('stat-services').textContent = SERVICES.length;
  document.getElementById('stat-codes').textContent = totalCodes;
}

// ── REFERRAL CARDS ──
function buildCard(svc) {
  const userData = getUserData();
  let codes = [...svc.codes];

  if (userData?.userCodes) {
    const uc = userData.userCodes.find(c => c.serviceId === svc.id);
    if (uc) {
      const displayName = clerk.user.firstName || clerk.user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'You';
      codes.push({ code: uc.code, contributor: displayName + ' (you)', trees: userData.trees || 1 });
    }
  }

  if (codes.length === 0) {
    return `
      <div class="referral-card" data-category="${svc.category}">
        <div class="card-header">
          <div class="service-icon" style="background:${svc.bg};color:${svc.color}">${svc.icon}</div>
          <div class="card-meta">
            <h3>${svc.name}</h3>
            <div class="category">${svc.category}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-reward">🎁 ${svc.reward}</div>
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

  const picked = randItem(codes);
  return `
    <div class="referral-card" data-category="${svc.category}">
      <div class="card-header">
        <div class="service-icon" style="background:${svc.bg};color:${svc.color}">${svc.icon}</div>
        <div class="card-meta">
          <h3>${svc.name}</h3>
          <div class="category">${svc.category}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-reward">🎁 ${svc.reward}</div>
        <div class="code-row">
          <div class="code-box">${picked.code}</div>
          <button class="copy-btn" onclick="copyCode(this, '${picked.code}')">Copy</button>
        </div>
      </div>
      <div class="card-footer">
        <div class="contributor-info">
          By <strong>${picked.contributor}</strong> · ${codes.length} contributor${codes.length !== 1 ? 's' : ''}
        </div>
        <div class="tree-count">🌳 ${picked.trees} trees</div>
      </div>
    </div>`;
}

function renderGrid() {
  const grid = document.getElementById('referral-grid');
  grid.innerHTML = SERVICES
    .filter(s => activeFilter === 'All' || s.category === activeFilter)
    .map(buildCard)
    .join('');
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

// ── FILTERS ──
function buildFilters() {
  const container = document.getElementById('category-filters');
  container.innerHTML = CATEGORIES.map(cat => `
    <button class="filter-btn ${cat === 'All' ? 'active' : ''}" onclick="setFilter('${cat}', this)">${cat}</button>
  `).join('');
}

function setFilter(cat, btn) {
  activeFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid();
}

// ── NAV ──
function updateNav() {
  const authEl = document.getElementById('nav-auth');
  const dashLink = document.getElementById('nav-dashboard');
  const user = clerk?.user;

  if (user) {
    const userData = getUserData();
    const name = user.firstName || user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Member';
    authEl.innerHTML = `
      <span style="color:var(--green-400);font-size:.85rem">🌳 ${userData?.trees || 0} trees</span>
      <span style="color:var(--green-100);font-size:.85rem;font-weight:600">${name}</span>
      <button class="btn btn-outline btn-sm" onclick="clerk.signOut()">Sign out</button>
    `;
    dashLink.style.display = 'block';
  } else {
    authEl.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="clerk.openSignIn()">Sign in</button>
      <button class="btn btn-primary btn-sm" onclick="startJoin()">Join for free</button>
    `;
    dashLink.style.display = 'none';
  }
}

// ── JOIN FLOW ──
// Called from hero CTA and pricing buttons.
// If not signed in → Clerk sign-up → on auth, open payment modal.
// If already signed in → open payment modal directly.
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
function handlePayment(e) {
  e.preventDefault();
  const plan = PLANS.find(p => p.id === selectedPlan);
  const btn = document.getElementById('pay-btn');
  btn.textContent = 'Processing…';
  btn.disabled = true;

  setTimeout(() => {
    const userData = getUserData() || { userCodes: [] };
    userData.plan = plan.id;
    userData.trees = (userData.trees || 0) + plan.trees;
    saveUserData(userData);

    goToPayStep(2);
    updateNav();
    updateStats();
    btn.textContent = `Complete & Start Planting — $${plan.price}/mo`;
    btn.disabled = false;
  }, 1500);
}

// ── ADD CODE (from card) ──
let addCodeTargetService = null;

function openAddCodeModal(serviceId) {
  if (!clerk?.user) {
    pendingPaymentOpen = false;
    clerk.openSignIn();
    showToast('Sign in first to add your referral code!');
    return;
  }
  addCodeTargetService = serviceId;
  const svc = SERVICES.find(s => s.id === serviceId);
  document.getElementById('add-code-service-name').textContent = svc.name;

  const userData = getUserData();
  const existing = userData?.userCodes?.find(c => c.serviceId === serviceId);
  document.getElementById('add-code-input').value = existing?.code || '';
  document.getElementById('add-code-url').value = existing?.url || svc.url;

  openModal('add-code-modal');
}

function handleAddCode(e) {
  e.preventDefault();
  const code = document.getElementById('add-code-input').value.trim().toUpperCase();
  if (!code) { showToast('Enter a referral code'); return; }

  const userData = getUserData() || { userCodes: [] };
  if (!userData.userCodes) userData.userCodes = [];

  const idx = userData.userCodes.findIndex(c => c.serviceId === addCodeTargetService);
  if (idx >= 0) {
    userData.userCodes[idx].code = code;
  } else {
    userData.userCodes.push({ serviceId: addCodeTargetService, code });
  }
  saveUserData(userData);

  // Reflect in live SERVICES array
  const displayName = clerk.user.firstName || clerk.user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'You';
  const svc = SERVICES.find(s => s.id === addCodeTargetService);
  const existingInSvc = svc.codes.findIndex(c => c.contributor?.endsWith('(you)'));
  const entry = { code, contributor: displayName + ' (you)', trees: userData.trees || 1 };
  if (existingInSvc >= 0) svc.codes[existingInSvc] = entry;
  else svc.codes.push(entry);

  closeModal('add-code-modal');
  renderGrid();
  renderDashboardCodes();
  showToast('Code saved — it\'s now live! 🎉');
}

// ── DASHBOARD ──
function showDashboard(show) {
  document.getElementById('main-page').style.display = show ? 'none' : 'block';
  document.getElementById('dashboard-page').style.display = show ? 'block' : 'none';
  if (show) renderDashboard();
}

function renderDashboard() {
  if (!clerk?.user) return;
  const userData = getUserData() || { plan: null, trees: 0, userCodes: [] };
  const plan = PLANS.find(p => p.id === userData.plan) || PLANS[0];
  const name = clerk.user.firstName || clerk.user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Member';

  document.getElementById('dash-name').textContent = name + '\'s Dashboard';
  document.getElementById('dash-plan').textContent = plan.name;
  document.getElementById('dash-trees-val').textContent = userData.trees || 0;
  document.getElementById('dash-codes-val').textContent = userData.userCodes?.length || 0;
  document.getElementById('dash-plan-val').textContent = `$${plan.price}/mo`;
  document.getElementById('dash-views-val').textContent = ((userData.userCodes?.length || 0) * 847).toLocaleString();

  renderDashboardCodes();
  renderServiceSelect();
}

function renderDashboardCodes() {
  const tbody = document.getElementById('codes-tbody');
  const userData = getUserData();
  const codes = userData?.userCodes || [];

  if (codes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--earth-400);padding:2rem">
      No codes yet. Add your first referral code below!
    </td></tr>`;
    return;
  }

  tbody.innerHTML = codes.map(c => {
    const svc = SERVICES.find(s => s.id === c.serviceId);
    return `<tr>
      <td>${svc?.icon || '🔗'} ${svc?.name || c.serviceId}</td>
      <td><span class="code-box" style="padding:.2rem .5rem;font-size:.85rem">${c.code}</span></td>
      <td><span class="status-pill status-active">● Active</span></td>
      <td>
        <button class="btn btn-sm" style="background:var(--earth-100);color:var(--earth-700)"
                onclick="openAddCodeModal('${c.serviceId}')">Edit</button>
        <button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;margin-left:.3rem"
                onclick="removeCode('${c.serviceId}')">Remove</button>
      </td>
    </tr>`;
  }).join('');
}

function renderServiceSelect() {
  const sel = document.getElementById('add-code-service-select');
  const userData = getUserData();
  const userCodeIds = new Set(userData?.userCodes?.map(c => c.serviceId) || []);
  sel.innerHTML = `<option value="">Choose a service…</option>` +
    SERVICES.map(s => `<option value="${s.id}" ${userCodeIds.has(s.id) ? 'disabled' : ''}>
      ${s.icon} ${s.name} ${userCodeIds.has(s.id) ? '(code added)' : ''}
    </option>`).join('');
}

function removeCode(serviceId) {
  const userData = getUserData();
  userData.userCodes = userData.userCodes.filter(c => c.serviceId !== serviceId);
  saveUserData(userData);

  const svc = SERVICES.find(s => s.id === serviceId);
  if (svc) svc.codes = svc.codes.filter(c => !c.contributor?.endsWith('(you)'));

  renderDashboardCodes();
  renderServiceSelect();
  renderGrid();
  showToast('Code removed');
}

function handleDashAddCode(e) {
  e.preventDefault();
  const serviceId = document.getElementById('add-code-service-select').value;
  const code = document.getElementById('add-code-direct').value.trim().toUpperCase();
  if (!serviceId || !code) { showToast('Select a service and enter your code'); return; }

  const userData = getUserData() || { userCodes: [] };
  if (!userData.userCodes) userData.userCodes = [];
  userData.userCodes.push({ serviceId, code });
  saveUserData(userData);

  const displayName = clerk.user.firstName || clerk.user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'You';
  const svc = SERVICES.find(s => s.id === serviceId);
  svc.codes.push({ code, contributor: displayName + ' (you)', trees: userData.trees || 1 });

  document.getElementById('add-code-direct').value = '';
  document.getElementById('add-code-service-select').value = '';
  renderDashboardCodes();
  renderServiceSelect();
  renderGrid();
  showToast('Code added and live! 🎉');
}

// ── INIT ──
async function init() {
  // Render UI immediately — don't wait for Clerk
  buildFilters();
  renderGrid();
  updateStats();
  updateNav();

  // Close modals on overlay click / Escape
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
  setInterval(renderGrid, 30000);

  // Load Clerk — update UI once ready
  try {
    clerk = new window.Clerk(CLERK_KEY);
    await clerk.load();

    clerk.addListener(({ user }) => {
      updateNav();
      updateStats();
      renderGrid();
      if (user && pendingPaymentOpen) {
        pendingPaymentOpen = false;
        setTimeout(openPaymentModal, 300);
      }
      if (!user) showDashboard(false);
    });

    // Refresh UI now that Clerk knows auth state
    updateNav();
    updateStats();
    renderGrid();
  } catch (err) {
    console.error('Clerk failed to load:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
