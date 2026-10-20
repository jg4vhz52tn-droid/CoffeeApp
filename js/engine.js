/*
 * Dial-in engine: turns a taste position on the coffee compass plus the
 * current recipe into concrete adjustments for the next espresso shot.
 *
 * Coordinate system of the compass map:
 *   x: -1 = under-extracted (sour) ... +1 = over-extracted (bitter)
 *   y: -1 = weak (watery)          ... +1 = strong (heavy)
 * The "green zone" (good cups) is the circle of radius GREEN_RADIUS.
 */
(function (root) {
  'use strict';

  var GREEN_RADIUS = 0.74;
  var SWEET_SPOT_RADIUS = 0.22;

  // Descriptor positions derived from the Brewed Coffee Compass
  // (Barista Hustle). group: 'inner' = inside the green zone.
  var DESCRIPTORS = [
    // strong side
    { id: 'soupy', de: 'Suppig', en: 'Soupy', x: -0.16, y: 0.87 },
    { id: 'bulky', de: 'Massig', en: 'Bulky', x: -0.32, y: 0.8 },
    { id: 'harsh', de: 'Harsch', en: 'Harsh', x: 0.24, y: 0.86 },
    { id: 'overwhelming', de: 'Überladen', en: 'Overwhelming', x: 0.45, y: 0.79 },
    { id: 'beefy', de: 'Fleischig', en: 'Beefy', x: -0.54, y: 0.67 },
    { id: 'severe', de: 'Streng', en: 'Severe', x: 0.51, y: 0.68 },
    { id: 'potent', de: 'Wuchtig', en: 'Potent', x: 0.67, y: 0.58 },
    { id: 'intense', de: 'Intensiv', en: 'Intense', x: 0.76, y: 0.49 },
    { id: 'dull', de: 'Dumpf', en: 'Dull', x: -0.72, y: 0.47 },
    // over-extracted side
    { id: 'dry', de: 'Trocken', en: 'Dry', x: 0.87, y: 0.36 },
    { id: 'bitter', de: 'Bitter', en: 'Bitter', x: 0.9, y: 0.2 },
    { id: 'powdery', de: 'Pudrig', en: 'Powdery', x: 0.89, y: -0.24 },
    { id: 'empty', de: 'Leer', en: 'Empty', x: 0.83, y: -0.39 },
    { id: 'dusty', de: 'Staubig', en: 'Dusty', x: 0.73, y: -0.55 },
    { id: 'astringent', de: 'Adstringierend', en: 'Astringent', x: 0.71, y: -0.67 },
    // under-extracted side
    { id: 'quickfinish', de: 'Kurzer Abgang', en: 'Quick finish', x: -0.87, y: 0.33 },
    { id: 'salty', de: 'Salzig', en: 'Salty', x: -0.88, y: 0.18 },
    { id: 'sour', de: 'Sauer', en: 'Sour', x: -0.88, y: -0.2 },
    { id: 'vegetal', de: 'Grasig', en: 'Vegetal', x: -0.8, y: -0.31 },
    { id: 'nutty', de: 'Nussig-flach', en: 'Nutty', x: -0.92, y: -0.42 },
    { id: 'bland', de: 'Fade', en: 'Bland', x: -0.72, y: -0.42 },
    { id: 'underwhelming', de: 'Enttäuschend', en: 'Underwhelming', x: -0.78, y: -0.56 },
    { id: 'insipid', de: 'Geschmacklos', en: 'Insipid', x: -0.65, y: -0.66 },
    // weak side
    { id: 'watery', de: 'Wässrig', en: 'Watery', x: -0.77, y: -0.76 },
    { id: 'tealike', de: 'Teeartig', en: 'Tea-like', x: -0.43, y: -0.72 },
    { id: 'flimsy', de: 'Kraftlos', en: 'Flimsy', x: -0.58, y: -0.85 },
    { id: 'sparse', de: 'Spärlich', en: 'Sparse', x: -0.39, y: -0.94 },
    { id: 'slender', de: 'Schmal', en: 'Slender', x: -0.31, y: -0.82 },
    { id: 'faint', de: 'Blass', en: 'Faint', x: -0.16, y: -0.89 },
    { id: 'muted', de: 'Gedämpft', en: 'Muted', x: 0.07, y: -0.83 },
    { id: 'scrawny', de: 'Mager', en: 'Scrawny', x: 0.3, y: -0.8 },
    { id: 'fragile', de: 'Zerbrechlich', en: 'Fragile', x: 0.33, y: -0.91 },
    { id: 'dilute', de: 'Verdünnt', en: 'Dilute', x: 0.45, y: -0.71 },
    { id: 'limp', de: 'Schlapp', en: 'Limp', x: 0.57, y: -0.83 },
    // green zone
    { id: 'big', de: 'Groß', en: 'Big', x: -0.1, y: 0.65, inner: true },
    { id: 'hefty', de: 'Gewichtig', en: 'Hefty', x: 0.2, y: 0.63, inner: true },
    { id: 'sticky', de: 'Klebrig', en: 'Sticky', x: -0.27, y: 0.55, inner: true },
    { id: 'strong', de: 'Kräftig', en: 'Strong', x: 0.06, y: 0.52, inner: true },
    { id: 'thick', de: 'Dicht', en: 'Thick', x: 0.33, y: 0.47, inner: true },
    { id: 'plump', de: 'Prall', en: 'Plump', x: -0.38, y: 0.43, inner: true },
    { id: 'heavy', de: 'Schwer', en: 'Heavy', x: -0.03, y: 0.37, inner: true },
    { id: 'robust', de: 'Robust', en: 'Robust', x: 0.16, y: 0.36, inner: true },
    { id: 'substantial', de: 'Gehaltvoll', en: 'Substantial', x: -0.33, y: 0.27, inner: true },
    { id: 'luscious', de: 'Üppig', en: 'Luscious', x: 0.25, y: 0.26, inner: true },
    { id: 'rich', de: 'Reichhaltig', en: 'Rich', x: 0.5, y: 0.23, inner: true },
    { id: 'buttery', de: 'Buttrig', en: 'Buttery', x: -0.54, y: 0.15, inner: true },
    { id: 'mouthfilling', de: 'Vollmundig', en: 'Mouth-filling', x: -0.04, y: 0.12, inner: true },
    { id: 'fruity', de: 'Fruchtig', en: 'Fruity', x: 0.3, y: 0.04, inner: true },
    { id: 'sweet', de: 'Süß', en: 'Sweet', x: 0.58, y: 0.0, inner: true },
    { id: 'smooth', de: 'Rund', en: 'Smooth', x: -0.43, y: 0.0, inner: true },
    { id: 'balanced', de: 'Ausgewogen', en: 'Balanced', x: 0.01, y: -0.05, inner: true },
    { id: 'nuanced', de: 'Nuanciert', en: 'Nuanced', x: -0.44, y: -0.13, inner: true },
    { id: 'pleasing', de: 'Angenehm', en: 'Pleasing', x: 0.41, y: -0.16, inner: true },
    { id: 'tasty', de: 'Lecker', en: 'Tasty', x: 0.11, y: -0.23, inner: true },
    { id: 'creamy', de: 'Cremig', en: 'Creamy', x: -0.16, y: -0.29, inner: true },
    { id: 'soft', de: 'Sanft', en: 'Soft', x: -0.44, y: -0.36, inner: true },
    { id: 'aromatic', de: 'Aromatisch', en: 'Aromatic', x: 0.39, y: -0.36, inner: true },
    { id: 'gentle', de: 'Mild', en: 'Gentle', x: 0.03, y: -0.44, inner: true },
    { id: 'transparent', de: 'Klar', en: 'Transparent', x: -0.31, y: -0.52, inner: true },
    { id: 'thin', de: 'Dünn', en: 'Thin', x: -0.03, y: -0.58, inner: true },
    { id: 'delicate', de: 'Zart', en: 'Delicate', x: 0.27, y: -0.6, inner: true }
  ];

  var SOUR_IDS = ['sour', 'salty', 'vegetal', 'quickfinish'];
  var BITTER_IDS = ['bitter', 'dry', 'astringent', 'harsh', 'powdery', 'dusty'];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v, step) { return Math.round(v / step) * step; }

  function findDescriptor(id) {
    for (var i = 0; i < DESCRIPTORS.length; i++) if (DESCRIPTORS[i].id === id) return DESCRIPTORS[i];
    return null;
  }

  /** Average position of the selected descriptors, or null when none are selected. */
  function positionFromDescriptors(ids) {
    var sx = 0, sy = 0, n = 0;
    (ids || []).forEach(function (id) {
      var d = findDescriptor(id);
      if (d) { sx += d.x; sy += d.y; n++; }
    });
    if (!n) return null;
    return { x: sx / n, y: sy / n };
  }

  function zoneOf(pos) {
    var r = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
    if (r <= SWEET_SPOT_RADIUS) return 'sweetspot';
    if (r <= GREEN_RADIUS) return 'green';
    return 'off';
  }

  function sizeWord(mag) {
    if (mag < 0.3) return 'leicht';
    if (mag < 0.6) return 'deutlich';
    return 'stark';
  }

  /**
   * recipe: { dose, yield, time, grind, grindStep, finerIsLower, temp, keep: 'dose'|'yield' }
   * taste:  { x, y, descriptors: [ids] }
   * target: optional bean profile { dose, yield, timeMin, timeMax, temp, roast }
   */
  function recommend(recipe, taste, target) {
    var pos = { x: clamp(taste.x, -1, 1), y: clamp(taste.y, -1, 1) };
    var zone = zoneOf(pos);
    var actions = [];
    var notes = [];
    var descr = taste.descriptors || [];

    var dose = Number(recipe.dose) || 18;
    var yld = Number(recipe.yield) || 36;
    var time = Number(recipe.time) || 0;
    var grind = recipe.grind === '' || recipe.grind == null ? null : Number(recipe.grind);
    var grindStep = Number(recipe.grindStep) || 1;
    var finerIsLower = recipe.finerIsLower !== false;
    var keep = recipe.keep === 'yield' ? 'yield' : 'dose';
    var ratio = yld / dose;

    var timeMin = target && target.timeMin ? target.timeMin : 25;
    var timeMax = target && target.timeMax ? target.timeMax : 32;

    // Correction vector points back to the centre of the compass.
    // ext > 0: extract more; str > 0: more coffee (lower ratio).
    var ext = zone === 'sweetspot' ? 0 : -pos.x;
    var str = zone === 'sweetspot' ? 0 : -pos.y;
    // Inside the green zone we only fine-tune.
    if (zone === 'green') { ext *= 0.5; str *= 0.5; }

    var hasSour = descr.some(function (id) { return SOUR_IDS.indexOf(id) >= 0; });
    var hasBitter = descr.some(function (id) { return BITTER_IDS.indexOf(id) >= 0; });
    var channeling = hasSour && hasBitter;

    if (channeling) {
      actions.push({
        kind: 'prep', priority: 0,
        title: 'Puck-Vorbereitung prüfen (Channeling)',
        detail: 'Sauer und bitter gleichzeitig deutet auf ungleichmäßige Extraktion hin: Teile des Pucks werden über-, andere unterextrahiert. ' +
          'Mahlgut mit WDT-Tool auflockern, gerade und gleichmäßig tampern, Siebträger trocken und sauber. Erst danach am Mahlgrad drehen.'
      });
      ext *= 0.4;
    }

    // Shot time sanity check, independent of taste.
    var timeHint = null;
    if (time > 0 && time < timeMin - 3) timeHint = 'fast';
    else if (time > timeMax + 5) timeHint = 'slow';

    // --- Extraction: grind (primary lever for espresso) ---
    var newGrind = grind;
    var grindSteps = 0;
    if (Math.abs(ext) >= 0.08) {
      grindSteps = Math.max(1, Math.round(Math.abs(ext) * 3));
      var finer = ext > 0;
      if (grind !== null) {
        var delta = grindSteps * grindStep * (finer === finerIsLower ? -1 : 1);
        newGrind = round(grind + delta, grindStep);
      }
      var stepText = grindSteps === 1 ? '1 Stufe' : grindSteps + ' Stufen';
      actions.push({
        kind: 'grind', priority: 1,
        title: finer ? 'Feiner mahlen (' + stepText + ')' : 'Gröber mahlen (' + stepText + ')',
        detail: finer
          ? 'Der Shot ist ' + sizeWord(Math.abs(ext)) + ' unterextrahiert. Feineres Mahlgut erhöht den Widerstand, der Shot läuft länger und löst mehr Süße und Körper.'
          : 'Der Shot ist ' + sizeWord(Math.abs(ext)) + ' überextrahiert. Gröberes Mahlgut senkt den Widerstand, der Shot läuft schneller und wird weniger bitter/trocken.'
      });
    }

    // --- Strength: brew ratio ---
    var newRatio = ratio;
    if (Math.abs(str) >= 0.08) {
      newRatio = clamp(ratio * (1 - 0.25 * str), 1.2, 4);
      var stronger = str > 0;
      actions.push({
        kind: 'ratio', priority: 2,
        title: stronger ? 'Mehr Kaffee – Ratio verkürzen' : 'Weniger Kaffee – Ratio verlängern',
        detail: (stronger
          ? 'Der Shot wirkt ' + sizeWord(Math.abs(str)) + ' zu schwach/dünn.'
          : 'Der Shot wirkt ' + sizeWord(Math.abs(str)) + ' zu schwer/intensiv.') +
          ' Brühverhältnis von 1:' + ratio.toFixed(1).replace('.', ',') + ' auf 1:' + newRatio.toFixed(1).replace('.', ',') + '.' +
          (keep === 'dose'
            ? ' Dosis bleibt, nur die Menge in der Tasse ändert sich.'
            : ' Menge in der Tasse bleibt, die Dosis wird angepasst – achte darauf, dass das Sieb dafür passt.')
      });
      if (keep === 'dose' && !stronger) {
        notes.push('Beim Espresso extrahiert ein längerer Bezug automatisch etwas mehr. Bei grenzwertiger Bitterkeit lieber zusätzlich minimal gröber mahlen.');
      }
      if (keep === 'dose' && stronger) {
        notes.push('Ein kürzerer Bezug extrahiert auch etwas weniger. Wird der Shot danach säuerlich, eine Stufe feiner nachjustieren.');
      }
    }

    var newDose = dose, newYield = yld;
    if (keep === 'dose') newYield = round(dose * newRatio, 1);
    else newDose = round(yld / newRatio, 0.5);

    var targetTime = null;
    if (time > 0) {
      targetTime = Math.round(clamp(time + ext * 6, timeMin - 2, timeMax + 4));
    }

    if (timeHint === 'fast' && ext <= 0) {
      notes.push('Der Shot lief mit ' + time + ' s sehr schnell. Schmeckt er trotzdem nicht sauer, ist das okay – sonst ist Channeling wahrscheinlich.');
    } else if (timeHint === 'fast') {
      notes.push('Mit ' + time + ' s lief der Shot zu schnell (Ziel ' + timeMin + '–' + timeMax + ' s) – das bestätigt: feiner mahlen.');
    } else if (timeHint === 'slow' && ext >= 0) {
      notes.push('Mit ' + time + ' s lief der Shot sehr langsam. Schmeckt er trotzdem unterextrahiert, ist die Mühle evtl. zu fein und der Puck „verstopft“ – Puck-Vorbereitung prüfen.');
    } else if (timeHint === 'slow') {
      notes.push('Mit ' + time + ' s lief der Shot zu langsam (Ziel ' + timeMin + '–' + timeMax + ' s) – das bestätigt: gröber mahlen.');
    }

    // Light roasts that stay sour: temperature is the next lever.
    if (ext > 0.3 && target && target.roast === 'hell') {
      actions.push({
        kind: 'temp', priority: 3,
        title: 'Brühtemperatur erhöhen (+1–2 °C)',
        detail: 'Helle Röstungen extrahieren schwerer. Mehr Temperatur hilft, wenn feineres Mahlen allein nicht reicht.'
      });
    } else if (ext < -0.3 && target && target.roast === 'dunkel') {
      actions.push({
        kind: 'temp', priority: 3,
        title: 'Brühtemperatur senken (−1–2 °C)',
        detail: 'Dunkle Röstungen extrahieren leicht und werden schnell bitter. Etwas kühler brühen nimmt Härte heraus.'
      });
    }

    if (zone === 'sweetspot') {
      actions.push({
        kind: 'done', priority: 0,
        title: 'Treffer! Rezept speichern',
        detail: 'Der Shot liegt im Zentrum des Kompasses. Ändere jetzt nichts mehr – höchstens eine Variable, um Nuancen zu erkunden.'
      });
    }

    actions.sort(function (a, b) { return a.priority - b.priority; });

    return {
      position: pos,
      zone: zone,
      correction: { extract: ext, strength: str },
      channeling: channeling,
      actions: actions,
      notes: notes,
      next: {
        dose: newDose,
        yield: newYield,
        ratio: Math.round(newRatio * 100) / 100,
        grind: newGrind,
        grindSteps: grindSteps * (ext > 0 ? 1 : ext < 0 ? -1 : 0),
        targetTime: targetTime,
        timeMin: timeMin,
        timeMax: timeMax
      }
    };
  }

  /**
   * Compare a measured shot against a bean profile before tasting.
   * Returns a list of deviations the user should fix first.
   */
  function checkAgainstProfile(recipe, profile) {
    if (!profile) return [];
    var out = [];
    var dose = Number(recipe.dose), yld = Number(recipe.yield), time = Number(recipe.time);
    if (profile.dose && dose && Math.abs(dose - profile.dose) >= 0.5) {
      out.push('Dosis ' + dose + ' g statt empfohlener ' + profile.dose + ' g.');
    }
    if (profile.yield && yld && Math.abs(yld - profile.yield) >= 2) {
      out.push('Bezug ' + yld + ' g statt empfohlener ' + profile.yield + ' g.');
    }
    if (time && profile.timeMin && time < profile.timeMin) {
      out.push('Durchlaufzeit ' + time + ' s liegt unter ' + profile.timeMin + ' s → feiner mahlen.');
    } else if (time && profile.timeMax && time > profile.timeMax) {
      out.push('Durchlaufzeit ' + time + ' s liegt über ' + profile.timeMax + ' s → gröber mahlen.');
    }
    return out;
  }

  /** Validates and normalises an imported bean profile. Throws on invalid input. */
  function parseProfile(obj) {
    if (typeof obj === 'string') obj = JSON.parse(obj);
    if (!obj || typeof obj !== 'object') throw new Error('Kein gültiges Profil.');
    var name = String(obj.name || '').trim();
    if (!name) throw new Error('Profil braucht einen Namen.');
    var r = obj.recipe || obj;
    var p = {
      id: String(obj.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 60),
      name: name.slice(0, 80),
      roaster: String(obj.roaster || '').slice(0, 80),
      roast: ['hell', 'mittel', 'dunkel'].indexOf(obj.roast) >= 0 ? obj.roast : 'mittel',
      notes: String(obj.notes || '').slice(0, 300),
      dose: Number(r.dose) || 18,
      yield: Number(r.yield) || 36,
      timeMin: Number(r.timeMin) || 25,
      timeMax: Number(r.timeMax) || 32,
      temp: Number(r.temp) || null,
      grind: r.grind === '' || r.grind == null || isNaN(Number(r.grind)) ? null : Number(r.grind),
      restDays: Number(obj.restDays) || null
    };
    if (p.dose < 5 || p.dose > 30) throw new Error('Dosis außerhalb 5–30 g.');
    if (p.yield < 10 || p.yield > 120) throw new Error('Bezug außerhalb 10–120 g.');
    if (p.timeMin > p.timeMax) throw new Error('timeMin ist größer als timeMax.');
    return p;
  }

  var api = {
    GREEN_RADIUS: GREEN_RADIUS,
    SWEET_SPOT_RADIUS: SWEET_SPOT_RADIUS,
    DESCRIPTORS: DESCRIPTORS,
    findDescriptor: findDescriptor,
    positionFromDescriptors: positionFromDescriptors,
    zoneOf: zoneOf,
    recommend: recommend,
    checkAgainstProfile: checkAgainstProfile,
    parseProfile: parseProfile
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DialEngine = api;
})(this);
