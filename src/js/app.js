// ── STATE ──
let currentUser = JSON.parse(localStorage.getItem('tf_user') || 'null');
let activeFilter = 'All';
let selectedPlan = 'grove';
let signupStep = 1;

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

// ── STATS ──
function updateStats() {
  const totalMembers = DEMO_MEMBERS.length + (currentUser ? 1 : 0);
  const totalTrees = DEMO_MEMBERS.reduce((s, m) => s + m.trees, 0) + (currentUser ? (currentUser.trees || 1) : 0);
  const totalCodes = SERVICES.reduce((s, svc) => s + svc.codes.length, 0) + (currentUser?.userCodes?.length || 0);

  document.getElementById('stat-members').textContent = totalMembers.toLocaleString();
  document.getElementById('stat-trees').textContent = totalTrees.toLocaleString();
  document.getElementById('stat-services').textContent = SERVICES.length;
  document.getElementById('stat-codes').textContent = totalCodes;
}

// ── REFERRAL CARDS ──
function buildCard(svc) {
  let codes = [...svc.codes];
  // Add user's code if they have one for this service
  if (currentUser?.userCodes) {
    const uc = currentUser.userCodes.find(c => c.serviceId === svc.id);
    if (uc) codes.push({ code: uc.code, contributor: currentUser.name + " (you)", trees: currentUser.trees || 1 });
  }

  if (codes.length === 0) {
    // No codes yet — show placeholder
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
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    showToast('Code copied to clipboard 🌳');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    showToast('Code copied! 🌳');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
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

// ── NAV / AUTH ──
function updateNav() {
  const authButtons = document.getElementById('nav-auth');
  const dashLink = document.getElementById('nav-dashboard');
  if (currentUser) {
    authButtons.innerHTML = `
      <span style="color:var(--green-400);font-size:.85rem">🌳 ${currentUser.trees || 0} trees</span>
      <button class="btn btn-outline btn-sm" onclick="logout()">Sign out</button>
    `;
    dashLink.style.display = 'block';
  } else {
    authButtons.innerHTML = `
      <a href="#" class="nav-links" onclick="openModal('login-modal')">Sign in</a>
      <button class="btn btn-primary btn-sm" onclick="openModal('signup-modal')">Join for free</button>
    `;
    dashLink.style.display = 'none';
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('tf_user');
  updateNav();
  updateStats();
  renderGrid();
  showDashboard(false);
  showToast('Signed out. See you soon! 👋');
}

// ── SIGNUP FLOW ──
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
}

function selectPlan(id, el) {
  selectedPlan = id;
  document.querySelectorAll('.plan-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  const plan = PLANS.find(p => p.id === id);
  document.getElementById('signup-submit-btn').textContent = `Start planting — $${plan.price}/mo`;
}

function goToStep(step) {
  signupStep = step;
  document.querySelectorAll('.signup-step').forEach(el => el.classList.add('hidden'));
  document.getElementById(`signup-step-${step}`).classList.remove('hidden');
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) { showToast('Please fill in all fields'); return; }

  goToStep(2);
}

function handlePayment(e) {
  e.preventDefault();
  const plan = PLANS.find(p => p.id === selectedPlan);

  // Simulate payment processing
  const btn = document.getElementById('pay-btn');
  btn.textContent = 'Processing...';
  btn.disabled = true;

  setTimeout(() => {
    const name = document.getElementById('signup-name').value.trim();
    currentUser = {
      name,
      plan: plan.id,
      trees: plan.trees,
      joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      userCodes: []
    };
    localStorage.setItem('tf_user', JSON.stringify(currentUser));

    goToStep(3); // success
    updateNav();
    updateStats();
    renderGrid();
    btn.textContent = 'Complete & Start Planting';
    btn.disabled = false;
  }, 1800);
}

// ── LOGIN ──
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  if (!email) { showToast('Enter your email'); return; }

  // Demo: any email works
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  setTimeout(() => {
    currentUser = {
      name: email.split('@')[0],
      plan: 'grove',
      trees: 3,
      joined: 'Jan 2024',
      userCodes: []
    };
    localStorage.setItem('tf_user', JSON.stringify(currentUser));
    closeModal('login-modal');
    updateNav();
    updateStats();
    renderGrid();
    showToast('Welcome back! 🌳');
    btn.textContent = 'Sign in';
    btn.disabled = false;
  }, 1000);
}

// ── ADD CODE ──
let addCodeTargetService = null;

function openAddCodeModal(serviceId) {
  if (!currentUser) {
    openModal('signup-modal');
    showToast('Sign up first to add your referral code!');
    return;
  }
  addCodeTargetService = serviceId;
  const svc = SERVICES.find(s => s.id === serviceId);
  document.getElementById('add-code-service-name').textContent = svc.name;

  // Pre-fill if user already has a code
  const existing = currentUser.userCodes?.find(c => c.serviceId === serviceId);
  document.getElementById('add-code-input').value = existing?.code || '';
  document.getElementById('add-code-url').value = existing?.url || svc.url;

  openModal('add-code-modal');
}

function handleAddCode(e) {
  e.preventDefault();
  const code = document.getElementById('add-code-input').value.trim().toUpperCase();
  if (!code) { showToast('Enter a referral code'); return; }

  if (!currentUser.userCodes) currentUser.userCodes = [];

  // Update or insert
  const idx = currentUser.userCodes.findIndex(c => c.serviceId === addCodeTargetService);
  if (idx >= 0) {
    currentUser.userCodes[idx].code = code;
  } else {
    currentUser.userCodes.push({ serviceId: addCodeTargetService, code });
  }
  localStorage.setItem('tf_user', JSON.stringify(currentUser));

  // Also push into SERVICES so it shows immediately
  const svc = SERVICES.find(s => s.id === addCodeTargetService);
  const existingInSvc = svc.codes.find(c => c.contributor === currentUser.name + ' (you)');
  if (!existingInSvc) {
    svc.codes.push({ code, contributor: currentUser.name + ' (you)', trees: currentUser.trees || 1 });
  } else {
    existingInSvc.code = code;
  }

  closeModal('add-code-modal');
  renderGrid();
  renderDashboardCodes();
  showToast('Referral code saved — it\'s now live! 🎉');
}

// ── DASHBOARD ──
function showDashboard(show) {
  document.getElementById('main-page').style.display = show ? 'none' : 'block';
  document.getElementById('dashboard-page').style.display = show ? 'block' : 'none';
  if (show) renderDashboard();
}

function renderDashboard() {
  if (!currentUser) return;
  const plan = PLANS.find(p => p.id === currentUser.plan) || PLANS[0];

  document.getElementById('dash-name').textContent = currentUser.name;
  document.getElementById('dash-plan').textContent = plan.name;
  document.getElementById('dash-trees-val').textContent = currentUser.trees || 0;
  document.getElementById('dash-codes-val').textContent = currentUser.userCodes?.length || 0;
  document.getElementById('dash-plan-val').textContent = `$${plan.price}/mo`;

  // Total trees across all services this month
  const totalViews = (currentUser.userCodes?.length || 0) * 847;
  document.getElementById('dash-views-val').textContent = totalViews.toLocaleString();

  renderDashboardCodes();
  renderServiceSelect();
}

function renderDashboardCodes() {
  const tbody = document.getElementById('codes-tbody');
  const codes = currentUser?.userCodes || [];

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
  const userCodeIds = new Set(currentUser?.userCodes?.map(c => c.serviceId) || []);
  sel.innerHTML = `<option value="">Choose a service…</option>` +
    SERVICES.map(s => `<option value="${s.id}" ${userCodeIds.has(s.id) ? 'disabled' : ''}>
      ${s.icon} ${s.name} ${userCodeIds.has(s.id) ? '(code added)' : ''}
    </option>`).join('');
}

function removeCode(serviceId) {
  currentUser.userCodes = currentUser.userCodes.filter(c => c.serviceId !== serviceId);
  localStorage.setItem('tf_user', JSON.stringify(currentUser));

  // Remove from services array too
  const svc = SERVICES.find(s => s.id === serviceId);
  if (svc) svc.codes = svc.codes.filter(c => !c.contributor.endsWith('(you)'));

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

  if (!currentUser.userCodes) currentUser.userCodes = [];
  currentUser.userCodes.push({ serviceId, code });
  localStorage.setItem('tf_user', JSON.stringify(currentUser));

  const svc = SERVICES.find(s => s.id === serviceId);
  svc.codes.push({ code, contributor: currentUser.name + ' (you)', trees: currentUser.trees || 1 });

  document.getElementById('add-code-direct').value = '';
  document.getElementById('add-code-service-select').value = '';
  renderDashboardCodes();
  renderServiceSelect();
  renderGrid();
  showToast('Code added and live! 🎉');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  buildFilters();
  renderGrid();
  updateStats();
  updateNav();
  initPlanSelector();

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal(overlay.id);
        if (overlay.id === 'signup-modal') goToStep(1);
      }
    });
  });

  // Keyboard escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => {
        closeModal(m.id);
        if (m.id === 'signup-modal') goToStep(1);
      });
    }
  });

  // Rotate codes every 30 seconds
  setInterval(() => {
    renderGrid();
  }, 30000);
});
