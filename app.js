'use strict';

const STORAGE_KEY = 'moneyTracker.v1';
const SORT_KEY = 'moneyTracker.sort';

/* ---------- default seed data ---------- */
const DEFAULT_GOALS = [
  {
    id: uid(),
    name: 'Porsche Cayman 981',
    image: '',
    price: null,          // никитос впишет сам
    saved: 0,
    link: 'https://www.donedeal.ie/cars-for-sale/reduced-cayman-981-25k-miles-fsh-mint/42370726',
    note: '',
    history: []
  },
  {
    id: uid(),
    name: 'Glo Man Full Zip Hoodie (Camo)',
    image: '',
    price: null,          // никитос впишет сам
    saved: 0,
    link: 'https://glogangworldwide.com/products/glo-man-full-zip-hoodie-camo',
    note: '',
    history: []
  }
];

/* ---------- state ---------- */
let goals = load();
let sortMode = localStorage.getItem(SORT_KEY) || 'manual';

/* ---------- helpers ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('load failed', e);
  }
  // первый запуск — засеять дефолт
  const seed = DEFAULT_GOALS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (e) {
    alert('Не удалось сохранить (возможно, картинка слишком большая для localStorage).');
    console.error(e);
  }
}

function eur(n) {
  const v = Number(n) || 0;
  return '€' + v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU') + ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function progressPct(g) {
  if (!g.price || g.price <= 0) return 0;
  return Math.min(100, Math.round((g.saved / g.price) * 100));
}

/* ---------- rendering ---------- */
const goalsEl = document.getElementById('goals');
const emptyEl = document.getElementById('emptyState');
const tpl = document.getElementById('goalCardTpl');

function sortedGoals() {
  const arr = [...goals];
  if (sortMode === 'progress') {
    arr.sort((a, b) => progressPct(b) - progressPct(a));
  } else if (sortMode === 'price') {
    arr.sort((a, b) => (b.price || 0) - (a.price || 0));
  }
  return arr; // manual — как есть
}

function render() {
  goalsEl.innerHTML = '';
  const list = sortedGoals();

  emptyEl.hidden = list.length !== 0;

  for (const g of list) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = g.id;

    const pct = progressPct(g);
    const left = g.price ? Math.max(0, g.price - g.saved) : 0;
    const done = g.price > 0 && g.saved >= g.price;

    if (done) node.classList.add('done');

    // image
    const img = node.querySelector('.goal-img');
    if (g.image) {
      img.src = g.image;
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      node.querySelector('.goal-img-wrap').style.background =
        'repeating-linear-gradient(45deg,#4A90D9 0 20px,#FFD93D 20px 40px)';
    }

    // boom bubble
    const boom = node.querySelector('.boom-bubble');
    boom.hidden = !done;

    node.querySelector('.goal-name').textContent = g.name;

    const inner = node.querySelector('.progress-inner');
    inner.style.width = pct + '%';
    if (done) inner.classList.add('full');
    node.querySelector('.progress-pct').textContent = pct + '%';

    node.querySelector('.money-saved').textContent = 'Накоплено: ' + eur(g.saved);
    node.querySelector('.money-left').textContent =
      g.price ? 'Осталось: ' + eur(left) : 'цена не задана';

    const note = node.querySelector('.goal-note');
    note.textContent = g.note || '';

    // history
    renderHistory(node.querySelector('.history-list'), g);

    goalsEl.appendChild(node);
  }

  renderStats();
}

function renderHistory(ul, g) {
  ul.innerHTML = '';
  if (!g.history || g.history.length === 0) {
    const li = document.createElement('li');
    li.className = 'hist-empty';
    li.textContent = 'Пока нет пополнений';
    li.style.border = 'none';
    li.style.background = 'transparent';
    ul.appendChild(li);
    return;
  }
  // новые сверху
  [...g.history].reverse().forEach((h) => {
    const li = document.createElement('li');
    li.className = h.amount >= 0 ? 'pos' : 'neg';
    const sign = h.amount >= 0 ? '+' : '−';
    li.innerHTML =
      `<span>${sign}${eur(Math.abs(h.amount))}</span>` +
      `<span>${fmtDate(h.date)}</span>`;
    const del = document.createElement('button');
    del.className = 'hist-del';
    del.textContent = '✕';
    del.title = 'удалить запись';
    del.addEventListener('click', () => deleteHistory(g.id, h.id));
    li.appendChild(del);
    ul.appendChild(li);
  });
}

function renderStats() {
  let saved = 0, total = 0;
  for (const g of goals) {
    saved += Number(g.saved) || 0;
    total += Number(g.price) || 0;
  }
  const pct = total > 0 ? Math.round((saved / total) * 100) : 0;
  document.getElementById('statSaved').textContent = eur(saved);
  document.getElementById('statTotal').textContent = eur(total);
  document.getElementById('statProgress').textContent = pct + '%';
}

/* ---------- money add/remove ---------- */
function changeMoney(id, delta) {
  const g = goals.find((x) => x.id === id);
  if (!g) return;
  const newSaved = (Number(g.saved) || 0) + delta;
  if (newSaved < 0) {
    alert('Нельзя уйти в минус — накоплено меньше, чем убираешь.');
    return;
  }
  const wasDone = g.price > 0 && g.saved >= g.price;
  g.saved = newSaved;
  g.history.push({
    id: uid(),
    amount: delta,
    date: new Date().toISOString()
  });
  save();
  render();

  floatBubble(delta);

  // взрыв при первом достижении 100%
  const nowDone = g.price > 0 && g.saved >= g.price;
  if (nowDone && !wasDone) boomBubble('BOOM!');
}

function deleteHistory(goalId, histId) {
  const g = goals.find((x) => x.id === goalId);
  if (!g) return;
  const entry = g.history.find((h) => h.id === histId);
  if (!entry) return;
  // откатываем сумму
  g.saved = Math.max(0, (Number(g.saved) || 0) - entry.amount);
  g.history = g.history.filter((h) => h.id !== histId);
  save();
  render();
}

/* ---------- floating comic bubbles ---------- */
const floatLayer = document.getElementById('floatLayer');

function floatBubble(delta) {
  const b = document.createElement('div');
  b.className = 'float-bubble ' + (delta >= 0 ? 'pos' : 'neg');
  const sign = delta >= 0 ? '+' : '−';
  b.textContent = sign + eur(Math.abs(delta)) + '!';
  b.style.left = (30 + Math.random() * 40) + '%';
  b.style.top = (40 + Math.random() * 20) + '%';
  floatLayer.appendChild(b);
  setTimeout(() => b.remove(), 1000);
}

function boomBubble(text) {
  const b = document.createElement('div');
  b.className = 'float-bubble pos';
  b.textContent = text;
  b.style.fontSize = '64px';
  b.style.left = '40%';
  b.style.top = '45%';
  floatLayer.appendChild(b);
  setTimeout(() => b.remove(), 1000);
}

/* ---------- card event delegation ---------- */
goalsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.goal-card');
  if (!card) return;
  const id = card.dataset.id;
  const g = goals.find((x) => x.id === id);
  if (!g) return;

  if (e.target.closest('.btn-plus') || e.target.closest('.btn-minus')) {
    const input = card.querySelector('.amount-input');
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) {
      input.focus();
      return;
    }
    const delta = e.target.closest('.btn-plus') ? amount : -amount;
    changeMoney(id, delta);
    input.value = '';
  } else if (e.target.closest('.btn-go')) {
    if (g.link) {
      window.open(g.link, '_blank', 'noopener');
    } else {
      alert('У этой цели нет ссылки на товар.');
    }
  } else if (e.target.closest('.btn-edit')) {
    openModal(g);
  } else if (e.target.closest('.btn-history')) {
    const w = card.querySelector('.history-wrap');
    w.hidden = !w.hidden;
  }
});

/* ---------- modal ---------- */
const modal = document.getElementById('goalModal');
const form = document.getElementById('goalForm');
let currentImage = ''; // base64 или url в процессе редактирования

function openModal(goal) {
  form.reset();
  currentImage = goal ? (goal.image || '') : '';
  document.getElementById('goalId').value = goal ? goal.id : '';
  document.getElementById('modalTitle').textContent = goal ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ЦЕЛЬ';
  document.getElementById('fName').value = goal ? goal.name : '';
  document.getElementById('fPrice').value = goal && goal.price != null ? goal.price : '';
  document.getElementById('fSaved').value = goal ? goal.saved : 0;
  document.getElementById('fLink').value = goal ? goal.link : '';
  document.getElementById('fNote').value = goal ? goal.note : '';
  document.getElementById('fImageUrl').value =
    (goal && goal.image && !goal.image.startsWith('data:')) ? goal.image : '';
  updateImgPreview();
  document.getElementById('btnDelete').hidden = !goal;
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
}

function updateImgPreview() {
  const wrap = document.getElementById('imgPreviewWrap');
  const img = document.getElementById('imgPreview');
  if (currentImage) {
    img.src = currentImage;
    wrap.hidden = false;
  } else {
    wrap.hidden = true;
    img.removeAttribute('src');
  }
}

document.getElementById('fImageUrl').addEventListener('input', (e) => {
  currentImage = e.target.value.trim();
  updateImgPreview();
});

document.getElementById('fImageFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    currentImage = reader.result; // base64
    document.getElementById('fImageUrl').value = '';
    updateImgPreview();
  };
  reader.readAsDataURL(file);
});

document.getElementById('clearImg').addEventListener('click', () => {
  currentImage = '';
  document.getElementById('fImageUrl').value = '';
  document.getElementById('fImageFile').value = '';
  updateImgPreview();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('goalId').value;
  const priceVal = document.getElementById('fPrice').value;
  const data = {
    name: document.getElementById('fName').value.trim(),
    image: currentImage,
    price: priceVal === '' ? null : Math.max(0, parseFloat(priceVal) || 0),
    saved: Math.max(0, parseFloat(document.getElementById('fSaved').value) || 0),
    link: document.getElementById('fLink').value.trim(),
    note: document.getElementById('fNote').value.trim()
  };

  if (id) {
    const g = goals.find((x) => x.id === id);
    Object.assign(g, data);
  } else {
    goals.push({ id: uid(), ...data, history: [] });
  }
  save();
  render();
  closeModal();
});

document.getElementById('btnDelete').addEventListener('click', () => {
  const id = document.getElementById('goalId').value;
  if (!id) return;
  if (!confirm('Удалить цель вместе с историей?')) return;
  goals = goals.filter((x) => x.id !== id);
  save();
  render();
  closeModal();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
document.getElementById('btnAdd').addEventListener('click', () => openModal(null));

/* ---------- sort ---------- */
document.querySelectorAll('.chip').forEach((chip) => {
  if (chip.dataset.sort === sortMode) chip.classList.add('active');
  chip.addEventListener('click', () => {
    sortMode = chip.dataset.sort;
    localStorage.setItem(SORT_KEY, sortMode);
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    render();
  });
});

/* ---------- export / import ---------- */
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(goals, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'money-tracker-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('не массив');
      if (!confirm('Импорт заменит текущие данные. Продолжить?')) return;
      // лёгкая нормализация
      goals = data.map((g) => ({
        id: g.id || uid(),
        name: g.name || 'Без названия',
        image: g.image || '',
        price: g.price != null ? g.price : null,
        saved: Number(g.saved) || 0,
        link: g.link || '',
        note: g.note || '',
        history: Array.isArray(g.history) ? g.history : []
      }));
      save();
      render();
      alert('Импорт готов!');
    } catch (err) {
      alert('Не удалось прочитать файл: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ---------- init ---------- */
render();
