/*
 * Tick dial: a horizontal ruler you swipe like the iOS timer (ported from the
 * wine app). The value under the pointer is selected, ticks up to it light up,
 * the edges fade out, and every tick you pass clicks - harder on labelled values.
 * Native scrolling with snap points keeps momentum on phones.
 */
(function (root) {
  'use strict';

  var U = root.UI;
  var TICK = 12; // px between two ticks

  function isMultiple(value, of) { return Math.abs(value / of - Math.round(value / of)) < 1e-6; }
  function decimalsOf(n) { return (String(n).split('.')[1] || '').length; }

  /**
   * opts: { label, value, min, max, step, majorEvery, mediumEvery, format(v), describe(v, touched), onChange(v), unit }
   * Returns { el, set(value), sync(), value() }.
   */
  function TickDial(opts) {
    var min = opts.min, max = opts.max, step = opts.step || 1;
    var majorEvery = opts.majorEvery || 5, mediumEvery = opts.mediumEvery;
    var count = Math.round((max - min) / step);
    var nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: decimalsOf(step) });
    var show = opts.format || function (v) { return nf.format(v); };
    var touched = opts.value !== null && opts.value !== undefined && opts.value !== '';
    var value = touched ? Number(opts.value) : (opts.fallback != null ? opts.fallback : min);
    var lastIndex = null, frame = 0, programmatic = false;

    function valueAt(i) { return Math.round((min + i * step) * 1e6) / 1e6; }
    function indexOf(v) { return Math.min(count, Math.max(0, Math.round((v - min) / step))); }
    function levelAt(i) {
      var v = valueAt(i);
      if (isMultiple(v, majorEvery)) return 'major';
      if (mediumEvery && isMultiple(v, mediumEvery)) return 'medium';
      return 'minor';
    }

    var id = 'td-' + Math.random().toString(36).slice(2, 8);
    var scroller = U.el('div', {
      class: 'td-scroller', role: 'slider', tabindex: '0', 'aria-labelledby': id,
      'aria-valuemin': min, 'aria-valuemax': max
    });
    var ticks = [];
    for (var i = 0; i <= count; i++) {
      var lvl = levelAt(i);
      var t = U.el('button', { type: 'button', tabindex: '-1', 'aria-hidden': 'true', class: 'td-tick ' + lvl, 'data-i': i });
      if (lvl === 'major') t.appendChild(U.el('span', { class: 'td-num', text: show(valueAt(i)) }));
      t.appendChild(U.el('span', { class: 'td-bar' }));
      scroller.appendChild(t);
      ticks.push(t);
    }
    var pill = U.el('span', { class: 'td-pill' });
    var big = U.el('span', { class: 'td-value', 'aria-hidden': 'true' });
    var unit = opts.unit ? U.el('span', { class: 'td-unit', text: opts.unit }) : null;
    var node = U.el('div', { class: 'tickdial' + (opts.compact ? ' compact' : '') }, [
      U.el('p', { class: 'td-label', id: id, text: opts.label }),
      U.el('div', { class: 'td-wrap' }, [scroller, U.el('div', { class: 'td-pointer', 'aria-hidden': 'true' })]),
      U.el('div', { class: 'td-foot' }, [pill, U.el('span', { class: 'td-readout' }, [big, unit])])
    ]);

    function paint() {
      var sel = indexOf(value);
      for (var i = 0; i < ticks.length; i++) ticks[i].classList.toggle('on', touched && i <= sel);
      big.textContent = touched ? show(value) : '–';
      pill.textContent = opts.describe ? opts.describe(value, touched) : opts.label;
      scroller.setAttribute('aria-valuenow', value);
      scroller.setAttribute('aria-valuetext', touched ? show(value) + (opts.unit ? ' ' + opts.unit : '') + (opts.describe ? ' – ' + opts.describe(value, true) : '') : 'nicht gesetzt');
    }

    function scrollToIndex(i, smooth) {
      if (!smooth) programmatic = true;
      scroller.scrollTo({ left: i * TICK, behavior: smooth ? 'smooth' : 'auto' });
      if (!smooth) requestAnimationFrame(function () { programmatic = false; });
    }

    scroller.addEventListener('scroll', function () {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        if (programmatic) return;
        var next = Math.min(count, Math.max(0, Math.round(scroller.scrollLeft / TICK)));
        var previous = lastIndex == null ? next : lastIndex;
        if (next === previous) return;
        // Click with the strongest level among all ticks passed since the last frame.
        var from = next > previous ? previous + 1 : next, to = next > previous ? next : previous - 1;
        var level = 'minor';
        for (var i = from; i <= to; i++) {
          var l = levelAt(i);
          if (l === 'major') level = 'major';
          else if (l === 'medium' && level === 'minor') level = 'medium';
        }
        U.tick(level);
        lastIndex = next;
        value = valueAt(next);
        touched = true;
        paint();
        if (opts.onChange) opts.onChange(value);
      });
    });
    scroller.addEventListener('touchend', function () { U.releaseTick(levelAt(lastIndex == null ? indexOf(value) : lastIndex)); });
    scroller.addEventListener('click', function (ev) {
      var t = ev.target.closest('.td-tick');
      if (t) scrollToIndex(Number(t.getAttribute('data-i')), true);
    });
    scroller.addEventListener('keydown', function (ev) {
      var bigStep = mediumEvery || majorEvery;
      var keys = { ArrowRight: value + step, ArrowUp: value + step, ArrowLeft: value - step, ArrowDown: value - step,
        PageUp: value + bigStep, PageDown: value - bigStep, Home: min, End: max };
      if (ev.key in keys) {
        ev.preventDefault();
        if (!touched) { touched = true; lastIndex = null; }
        scrollToIndex(indexOf(keys[ev.key]), true);
      }
    });

    // Position the ruler once it has a width (it may start in a hidden view).
    function sync() {
      if (!scroller.clientWidth) return;
      lastIndex = indexOf(value);
      scrollToIndex(lastIndex, false);
    }
    if (root.ResizeObserver) new ResizeObserver(sync).observe(scroller);
    requestAnimationFrame(sync);
    paint();

    return {
      el: node,
      sync: sync,
      value: function () { return touched ? value : null; },
      /** Set from outside (no onChange). Pass null/'' to show the dial as untouched. */
      set: function (v) {
        touched = v !== null && v !== undefined && v !== '';
        if (touched) value = Math.min(max, Math.max(min, Number(v)));
        lastIndex = indexOf(value);
        paint();
        scrollToIndex(lastIndex, false);
      }
    };
  }

  root.TickDial = TickDial;
})(this);
