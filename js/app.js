const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ESC[ch]);

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 2500);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('baon-db', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSettings() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('settings', 'readonly')
      .objectStore('settings').get('allowance');
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function saveSettings(settings) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('settings', 'readwrite')
      .objectStore('settings').put({ id: 'allowance', ...settings });
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

function money(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function renderHome() {
  let settings;
  try {
    settings = await getSettings();
  } catch {
    view.innerHTML = `<section class="card"><h2>Home</h2>
      <p class="muted">Your browser could not open local storage. Try using the app through localhost.</p></section>`;
    return;
  }

  if (!settings) {
    view.innerHTML = `<section class="card hero">
      <p class="muted">Welcome to BAON</p>
      <h2>Know your baon. Plan your spending.</h2>
      <p>Set your allowance first to get started.</p>
      <button class="btn lime" id="setBudget">Set my baon</button>
    </section>`;
    document.getElementById('setBudget').addEventListener('click', () => {
      location.hash = '#/settings';
    });
    return;
  }

  view.innerHTML = `<section class="card hero">
      <p class="muted">Your allowance</p>
      <p class="big">${money(settings.amount)}</p>
      <p class="muted">${esc(settings.period)} · starts ${esc(formatDate(settings.startDate))}</p>
    </section>
    <section class="card">
      <h2>You're all set!</h2>
      <p class="muted">Your baon settings are saved on this device. Expense tracking will be added in the next steps.</p>
      <button class="btn" id="editBudget">Edit baon</button>
    </section>`;
  document.getElementById('editBudget').addEventListener('click', () => {
    location.hash = '#/settings';
  });
}

function renderAdd() {
  view.innerHTML = `<section class="card"><h2>Add expense</h2>
    <p class="muted">The expense form will be added in a later step.</p></section>`;
}

function renderHistory() {
  view.innerHTML = `<section class="card"><h2>History</h2>
    <p class="muted">Your expenses will be listed here in a later step.</p></section>`;
}

async function renderSettings() {
  let settings = null;
  try {
    settings = await getSettings();
  } catch {
    view.innerHTML = `<section class="card"><h2>My baon</h2>
      <p class="muted">Could not access IndexedDB. Please use the app through http://localhost:3000.</p></section>`;
    return;
  }

  const amount = settings?.amount ?? '';
  const period = settings?.period ?? 'Weekly';
  const startDate = settings?.startDate ?? todayString();

  view.innerHTML = `<section class="card">
    <h2>My baon</h2>
    <p class="muted">Set your allowance amount, period, and start date.</p>
    <form id="budgetForm">
      <label for="amount">Allowance amount (₱)
        <input id="amount" name="amount" type="number" min="0.01" step="0.01"
          class="amount-input" placeholder="e.g. 1500" value="${esc(amount)}" required>
      </label>
      <label for="period">Allowance period
        <select id="period" name="period" required>
          <option value="Daily" ${period === 'Daily' ? 'selected' : ''}>Daily</option>
          <option value="Weekly" ${period === 'Weekly' ? 'selected' : ''}>Weekly</option>
          <option value="Monthly" ${period === 'Monthly' ? 'selected' : ''}>Monthly</option>
          <option value="Semester" ${period === 'Semester' ? 'selected' : ''}>Semester</option>
        </select>
      </label>
      <label for="startDate">Start date
        <input id="startDate" name="startDate" type="date" value="${esc(startDate)}" required>
      </label>
      <button class="btn lime" type="submit">Save baon</button>
    </form>
  </section>`;

  document.getElementById('budgetForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const amountValue = Number(form.amount.value);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast('Enter an allowance amount greater than zero.');
      form.amount.focus();
      return;
    }
    try {
      await saveSettings({
        amount: amountValue,
        period: form.period.value,
        startDate: form.startDate.value,
        updatedAt: new Date().toISOString()
      });
      toast('Your baon settings were saved.');
      location.hash = '#/home';
    } catch {
      toast('Could not save settings. Please try again.');
    }
  });
}

const routes = {
  home: renderHome,
  add: renderAdd,
  history: renderHistory,
  settings: renderSettings
};

async function router() {
  const name = location.hash.replace('#/', '') || 'home';
  const render = routes[name] ?? renderHome;
  document.querySelectorAll('.tabbar a').forEach((a) =>
    a.classList.toggle('active', a.dataset.route === name));
  await render();
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

window.addEventListener('hashchange', router);
router();
