/*
 * Coffee tasting: aroma families (after the SCA Coffee Taster's Flavor Wheel),
 * structure scales and the taste profile computed from the user's ratings.
 */
(function (root) {
  'use strict';

  var AROMA_FAMILIES = [
    { id: 'beeren', name: 'Beerig', color: '#c4476a', aromas: ['Brombeere', 'Himbeere', 'Heidelbeere', 'Erdbeere', 'Johannisbeere', 'Rosine'] },
    { id: 'zitrus', name: 'Zitrus', color: '#e7c23a', aromas: ['Zitrone', 'Limette', 'Orange', 'Grapefruit', 'Bergamotte', 'Mandarine'] },
    { id: 'obst', name: 'Steinobst', color: '#ee8f45', aromas: ['Pfirsich', 'Aprikose', 'Kirsche', 'Pflaume', 'Apfel', 'Birne'] },
    { id: 'tropisch', name: 'Tropisch', color: '#f2b04f', aromas: ['Mango', 'Ananas', 'Maracuja', 'Papaya', 'Litschi', 'Kokos'] },
    { id: 'blumig', name: 'Blumig', color: '#c9a0dc', aromas: ['Jasmin', 'Rose', 'Kamille', 'Holunderblüte', 'Lavendel', 'Schwarztee'] },
    { id: 'suess', name: 'Süß', color: '#dcae6b', aromas: ['Honig', 'Karamell', 'Brauner Zucker', 'Ahornsirup', 'Vanille', 'Melasse'] },
    { id: 'nuss', name: 'Nuss & Kakao', color: '#a5704b', aromas: ['Haselnuss', 'Mandel', 'Erdnuss', 'Milchschokolade', 'Zartbitter', 'Kakao'] },
    { id: 'gewuerz', name: 'Gewürze', color: '#c47a3f', aromas: ['Zimt', 'Nelke', 'Muskat', 'Pfeffer', 'Anis', 'Kardamom'] },
    { id: 'roestig', name: 'Röstig', color: '#8d7b6e', aromas: ['Getreide', 'Malz', 'Toast', 'Tabak', 'Rauch', 'Verbrannt'] },
    { id: 'gruen', name: 'Grün & Erdig', color: '#86ad62', aromas: ['Gras', 'Erbse', 'Kräuter', 'Holz', 'Erde', 'Pilz'] },
    { id: 'ferment', name: 'Fermentiert', color: '#b0628f', aromas: ['Rotwein', 'Rum', 'Whisky', 'Joghurt', 'Überreif', 'Essig'] }
  ];

  var AROMA_FAMILY = {};
  AROMA_FAMILIES.forEach(function (f) { f.aromas.forEach(function (a) { AROMA_FAMILY[a] = f; }); });

  var STRUCTURE = [
    { id: 'acidity', label: 'Säure', words: ['flach', 'mild', 'lebendig', 'hell', 'spritzig'] },
    { id: 'sweetness', label: 'Süße', words: ['keine', 'zart', 'rund', 'deutlich', 'sirupartig'] },
    { id: 'body', label: 'Körper', words: ['wässrig', 'leicht', 'mittel', 'voll', 'sirupartig'] },
    { id: 'bitterness', label: 'Bitterkeit', words: ['keine', 'dezent', 'präsent', 'kräftig', 'dominant'] },
    { id: 'finish', label: 'Abgang', words: ['kurz', 'mittel', 'lang', 'sehr lang', 'endlos'] }
  ];

  var PROCESSES = ['Gewaschen', 'Natural', 'Honey', 'Anaerob', 'Andere'];
  var ROASTS = ['hell', 'mittel', 'dunkel'];

  function describeStructure(id, value) {
    var s = STRUCTURE.filter(function (x) { return x.id === id; })[0];
    if (!s) return '';
    return s.words[Math.min(4, Math.floor(value / 2.0001))];
  }

  function describeRating(v) {
    if (v >= 9.5) return 'Unvergesslich';
    if (v >= 8.5) return 'Herausragend';
    if (v >= 7.5) return 'Sehr gut';
    if (v >= 6.5) return 'Gut';
    if (v >= 5) return 'Okay';
    if (v >= 3) return 'Eher nicht';
    return 'Nie wieder';
  }

  function avg(list) {
    return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : null;
  }

  function median(list) {
    if (!list.length) return null;
    var s = list.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function ranked(ratings, key) {
    var groups = {};
    ratings.forEach(function (r) {
      var k = (r[key] || '').trim();
      if (!k) return;
      (groups[k] = groups[k] || []).push(r.rating);
    });
    return Object.keys(groups).map(function (k) { return { name: k, avg: avg(groups[k]), n: groups[k].length }; })
      .sort(function (a, b) { return b.avg - a.avg || b.n - a.n; });
  }

  /**
   * Taste profile from all ratings.
   * families: average rating of coffees that showed this family (null = never tasted),
   * favorite aromas: weighted by how much the coffee was liked,
   * structure: the "sweet spot" = average structure of the better half of coffees.
   */
  function profile(ratings) {
    ratings = (ratings || []).filter(function (r) { return typeof r.rating === 'number'; });
    var med = median(ratings.map(function (r) { return r.rating; }));

    var families = AROMA_FAMILIES.map(function (f) {
      var rs = ratings.filter(function (r) { return (r.aromas || []).some(function (a) { return AROMA_FAMILY[a] === f; }); });
      var counts = {};
      rs.forEach(function (r) {
        (r.aromas || []).forEach(function (a) { if (AROMA_FAMILY[a] === f) counts[a] = (counts[a] || 0) + r.rating; });
      });
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3);
      return { id: f.id, name: f.name, color: f.color, avg: rs.length ? avg(rs.map(function (r) { return r.rating; })) : null, n: rs.length, top: top };
    });

    var aromaScore = {};
    ratings.forEach(function (r) {
      var w = r.rating - (med == null ? 5 : med) + 1;
      (r.aromas || []).forEach(function (a) { aromaScore[a] = (aromaScore[a] || 0) + w; });
    });
    var favoriteAromas = Object.keys(aromaScore).filter(function (a) { return aromaScore[a] > 0; })
      .sort(function (a, b) { return aromaScore[b] - aromaScore[a]; }).slice(0, 6);

    var liked = ratings.filter(function (r) { return med == null || r.rating >= med; });
    var structure = {};
    STRUCTURE.forEach(function (s) {
      var vals = liked.map(function (r) { return r.structure && r.structure[s.id]; }).filter(function (v) { return typeof v === 'number'; });
      if (vals.length) structure[s.id] = { value: avg(vals), n: vals.length };
    });

    // Rank with a small pull towards the overall average, so one lucky cup
    // doesn't outrank a family you liked several times.
    var overall = avg(ratings.map(function (r) { return r.rating; }));
    families.forEach(function (f) { f.score = f.n ? (f.avg * f.n + overall) / (f.n + 1) : null; });
    var tasted = families.filter(function (f) { return f.n > 0; }).sort(function (a, b) { return b.score - a.score || b.n - a.n; });

    return {
      count: ratings.length,
      average: avg(ratings.map(function (r) { return r.rating; })),
      median: med,
      families: families,
      topFamily: tasted[0] || null,
      favoriteAromas: favoriteAromas,
      structure: structure,
      origins: ranked(ratings, 'origin'),
      processes: ranked(ratings, 'process'),
      roasters: ranked(ratings, 'roaster'),
      methods: ranked(ratings, 'method')
    };
  }

  /** One sentence describing the profile, built only from the numbers. */
  function summary(p) {
    if (!p.count) return '';
    var ACID = ['flache', 'milde', 'lebendige', 'helle', 'spritzige'];
    var BODY = ['wässrigen', 'leichten', 'mittleren', 'vollen', 'sirupartigen'];
    var level = function (v) { return Math.min(4, Math.floor(v / 2.0001)); };
    var s = p.structure;
    var traits = [];
    if (s.acidity) traits.push(ACID[level(s.acidity.value)] + ' Säure');
    if (s.body) traits.push('einen ' + BODY[level(s.body.value)] + ' Körper');
    var sentences = [];
    if (p.topFamily) sentences.push('Am meisten begeistern dich Noten aus „' + p.topFamily.name + '“.');
    if (traits.length) sentences.push('Deine Lieblingskaffees haben ' + traits.join(' und ') + '.');
    if (p.origins[0]) sentences.push('Top-Herkunft: ' + p.origins[0].name + '.');
    return sentences.join(' ');
  }

  /** Normalises the JSON a label scan returns. */
  function parseScan(obj) {
    obj = obj || {};
    var str = function (v, n) { return typeof v === 'string' ? v.trim().slice(0, n || 80) : ''; };
    var notes = Array.isArray(obj.tasting_notes) ? obj.tasting_notes.filter(function (x) { return typeof x === 'string'; }) : [];
    var aromas = [];
    notes.forEach(function (n) {
      var hit = Object.keys(AROMA_FAMILY).filter(function (a) { return n.toLowerCase().indexOf(a.toLowerCase()) >= 0 || a.toLowerCase().indexOf(n.toLowerCase()) >= 0; })[0];
      if (hit && aromas.indexOf(hit) < 0) aromas.push(hit);
    });
    var process = str(obj.process, 30);
    var proc = PROCESSES.filter(function (p) { return process && process.toLowerCase().indexOf(p.toLowerCase().slice(0, 4)) >= 0; })[0] ||
      (/wash/i.test(process) ? 'Gewaschen' : /natur/i.test(process) ? 'Natural' : /anaer/i.test(process) ? 'Anaerob' : process ? 'Andere' : '');
    var roast = ROASTS.indexOf(obj.roast) >= 0 ? obj.roast : '';
    return {
      isCoffee: obj.is_coffee !== false,
      roaster: str(obj.roaster),
      name: str(obj.name),
      origin: str(obj.origin, 60),
      region: str(obj.region, 60),
      variety: str(obj.variety, 60),
      process: proc,
      roast: roast,
      notes: notes.slice(0, 6).join(', '),
      aromas: aromas
    };
  }

  var api = {
    AROMA_FAMILIES: AROMA_FAMILIES, AROMA_FAMILY: AROMA_FAMILY, STRUCTURE: STRUCTURE, PROCESSES: PROCESSES, ROASTS: ROASTS,
    describeStructure: describeStructure, describeRating: describeRating, profile: profile, summary: summary, parseScan: parseScan
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TastingData = api;
})(this);
