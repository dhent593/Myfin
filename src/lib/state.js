// ==============================================================================
// DOMPETKU - CENTRAL REACTIVE STATE & BUSINESS ENGINE
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';

export const state = {
  // Session
  currentUser: JSON.parse(localStorage.getItem('dompetku_user') || 'null'),
  
  // Financial Entities
  pockets: [],
  categories: [],
  transactions: [],
  budgets: [],
  debts: [],
  assets: [],
  archives: [],

  // Theme
  isLightMode: localStorage.getItem('dompetku_theme') === 'light',

  // Active filters
  txFilter: {
    tab: 'all', // 'this_month', 'this_week', 'all'
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'all', // 'all', 'expense', 'income', 'transfer'
    search: '',
  },

  // Listeners for reactivity
  listeners: [],
};

// ==============================================================================
// REACTIVITY SYSTEM
// ==============================================================================

export function subscribe(fn) {
  state.listeners.push(fn);
  return () => {
    state.listeners = state.listeners.filter(l => l !== fn);
  };
}

export function notify() {
  state.listeners.forEach(fn => {
    try {
      fn(state);
    } catch (e) {
      console.error('State listener error:', e);
    }
  });
}

// ==============================================================================
// KALKULASI SALDO DINAMIS (REAL-TIME ENGINE)
// ==============================================================================

/**
 * Menghitung saldo aktual sebuah kantong secara real-time:
 * Saldo Awal + Total Pemasukan - Total Pengeluaran + Transfer Masuk - Transfer Keluar
 * @param {string} pocketId
 * @returns {number}
 */
export function calculatePocketBalance(pocketId) {
  const pocket = state.pockets.find(p => p.id === pocketId);
  if (!pocket) return 0;

  let balance = Number(pocket.initial_balance) || 0;

  state.transactions.forEach(t => {
    const amount = Number(t.amount) || 0;
    
    // Jika kantong sebagai sumber
    if (t.pocket_id === pocketId) {
      if (t.type === 'expense' || t.type === 'transfer') {
        balance -= amount;
      } else if (t.type === 'income') {
        balance += amount;
      }
    }

    // Jika kantong sebagai tujuan transfer
    if (t.destination_pocket_id === pocketId && t.type === 'transfer') {
      balance += amount;
    }
  });

  return balance;
}

/**
 * Menghitung total kekayaan bersih (Net Worth):
 * Total Saldo Semua Kantong + Total Aset Berharga (selain tabungan yang ter-link agar tidak double-count)
 * @returns {number}
 */
export function calculateTotalNetWorth() {
  // 1. Total dari seluruh kantong aktif
  const totalPockets = state.pockets.reduce((acc, p) => acc + calculatePocketBalance(p.id), 0);

  // 2. Total dari aset yang TIDAK di-link ke kantong
  const totalAssets = state.assets.reduce((acc, a) => {
    if (a.category === 'savings' && a.linked_pocket_id) {
      // Jika di-link ke kantong, saldonya sudah terhitung di totalPockets
      return acc;
    }
    return acc + (Number(a.estimated_value) || 0);
  }, 0);

  return totalPockets + totalAssets;
}

/**
 * Menghitung total pengeluaran untuk kategori tertentu pada bulan & tahun spesifik
 * @param {string} categoryName
 * @param {number} month
 * @param {number} year
 * @returns {number}
 */
export function calculateCategoryExpense(categoryName, month, year) {
  return state.transactions
    .filter(t => {
      if (t.type !== 'expense') return false;
      if (t.category_name !== categoryName) return false;
      const d = new Date(t.date);
      return (d.getMonth() + 1) === month && d.getFullYear() === year;
    })
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
}

// ==============================================================================
// SUPABASE DATA SYNC & ACTIONS
// ==============================================================================

/**
 * Muat seluruh data awal pengguna dari Supabase
 */
export async function loadUserData() {
  if (!isSupabaseConfigured() || !state.currentUser) {
    loadLocalFallbackData();
    notify();
    return;
  }

  try {
    const userId = state.currentUser.id;

    // 1. Load Pockets
    const { data: pocketsData, error: pocketsErr } = await supabase
      .from('pockets')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (!pocketsErr && pocketsData) {
      state.pockets = pocketsData;
    }

    // 2. Load Categories
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    if (catData) state.categories = catData;

    // 3. Load Active Transactions (Tahun Berjalan)
    const currentYear = new Date().getFullYear();
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (txData) state.transactions = txData;

    // 4. Load Budgets
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId);
    if (budgetData) state.budgets = budgetData;

    // 5. Load Debts
    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (debtData) state.debts = debtData;

    // 6. Load Assets
    const { data: assetData } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (assetData) state.assets = assetData;

    notify();
  } catch (err) {
    console.error('Error loading Supabase data:', err);
  }
}

/**
 * Otomatis daftarkan kategori baru ke Supabase jika belum ada
 * @param {string} name
 * @param {'expense'|'income'} type
 */
export async function ensureCategoryExists(name, type = 'expense') {
  if (!name || !name.trim()) return;
  const cleanName = name.trim();

  const existing = state.categories.find(
    c => c.name.toLowerCase() === cleanName.toLowerCase() && c.type === type
  );

  if (!existing && state.currentUser) {
    const newCat = {
      user_id: state.currentUser.id,
      name: cleanName,
      type: type,
      icon: type === 'income' ? 'fa-wallet' : 'fa-tag',
      color: type === 'income' ? '#10b981' : '#ef4444',
    };

    state.categories.push(newCat);
    notify();

    if (isSupabaseConfigured()) {
      await supabase.from('categories').insert(newCat);
    }
  }
}

/**
 * Simpan transaksi baru
 * @param {Object} tx
 */
export async function addTransaction(tx) {
  const newTx = {
    ...tx,
    id: tx.id || crypto.randomUUID(),
    user_id: state.currentUser?.id,
    created_at: new Date().toISOString(),
  };

  state.transactions.unshift(newTx);
  notify();

  if (isSupabaseConfigured() && state.currentUser) {
    const { data, error } = await supabase.from('transactions').insert(newTx).select().single();
    if (error) {
      console.error('Error inserting transaction:', error);
      throw error;
    }
    return data;
  }
  saveLocalState();
  return newTx;
}

/**
 * Simpan urutan kartu kantong (Drag & Drop Reorder)
 * @param {Array<string>} orderedPocketIds
 */
export async function updatePocketsOrder(orderedPocketIds) {
  // Update order_index di memori
  const updatedPockets = [];
  orderedPocketIds.forEach((id, index) => {
    const p = state.pockets.find(item => item.id === id);
    if (p) {
      p.order_index = index;
      updatedPockets.push(p);
    }
  });

  state.pockets.sort((a, b) => a.order_index - b.order_index);
  notify();

  if (isSupabaseConfigured() && state.currentUser) {
    // Batch upsert urutan ke Supabase
    for (const p of updatedPockets) {
      await supabase
        .from('pockets')
        .update({ order_index: p.order_index })
        .eq('id', p.id);
    }
  } else {
    saveLocalState();
  }
}

/**
 * Tambah kantong baru
 */
export async function addPocket(pocket) {
  const newPocket = {
    ...pocket,
    id: pocket.id || crypto.randomUUID(),
    user_id: state.currentUser?.id,
    order_index: state.pockets.length,
    created_at: new Date().toISOString(),
  };

  state.pockets.push(newPocket);
  notify();

  if (isSupabaseConfigured() && state.currentUser) {
    const { data, error } = await supabase.from('pockets').insert(newPocket).select().single();
    if (error) throw error;
    return data;
  }
  saveLocalState();
  return newPocket;
}

/**
 * Bayar cicilan hutang/piutang terintegrasi dengan mutasi transaksi & kantong
 */
export async function payDebtInstallment({ debtId, amount, pocketId, notes }) {
  const debt = state.debts.find(d => d.id === debtId);
  if (!debt) throw new Error('Hutang/piutang tidak ditemukan');

  const paymentAmount = Number(amount);
  const newPaidAmount = (Number(debt.paid_amount) || 0) + paymentAmount;
  const isSettled = newPaidAmount >= Number(debt.total_amount);

  debt.paid_amount = newPaidAmount;
  debt.is_settled = isSettled;

  // Buat mutasi transaksi otomatis di kantong
  // Jika 'debt' (kita bayar hutang): Pengeluaran dari pocketId
  // Jika 'receivable' (kita terima pelunasan): Pemasukan ke pocketId
  const txType = debt.type === 'debt' ? 'expense' : 'income';
  const categoryName = debt.type === 'debt' ? 'Pembayaran Hutang' : 'Penerimaan Piutang';

  const tx = await addTransaction({
    pocket_id: pocketId,
    category_name: categoryName,
    type: txType,
    amount: paymentAmount,
    date: new Date().toISOString().split('T')[0],
    notes: `Cicilan ${debt.type === 'debt' ? 'ke' : 'dari'} ${debt.person_name}: ${notes || ''}`,
    reference_id: debt.id,
    reference_type: 'debt_payment',
  });

  // Catat riwayat pembayaran
  if (isSupabaseConfigured() && state.currentUser) {
    await supabase
      .from('debts')
      .update({ paid_amount: newPaidAmount, is_settled: isSettled })
      .eq('id', debt.id);

    await supabase.from('debt_payments').insert({
      debt_id: debt.id,
      user_id: state.currentUser.id,
      amount: paymentAmount,
      pocket_id: pocketId,
      transaction_id: tx?.id,
      payment_date: new Date().toISOString().split('T')[0],
      notes: notes || '',
    });
  } else {
    saveLocalState();
  }

  notify();
}

/**
 * Arsipkan transaksi tahun lalu untuk optimasi performa
 */
export async function archiveOldYearTransactions(year) {
  if (isSupabaseConfigured() && state.currentUser) {
    const { data, error } = await supabase.rpc('archive_old_transactions', { p_year: year });
    if (error) throw error;
    // Refresh local
    await loadUserData();
    return data;
  } else {
    // Local fallback archive
    const toArchive = state.transactions.filter(t => new Date(t.date).getFullYear() === year);
    state.archives.push(...toArchive);
    state.transactions = state.transactions.filter(t => new Date(t.date).getFullYear() !== year);
    saveLocalState();
    notify();
    return toArchive.length;
  }
}

/**
 * Lazy load arsip transaksi untuk Laporan Tahunan
 */
export async function fetchArchivedTransactions(year) {
  if (isSupabaseConfigured() && state.currentUser) {
    const { data } = await supabase
      .from('transaction_archives')
      .select('*')
      .eq('user_id', state.currentUser.id)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);
    return data || [];
  }
  return state.archives.filter(t => new Date(t.date).getFullYear() === year);
}

// ==============================================================================
// LOCAL STORAGE PERSISTENCE & FALLBACKS
// ==============================================================================

function saveLocalState() {
  localStorage.setItem('dompetku_local_pockets', JSON.stringify(state.pockets));
  localStorage.setItem('dompetku_local_categories', JSON.stringify(state.categories));
  localStorage.setItem('dompetku_local_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('dompetku_local_budgets', JSON.stringify(state.budgets));
  localStorage.setItem('dompetku_local_debts', JSON.stringify(state.debts));
  localStorage.setItem('dompetku_local_assets', JSON.stringify(state.assets));
  localStorage.setItem('dompetku_local_archives', JSON.stringify(state.archives));
}

function loadLocalFallbackData() {
  const savedPockets = localStorage.getItem('dompetku_local_pockets');
  if (savedPockets) {
    state.pockets = JSON.parse(savedPockets);
    state.categories = JSON.parse(localStorage.getItem('dompetku_local_categories') || '[]');
    state.transactions = JSON.parse(localStorage.getItem('dompetku_local_transactions') || '[]');
    state.budgets = JSON.parse(localStorage.getItem('dompetku_local_budgets') || '[]');
    state.debts = JSON.parse(localStorage.getItem('dompetku_local_debts') || '[]');
    state.assets = JSON.parse(localStorage.getItem('dompetku_local_assets') || '[]');
    state.archives = JSON.parse(localStorage.getItem('dompetku_local_archives') || '[]');
    return;
  }

  // Initial Sample Data (Mirip index-refference.html)
  const defaultPocketId = crypto.randomUUID();
  state.pockets = [
    {
      id: defaultPocketId,
      name: 'Dompet Utama',
      initial_balance: 5000000,
      target_balance: 15000000,
      icon: 'fa-wallet',
      color: '#5b55f9',
      order_index: 0,
    },
    {
      id: crypto.randomUUID(),
      name: 'BCA Rekening',
      initial_balance: 3482000,
      target_balance: 10000000,
      icon: 'fa-credit-card',
      color: '#0060af',
      order_index: 1,
    }
  ];

  state.categories = [
    { name: 'Makanan & Minuman', type: 'expense', icon: 'fa-utensils', color: '#ef4444' },
    { name: 'Shopping & Belanja', type: 'expense', icon: 'fa-shopping-bag', color: '#ec4899' },
    { name: 'Wifi & Tagihan', type: 'expense', icon: 'fa-wifi', color: '#f59e0b' },
    { name: 'Transportasi', type: 'expense', icon: 'fa-car', color: '#3b82f6' },
    { name: 'Gaji & Bonus', type: 'income', icon: 'fa-money-bill-wave', color: '#10b981' },
    { name: 'Investasi', type: 'income', icon: 'fa-chart-line', color: '#8b5cf6' },
  ];

  state.transactions = [
    {
      id: crypto.randomUUID(),
      pocket_id: defaultPocketId,
      category_name: 'Shopping & Belanja',
      type: 'expense',
      amount: 350000,
      date: new Date().toISOString().split('T')[0],
      notes: 'Beli baju kerja',
    },
    {
      id: crypto.randomUUID(),
      pocket_id: defaultPocketId,
      category_name: 'Wifi & Tagihan',
      type: 'expense',
      amount: 450000,
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      notes: 'Tagihan Indihome',
    },
    {
      id: crypto.randomUUID(),
      pocket_id: defaultPocketId,
      category_name: 'Gaji & Bonus',
      type: 'income',
      amount: 4000000,
      date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
      notes: 'Gaji Bulanan',
    }
  ];

  state.budgets = [
    {
      id: crypto.randomUUID(),
      category_name: 'Makanan & Minuman',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      amount_limit: 2000000,
    },
    {
      id: crypto.randomUUID(),
      category_name: 'Shopping & Belanja',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      amount_limit: 1000000,
    }
  ];

  state.debts = [
    {
      id: crypto.randomUUID(),
      type: 'receivable',
      person_name: 'Budi Santoso',
      total_amount: 1500000,
      paid_amount: 500000,
      due_date: '2026-12-30',
      is_settled: false,
      notes: 'Pinjaman modal usaha',
    }
  ];

  state.assets = [
    {
      id: crypto.randomUUID(),
      category: 'gold',
      name: 'Logam Mulia Antam 10gr',
      estimated_value: 12500000,
      notes: 'Brankas rumah',
    },
    {
      id: crypto.randomUUID(),
      category: 'savings',
      name: 'Tabungan Darurat',
      linked_pocket_id: defaultPocketId,
      estimated_value: 0,
      notes: 'Tersinkron dengan Dompet Utama',
    }
  ];

  saveLocalState();
}

