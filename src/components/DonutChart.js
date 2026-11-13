// ==============================================================================
// DOMPETKU - SVG DONUT CHART GENERATOR (Native JS & SVG)
// ==============================================================================

import { formatRupiah, formatCompact } from '../lib/formatters.js';

/**
 * Render donut chart SVG langsung ke container DOM
 * @param {HTMLElement} containerEl
 * @param {Array<{label: string, value: number, color: string}>} items
 * @param {string} centerTitle
 * @param {number} centerValue
 */
export function renderDonutChart(containerEl, items = [], centerTitle = 'Total', centerValue = 0) {
  if (!containerEl) return;

  const validItems = items.filter(i => i.value > 0);
  const total = validItems.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    containerEl.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
        <i class="fas fa-chart-pie text-3xl mb-2 opacity-40"></i>
        <span>Belum ada data pengeluaran bulan ini</span>
      </div>
    `;
    return;
  }

  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  let circlesSvg = '';

  validItems.forEach((item) => {
    const percent = item.value / total;
    const dashLength = circumference * percent;
    const offset = circumference - currentOffset;

    circlesSvg += `
      <circle 
        cx="${size / 2}" 
        cy="${size / 2}" 
        r="${radius}" 
        fill="transparent" 
        stroke="${item.color || '#5b55f9'}" 
        stroke-width="${strokeWidth}" 
        stroke-dasharray="${dashLength} ${circumference - dashLength}" 
        stroke-dashoffset="${offset}" 
        class="transition-all duration-700 ease-out hover:opacity-80 cursor-pointer"
        data-label="${item.label}"
        data-value="${item.value}"
        data-percent="${(percent * 100).toFixed(1)}%"
      />
    `;

    currentOffset += dashLength;
  });

  const legendHtml = validItems.map(item => {
    const pct = ((item.value / total) * 100).toFixed(0);
    return `
      <div class="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${item.color || '#5b55f9'}"></span>
          <span class="font-medium text-gray-300">${item.label}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-white">${formatCompact(item.value)}</span>
          <span class="text-[10px] text-gray-400">(${pct}%)</span>
        </div>
      </div>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div class="flex flex-col items-center">
      <div class="relative w-[${size}px] h-[${size}px] my-2">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="transform -rotate-90">
          <circle 
            id="donut-bg-track"
            cx="${size / 2}" 
            cy="${size / 2}" 
            r="${radius}" 
            fill="transparent" 
            stroke="rgba(255,255,255,0.05)" 
            stroke-width="${strokeWidth}" 
          />
          ${circlesSvg}
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span class="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">${centerTitle}</span>
          <span class="text-sm font-bold text-white mt-0.5">${formatCompact(total)}</span>
        </div>
      </div>
      <div class="w-full mt-4 space-y-1">
        ${legendHtml}
      </div>
    </div>
  `;
}

