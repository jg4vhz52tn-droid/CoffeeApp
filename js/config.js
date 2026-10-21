/*
 * Supabase project for accounts and saving (see docs/SUPABASE.md).
 * Both values are meant to be public: Row Level Security in the database
 * makes sure everyone only sees their own data.
 * Leave them empty and the app runs without accounts, saving only on this device.
 */
window.CLOUD_CONFIG = {
  url: '',  // e.g. https://abcdefgh.supabase.co
  key: ''   // Publishable key, e.g. sb_publishable_…
};
