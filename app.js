'use strict';

const STORAGE_KEY = 'moneyTracker.v2';
const OLD_KEY = 'moneyTracker.v1';
const SORT_KEY = 'moneyTracker.sort';

/* ---------- default seed data ---------- */
function defaultData() {
  return {
    bank: 0,
    history: [],
    goals: [
      {
        id: uid(),
        name: 'Porsche Cayman 981',
        image: '',
        price: null,          // никитос впишет сам
        link: 'https://www.donedeal.ie/cars-for-sale/reduced-cayman-981-25k-miles-fsh-mint/42370726',
        note: ''
      },
      {
        id: uid(),
        name: 'Glo Man Full Zip Hoodie (Camo)',
        image: '',
        price: null,          // никитос впишет сам
        link: 'https://glogangworldwide.com/products/glo-man-full-zip-hoodie-camo',
        note: ''
      }
    ]
  };
}

/* ---------- state ---------- */
let data = load();
let sortMode = localStorage.getItem(SORT_KEY) || 'manual';

/* ---------- helpers ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function load() {
  // новый формат
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('load v2 failed', e);
  }
  // миграция со старого формата (деньги были по вещам -> в общий банк)
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const arr = JSON.parse(old);
      if (Array.isArray(arr)) {
        let bank = 0;
        let history = [];
        const goals = arr.map((g) => {
          bank += Number(g.saved) || 0;
          if (Array.isArray(g.history)) {
            history = history.concat(g.history.map((h) => ({
              id: h.id || uid(),
              amount: Number(h.amount) || 0,
              date: h.date || new Date().toISOString(),
              note: 'из «' + (g.name || 'цель') + '»'
            })));
          }
          return {
            id: g.id || uid(),
            name: g.name || 'Без названия',
            image: g.image || '',
            price: g.price != null ? g.price : null,
            link: g.link || '',
            note: g.note || ''
          };
        });
        history.sort((a, b) => new Date(a.date) - new Date(b.date));
        const migrated = { bank, history, goals };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn('migration failed', e);
  }
  // первый запуск
  const seed = defaultData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function normalize(d) {
  return {
    bank: Number(d.bank) || 0,
    history: Array.isArray(d.history) ? d.history : [],
    goals: Array.isArray(d.goals) ? d.goals.map((g) => ({
      id: g.id || uid(),
      name: g.name || 'Без названия',
      image: g.image || '',
      price: g.price != null ? g.price : null,
      link: g.link || '',
      note: g.note || ''
    })) : []
  };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  return Math.min(100, Math.round((data.bank / g.price) * 100));
}

function isDone(g) {
  return g.price > 0 && data.bank >= g.price;
}

/* ---------- rendering ---------- */
const goalsEl = document.getElementById('goals');
const emptyEl = document.getElementById('emptyState');
const tpl = document.getElementById('goalCardTpl');

function sortedGoals() {
  const arr = [...data.goals];
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
    const done = isDone(g);
    const shownSaved = g.price ? Math.min(data.bank, g.price) : data.bank;
    const left = g.price ? Math.max(0, g.price - data.bank) : 0;

    if (done) node.classList.add('done');

    const img = node.querySelector('.goal-img');
    if (g.image) {
      img.src = g.image;
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      node.querySelector('.goal-img-wrap').style.background =
        'repeating-linear-gradient(45deg,#4A90D9 0 20px,#FFD93D 20px 40px)';
    }

    node.querySelector('.boom-bubble').hidden = !done;
    node.querySelector('.goal-name').textContent = g.name;

    const inner = node.querySelector('.progress-inner');
    inner.style.width = pct + '%';
    if (done) inner.classList.add('full');
    node.querySelector('.progress-pct').textContent = pct + '%';

    node.querySelector('.money-saved').textContent = 'Хватает: ' + eur(shownSaved);
    node.querySelector('.money-left').textContent =
      g.price ? 'Осталось: ' + eur(left) : 'цена не задана';

    node.querySelector('.goal-note').textContent = g.note || '';

    goalsEl.appendChild(node);
  }

  renderStats();
  renderBank();
}

function renderStats() {
  let total = 0, doneCount = 0;
  for (const g of data.goals) {
    total += Number(g.price) || 0;
    if (isDone(g)) doneCount++;
  }
  const pct = total > 0 ? Math.round((data.bank / total) * 100) : 0;
  document.getElementById('statTotal').textContent = eur(total);
  document.getElementById('statProgress').textContent = pct + '%';
  document.getElementById('statDone').textContent = doneCount + '/' + data.goals.length;
}

function renderBank() {
  document.getElementById('bankValue').textContent = eur(data.bank);
  renderBankHistory();
}

function renderBankHistory() {
  const ul = document.getElementById('bankHistoryList');
  ul.innerHTML = '';
  if (!data.history.length) {
    const li = document.createElement('li');
    li.className = 'hist-empty';
    li.textContent = 'Пока нет операций';
    li.style.border = 'none';
    li.style.background = 'transparent';
    ul.appendChild(li);
    return;
  }
  [...data.history].reverse().forEach((h) => {
    const li = document.createElement('li');
    li.className = h.amount >= 0 ? 'pos' : 'neg';
    const sign = h.amount >= 0 ? '+' : '−';
    const noteHtml = h.note ? ` <em class="hist-note">${escapeHtml(h.note)}</em>` : '';
    li.innerHTML =
      `<span>${sign}${eur(Math.abs(h.amount))}${noteHtml}</span>` +
      `<span>${fmtDate(h.date)}</span>`;
    const del = document.createElement('button');
    del.className = 'hist-del';
    del.textContent = '✕';
    del.title = 'удалить операцию';
    del.addEventListener('click', () => deleteHistory(h.id));
    li.appendChild(del);
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------- bank add/remove ---------- */
function changeBank(delta) {
  const newBank = data.bank + delta;
  if (newBank < 0) {
    alert('В банке столько нет — нельзя уйти в минус.');
    return;
  }
  // цели, что были закрыты ДО операции
  const wasDone = new Set(data.goals.filter(isDone).map((g) => g.id));
  data.bank = newBank;
  data.history.push({ id: uid(), amount: delta, date: new Date().toISOString() });
  save();
  render();

  floatBubble(delta);

  // если пополнение закрыло новую цель — BOOM
  if (delta > 0) {
    const newlyDone = data.goals.filter((g) => isDone(g) && !wasDone.has(g.id));
    if (newlyDone.length) boomBubble('BOOM!');
  }
}

function deleteHistory(histId) {
  const entry = data.history.find((h) => h.id === histId);
  if (!entry) return;
  if (data.bank - entry.amount < 0) {
    alert('Нельзя удалить: банк уйдёт в минус.');
    return;
  }
  data.bank -= entry.amount;
  data.history = data.history.filter((h) => h.id !== histId);
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

/* ---------- bank controls ---------- */
const bankAmount = document.getElementById('bankAmount');
function readBankAmount() {
  const v = parseFloat(bankAmount.value);
  if (!v || v <= 0) { bankAmount.focus(); return null; }
  return v;
}
document.getElementById('bankPlus').addEventListener('click', () => {
  const v = readBankAmount(); if (v == null) return;
  changeBank(v); bankAmount.value = '';
});
document.getElementById('bankMinus').addEventListener('click', () => {
  const v = readBankAmount(); if (v == null) return;
  changeBank(-v); bankAmount.value = '';
});
bankAmount.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('bankPlus').click();
});
document.getElementById('bankHistoryBtn').addEventListener('click', () => {
  const w = document.getElementById('bankHistoryWrap');
  w.hidden = !w.hidden;
});

/* ---------- card event delegation ---------- */
goalsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.goal-card');
  if (!card) return;
  const g = data.goals.find((x) => x.id === card.dataset.id);
  if (!g) return;

  if (e.target.closest('.btn-go')) {
    if (g.link) window.open(g.link, '_blank', 'noopener');
    else alert('У этой цели нет ссылки на товар.');
  } else if (e.target.closest('.btn-edit')) {
    openModal(g);
  }
});

/* ---------- modal ---------- */
const modal = document.getElementById('goalModal');
const form = document.getElementById('goalForm');
let currentImage = '';

function openModal(goal) {
  form.reset();
  currentImage = goal ? (goal.image || '') : '';
  document.getElementById('goalId').value = goal ? goal.id : '';
  document.getElementById('modalTitle').textContent = goal ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ЦЕЛЬ';
  document.getElementById('fName').value = goal ? goal.name : '';
  document.getElementById('fPrice').value = goal && goal.price != null ? goal.price : '';
  document.getElementById('fLink').value = goal ? goal.link : '';
  document.getElementById('fNote').value = goal ? goal.note : '';
  document.getElementById('fImageUrl').value =
    (goal && goal.image && !goal.image.startsWith('data:')) ? goal.image : '';
  updateImgPreview();
  document.getElementById('btnDelete').hidden = !goal;
  modal.hidden = false;
}

function closeModal() { modal.hidden = true; }

function updateImgPreview() {
  const wrap = document.getElementById('imgPreviewWrap');
  const img = document.getElementById('imgPreview');
  if (currentImage) { img.src = currentImage; wrap.hidden = false; }
  else { wrap.hidden = true; img.removeAttribute('src'); }
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
    currentImage = reader.result;
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
  const patch = {
    name: document.getElementById('fName').value.trim(),
    image: currentImage,
    price: priceVal === '' ? null : Math.max(0, parseFloat(priceVal) || 0),
    link: document.getElementById('fLink').value.trim(),
    note: document.getElementById('fNote').value.trim()
  };
  if (id) {
    const g = data.goals.find((x) => x.id === id);
    Object.assign(g, patch);
  } else {
    data.goals.push({ id: uid(), ...patch });
  }
  save();
  render();
  closeModal();
});

document.getElementById('btnDelete').addEventListener('click', () => {
  const id = document.getElementById('goalId').value;
  if (!id) return;
  if (!confirm('Удалить цель? (деньги в банке останутся)')) return;
  data.goals = data.goals.filter((x) => x.id !== id);
  save();
  render();
  closeModal();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
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
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
      let parsed = JSON.parse(reader.result);
      // поддержка старого экспорта (просто массив целей)
      if (Array.isArray(parsed)) {
        let bank = 0, history = [];
        const goals = parsed.map((g) => {
          bank += Number(g.saved) || 0;
          if (Array.isArray(g.history)) {
            history = history.concat(g.history.map((h) => ({
              id: h.id || uid(), amount: Number(h.amount) || 0,
              date: h.date || new Date().toISOString(),
              note: 'из «' + (g.name || 'цель') + '»'
            })));
          }
          return { id: g.id || uid(), name: g.name || 'Без названия', image: g.image || '',
            price: g.price != null ? g.price : null, link: g.link || '', note: g.note || '' };
        });
        parsed = { bank, history, goals };
      }
      if (!confirm('Импорт заменит текущие данные. Продолжить?')) return;
      data = normalize(parsed);
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
