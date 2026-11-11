// ==============================================================================
// DOMPETKU - FORMATTER UTILITIES
// ==============================================================================

/**
 * Format angka ke format mata uang Rupiah (IDR)
 * @param {number} amount
 * @param {boolean} withPrefix - Tampilkan "Rp" atau tidak
 * @returns {string}
 */
export function formatRupiah(amount = 0, withPrefix = true) {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(absNum);

  const prefix = withPrefix ? 'Rp ' : '';
  return isNegative ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

/**
 * Format angka singkat (Compact) misal 1.5jt, 250rb
 * @param {number} amount
 * @returns {string}
 */
export function formatCompact(amount = 0) {
  const num = Math.abs(Number(amount) || 0);
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace('.0', '') + ' M';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace('.0', '') + ' Jt';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(0) + ' Rb';
  }
  return num.toString();
}

/**
 * Format tanggal Indonesia: '19 Apr, 01:15 PM' atau '19 April 2026'
 * @param {string|Date} dateStr
 * @param {boolean} includeTime
 * @returns {string}
 */
export function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = d.getDate();
  const month = monthsShort[d.getMonth()];
  const year = d.getFullYear();

  if (!includeTime) {
    return `${day} ${month} ${year}`;
  }

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 diubah jadi 12

  return `${day} ${month}, ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Pengelompokan tanggal cerdas: 'HARI INI', 'KEMARIN', atau '19 APR 2026'
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function getRelativeDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return 'Hari Ini';
  if (isYesterday) return 'Kemarin';

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Bind input field agar otomatis memformat ribuan titik secara real-time saat diketik (misal: 100.000)
 * @param {HTMLInputElement} inputEl
 */
export function formatCurrencyInput(inputEl) {
  if (!inputEl) return;
  inputEl.type = 'text';
  inputEl.inputMode = 'numeric';

  inputEl.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      e.target.value = '';
      return;
    }
    e.target.value = new Intl.NumberFormat('id-ID').format(Number(val));
  });
}

/**
 * Parsing nilai angka bersih dari input yang berformat ribuan titik
 * @param {string|HTMLInputElement} input
 * @returns {number}
 */
export function parseCurrencyInput(input) {
  const val = typeof input === 'string' ? input : (input?.value || '0');
  const clean = val.replace(/\D/g, '');
  return Number(clean) || 0;
}


