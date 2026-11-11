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

  // Baris data
  const rows = transactions.map(t => {
    const jenis = t.type === 'expense' ? 'Pengeluaran' : (t.type === 'income' ? 'Pemasukan' : 'Pindah Dana (Transfer)');
    const pocketFrom = pocketMap[t.pocket_id] || '-';
    const pocketTo = t.destination_pocket_id ? (pocketMap[t.destination_pocket_id] || '-') : '-';
    const cleanNotes = (t.notes || '').replace(/"/g, '""');

    return [
      `"${t.date}"`,
      `"${jenis}"`,
      `"${t.category_name || '-'}"`,
      `"${pocketFrom}"`,
      `"${pocketTo}"`,
      t.amount,
      `"${cleanNotes}"`
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

