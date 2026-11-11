// ==============================================================================
// DOMPETKU - MAIN APPLICATION CONTROLLER
// ==============================================================================

import Sortable from 'sortablejs';
import {
  state,
  subscribe,
  calculatePocketBalance,
  calculateTotalNetWorth,
  calculateCategoryExpense,
  loadUserData,
  ensureCategoryExists,
  addTransaction,
  addPocket,
  updatePocketsOrder,
  payDebtInstallment,
  archiveOldYearTransactions,
  fetchArchivedTransactions
} from './lib/state.js';
import {
  formatRupiah,
  formatCompact,
  formatDate,
  getRelativeDayLabel,
  formatCurrencyInput,
  parseCurrencyInput
} from './lib/formatters.js';
import {
  supabase,
  isSupabaseConfigured,
  saveSupabaseConfig,
  SUPABASE_URL
} from './lib/supabase.js';
import { exportTransactionsToCsv } from './lib/exportCsv.js';
import { renderDonutChart } from './components/DonutChart.js';
import { showToast } from './components/Toast.js';

// ==============================================================================
// 1. ROUTER & PAGE NAVIGATION SYSTEM
// ==============================================================================

const pages = [
  'onboarding',
  'signin',
  'home',
  'stats',
  'wallet',
  'debts',
  'settings',
  'transactions',
  'add-transaction'
];

const navPages = ['home', 'stats', 'wallet', 'settings'];
let currentPage = 'onboarding';

export function navigate(target) {
  if (target === currentPage) return;

  const currentIndex = pages.indexOf(currentPage);
  const targetIndex = pages.indexOf(target);

  pages.forEach((page, index) => {
    const el = document.getElementById('page-' + page);
    if (!el) return;

    if (index < targetIndex) {
      el.className = 'page-container page-hidden-left hide-scroll';
    } else if (index > targetIndex) {
      el.className = 'page-container page-hidden-right hide-scroll';
    } else {
      el.className = 'page-container page-active hide-scroll ' + (navPages.includes(page) ? 'pb-[100px]' : '');
    }
  });

  currentPage = target;

  // Bottom Nav Bar Visibility
  const nav = document.getElementById('bottom-nav');
  if (nav) {
    if (navPages.includes(target)) {
      nav.classList.remove('translate-y-[150%]');
    } else {
      nav.classList.add('translate-y-[150%]');
    }
  }

  // Active Bottom Nav Button Update
  if (navPages.includes(target)) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active', 'text-white');
      btn.classList.add('text-gray-500');
      const ind = btn.querySelector('.indicator');
      if (ind) ind.classList.add('hidden');
    });

    const activeBtn = document.getElementById('nav-' + target);
    if (activeBtn) {
      activeBtn.classList.remove('text-gray-500');
      activeBtn.classList.add('active', 'text-white');
      const ind = activeBtn.querySelector('.indicator');
      if (ind) ind.classList.remove('hidden');
    }
  }

  // Auto Refresh View on Navigate
  renderCurrentPageView(target);
}

// ==============================================================================
// 2. THEME ENGINE (DARK / LIGHT MODE)
// ==============================================================================

function applyTheme(isLight) {
  state.isLightMode = isLight;
  localStorage.setItem('dompetku_theme', isLight ? 'light' : 'dark');

  const icon = document.getElementById('theme-icon');
  const ball = document.getElementById('theme-toggle-ball');
  const toggleBg = document.getElementById('theme-toggle-bg');

  if (isLight) {
    document.body.classList.add('light-mode');
    if (icon) icon.className = 'fas fa-sun text-yellow-500';
    if (ball) ball.style.transform = 'translateX(20px)';
    if (toggleBg) toggleBg.classList.replace('bg-gray-600', 'bg-[#5b55f9]');
  } else {
    document.body.classList.remove('light-mode');
    if (icon) icon.className = 'fas fa-moon text-gray-300';
    if (ball) ball.style.transform = 'translateX(0px)';
    if (toggleBg) toggleBg.classList.replace('bg-[#5b55f9]', 'bg-gray-600');
  }
}

function toggleTheme() {
  applyTheme(!state.isLightMode);
}

// ==============================================================================
// 3. UI RENDERING ENGINES
// ==============================================================================

function renderCurrentPageView(pageName) {
  if (pageName === 'home') renderHomePage();
  else if (pageName === 'stats') renderStatsPage();
  else if (pageName === 'wallet') renderWalletPage();
  else if (pageName === 'debts') renderDebtsPage();
  else if (pageName === 'transactions') renderTransactionsPage();
  else if (pageName === 'settings') renderSettingsPage();
  else if (pageName === 'add-transaction') setupAddTransactionForm();
}

/**
 * HOME / DASHBOARD PAGE
 */
function renderHomePage() {
  const user = state.currentUser;
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = user ? user.full_name || user.username : 'Tamu';

  // Total Net Worth
  const totalNetWorth = calculateTotalNetWorth();
  const netWorthEl = document.getElementById('total-net-worth');
  if (netWorthEl) netWorthEl.textContent = formatRupiah(totalNetWorth);

  // Active Pocket Count
  const countEl = document.getElementById('active-pocket-count');
  if (countEl) countEl.textContent = `${state.pockets.length} Kantong`;

  // Onboarding Balance preview
  const obEl = document.getElementById('onboarding-balance');
  if (obEl) obEl.textContent = formatRupiah(totalNetWorth);

  // Pockets Snapshot
  const pocketsContainer = document.getElementById('home-pockets-list');
  if (pocketsContainer) {
    if (!state.pockets.length) {
      pocketsContainer.innerHTML = `
        <div class="glass p-4 rounded-2xl text-center text-xs text-gray-400">
          Belum ada kantong. Klik "+ Kantong Baru" untuk membuat.
        </div>
      `;
    } else {
      pocketsContainer.innerHTML = state.pockets.slice(0, 3).map(pocket => {
        const balance = calculatePocketBalance(pocket.id);
        const hasTarget = Boolean(pocket.target_balance && Number(pocket.target_balance) > 0);
        const targetPercent = hasTarget ? Math.min(100, (balance / Number(pocket.target_balance)) * 100).toFixed(0) : null;

        return `
          <div class="glass p-3.5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition cursor-pointer" onclick="window.dompetkuNavigate('wallet')">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white" style="background-color: ${pocket.color || '#5b55f9'}">
                <i class="fas ${pocket.icon || 'fa-wallet'} text-sm"></i>
              </div>
              <div>
                <p class="font-semibold text-xs text-white">${pocket.name}</p>
                <p class="text-[10px] text-gray-400">
                  ${hasTarget ? `Target: ${formatCompact(pocket.target_balance)} (${targetPercent}%)` : 'Kantong Aktif'}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-bold text-xs text-white">${formatRupiah(balance)}</p>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Recent Transactions (Limit 3)
  const recentContainer = document.getElementById('home-recent-transactions');
  if (recentContainer) {
    if (!state.transactions.length) {
      recentContainer.innerHTML = `
        <div class="glass p-4 rounded-2xl text-center text-xs text-gray-400">
          Belum ada transaksi tercatat.
        </div>
      `;
    } else {
      recentContainer.innerHTML = state.transactions.slice(0, 4).map(tx => {
        const isExp = tx.type === 'expense';
        const isInc = tx.type === 'income';
        const isTf = tx.type === 'transfer';
        const amountSign = isExp ? '-' : (isInc ? '+' : '↔ ');
        const amountColor = isExp ? 'text-gray-100' : (isInc ? 'text-green-400' : 'text-purple-300');
        const iconClass = isExp ? 'fa-arrow-up text-red-400' : (isInc ? 'fa-arrow-down text-green-400' : 'fa-paper-plane text-purple-400');

        return `
          <div class="glass p-3.5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                <i class="fas ${iconClass} text-xs"></i>
              </div>
              <div>
                <p class="font-semibold text-xs text-white">${tx.category_name || (isTf ? 'Pindah Dana' : 'Transaksi')}</p>
                <p class="text-[10px] text-gray-400">${formatDate(tx.date)} ${tx.notes ? '• ' + tx.notes : ''}</p>
              </div>
            </div>
            <span class="font-bold text-xs ${amountColor}">${amountSign}${formatRupiah(tx.amount)}</span>
          </div>
        `;
      }).join('');
    }
  }
}

/**
 * STATS & BUDGETING PAGE
 */
function renderStatsPage() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // 1. Total Pengeluaran Bulan Ini
  const monthExpenses = state.transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.date);
    return (d.getMonth() + 1) === currentMonth && d.getFullYear() === currentYear;
  });

  const totalExpense = monthExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const expenseEl = document.getElementById('stats-total-expense');
  if (expenseEl) expenseEl.textContent = formatRupiah(totalExpense);

  // 2. SVG Donut Chart Kategori
  const categoryMap = {};
  monthExpenses.forEach(t => {
    const cat = t.category_name || 'Lain-lain';
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount || 0);
  });

  const donutColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
  const donutData = Object.keys(categoryMap).map((catName, idx) => ({
    label: catName,
    value: categoryMap[catName],
    color: donutColors[idx % donutColors.length],
  }));

  const donutContainer = document.getElementById('stats-donut-container');
  if (donutContainer) {
    renderDonutChart(donutContainer, donutData, 'Pengeluaran', totalExpense);
  }

  // 3. Budgets List with Progress Bar & Expandable Detail
  const budgetContainer = document.getElementById('stats-budget-list');
  if (budgetContainer) {
    if (!state.budgets.length) {
      budgetContainer.innerHTML = `
        <div class="glass p-4 rounded-2xl text-center text-xs text-gray-400">
          Belum ada anggaran bulanan yang dibuat.
        </div>
      `;
    } else {
      budgetContainer.innerHTML = state.budgets.map((b, idx) => {
        const spent = calculateCategoryExpense(b.category_name, currentMonth, currentYear);
        const limit = Number(b.amount_limit) || 1;
        const percent = Math.min(100, Math.round((spent / limit) * 100));
        const isOverBudget = spent > limit;
        const isWarning = percent >= 90;

        // Color thresholding: red if >= 90%, orange if >= 75%, purple/blue otherwise
        const barColor = isWarning || isOverBudget ? 'bg-red-500' : (percent >= 75 ? 'bg-amber-500' : 'bg-[#5b55f9]');
        const badgeColor = isWarning || isOverBudget ? 'text-red-400 bg-red-500/10' : 'text-purple-300 bg-purple-500/10';

        // Matching transactions for expandable accordion
        const matchingTxs = monthExpenses.filter(t => t.category_name === b.category_name);
        const txsListHtml = matchingTxs.length ? matchingTxs.map(tx => `
          <div class="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 text-[11px]">
            <span class="text-gray-300">${formatDate(tx.date)} ${tx.notes ? '• ' + tx.notes : ''}</span>
            <span class="font-semibold text-white">-${formatRupiah(tx.amount)}</span>
          </div>
        `).join('') : '<p class="text-[10px] text-gray-500 py-1">Belum ada transaksi di bulan ini.</p>';

        return `
          <div class="glass rounded-2xl overflow-hidden transition-all duration-300 border border-white/5">
            <div class="p-4 cursor-pointer hover:bg-white/5 transition" onclick="window.toggleBudgetExpand('${idx}')">
              <div class="flex justify-between items-center mb-2">
                <span class="font-semibold text-xs text-white">${b.category_name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeColor}">
                  ${percent}% ${isOverBudget ? '(Over)' : ''}
                </span>
              </div>
              <div class="flex justify-between items-center text-[11px] text-gray-400 mb-2">
                <span>Terpakai: <strong class="text-white">${formatCompact(spent)}</strong></span>
                <span>Batas: <strong class="text-gray-300">${formatCompact(limit)}</strong></span>
              </div>
              <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700 ${barColor}" style="width: ${percent}%"></div>
              </div>
              <div class="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                <span>Klik untuk rincian riwayat</span>
                <i id="budget-arrow-${idx}" class="fas fa-chevron-down transition-transform duration-300"></i>
              </div>
            </div>
            
            <!-- Expandable detail list -->
            <div id="budget-detail-${idx}" class="hidden px-4 pb-3 pt-1 border-t border-white/5 bg-black/10">
              <div class="space-y-1">
                ${txsListHtml}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// Window helper for accordion toggle
window.toggleBudgetExpand = function(idx) {
  const detailEl = document.getElementById(`budget-detail-${idx}`);
  const arrowEl = document.getElementById(`budget-arrow-${idx}`);
  if (detailEl) {
    const isHidden = detailEl.classList.contains('hidden');
    if (isHidden) {
      detailEl.classList.remove('hidden');
      if (arrowEl) arrowEl.classList.add('rotate-180');
    } else {
      detailEl.classList.add('hidden');
      if (arrowEl) arrowEl.classList.remove('rotate-180');
    }
  }
};

/**
 * WALLET PAGE: POCKETS (WITH DRAG & DROP) & ASSETS
 */
let sortableInstance = null;

function renderWalletPage() {
  // Pockets count & Assets count
  const pCount = document.getElementById('wallet-pockets-count');
  const aCount = document.getElementById('wallet-assets-count');
  if (pCount) pCount.textContent = state.pockets.length;
  if (aCount) aCount.textContent = state.assets.length;

  // Render Pockets Container
  const pocketsContainer = document.getElementById('wallet-pockets-container');
  if (pocketsContainer) {
    if (!state.pockets.length) {
      pocketsContainer.innerHTML = `
        <div class="glass p-6 rounded-2xl text-center text-xs text-gray-400">
          Belum ada kantong dibuat. Buat kantong baru untuk mulai mencatat.
        </div>
      `;
    } else {
      pocketsContainer.innerHTML = state.pockets.map(p => {
        const balance = calculatePocketBalance(p.id);
        const hasTarget = Boolean(p.target_balance && Number(p.target_balance) > 0);
        const percent = hasTarget ? Math.min(100, Math.round((balance / Number(p.target_balance)) * 100)) : null;

        return `
          <div class="pocket-drag-item glass p-4 rounded-2xl cursor-grab active:cursor-grabbing hover:bg-white/10 transition relative overflow-hidden border border-white/5" data-id="${p.id}">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md" style="background-color: ${p.color || '#5b55f9'}">
                  <i class="fas ${p.icon || 'fa-wallet'} text-sm"></i>
                </div>
                <div>
                  <h4 class="font-bold text-xs text-white">${p.name}</h4>
                  <p class="text-[10px] text-gray-400">Saldo Awal: ${formatRupiah(p.initial_balance)}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="text-right">
                  <span class="text-[10px] text-gray-400 block font-medium">Saldo Aktual</span>
                  <span class="font-bold text-sm text-white">${formatRupiah(balance)}</span>
                </div>
                <div class="w-6 h-6 flex items-center justify-center text-gray-500 cursor-grab">
                  <i class="fas fa-ellipsis-vertical text-xs"></i>
                </div>
              </div>
            </div>

            ${hasTarget ? `
              <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                <div class="h-full bg-[#5b55f9] rounded-full" style="width: ${percent}%"></div>
              </div>
              <div class="flex justify-between text-[9px] text-gray-400 mt-1">
                <span>Target: ${formatCompact(p.target_balance)}</span>
                <span class="text-purple-300 font-semibold">${percent}% tercapai</span>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Setup SortableJS for Drag & Drop Reorder
      if (sortableInstance) sortableInstance.destroy();
      sortableInstance = new Sortable(pocketsContainer, {
        animation: 200,
        handle: '.pocket-drag-item',
        delay: 200,
        delayOnTouchOnly: true,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: async function () {
          const itemElements = pocketsContainer.querySelectorAll('.pocket-drag-item');
          const orderedIds = Array.from(itemElements).map(el => el.getAttribute('data-id'));
          
          const statusEl = document.getElementById('reorder-status');
          if (statusEl) {
            statusEl.classList.remove('hidden');
            setTimeout(() => statusEl.classList.add('hidden'), 2000);
          }

          await updatePocketsOrder(orderedIds);
          showToast('Urutan kantong berhasil diperbarui', 'success');
        },
      });
    }
  }

  // Render Assets Container
  const assetsContainer = document.getElementById('wallet-assets-container');
  if (assetsContainer) {
    if (!state.assets.length) {
      assetsContainer.innerHTML = `
        <div class="glass p-6 rounded-2xl text-center text-xs text-gray-400">
          Belum ada portofolio aset. Tambahkan emas, investasi, atau tabungan.
        </div>
      `;
    } else {
      assetsContainer.innerHTML = state.assets.map(a => {
        const isSavings = a.category === 'savings';
        let displayValue = Number(a.estimated_value) || 0;
        let noteExtra = '';

        if (isSavings && a.linked_pocket_id) {
          const linkedPocket = state.pockets.find(p => p.id === a.linked_pocket_id);
          displayValue = calculatePocketBalance(a.linked_pocket_id);
          noteExtra = `(Tersinkron: ${linkedPocket?.name || 'Kantong'})`;
        }

        const categoryIcons = {
          gold: 'fa-coins text-amber-400',
          investment: 'fa-chart-line text-purple-400',
          property: 'fa-building text-blue-400',
          valuable: 'fa-gem text-pink-400',
          savings: 'fa-piggy-bank text-emerald-400',
        };

        return `
          <div class="glass p-4 rounded-2xl flex items-center justify-between hover:bg-white/10 transition">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-base">
                <i class="fas ${categoryIcons[a.category] || 'fa-box'}"></i>
              </div>
              <div>
                <h4 class="font-bold text-xs text-white">${a.name}</h4>
                <p class="text-[10px] text-gray-400 capitalize">${a.category} <span class="text-purple-300 font-medium">${noteExtra}</span></p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-bold text-xs text-white">${formatRupiah(displayValue)}</p>
              <p class="text-[9px] text-gray-500">${a.notes || 'Aset Aktif'}</p>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

/**
 * DEBTS & RECEIVABLES PAGE
 */
let activeDebtFilter = 'active'; // 'active' | 'settled'

function renderDebtsPage() {
  const container = document.getElementById('debts-list-container');
  if (!container) return;

  const filteredDebts = state.debts.filter(d => {
    if (activeDebtFilter === 'active') return !d.is_settled;
    return d.is_settled;
  });

  if (!filteredDebts.length) {
    container.innerHTML = `
      <div class="glass p-6 rounded-2xl text-center text-xs text-gray-400">
        Tidak ada data ${activeDebtFilter === 'active' ? 'aktif' : 'lunas'} saat ini.
      </div>
    `;
    return;
  }

  container.innerHTML = filteredDebts.map(d => {
    const isDebt = d.type === 'debt'; // Saya berhutang
    const total = Number(d.total_amount) || 0;
    const paid = Number(d.paid_amount) || 0;
    const remaining = Math.max(0, total - paid);
    const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

    const typeBadge = isDebt 
      ? '<span class="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">Saya Berhutang</span>'
      : '<span class="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">Piutang (Dipinjam)</span>';

    return `
      <div class="glass p-4 rounded-2xl space-y-3 border border-white/5 hover:bg-white/5 transition">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2 mb-1">
              ${typeBadge}
              ${d.due_date ? `<span class="text-[9px] text-gray-400"><i class="fas fa-clock mr-1 text-[8px]"></i>Jatuh tempo: ${formatDate(d.due_date)}</span>` : ''}
            </div>
            <h4 class="font-bold text-sm text-white">${d.person_name}</h4>
          </div>
          <div class="text-right">
            <span class="text-[10px] text-gray-400 block">Sisa Pembayaran</span>
            <span class="font-bold text-xs ${remaining > 0 ? 'text-amber-400' : 'text-green-400'}">
              ${formatRupiah(remaining)}
            </span>
          </div>
        </div>

        <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500 rounded-full" style="width: ${progress}%"></div>
        </div>

        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>Terbayar: ${formatCompact(paid)} / ${formatCompact(total)} (${progress}%)</span>
          ${!d.is_settled ? `
            <button onclick="window.openPayDebtModal('${d.id}')" class="btn-gradient text-white px-3 py-1.5 rounded-xl font-semibold text-[10px] shadow-sm hover:opacity-95 transition">
              Bayar Cicilan
            </button>
          ` : `
            <span class="text-green-400 font-semibold"><i class="fas fa-check-circle mr-1"></i>Lunas</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * TRANSACTIONS PAGE (FILTER & SEARCH)
 */
function renderTransactionsPage() {
  const container = document.getElementById('transactions-grouped-list');
  if (!container) return;

  const query = state.txFilter.search.toLowerCase();
  const tab = state.txFilter.tab;
  const now = new Date();

  const filtered = state.transactions.filter(t => {
    // Search filter
    if (query) {
      const matchCat = (t.category_name || '').toLowerCase().includes(query);
      const matchNotes = (t.notes || '').toLowerCase().includes(query);
      if (!matchCat && !matchNotes) return false;
    }

    // Tab filter
    if (tab === 'this_month') {
      const d = new Date(t.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
    } else if (tab === 'this_week') {
      const d = new Date(t.date);
      const diffTime = Math.abs(now - d);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 7) return false;
    }

    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="glass p-8 rounded-2xl text-center text-xs text-gray-400">
        <i class="fas fa-receipt text-3xl mb-2 opacity-30"></i>
        <p>Tidak ada transaksi ditemukan.</p>
      </div>
    `;
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(tx => {
    const label = getRelativeDayLabel(tx.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });

  container.innerHTML = Object.keys(groups).map(dateLabel => {
    const txItems = groups[dateLabel].map(tx => {
      const isExp = tx.type === 'expense';
      const isInc = tx.type === 'income';
      const amountSign = isExp ? '-' : (isInc ? '+' : '↔ ');
      const amountColor = isExp ? 'text-gray-100' : (isInc ? 'text-green-400' : 'text-purple-300');
      const icon = isExp ? 'fa-shopping-bag' : (isInc ? 'fa-arrow-down text-green-400' : 'fa-paper-plane text-purple-400');

      return `
        <div class="glass p-3.5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
              <i class="fas ${icon} text-xs text-gray-300"></i>
            </div>
            <div>
              <p class="font-semibold text-xs text-white">${tx.category_name || (tx.type === 'transfer' ? 'Pindah Dana' : 'Transaksi')}</p>
              <p class="text-[10px] text-gray-400">${tx.notes || formatDate(tx.date)}</p>
            </div>
          </div>
          <span class="font-bold text-xs ${amountColor}">${amountSign}${formatRupiah(tx.amount)}</span>
        </div>
      `;
    }).join('');

    return `
      <div>
        <p class="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wider">${dateLabel}</p>
        <div class="space-y-2">
          ${txItems}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * SETTINGS PAGE
 */
function renderSettingsPage() {
  const user = state.currentUser;
  const fnEl = document.getElementById('settings-user-fullname');
  const unEl = document.getElementById('settings-user-username');
  if (fnEl) fnEl.textContent = user ? user.full_name : 'Pengguna Tamu';
  if (unEl) unEl.textContent = user ? `@${user.username}` : '@tamu';

  const sbPill = document.getElementById('supabase-status-pill');
  if (sbPill) {
    if (isSupabaseConfigured()) {
      sbPill.textContent = 'Terhubung';
      sbPill.className = 'text-[10px] text-emerald-400 font-medium';
    } else {
      sbPill.textContent = 'Demo Mode (Offline)';
      sbPill.className = 'text-[10px] text-amber-400 font-medium';
    }
  }
}

// ==============================================================================
// 4. ADD TRANSACTION FORM ENGINE
// ==============================================================================

let selectedTxType = 'expense';

function setupAddTransactionForm() {
  const amountInput = document.getElementById('input-tx-amount');
  if (amountInput && !amountInput.dataset.bound) {
    formatCurrencyInput(amountInput);
    amountInput.dataset.bound = 'true';
  }

  const dateInput = document.getElementById('input-tx-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Populate source pockets
  const sourceSelect = document.getElementById('select-tx-source-pocket');
  const destSelect = document.getElementById('select-tx-dest-pocket');
  
  const optionsHtml = state.pockets.map(p => `
    <option value="${p.id}" class="bg-[#1a1b2f] text-white">${p.name} (Saldo: ${formatCompact(calculatePocketBalance(p.id))})</option>
  `).join('');

  if (sourceSelect) sourceSelect.innerHTML = optionsHtml;
  if (destSelect) destSelect.innerHTML = optionsHtml;

  // Datalist categories
  const datalist = document.getElementById('category-datalist');
  if (datalist) {
    datalist.innerHTML = state.categories.map(c => `<option value="${c.name}">`).join('');
  }

  // Update type buttons
  setTxType(selectedTxType);
}

function setTxType(type) {
  selectedTxType = type;
  const btnExp = document.getElementById('btn-tx-type-expense');
  const btnInc = document.getElementById('btn-tx-type-income');
  const btnTf = document.getElementById('btn-tx-type-transfer');
  const fieldDest = document.getElementById('field-dest-pocket');
  const fieldCat = document.getElementById('field-category');

  const activeClass = 'flex-1 rounded-xl py-2 text-xs font-semibold transition-all bg-white/10 shadow-sm text-white';
  const inactiveClass = 'flex-1 rounded-xl py-2 text-xs font-semibold text-gray-400 hover:text-white transition-all';

  if (btnExp) btnExp.className = type === 'expense' ? activeClass : inactiveClass;
  if (btnInc) btnInc.className = type === 'income' ? activeClass : inactiveClass;
  if (btnTf) btnTf.className = type === 'transfer' ? activeClass : inactiveClass;

  if (type === 'transfer') {
    if (fieldDest) fieldDest.classList.remove('hidden');
    if (fieldCat) fieldCat.classList.add('hidden');
  } else {
    if (fieldDest) fieldDest.classList.add('hidden');
    if (fieldCat) fieldCat.classList.remove('hidden');
  }
}

// ==============================================================================
// 5. MODAL SYSTEMS (PROFILE, POCKET, BUDGET, ASSET, ANNUAL REPORT)
// ==============================================================================

const modalsRoot = document.getElementById('modals-root');

function openModal(contentHtml) {
  if (!modalsRoot) return;
  modalsRoot.innerHTML = `
    <div id="active-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 modal-backdrop opacity-0">
      <div class="w-full max-w-sm app-bg border border-white/10 rounded-3xl p-6 shadow-2xl modal-content transform scale-95 opacity-0 text-white relative">
        ${contentHtml}
      </div>
    </div>
  `;

  const modal = document.getElementById('active-modal');
  const modalContent = modal?.querySelector('.modal-content');
  requestAnimationFrame(() => {
    modal?.classList.remove('opacity-0');
    modalContent?.classList.remove('scale-95', 'opacity-0');
    modalContent?.classList.add('scale-100', 'opacity-100');
  });
}

export function closeModal() {
  const modal = document.getElementById('active-modal');
  if (modal) {
    modal.classList.add('opacity-0');
    setTimeout(() => {
      if (modalsRoot) modalsRoot.innerHTML = '';
    }, 250);
  }
}
window.closeDompetkuModal = closeModal;

// Modal: Tambah Kantong
function openAddPocketModal() {
  openModal(`
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-base">Tambah Kantong Baru</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <form id="form-add-pocket" class="space-y-3.5" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Nama Kantong</label>
        <input id="input-pocket-name" type="text" placeholder="misal: Tabungan Haji, BCA" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Saldo Awal (Rp)</label>
        <input id="input-pocket-initial" type="text" inputmode="numeric" placeholder="0" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Target Saldo (Opsional)</label>
        <input id="input-pocket-target" type="text" inputmode="numeric" placeholder="Kosongkan jika tidak ada target" class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-gray-400 font-medium mb-1 block">Ikon FontAwesome</label>
          <select id="input-pocket-icon" class="w-full glass-input rounded-xl py-3 px-2 text-xs bg-[#1a1b2f]">
            <option value="fa-wallet">Dompet</option>
            <option value="fa-credit-card">Kartu Bank</option>
            <option value="fa-piggy-bank">Celengan</option>
            <option value="fa-building-columns">Bank</option>
            <option value="fa-money-bill-wave">Uang Tunai</option>
          </select>
        </div>
        <div>
          <label class="text-[11px] text-gray-400 font-medium mb-1 block">Warna Aksen</label>
          <input id="input-pocket-color" type="color" value="#5b55f9" class="w-full h-10 rounded-xl bg-transparent cursor-pointer">
        </div>
      </div>
      <div class="pt-3">
        <button id="btn-submit-add-pocket" type="submit" class="w-full btn-gradient rounded-xl py-3.5 font-semibold text-xs text-white">
          Simpan Kantong
        </button>
      </div>
    </form>
  `);

  formatCurrencyInput(document.getElementById('input-pocket-initial'));
  formatCurrencyInput(document.getElementById('input-pocket-target'));

  document.getElementById('form-add-pocket')?.addEventListener('submit', async () => {
    const name = document.getElementById('input-pocket-name')?.value.trim();
    const initial = parseCurrencyInput(document.getElementById('input-pocket-initial'));
    const target = parseCurrencyInput(document.getElementById('input-pocket-target')) || null;
    const icon = document.getElementById('input-pocket-icon')?.value || 'fa-wallet';
    const color = document.getElementById('input-pocket-color')?.value || '#5b55f9';

    if (!name) return;

    try {
      await addPocket({
        name,
        initial_balance: initial,
        target_balance: target,
        icon,
        color
      });
      closeModal();
      showToast('Kantong berhasil ditambahkan!', 'success');
      renderHomePage();
      renderWalletPage();
    } catch (err) {
      showToast('Gagal menambah kantong: ' + err.message, 'error');
    }
  });
}

// Modal: Pasang Anggaran (Set Budget)
function openSetBudgetModal() {
  openModal(`
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-base">Atur Anggaran Bulanan</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <form id="form-set-budget" class="space-y-3.5" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Kategori Pengeluaran</label>
        <select id="input-budget-cat" class="w-full glass-input rounded-xl py-3 px-3 text-xs bg-[#1a1b2f]" required>
          ${state.categories.filter(c => c.type === 'expense').map(c => `
            <option value="${c.name}">${c.name}</option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Batas Maksimal Pengeluaran (Rp)</label>
        <input id="input-budget-limit" type="text" inputmode="numeric" placeholder="misal: 1.500.000" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div class="pt-3">
        <button type="submit" class="w-full btn-gradient rounded-xl py-3.5 font-semibold text-xs text-white">
          Simpan Anggaran
        </button>
      </div>
    </form>
  `);

  formatCurrencyInput(document.getElementById('input-budget-limit'));

  document.getElementById('form-set-budget')?.addEventListener('submit', async () => {
    const catName = document.getElementById('input-budget-cat')?.value;
    const limit = parseCurrencyInput(document.getElementById('input-budget-limit'));
    const m = new Date().getMonth() + 1;
    const y = new Date().getFullYear();

    if (!catName || limit <= 0) return;

    const existingIndex = state.budgets.findIndex(b => b.category_name === catName && b.month === m && b.year === y);
    if (existingIndex >= 0) {
      state.budgets[existingIndex].amount_limit = limit;
    } else {
      state.budgets.push({
        id: crypto.randomUUID(),
        category_name: catName,
        month: m,
        year: y,
        amount_limit: limit,
      });
    }

    if (isSupabaseConfigured() && state.currentUser) {
      await supabase.from('budgets').upsert({
        user_id: state.currentUser.id,
        category_name: catName,
        month: m,
        year: y,
        amount_limit: limit,
      });
    }

    closeModal();
    showToast('Anggaran berhasil diperbarui!', 'success');
    renderStatsPage();
  });
}

// Modal: Tambah Hutang/Piutang
function openAddDebtModal() {
  openModal(`
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-base">Catat Hutang / Piutang</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <form id="form-add-debt" class="space-y-3.5" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Jenis Catatan</label>
        <select id="input-debt-type" class="w-full glass-input rounded-xl py-3 px-3 text-xs bg-[#1a1b2f]">
          <option value="debt">Saya Berhutang (Kewajiban Bayar)</option>
          <option value="receivable">Piutang (Orang Lain Berhutang ke Saya)</option>
        </select>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Nama Pihak (Orang / Lembaga)</label>
        <input id="input-debt-person" type="text" placeholder="misal: Budi / Bank Mandiri" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Total Nominal (Rp)</label>
        <input id="input-debt-total" type="text" inputmode="numeric" placeholder="0" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Tanggal Jatuh Tempo (Opsional)</label>
        <input id="input-debt-due" type="date" class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Catatan</label>
        <input id="input-debt-notes" type="text" placeholder="Keperluan pinjaman..." class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div class="pt-3">
        <button type="submit" class="w-full btn-gradient rounded-xl py-3.5 font-semibold text-xs text-white">
          Simpan Catatan
        </button>
      </div>
    </form>
  `);

  formatCurrencyInput(document.getElementById('input-debt-total'));

  document.getElementById('form-add-debt')?.addEventListener('submit', async () => {
    const type = document.getElementById('input-debt-type')?.value;
    const person = document.getElementById('input-debt-person')?.value.trim();
    const total = parseCurrencyInput(document.getElementById('input-debt-total'));
    const due = document.getElementById('input-debt-due')?.value || null;
    const notes = document.getElementById('input-debt-notes')?.value.trim() || '';

    if (!person || total <= 0) return;

    const newDebt = {
      id: crypto.randomUUID(),
      user_id: state.currentUser?.id,
      type,
      person_name: person,
      total_amount: total,
      paid_amount: 0,
      due_date: due,
      is_settled: false,
      notes,
    };

    state.debts.unshift(newDebt);
    if (isSupabaseConfigured() && state.currentUser) {
      await supabase.from('debts').insert(newDebt);
    }

    closeModal();
    showToast('Catatan hutang/piutang tersimpan!', 'success');
    renderDebtsPage();
  });
}

// Modal: Bayar Cicilan Terintegrasi
window.openPayDebtModal = function(debtId) {
  const debt = state.debts.find(d => d.id === debtId);
  if (!debt) return;

  const remaining = Math.max(0, (Number(debt.total_amount) || 0) - (Number(debt.paid_amount) || 0));

  openModal(`
    <div class="flex justify-between items-center mb-4">
      <div>
        <h3 class="font-bold text-base">Bayar Cicilan</h3>
        <p class="text-[11px] text-gray-400">${debt.person_name} (Sisa: ${formatRupiah(remaining)})</p>
      </div>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <form id="form-pay-debt" class="space-y-3.5" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Nominal Cicilan (Rp)</label>
        <input id="input-pay-amount" type="text" inputmode="numeric" value="${new Intl.NumberFormat('id-ID').format(remaining)}" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">
          ${debt.type === 'debt' ? 'Ambil Dana dari Kantong' : 'Setor Dana ke Kantong'}
        </label>
        <select id="select-pay-pocket" class="w-full glass-input rounded-xl py-3 px-3 text-xs bg-[#1a1b2f]" required>
          ${state.pockets.map(p => `
            <option value="${p.id}">${p.name} (Saldo: ${formatCompact(calculatePocketBalance(p.id))})</option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Keterangan Tambahan</label>
        <input id="input-pay-notes" type="text" placeholder="Cicilan ke-..." class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div class="pt-3">
        <button type="submit" class="w-full btn-gradient rounded-xl py-3.5 font-semibold text-xs text-white">
          Konfirmasi Pembayaran
        </button>
      </div>
    </form>
  `);

  formatCurrencyInput(document.getElementById('input-pay-amount'));

  document.getElementById('form-pay-debt')?.addEventListener('submit', async () => {
    const amount = parseCurrencyInput(document.getElementById('input-pay-amount'));
    const pocketId = document.getElementById('select-pay-pocket')?.value;
    const notes = document.getElementById('input-pay-notes')?.value.trim();

    if (amount <= 0 || !pocketId) return;

    try {
      await payDebtInstallment({
        debtId,
        amount,
        pocketId,
        notes
      });
      closeModal();
      showToast('Cicilan berhasil dicatat & saldo kantong diperbarui!', 'success');
      renderDebtsPage();
      renderHomePage();
    } catch (err) {
      showToast('Gagal membayar cicilan: ' + err.message, 'error');
    }
  });
};

// Modal: Tambah Aset Berharga
function openAddAssetModal() {
  openModal(`
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-base">Tambah Aset Berharga</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <form id="form-add-asset" class="space-y-3.5" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Klasifikasi Aset</label>
        <select id="input-asset-cat" class="w-full glass-input rounded-xl py-3 px-3 text-xs bg-[#1a1b2f]">
          <option value="gold">Emas / Logam Mulia</option>
          <option value="investment">Investasi (Saham / Reksa Dana / Kripto)</option>
          <option value="property">Properti (Tanah / Rumah)</option>
          <option value="valuable">Barang Berharga (Kendaraan / Koleksi)</option>
          <option value="savings">Tabungan & Simpanan</option>
        </select>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Nama Aset</label>
        <input id="input-asset-name" type="text" placeholder="misal: Antam 10gr, Saham BBCA" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div id="field-asset-pocket-link" class="hidden">
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Sinkronkan ke Saldo Kantong (Opsional)</label>
        <select id="input-asset-linked-pocket" class="w-full glass-input rounded-xl py-3 px-3 text-xs bg-[#1a1b2f]">
          <option value="">-- Tanpa Sinkronisasi (Manual) --</option>
          ${state.pockets.map(p => `
            <option value="${p.id}">${p.name}</option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Estimasi Nilai (Rp)</label>
        <input id="input-asset-value" type="text" inputmode="numeric" placeholder="0" class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Catatan</label>
        <input id="input-asset-notes" type="text" placeholder="Lokasi simpan, kuantitas..." class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div class="pt-3">
        <button type="submit" class="w-full btn-gradient rounded-xl py-3.5 font-semibold text-xs text-white">
          Simpan Aset
        </button>
      </div>
    </form>
  `);

  formatCurrencyInput(document.getElementById('input-asset-value'));

  const catSelect = document.getElementById('input-asset-cat');
  const pocketLinkField = document.getElementById('field-asset-pocket-link');
  catSelect?.addEventListener('change', () => {
    if (catSelect.value === 'savings') {
      pocketLinkField?.classList.remove('hidden');
    } else {
      pocketLinkField?.classList.add('hidden');
    }
  });

  document.getElementById('form-add-asset')?.addEventListener('submit', async () => {
    const category = catSelect?.value;
    const name = document.getElementById('input-asset-name')?.value.trim();
    const linkedPocket = document.getElementById('input-asset-linked-pocket')?.value || null;
    const value = parseCurrencyInput(document.getElementById('input-asset-value'));
    const notes = document.getElementById('input-asset-notes')?.value.trim();

    if (!name) return;

    const newAsset = {
      id: crypto.randomUUID(),
      user_id: state.currentUser?.id,
      category,
      name,
      estimated_value: value,
      linked_pocket_id: linkedPocket,
      notes,
    };

    state.assets.unshift(newAsset);
    if (isSupabaseConfigured() && state.currentUser) {
      await supabase.from('assets').insert(newAsset);
    }

    closeModal();
    showToast('Aset berharga berhasil ditambahkan!', 'success');
    renderWalletPage();
    renderHomePage();
  });
}

// Modal: Edit Profil
function openProfileModal() {
  const user = state.currentUser;
  openModal(`
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-base">Profil Pengguna</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <form id="form-edit-profile" class="space-y-3.5" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Username (Permanen)</label>
        <input type="text" value="${user?.username || ''}" class="w-full glass-input rounded-xl py-3 px-3 text-xs opacity-60 cursor-not-allowed" disabled>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Nama Lengkap</label>
        <input id="input-edit-fullname" type="text" value="${user?.full_name || ''}" class="w-full glass-input rounded-xl py-3 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Ganti Password (Kosongkan jika tetap)</label>
        <input id="input-edit-password" type="password" placeholder="Minimal 6 karakter" class="w-full glass-input rounded-xl py-3 px-3 text-xs">
      </div>
      <div class="pt-3">
        <button type="submit" class="w-full btn-gradient rounded-xl py-3.5 font-semibold text-xs text-white">
          Perbarui Profil
        </button>
      </div>
    </form>
  `);

  document.getElementById('form-edit-profile')?.addEventListener('submit', async () => {
    const newName = document.getElementById('input-edit-fullname')?.value.trim();
    const newPassword = document.getElementById('input-edit-password')?.value;

    if (!newName) return;

    if (user) {
      user.full_name = newName;
      state.currentUser = user;
      localStorage.setItem('dompetku_user', JSON.stringify(user));

      if (isSupabaseConfigured()) {
        await supabase.from('profiles').update({ full_name: newName }).eq('id', user.id);
        if (newPassword && newPassword.length >= 6) {
          await supabase.auth.updateUser({ password: newPassword });
        }
      }
    }

    closeModal();
    showToast('Profil berhasil diperbarui!', 'success');
    renderSettingsPage();
    renderHomePage();
  });
}

// Modal: Supabase Cloud Database Config
function openSupabaseSetupModal() {
  openModal(`
    <div class="flex justify-between items-center mb-3">
      <h3 class="font-bold text-base">Setup Supabase Database</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <p class="text-[11px] text-gray-400 mb-4 leading-relaxed">
      Hubungkan dengan project Supabase Anda untuk sinkronisasi cloud real-time, autentikasi aman, dan backup otomatis.
    </p>
    <form id="form-supabase-config" class="space-y-3" onsubmit="return false;">
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Project URL</label>
        <input id="input-sb-url" type="url" placeholder="https://xyzcompany.supabase.co" value="${SUPABASE_URL}" class="w-full glass-input rounded-xl py-2.5 px-3 text-xs" required>
      </div>
      <div>
        <label class="text-[11px] text-gray-400 font-medium mb-1 block">Anon Public Key</label>
        <input id="input-sb-key" type="password" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." class="w-full glass-input rounded-xl py-2.5 px-3 text-xs" required>
      </div>
      <div class="pt-2 space-y-2">
        <button type="submit" class="w-full btn-gradient rounded-xl py-3 font-semibold text-xs text-white">
          Simpan & Hubungkan
        </button>
        <a href="/supabase-schema.sql" target="_blank" class="block text-center text-[10px] text-purple-300 hover:underline">
          <i class="fas fa-download mr-1"></i>Unduh Skrip SQL Database
        </a>
      </div>
    </form>
  `);

  document.getElementById('form-supabase-config')?.addEventListener('submit', () => {
    const url = document.getElementById('input-sb-url')?.value.trim();
    const key = document.getElementById('input-sb-key')?.value.trim();
    if (url && key) {
      saveSupabaseConfig(url, key);
    }
  });
}

// Modal: Laporan Tahunan Fullscreen
async function openAnnualReportModal() {
  const currentYear = new Date().getFullYear();

  openModal(`
    <div class="flex justify-between items-center mb-4">
      <div>
        <h3 class="font-bold text-base">Laporan Keuangan Tahunan</h3>
        <p class="text-[11px] text-gray-400">Ringkasan Arus Kas & Pertumbuhan Tabungan</p>
      </div>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Year Selector -->
    <div class="flex items-center gap-2 mb-4">
      <label class="text-xs text-gray-400">Pilih Tahun:</label>
      <select id="select-annual-year" class="glass-input rounded-xl py-1.5 px-3 text-xs bg-[#1a1b2f]">
        <option value="${currentYear}">${currentYear}</option>
        <option value="${currentYear - 1}">${currentYear - 1}</option>
        <option value="${currentYear - 2}">${currentYear - 2}</option>
      </select>
    </div>

    <div id="annual-report-body" class="space-y-4">
      <div class="flex justify-center py-6 text-gray-400 text-xs">
        <i class="fas fa-circle-notch fa-spin mr-2"></i> Mengkalkulasi data tahunan...
      </div>
    </div>
  `);

  const selectYear = document.getElementById('select-annual-year');
  selectYear?.addEventListener('change', () => {
    loadAnnualStats(Number(selectYear.value));
  });

  loadAnnualStats(currentYear);
}

async function loadAnnualStats(targetYear) {
  const bodyEl = document.getElementById('annual-report-body');
  if (!bodyEl) return;

  // Lazy load transactions jika tahun berbeda
  const currentYear = new Date().getFullYear();
  let txList = state.transactions;
  if (targetYear !== currentYear) {
    txList = await fetchArchivedTransactions(targetYear);
  }

  // Hitung pemasukan & pengeluaran tahunan
  let totalIncome = 0;
  let totalExpense = 0;
  const monthStats = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

  txList.forEach(t => {
    const d = new Date(t.date);
    if (d.getFullYear() === targetYear) {
      const m = d.getMonth(); // 0-11
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
        monthStats[m].income += amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;
        monthStats[m].expense += amt;
      }
    }
  });

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // Monthly Bars Svg
  const maxMonthVal = Math.max(...monthStats.map(m => Math.max(m.income, m.expense)), 1);
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const barsHtml = monthStats.map((m, idx) => {
    const incHeight = Math.round((m.income / maxMonthVal) * 50);
    const expHeight = Math.round((m.expense / maxMonthVal) * 50);

    return `
      <div class="flex-1 flex flex-col items-center">
        <div class="h-16 w-full flex items-end justify-center gap-0.5">
          <div class="w-1.5 bg-green-400 rounded-t-sm" style="height: ${incHeight}px" title="Masuk: ${formatRupiah(m.income)}"></div>
          <div class="w-1.5 bg-red-400 rounded-t-sm" style="height: ${expHeight}px" title="Keluar: ${formatRupiah(m.expense)}"></div>
        </div>
        <span class="text-[8px] text-gray-400 mt-1">${monthsShort[idx]}</span>
      </div>
    `;
  }).join('');

  bodyEl.innerHTML = `
    <!-- Top 3 Stat Cards -->
    <div class="grid grid-cols-2 gap-2.5">
      <div class="glass p-3 rounded-2xl">
        <span class="text-[10px] text-gray-400 block font-medium">Total Pemasukan</span>
        <span class="font-bold text-xs text-green-400">+${formatRupiah(totalIncome)}</span>
      </div>
      <div class="glass p-3 rounded-2xl">
        <span class="text-[10px] text-gray-400 block font-medium">Total Pengeluaran</span>
        <span class="font-bold text-xs text-red-400">-${formatRupiah(totalExpense)}</span>
      </div>
    </div>

    <!-- Net Savings & Rate -->
    <div class="glass p-4 rounded-2xl flex items-center justify-between border border-purple-500/20">
      <div>
        <span class="text-[10px] text-gray-400 block">Sisa Tabungan Bersih</span>
        <span class="font-extrabold text-sm text-white">${formatRupiah(netSavings)}</span>
      </div>
      <div class="text-right">
        <span class="text-[10px] text-gray-400 block">Savings Rate</span>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
          ${savingsRate}%
        </span>
      </div>
    </div>

    <!-- Monthly Comparison Chart -->
    <div class="glass p-4 rounded-2xl">
      <div class="flex justify-between items-center mb-3">
        <span class="text-xs font-semibold">Grafik Bulanan (${targetYear})</span>
        <div class="flex gap-2 text-[9px]">
          <span class="flex items-center gap-1 text-green-400"><span class="w-2 h-2 rounded-full bg-green-400"></span>Masuk</span>
          <span class="flex items-center gap-1 text-red-400"><span class="w-2 h-2 rounded-full bg-red-400"></span>Keluar</span>
        </div>
      </div>
      <div class="flex justify-between gap-1 pt-2">
        ${barsHtml}
      </div>
    </div>
  `;
}

// Modal: Arsipkan Transaksi Tahun Lalu
function openArchiveDataModal() {
  const lastYear = new Date().getFullYear() - 1;
  openModal(`
    <div class="flex justify-between items-center mb-3">
      <h3 class="font-bold text-base">Arsip Data Transaksi</h3>
      <button onclick="window.closeDompetkuModal()" class="w-8 h-8 rounded-full glass flex items-center justify-center text-xs text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <p class="text-xs text-gray-300 mb-4 leading-relaxed">
      Memindahkan transaksi tahun <strong>${lastYear}</strong> dan sebelumnya ke tabel arsip untuk menjaga kecepatan pembukaan aplikasi tetap kilat.
    </p>
    <div class="p-3 rounded-2xl glass mb-4 text-[11px] text-gray-400">
      <i class="fas fa-info-circle mr-1 text-blue-400"></i> Data tidak hilang. Transaksi arsip tetap dapat diakses di menu <strong>Laporan Tahunan</strong>.
    </div>
    <div class="flex gap-2">
      <button onclick="window.closeDompetkuModal()" class="flex-1 glass py-3 rounded-xl text-xs text-gray-300 hover:text-white">
        Batal
      </button>
      <button id="btn-confirm-archive" class="flex-1 btn-gradient py-3 rounded-xl text-xs font-semibold text-white">
        Proses Arsip
      </button>
    </div>
  `);

  document.getElementById('btn-confirm-archive')?.addEventListener('click', async () => {
    try {
      const count = await archiveOldYearTransactions(lastYear);
      closeModal();
      showToast(`${count || 0} transaksi berhasil diarsipkan!`, 'success');
    } catch (err) {
      showToast('Gagal mengarsipkan: ' + err.message, 'error');
    }
  });
}

// ==============================================================================
// 6. EVENT LISTENERS BINDING
// ==============================================================================

function bindAppEvents() {
  // Navigation Routing Buttons
  document.getElementById('btn-get-started')?.addEventListener('click', () => {
    navigate('signin');
  });

  document.getElementById('link-see-all-tx')?.addEventListener('click', () => navigate('transactions'));
  document.getElementById('link-view-all-pockets')?.addEventListener('click', () => navigate('wallet'));
  document.getElementById('btn-tx-back')?.addEventListener('click', () => navigate('home'));
  document.getElementById('btn-stats-back')?.addEventListener('click', () => navigate('home'));
  document.getElementById('btn-debts-back')?.addEventListener('click', () => navigate('settings'));
  document.getElementById('btn-add-tx-back')?.addEventListener('click', () => navigate('home'));
  document.getElementById('btn-home-profile')?.addEventListener('click', () => navigate('settings'));

  // Bottom Navigation Clicks
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      if (target) navigate(target);
    });
  });

  // Theme Toggle
  document.getElementById('btn-toggle-theme')?.addEventListener('click', toggleTheme);

  // Auth Tabs (Login vs Register)
  let isRegisterMode = false;
  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-register');
  const fieldFullName = document.getElementById('field-fullname');
  const btnSubmitAuth = document.getElementById('btn-submit-auth');

  tabLogin?.addEventListener('click', () => {
    isRegisterMode = false;
    tabLogin.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all btn-gradient text-white';
    tabReg.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-all';
    fieldFullName?.classList.add('hidden');
    if (btnSubmitAuth) btnSubmitAuth.textContent = 'Masuk ke Akun';
  });

  tabReg?.addEventListener('click', () => {
    isRegisterMode = true;
    tabReg.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all btn-gradient text-white';
    tabLogin.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-all';
    fieldFullName?.classList.remove('hidden');
    if (btnSubmitAuth) btnSubmitAuth.textContent = 'Buat Akun Baru';
  });

  // Password Visibility Toggle
  const togglePassBtn = document.getElementById('btn-toggle-password');
  const passInput = document.getElementById('input-password');
  togglePassBtn?.addEventListener('click', () => {
    if (passInput.type === 'password') {
      passInput.type = 'text';
      togglePassBtn.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      passInput.type = 'password';
      togglePassBtn.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // Demo Mode Login
  document.getElementById('btn-quick-demo')?.addEventListener('click', () => {
    state.currentUser = {
      id: crypto.randomUUID(),
      username: 'smith_demo',
      full_name: 'Smith Doe',
    };
    localStorage.setItem('dompetku_user', JSON.stringify(state.currentUser));
    loadUserData();
    showToast('Masuk dalam Demo Mode!', 'info');
    navigate('home');
  });

  // Auth Form Submit
  document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
    e?.preventDefault?.();
    const userInput = document.getElementById('input-username')?.value.trim();
    const password = document.getElementById('input-password')?.value;
    const fullName = document.getElementById('input-fullname')?.value.trim() || userInput;

    if (!userInput || !password) return;

    if (isRegisterMode && password.length < 6) {
      showToast('Password minimal 6 karakter', 'error');
      return;
    }

    const cleanInput = userInput.toLowerCase();
    // Jika input mengandung '@', berarti user memasukkan email lengkap (e.g. arif.setiawan2209@gmail.com)
    // Jika tidak mengandung '@', gunakan format internal username@dompetku.local
    const emailToUse = cleanInput.includes('@') ? cleanInput : `${cleanInput}@dompetku.local`;
    const usernameForProfile = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;

    if (!isSupabaseConfigured()) {
      // Offline fallback login
      state.currentUser = {
        id: crypto.randomUUID(),
        username: usernameForProfile,
        full_name: fullName,
      };
      localStorage.setItem('dompetku_user', JSON.stringify(state.currentUser));
      loadUserData();
      showToast(isRegisterMode ? 'Akun baru dibuat!' : 'Berhasil masuk!', 'success');
      navigate('home');
      return;
    }

    try {
      if (isRegisterMode) {
        const { data, error } = await supabase.auth.signUp({
          email: emailToUse,
          password: password,
          options: {
            data: { username: usernameForProfile, full_name: fullName }
          }
        });
        if (error) throw error;

        // Jika email confirmation aktif di Supabase dan session belum langsung terbentuk
        if (!data.session && data.user) {
          if (data.user.identities && data.user.identities.length === 0) {
            showToast('Email / Username ini sudah terdaftar. Silakan login.', 'error');
            return;
          }
          showToast('Pendaftaran berhasil! Silakan masuk ke akun Anda.', 'success');
          tabLogin?.click();
          return;
        }

        state.currentUser = {
          id: data.user.id,
          username: usernameForProfile,
          full_name: fullName,
        };
        localStorage.setItem('dompetku_user', JSON.stringify(state.currentUser));
        await loadUserData();
        showToast('Pendaftaran berhasil! Dompet Utama dibuat otomatis.', 'success');
        navigate('home');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: password,
        });
        if (error) {
          if (error.message.includes('Invalid login credentials') && !cleanInput.includes('@')) {
            throw new Error('Kredensial salah. Jika Anda mendaftar dengan alamat email, silakan ketik email lengkap Anda.');
          }
          throw error;
        }

        // Fetch user profile (or auto-create if missing)
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile) {
          const autoUsername = data.user.user_metadata?.username || usernameForProfile;
          const autoFullName = data.user.user_metadata?.full_name || autoUsername;
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              username: autoUsername,
              full_name: autoFullName,
            })
            .select()
            .maybeSingle();
          profile = newProfile;
        }

        state.currentUser = {
          id: data.user.id,
          username: profile?.username || usernameForProfile,
          full_name: profile?.full_name || usernameForProfile,
        };
        localStorage.setItem('dompetku_user', JSON.stringify(state.currentUser));
        await loadUserData();
        showToast('Selamat datang kembali!', 'success');
        navigate('home');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Add Transaction Clicks & Type Switches
  document.getElementById('btn-quick-add-tx')?.addEventListener('click', () => {
    selectedTxType = 'expense';
    navigate('add-transaction');
  });

  document.getElementById('btn-quick-transfer')?.addEventListener('click', () => {
    selectedTxType = 'transfer';
    navigate('add-transaction');
  });

  document.getElementById('btn-tx-type-expense')?.addEventListener('click', () => setTxType('expense'));
  document.getElementById('btn-tx-type-income')?.addEventListener('click', () => setTxType('income'));
  document.getElementById('btn-tx-type-transfer')?.addEventListener('click', () => setTxType('transfer'));

  // Save Transaction Submit
  document.getElementById('form-add-transaction')?.addEventListener('submit', async () => {
    const amount = parseCurrencyInput(document.getElementById('input-tx-amount'));
    const sourcePocket = document.getElementById('select-tx-source-pocket')?.value;
    const destPocket = document.getElementById('select-tx-dest-pocket')?.value;
    const categoryName = document.getElementById('input-tx-category')?.value.trim();
    const date = document.getElementById('input-tx-date')?.value;
    const notes = document.getElementById('input-tx-notes')?.value.trim();

    if (amount <= 0 || !sourcePocket) {
      showToast('Nominal dan kantong harus diisi', 'error');
      return;
    }

    if (selectedTxType === 'transfer' && sourcePocket === destPocket) {
      showToast('Kantong asal dan tujuan tidak boleh sama', 'error');
      return;
    }

    try {
      if (selectedTxType !== 'transfer' && categoryName) {
        await ensureCategoryExists(categoryName, selectedTxType);
      }

      await addTransaction({
        pocket_id: sourcePocket,
        destination_pocket_id: selectedTxType === 'transfer' ? destPocket : null,
        category_name: selectedTxType === 'transfer' ? 'Pindah Dana' : (categoryName || 'Lain-lain'),
        type: selectedTxType,
        amount,
        date: date || new Date().toISOString().split('T')[0],
        notes,
      });

      // Reset form
      document.getElementById('input-tx-amount').value = '';
      document.getElementById('input-tx-notes').value = '';

      showToast('Transaksi berhasil disimpan!', 'success');
      navigate('home');
    } catch (err) {
      showToast('Gagal menyimpan transaksi: ' + err.message, 'error');
    }
  });

  // Wallet Tabs (Pockets vs Assets)
  const tabPockets = document.getElementById('tab-wallet-pockets');
  const tabAssets = document.getElementById('tab-wallet-assets');
  const viewPockets = document.getElementById('view-wallet-pockets');
  const viewAssets = document.getElementById('view-wallet-assets');

  tabPockets?.addEventListener('click', () => {
    tabPockets.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all btn-gradient text-white';
    tabAssets.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-all';
    viewPockets?.classList.remove('hidden');
    viewAssets?.classList.add('hidden');
  });

  tabAssets?.addEventListener('click', () => {
    tabAssets.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all btn-gradient text-white';
    tabPockets.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-all';
    viewAssets?.classList.remove('hidden');
    viewPockets?.classList.add('hidden');
  });

  // Debts Status Tabs
  const debtTabActive = document.getElementById('filter-debt-active');
  const debtTabSettled = document.getElementById('filter-debt-settled');

  debtTabActive?.addEventListener('click', () => {
    activeDebtFilter = 'active';
    debtTabActive.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all btn-gradient text-white';
    debtTabSettled.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-all';
    renderDebtsPage();
  });

  debtTabSettled?.addEventListener('click', () => {
    activeDebtFilter = 'settled';
    debtTabSettled.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all btn-gradient text-white';
    debtTabActive.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-all';
    renderDebtsPage();
  });

  // Transaction Search & Filter Tabs
  document.getElementById('input-search-tx')?.addEventListener('input', (e) => {
    state.txFilter.search = e.target.value;
    renderTransactionsPage();
  });

  document.querySelectorAll('.btn-filter-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter-tab').forEach(b => {
        b.className = 'btn-filter-tab flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white transition';
      });
      tabBtn.className = 'btn-filter-tab flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition bg-white/10 text-white';
      state.txFilter.tab = tabBtn.getAttribute('data-tab');
      renderTransactionsPage();
    });
  });

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportTransactionsToCsv(state.transactions, state.pockets);
    showToast('File CSV berhasil diunduh', 'success');
  });

  // Modal Openers
  document.getElementById('btn-quick-add-pocket')?.addEventListener('click', openAddPocketModal);
  document.getElementById('btn-add-pocket-modal')?.addEventListener('click', openAddPocketModal);
  document.getElementById('btn-open-set-budget')?.addEventListener('click', openSetBudgetModal);
  document.getElementById('btn-add-budget-link')?.addEventListener('click', openSetBudgetModal);
  document.getElementById('btn-open-add-debt')?.addEventListener('click', openAddDebtModal);
  document.getElementById('btn-settings-debts-shortcut')?.addEventListener('click', () => navigate('debts'));
  document.getElementById('btn-open-add-asset')?.addEventListener('click', openAddAssetModal);
  document.getElementById('btn-open-edit-profile')?.addEventListener('click', openProfileModal);
  document.getElementById('btn-open-supabase-setup')?.addEventListener('click', openSupabaseSetupModal);
  document.getElementById('btn-settings-supabase')?.addEventListener('click', openSupabaseSetupModal);
  document.getElementById('btn-open-annual-report')?.addEventListener('click', openAnnualReportModal);
  document.getElementById('btn-archive-data')?.addEventListener('click', openArchiveDataModal);

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    localStorage.removeItem('dompetku_user');
    state.currentUser = null;
    if (supabase) await supabase.auth.signOut();
    showToast('Berhasil keluar dari akun', 'info');
    navigate('onboarding');
  });
}

// Global window navigations for onclick attributes
window.dompetkuNavigate = navigate;

// ==============================================================================
// 7. APP INITIALIZATION & SERVICE WORKER
// ==============================================================================

async function initDompetku() {
  // 1. Theme init
  applyTheme(state.isLightMode);

  // 2. Event binding
  bindAppEvents();

  // 3. Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('SW registration error:', err);
      });
    });
  }

  // 4. Check existing session
  if (state.currentUser) {
    await loadUserData();
    navigate('home');
  } else {
    // If not logged in, show onboarding
    navigate('onboarding');
  }

  // 5. Subscribe to reactive state updates
  subscribe(() => {
    renderCurrentPageView(currentPage);
  });
}

// Start App!
initDompetku();

