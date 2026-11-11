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

export function saveSupabaseConfig(url, key) {
  if (url && key) {
    localStorage.setItem('dompetku_sb_url', url.trim());
    localStorage.setItem('dompetku_sb_key', key.trim());
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

