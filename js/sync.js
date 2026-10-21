/*
 * Sync rules between this browser and the user's account (pure, testable).
 * The whole app state is stored as one JSON document per user.
 */
(function (root) {
  'use strict';

  // Lists of records with an "id" that are merged instead of overwritten.
  var LISTS = ['profiles', 'shots', 'ratings', 'brew.custom', 'brew.log', 'cafes.liked'];
  // Device-only fields that never leave the browser.
  var LOCAL_ONLY = ['meta', 'view'];

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function set(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; return o[k]; }, obj);
    target[last] = value;
  }

  /** State as it is stored in the account: a deep copy without device-only fields. */
  function forCloud(state) {
    var copy = JSON.parse(JSON.stringify(state || {}));
    LOCAL_ONLY.forEach(function (k) { delete copy[k]; });
    return copy;
  }

  /** True when the local state holds anything the user created (not just defaults/examples). */
  function hasOwnData(state) {
    if (!state) return false;
    var own = function (list, pred) { return (list || []).some(pred || function () { return true; }); };
    return own(state.shots) || own(state.ratings, function (r) { return !r.example; }) ||
      own(state.brew && state.brew.custom) || own(state.brew && state.brew.log) ||
      own(state.profiles, function (p) { return !/^beispiel-/.test(p.id); });
  }

  /**
   * Union of both states. Records in the LISTS are matched by id (remote wins
   * on conflicts); everything else comes from remote, local fills the gaps.
   */
  function merge(local, remote) {
    var out = JSON.parse(JSON.stringify(remote || {}));
    local = forCloud(local);
    Object.keys(local).forEach(function (k) { if (out[k] === undefined) out[k] = local[k]; });
    LISTS.forEach(function (path) {
      var r = get(remote, path) || [], l = get(local, path) || [];
      if (!r.length && !l.length) return;
      var seen = {};
      var merged = [];
      r.concat(l).forEach(function (item) {
        var id = item && item.id;
        if (id == null) { merged.push(item); return; }
        if (seen[id]) return;
        seen[id] = true;
        merged.push(item);
      });
      // Keep time-ordered lists in time order.
      if (merged.every(function (x) { return x && x.at; })) merged.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
      set(out, path, merged);
    });
    return out;
  }

  /**
   * What to do right after signing in or on a sync.
   * local: app state (with meta.updatedAt, meta.syncedAt, meta.userId)
   * remote: { data, updated_at } row or null
   * Returns 'push' | 'pull' | 'merge' | 'none'.
   */
  function decide(local, remote, userId) {
    var meta = (local && local.meta) || {};
    if (!remote || !remote.data || !Object.keys(remote.data).length) return 'push';
    var remoteTime = Date.parse(remote.updated_at) || 0;
    if (meta.userId !== userId) {
      // First sync of this browser with this account.
      return hasOwnData(local) ? 'merge' : 'pull';
    }
    var localChanged = (meta.updatedAt || 0) > (meta.syncedAt || 0);
    var remoteChanged = remoteTime > (meta.syncedAt || 0) + 1000;
    if (localChanged && remoteChanged) return 'merge';
    if (localChanged) return 'push';
    if (remoteChanged) return 'pull';
    return 'none';
  }

  var api = { LISTS: LISTS, forCloud: forCloud, hasOwnData: hasOwnData, merge: merge, decide: decide };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sync = api;
})(this);
