// ==============================================================================
// DOMPETKU - CLIENT-SIDE CSV EXPORTER
// ==============================================================================

/**
 * Ekspor data transaksi ke file CSV dan langsung unduh via browser
 * @param {Array} transactions
 * @param {Array} pockets
 * @param {string} filename
 */
export function exportTransactionsToCsv(transactions = [], pockets = [], filename = 'riwayat_transaksi_dompetku.csv') {
  if (!transactions.length) {
    alert('Tidak ada transaksi untuk diekspor.');
    return;
  }

  // Buat lookup nama kantong
  const pocketMap = {};
  pockets.forEach(p => {
    pocketMap[p.id] = p.name;
  });

  // Header CSV
  const headers = ['Tanggal', 'Jenis', 'Kategori', 'Kantong Sumber', 'Kantong Tujuan', 'Nominal (IDR)', 'Keterangan'];

  // Helper untuk sanitasi sel CSV dari formula injection (=, +, -, @)
  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    // Jika diawali karakter formula Excel, beri tanda petik satu (') agar dianggap teks murni
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'` + str;
    }
    return `"${str}"`;
  };

  // Baris data
  const rows = transactions.map(t => {
    const jenis = t.type === 'expense' ? 'Pengeluaran' : (t.type === 'income' ? 'Pemasukan' : 'Pindah Dana (Transfer)');
    const pocketFrom = pocketMap[t.pocket_id] || '-';
    const pocketTo = t.destination_pocket_id ? (pocketMap[t.destination_pocket_id] || '-') : '-';

    return [
      sanitizeCell(t.date),
      sanitizeCell(jenis),
      sanitizeCell(t.category_name || '-'),
      sanitizeCell(pocketFrom),
      sanitizeCell(pocketTo),
      Number(t.amount) || 0,
      sanitizeCell(t.notes || '')
    ].join(',');
  });

  // Gabungkan ke CSV Content dengan BOM untuk kompatibilitas Microsoft Excel (UTF-8 BOM)
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Buat trigger download via blob link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

