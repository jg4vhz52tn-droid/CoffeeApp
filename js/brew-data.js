/*
 * Brew methods and recipes for the brewing guide.
 * Amounts inside step texts are written as [[grams]] so they scale with
 * the chosen water amount. Step "at" values are seconds from the start.
 * Recipe parameters come from the cited sources; instructions are our own wording.
 */
(function (root) {
  'use strict';

  var GRIND_SCALE = ['extrafein', 'fein', 'mittelfein', 'mittel', 'mittelgrob', 'grob'];

  var METHODS = [
    { id: 'aeropress', name: 'AeroPress', tagline: 'Schnell, sauber, unendlich variabel.', icon: 'aeropress' },
    { id: 'frenchpress', name: 'French Press', tagline: 'Voller Körper, kaum Aufwand.', icon: 'frenchpress' },
    { id: 'v60', name: 'V60', tagline: 'Klar und präzise – für helle Röstungen.', icon: 'v60' },
    { id: 'chemex', name: 'Chemex', tagline: 'Sehr klar, ideal für mehrere Tassen.', icon: 'chemex' },
    { id: 'moka', name: 'Mokkakanne', tagline: 'Kräftig und intensiv vom Herd.', icon: 'moka' },
    { id: 'coldbrew', name: 'Cold Brew', tagline: 'Über Nacht: weich, schokoladig, wenig Säure.', icon: 'coldbrew' }
  ];

  var AEROPRECIPE = 'https://aeroprecipe.com/recipes/';

  var RECIPES = [
    // ---------- AeroPress ----------
    {
      id: 'adler-original', method: 'aeropress', name: 'Das Original', author: 'Alan Adler (Erfinder der AeroPress)',
      source: { label: 'AeroPrecipe', url: AEROPRECIPE + 'alan-adler-original' },
      dose: 15, water: 90, temp: 80, grind: 'fein', position: 'Standard', level: 'Einsteiger',
      notes: 'Kurz und konzentriert. Für helle Röstungen 85 °C nehmen. Pur trinken oder mit heißem Wasser zu einem Americano strecken.',
      steps: [
        { at: 0, title: 'Vorbereiten', detail: 'Papierfilter einlegen und kurz mit heißem Wasser spülen. [[15]] Kaffee in die Kammer geben.' },
        { at: 0, title: 'Aufgießen', detail: '[[90]] Wasser mit 80 °C einfüllen – etwa bis Markierung 1.' },
        { at: 5, title: 'Umrühren', detail: '10 Sekunden zügig umrühren.' },
        { at: 15, title: 'Drücken', detail: 'Stempel einsetzen und mit sanftem Druck 20–40 Sekunden herunterdrücken.' },
        { at: 50, title: 'Fertig', detail: 'Pur genießen oder nach Geschmack mit heißem Wasser auffüllen.' }
      ]
    },
    {
      id: 'hoffmann-ultimate', method: 'aeropress', name: 'Ultimate AeroPress', author: 'James Hoffmann',
      source: { label: 'AeroPrecipe', url: AEROPRECIPE + 'james-hoffmann-aeropress-recipe' },
      dose: 11, water: 200, temp: 99, grind: 'mittelfein', position: 'Standard', level: 'Einsteiger',
      notes: 'Wenig Kaffee, lange Ziehzeit, sehr sanftes Drücken: ein klarer, süßer Becher. Für dunkle Röstungen etwas mehr Kaffee und gröber mahlen.',
      steps: [
        { at: 0, title: 'Aufgießen', detail: 'Ohne Vorwärmen: [[200]] Wasser direkt vom Kochen einfüllen und dabei alles Kaffeemehl benetzen.' },
        { at: 10, title: 'Abdichten & warten', detail: 'Stempel ein Stück einsetzen, damit nichts durchtropft. Bis 2:00 ziehen lassen.' },
        { at: 120, title: 'Schwenken', detail: 'Die AeroPress samt Tasse sanft schwenken.' },
        { at: 125, title: 'Setzen lassen', detail: '30 Sekunden warten, damit sich das Kaffeemehl absetzt.' },
        { at: 150, title: 'Sehr sanft drücken', detail: 'Langsam über ca. 30 Sekunden drücken – bis ganz unten.' },
        { at: 180, title: 'Fertig', detail: 'Genießen.' }
      ]
    },
    {
      id: 'wendelboe', method: 'aeropress', name: 'Klar & ausbalanciert', author: 'Tim Wendelboe',
      source: { label: 'AeroPrecipe', url: AEROPRECIPE + 'tim-wendelboe' },
      dose: 14, water: 200, temp: 96, grind: 'mittel', position: 'Standard', level: 'Einsteiger',
      notes: 'Die Rühranzahl zählt: weniger rühren wird sauer, mehr wird bitter.',
      steps: [
        { at: 0, title: 'Vorbereiten', detail: 'Filter spülen. [[14]] Kaffee einfüllen.' },
        { at: 0, title: 'Aufgießen', detail: '[[200]] Wasser mit 96 °C einfüllen.' },
        { at: 10, title: '3× rühren', detail: 'Genau drei Mal von vorne nach hinten rühren, dann den Stempel aufsetzen.' },
        { at: 15, title: 'Ziehen lassen', detail: '60 Sekunden ziehen lassen.' },
        { at: 75, title: 'Nochmal 3× rühren', detail: 'Stempel abnehmen, drei Mal rühren, Stempel wieder einsetzen.' },
        { at: 85, title: 'Drücken', detail: 'Gleichmäßig in ca. 20–30 Sekunden durchdrücken.' },
        { at: 110, title: 'Fertig', detail: 'Genießen.' }
      ]
    },
    {
      id: 'wac-2019', method: 'aeropress', name: 'Weltmeister-Rezept 2019', author: 'Wendelien van Bunnik (NL)',
      source: { label: 'AeroPrecipe', url: AEROPRECIPE + '2019-wac-1st-place' },
      dose: 30, water: 220, temp: 92, grind: 'grob', position: 'Invertiert', level: 'Fortgeschritten',
      notes: 'Starkes Konzentrat aus viel, grob gemahlenem Kaffee, danach mit heißem Wasser verdünnt. Auf ca. 60 °C abkühlen lassen – dann schmeckt man am meisten.',
      steps: [
        { at: 0, title: 'Invertiert aufbauen', detail: 'Stempel ins untere Ende, AeroPress auf den Kopf stellen. Filter im Deckel spülen. [[30]] Kaffee einfüllen.' },
        { at: 0, title: 'Aufgießen', detail: '[[100]] Wasser mit 92 °C innerhalb von 10 Sekunden aufgießen.' },
        { at: 10, title: '20× rühren', detail: 'Zügig 20 Mal umrühren.' },
        { at: 30, title: 'Umdrehen', detail: 'Deckel aufschrauben, überschüssige Luft herausdrücken und auf die Kanne drehen.' },
        { at: 40, title: 'Drücken', detail: 'In etwa 40 Sekunden durchdrücken.' },
        { at: 80, title: 'Verdünnen', detail: '[[120]] heißes Wasser (92 °C) dazugeben.' },
        { at: 90, title: 'Abkühlen & genießen', detail: 'Umrühren und auf Trinktemperatur (ca. 60 °C) abkühlen lassen.' }
      ]
    },
    {
      id: 'wac-2018', method: 'aeropress', name: 'Weltmeister-Rezept 2018', author: 'Carolina Ibarra Garay (USA)',
      source: { label: 'AeroPrecipe', url: AEROPRECIPE + '2018-wac-1st-place' },
      dose: 35, water: 200, temp: 85, grind: 'mittelgrob', position: 'Invertiert', level: 'Fortgeschritten',
      notes: 'Viel Kaffee, kühleres Wasser und ein Mix aus heißem und zimmerwarmem Wasser zum Verdünnen.',
      steps: [
        { at: 0, title: 'Invertiert aufbauen', detail: 'AeroPress umgedreht aufstellen, Filter spülen. [[35]] Kaffee einfüllen.' },
        { at: 0, title: 'Aufgießen', detail: '[[100]] Wasser mit 85 °C aufgießen.' },
        { at: 10, title: 'Warten', detail: '30 Sekunden quellen lassen.' },
        { at: 40, title: 'Rühren', detail: '30 Sekunden behutsam, aber gründlich rühren.' },
        { at: 70, title: 'Umdrehen & drücken', detail: 'Deckel drauf, umdrehen und in ca. 30 Sekunden in eine Kanne drücken.' },
        { at: 100, title: 'Verdünnen', detail: '[[60]] Wasser mit 85 °C und [[40]] zimmerwarmes Wasser dazugeben.' },
        { at: 110, title: 'Fertig', detail: 'Umrühren und genießen.' }
      ]
    },
    {
      id: 'adler-coldbrew', method: 'aeropress', name: '2-Minuten Cold Brew', author: 'Alan Adler',
      source: { label: 'AeroPrecipe', url: AEROPRECIPE + 'alan-adler-cold-brew-aeropress-recipe' },
      dose: 15, water: 70, temp: 20, grind: 'fein', position: 'Standard', level: 'Einsteiger',
      notes: 'Cold Brew ohne Warten: zimmerwarmes Wasser, eine Minute kräftig rühren. Alan Adler empfiehlt dafür äthiopischen Yirgacheffe.',
      steps: [
        { at: 0, title: 'Aufgießen', detail: '[[15]] fein gemahlenen Kaffee einfüllen, [[70]] zimmerwarmes Wasser dazu (bis Markierung 1).' },
        { at: 5, title: 'Eine Minute rühren', detail: '60 Sekunden durchgehend rühren.' },
        { at: 65, title: 'Langsam drücken', detail: 'Über ca. 60 Sekunden sanft drücken.' },
        { at: 125, title: 'Verdünnen', detail: 'Mit Eiswasser oder Eiswürfeln nach Geschmack auffüllen.' }
      ]
    },

    // ---------- French Press ----------
    {
      id: 'fp-hoffmann', method: 'frenchpress', name: 'Ohne Satz im Becher', author: 'James Hoffmann',
      source: { label: 'YouTube: The Ultimate French Press Technique', url: 'https://www.youtube.com/results?search_query=James+Hoffmann+Ultimate+French+Press+Technique' },
      dose: 30, water: 500, temp: 99, grind: 'mittel', position: '', level: 'Einsteiger',
      notes: 'Längere Wartezeit, kaum drücken: Der Satz sinkt von allein, der Kaffee wird erstaunlich klar.',
      steps: [
        { at: 0, title: 'Aufgießen', detail: '[[30]] Kaffee in die Kanne, [[500]] Wasser direkt vom Kochen aufgießen.' },
        { at: 10, title: 'Ziehen lassen', detail: 'Ohne Deckel 4 Minuten stehen lassen.' },
        { at: 240, title: 'Kruste aufbrechen', detail: 'Die Kruste mit einem Löffel aufbrechen, Schaum und schwimmende Partikel abschöpfen.' },
        { at: 270, title: 'Warten', detail: 'Mindestens 5 Minuten weiter warten – länger geht auch, der Kaffee kühlt nur ab.' },
        { at: 570, title: 'Ausgießen', detail: 'Sieb nur bis zur Oberfläche absenken, nicht drücken. Langsam ausgießen.' }
      ]
    },
    {
      id: 'fp-classic', method: 'frenchpress', name: 'Klassisch in 4 Minuten', author: 'Standardrezept',
      source: null,
      dose: 30, water: 500, temp: 94, grind: 'grob', position: '', level: 'Einsteiger',
      notes: 'Der schnelle Klassiker. Sofort nach dem Drücken ausgießen, sonst zieht der Kaffee weiter.',
      steps: [
        { at: 0, title: 'Aufgießen', detail: '[[30]] grob gemahlenen Kaffee in die Kanne geben, [[500]] Wasser mit 94 °C aufgießen.' },
        { at: 15, title: 'Umrühren', detail: 'Einmal kurz umrühren, Deckel aufsetzen (Sieb oben lassen).' },
        { at: 240, title: 'Drücken', detail: 'Sieb langsam herunterdrücken.' },
        { at: 260, title: 'Sofort ausgießen', detail: 'Komplett in Tassen oder eine Karaffe umfüllen.' }
      ]
    },

    // ---------- V60 ----------
    {
      id: 'v60-hoffmann', method: 'v60', name: 'Ultimate V60', author: 'James Hoffmann',
      source: { label: 'YouTube: The Ultimate V60 Technique', url: 'https://www.youtube.com/results?search_query=James+Hoffmann+Ultimate+V60+Technique' },
      dose: 30, water: 500, temp: 99, grind: 'mittelfein', position: '', level: 'Fortgeschritten',
      notes: 'Bloom, zwei große Aufgüsse und ein Schwenk für ein gleichmäßiges Kaffeebett.',
      steps: [
        { at: 0, title: 'Bloom', detail: '[[60]] Wasser aufgießen, bis alles nass ist. Den Filter schwenken, damit sich alles vermischt.' },
        { at: 45, title: 'Erster Aufguss', detail: 'Bis 1:15 zügig auf [[300]] gesamt aufgießen.' },
        { at: 75, title: 'Zweiter Aufguss', detail: 'Etwas langsamer bis 1:45 auf [[500]] gesamt aufgießen.' },
        { at: 105, title: 'Rühren & schwenken', detail: 'Einmal im und gegen den Uhrzeigersinn rühren, dann sanft schwenken.' },
        { at: 120, title: 'Durchlaufen lassen', detail: 'Ziel: Durchlauf fertig bei ca. 3:30.' },
        { at: 210, title: 'Fertig', detail: 'Flaches Kaffeebett = gleichmäßige Extraktion.' }
      ]
    },
    {
      id: 'v60-46', method: 'v60', name: '4:6-Methode', author: 'Tetsu Kasuya (Weltmeister 2016)',
      source: { label: 'Philocoffea', url: 'https://philocoffea.com/' },
      dose: 20, water: 300, temp: 92, grind: 'grob', position: '', level: 'Fortgeschritten',
      notes: 'Fünf gleiche Aufgüsse. Die ersten 40 % steuern Süße und Säure, die letzten 60 % die Stärke.',
      steps: [
        { at: 0, title: 'Aufguss 1', detail: '[[60]] Wasser gleichmäßig aufgießen.' },
        { at: 45, title: 'Aufguss 2', detail: 'Auf [[120]] gesamt aufgießen.' },
        { at: 90, title: 'Aufguss 3', detail: 'Auf [[180]] gesamt aufgießen.' },
        { at: 135, title: 'Aufguss 4', detail: 'Auf [[240]] gesamt aufgießen.' },
        { at: 180, title: 'Aufguss 5', detail: 'Auf [[300]] gesamt aufgießen.' },
        { at: 210, title: 'Fertig', detail: 'Filter herausnehmen, sobald das Wasser durchgelaufen ist (ca. 3:30).' }
      ]
    },

    // ---------- Chemex ----------
    {
      id: 'chemex-classic', method: 'chemex', name: 'Chemex für 2–3 Tassen', author: 'Standardrezept',
      source: null,
      dose: 30, water: 500, temp: 94, grind: 'mittelgrob', position: '', level: 'Einsteiger',
      notes: 'Der dicke Filter hält Öle zurück – sehr klarer, teeähnlicher Kaffee. Filter gründlich vorspülen.',
      steps: [
        { at: 0, title: 'Bloom', detail: 'Filter spülen, Spülwasser weggießen. [[30]] Kaffee einfüllen, [[60]] Wasser aufgießen.' },
        { at: 45, title: 'Aufgießen', detail: 'In kreisenden Bewegungen auf [[250]] gesamt aufgießen.' },
        { at: 90, title: 'Aufgießen', detail: 'Weiter auf [[400]] gesamt.' },
        { at: 135, title: 'Letzter Aufguss', detail: 'Auf [[500]] gesamt aufgießen.' },
        { at: 165, title: 'Durchlaufen lassen', detail: 'Ziel: fertig bei 4:00–4:30. Läuft es langsamer, nächstes Mal gröber mahlen.' },
        { at: 255, title: 'Fertig', detail: 'Filter entfernen, Chemex schwenken und servieren.' }
      ]
    },

    // ---------- Moka ----------
    {
      id: 'moka-classic', method: 'moka', name: 'Ohne Bitterkeit', author: 'Standardrezept',
      source: null,
      dose: 17, water: 170, temp: 95, grind: 'mittelfein', position: '', level: 'Einsteiger',
      notes: 'Mit heißem Wasser starten und früh vom Herd nehmen – so wird Moka kräftig, aber nicht verbrannt bitter. Menge richtet sich nach deiner Kanne.',
      steps: [
        { at: 0, title: 'Befüllen', detail: 'Unterteil mit heißem Wasser bis knapp unter das Ventil füllen ([[170]]). Sieb locker mit [[17]] Kaffee füllen, nicht andrücken.' },
        { at: 30, title: 'Aufsetzen', detail: 'Kanne mit Tuch zuschrauben, auf mittlere Hitze stellen, Deckel offen lassen.' },
        { at: 150, title: 'Beobachten', detail: 'Sobald Kaffee fließt, Hitze reduzieren. Er sollte langsam und honigartig laufen.' },
        { at: 240, title: 'Vom Herd nehmen', detail: 'Wird der Strahl hell und beginnt zu sprudeln: sofort runter und den Boden unter kaltem Wasser abkühlen.' },
        { at: 260, title: 'Fertig', detail: 'Umrühren und servieren.' }
      ]
    },

    // ---------- Cold Brew ----------
    {
      id: 'coldbrew-classic', method: 'coldbrew', name: 'Konzentrat über Nacht', author: 'Standardrezept',
      source: null,
      dose: 100, water: 1000, temp: 6, grind: 'grob', position: '', level: 'Einsteiger',
      notes: 'Ergibt ein Konzentrat. Zum Trinken etwa 1:1 mit Wasser oder Milch auf Eis verdünnen. Hält im Kühlschrank ca. eine Woche.',
      steps: [
        { at: 0, title: 'Ansetzen', detail: '[[100]] grob gemahlenen Kaffee mit [[1000]] kaltem Wasser in einem Gefäß mischen.' },
        { at: 30, title: 'Umrühren', detail: 'Gründlich umrühren, bis alles benetzt ist. Abdecken.' },
        { at: 60, title: 'Ziehen lassen', detail: '12–18 Stunden in den Kühlschrank stellen.' },
        { at: 64800, title: 'Filtern', detail: 'Durch einen Papierfilter oder ein feines Tuch abseihen.' },
        { at: 65400, title: 'Servieren', detail: 'Mit Wasser oder Milch verdünnen, auf Eis genießen.' }
      ]
    }
  ];

  function methodById(id) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return METHODS[i];
    return null;
  }
  function recipeById(id) {
    for (var i = 0; i < RECIPES.length; i++) if (RECIPES[i].id === id) return RECIPES[i];
    return null;
  }
  function recipesFor(methodId) {
    return RECIPES.filter(function (r) { return r.method === methodId; });
  }

  function roundAmount(g) {
    return g >= 100 ? Math.round(g / 5) * 5 : Math.round(g);
  }

  /** Returns a copy of the recipe scaled to a new total water amount. */
  function scaleRecipe(recipe, water) {
    var f = water / recipe.water;
    return Object.assign({}, recipe, {
      factor: f,
      dose: Math.round(recipe.dose * f * 10) / 10,
      water: roundAmount(water),
      steps: recipe.steps.map(function (s) {
        return Object.assign({}, s, {
          detail: s.detail.replace(/\[\[(\d+(?:\.\d+)?)\]\]/g, function (_, g) { return roundAmount(Number(g) * f) + ' g'; })
        });
      })
    });
  }

  function ratioOf(recipe) {
    return recipe.water / recipe.dose;
  }

  function totalTime(recipe) {
    return recipe.steps.length ? recipe.steps[recipe.steps.length - 1].at : 0;
  }

  /** Index of the step that is active at second t. */
  function stepIndexAt(recipe, t) {
    var idx = 0;
    for (var i = 0; i < recipe.steps.length; i++) if (recipe.steps[i].at <= t) idx = i;
    return idx;
  }

  function grindLevel(name) {
    var i = GRIND_SCALE.indexOf(name);
    return i < 0 ? 3 : i;
  }

  function formatTime(sec) {
    if (sec >= 3600) {
      var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
      return h + ' h' + (m ? ' ' + m + ' min' : '');
    }
    var mm = Math.floor(sec / 60), ss = Math.round(sec % 60);
    return mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  var api = {
    METHODS: METHODS, RECIPES: RECIPES, GRIND_SCALE: GRIND_SCALE,
    methodById: methodById, recipeById: recipeById, recipesFor: recipesFor,
    scaleRecipe: scaleRecipe, ratioOf: ratioOf, totalTime: totalTime,
    stepIndexAt: stepIndexAt, grindLevel: grindLevel, formatTime: formatTime
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BrewData = api;
})(this);
