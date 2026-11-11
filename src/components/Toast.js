// ==============================================================================
// DOMPETKU - FLOATING GLASS TOAST NOTIFICATION
// ==============================================================================

export function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-[90%] max-w-sm';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const icon = type === 'success' ? 'fa-check-circle text-green-400' :
               type === 'error' ? 'fa-exclamation-circle text-red-400' :
               'fa-info-circle text-blue-400';

  toast.className = 'glass p-3.5 rounded-2xl flex items-center gap-3 text-xs font-medium text-white shadow-2xl border border-white/20 transition-all duration-300 transform -translate-y-4 opacity-0 pointer-events-auto bg-[#1a1b2f]/95';
  toast.innerHTML = `
    <i class="fas ${icon} text-base flex-shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger anim in
  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-4', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

