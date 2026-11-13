import { createClient } from '@supabase/supabase-js';

// Ambil URL & Key dari ENV Vite atau dari localStorage (jika pengguna menyetting lewat UI)
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const localUrl = localStorage.getItem('dompetku_sb_url') || '';
const localKey = localStorage.getItem('dompetku_sb_key') || '';

export const SUPABASE_URL = localUrl || envUrl;
export const SUPABASE_ANON_KEY = localKey || envKey;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'));
}

/**
 * Deteksi apakah sebuah JWT token adalah service_role secret key
 * @param {string} key
 * @returns {boolean}
 */
export function isServiceRoleKey(key) {
  if (!key || typeof key !== 'string') return false;
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      // Decode JWT payload (base64url)
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload && payload.role === 'service_role';
    }
  } catch {
    // Abaikan jika bukan format JWT
  }
  return false;
}

export function saveSupabaseConfig(url, key) {
  if (url && key) {
    const cleanKey = key.trim();
    if (isServiceRoleKey(cleanKey)) {
      throw new Error('PERINGATAN KEAMANAN: Kunci yang Anda masukkan adalah "service_role" (kunci rahasia server dengan akses penuh yang membypass RLS). Demi keamanan database Anda, harap gunakan "anon / public" key.');
    }
    localStorage.setItem('dompetku_sb_url', url.trim());
    localStorage.setItem('dompetku_sb_key', cleanKey);
    window.location.reload();
  }
}

// Inisialisasi Supabase client
// Jika belum dikonfigurasi, gunakan dummy client agar aplikasi tidak crash dan menampilkan modal konfigurasi
export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

