/*
 * Supabase project for accounts and saving (see docs/SUPABASE.md).
 * The coffee app shares the project with the wine app but keeps its data in
 * its own schema "coffee". URL and publishable key are meant to be public:
 * Row Level Security makes sure everyone only sees their own data.
 * Leave url/key empty and the app runs without accounts, saving only on this device.
 */
window.CLOUD_CONFIG = {
  url: '',          // e.g. https://abcdefgh.supabase.co
  key: '',          // Publishable key, e.g. sb_publishable_…
  schema: 'coffee'  // tables live in coffee.profiles and coffee.user_data
};
