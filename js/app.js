/* LessonBeam UI. Plain JS, no build step. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === 'text') e.textContent = props[k]; else if (k === 'class') e.className = props[k]; else e.setAttribute(k, props[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };

  /* ---------- storage ---------- */
  var KEY = 'lessonbeam.lessons.v1';
  var temp = {};
  function loadUser() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.map(function (x) { var l = LB.cleanLesson(x); l.source = x.source === 'received' ? 'received' : 'created'; l.savedAt = x.savedAt || 0; return l; }).filter(function (l) { return l.title; });
    } catch (e) { return []; }
  }
  function saveUser(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function allLessons() { return window.LB_SAMPLES.map(function (s) { var l = LB.cleanLesson(s); l.source = 'sample'; return l; }).concat(loadUser()); }
  function getLesson(id) { return temp[id] || allLessons().filter(function (l) { return l.id === id; })[0] || null; }
  function upsert(lesson, source) {
    if (window.LB_SAMPLES.some(function (s) { return s.id === lesson.id; })) return 'builtin';
    var list = loadUser();
    if (list.some(function (l) { return l.id === lesson.id; })) return 'exists';
    var l = LB.cleanLesson(lesson); l.source = source; l.savedAt = Date.now(); list.push(l);
    if (!saveUser(list)) { temp[l.id] = l; return 'failed'; }
    return 'saved';
  }
  function removeLesson(id) { saveUser(loadUser().filter(function (l) { return l.id !== id; })); }

  /* ---------- navigation ---------- */
  var current = 'library';
  function show(view, arg) {
    leaveView(current);
    current = view;
    $$('main > section[data-view]').forEach(function (s) { s.hidden = s.dataset.view !== view; });
    $$('.tabs button').forEach(function (b) { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (view === 'library') renderLibrary();
    if (view === 'beam') enterBeam(arg);
    if (view === 'lesson') renderLesson(arg);
    window.scrollTo(0, 0);
  }
  function leaveView(v) { if (v === 'beam') beam.stop(); if (v === 'receive') cam.stop(); }
  function route() {
    var h = location.hash.replace(/^#/, '');
    var p = h.split('/');
    var v = p[0] || 'library';
    if (['library', 'create', 'beam', 'receive', 'lesson'].indexOf(v) < 0) v = 'library';
    show(v, p[1] ? decodeURIComponent(p[1]) : undefined);
  }
  function go(v, arg) { var h = '#' + v + (arg ? '/' + encodeURIComponent(arg) : ''); if (location.hash === h) route(); else location.hash = h; }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-view],[data-go]');
    if (!t) return;
    if (t.closest('.tabs')) go(t.dataset.view); else if (t.dataset.go) go(t.dataset.go);
  });

  /* ---------- library ---------- */
  var armed = null;
  function renderLibrary() {
    var ul = $('#lib-list'); ul.textContent = '';
    allLessons().forEach(function (l) {
      var label = { sample: 'Sample', created: 'Created', received: 'Received' }[l.source];
      var cls = { sample: 'badge', created: 'badge cre', received: 'badge rec' }[l.source];
      var meta = fmt(l.text.length) + ' characters' + (l.quiz.length ? ', ' + l.quiz.length + '-question quiz' : ', no quiz');
      var acts = el('div', { class: 'actions' }, [
        el('button', { class: 'btn small primary', text: 'Read' }),
        el('button', { class: 'btn small', text: 'Beam' })
      ]);
      acts.children[0].addEventListener('click', function () { go('lesson', l.id); });
      acts.children[1].addEventListener('click', function () { go('beam', l.id); });
      if (l.source !== 'sample') {
        var d = el('button', { class: 'btn small danger', text: 'Delete', 'aria-label': 'Delete ' + l.title });
        d.addEventListener('click', function () {
          if (armed === l.id) { removeLesson(l.id); armed = null; renderLibrary(); }
          else { armed = l.id; d.textContent = 'Tap again to delete'; }
        });
        acts.appendChild(d);
      }
      ul.appendChild(el('li', { class: 'card' }, [el('h3', {}, [el('span', { class: cls, text: label }), document.createTextNode(l.title)]), el('p', { text: meta }), acts]));
    });
  }

  /* ---------- create ---------- */
  var qCount = 0;
  function addQuestion() {
    if ($$('#c-quiz .q').length >= 5) return;
    var n = ++qCount;
    var box = el('div', { class: 'q' });
    box.appendChild(el('label', { for: 'q' + n, text: 'Question' }));
    box.appendChild(el('input', { id: 'q' + n, maxlength: '300', class: 'qq' }));
    box.appendChild(el('p', { class: 'note', text: 'Answers (choose the correct one, leave unused answers blank)' }));
    for (var i = 0; i < 4; i++) {
      var o = el('div', { class: 'opt' });
      o.appendChild(el('input', { type: 'radio', name: 'qa' + n, value: String(i), 'aria-label': 'Answer ' + 'ABCD'[i] + ' is correct' }));
      o.appendChild(el('input', { class: 'qo', maxlength: '200', placeholder: 'Answer ' + 'ABCD'[i], 'aria-label': 'Answer ' + 'ABCD'[i] + ' text' }));
      box.appendChild(o);
    }
    var rm = el('button', { type: 'button', class: 'btn small danger', text: 'Remove question' });
    rm.addEventListener('click', function () { box.remove(); $('#c-addq').hidden = false; });
    box.appendChild(rm);
    $('#c-quiz').appendChild(box);
    $('#c-addq').hidden = $$('#c-quiz .q').length >= 5;
    $('#q' + n).focus();
  }
  function readForm() {
    var quiz = [];
    var qs = $$('#c-quiz .q');
    for (var k = 0; k < qs.length; k++) {
      var q = qs[k], text = $('.qq', q).value.trim();
      var opts = [], answer = -1;
      $$('.opt', q).forEach(function (o, i) {
        var v = $('.qo', o).value.trim();
        if (v) { if ($('input[type=radio]', o).checked) answer = opts.length; opts.push(v); }
      });
      if (!text && !opts.length) continue;
      if (!text) throw new Error('Question ' + (k + 1) + ' needs question text.');
      if (opts.length < 2) throw new Error('Question ' + (k + 1) + ' needs at least two answers.');
      if (answer < 0) throw new Error('Question ' + (k + 1) + ': choose which answer is correct (and fill that answer in).');
      quiz.push({ q: text, options: opts, answer: answer });
    }
    var title = $('#c-title').value.trim(), body = $('#c-text').value.trim();
    if (!title) throw new Error('Please add a title.');
    if (!body) throw new Error('Please write some lesson text.');
    return { v: 1, id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: title, text: body, quiz: quiz };
  }
  function submitCreate(beamAfter) {
    var err = $('#c-error'); err.hidden = true;
    var lesson;
    try { lesson = readForm(); } catch (e) { err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); return; }
    var r = upsert(lesson, 'created');
    $('#create-form').reset(); $('#c-quiz').textContent = ''; $('#c-addq').hidden = false; updateCount();
    if (r === 'failed') { err.textContent = 'Could not save to browser storage (full or blocked). You can still beam it now.'; err.hidden = false; }
    go(beamAfter ? 'beam' : 'library', beamAfter ? lesson.id : undefined);
  }
  function updateCount() { $('#c-count').textContent = $('#c-text').value.length + ' / 6000'; }
  $('#c-text').addEventListener('input', updateCount);
  $('#c-addq').addEventListener('click', addQuestion);
  $('#create-form').addEventListener('submit', function (e) { e.preventDefault(); submitCreate(true); });
  $('#c-save').addEventListener('click', function () { submitCreate(false); });

  /* ---------- receiver panel (used by camera and by loopback self-test) ---------- */
  function ReceiverPanel(slot, kind) {
    var self = this;
    this.kind = kind;
    this.root = document.importNode($('#tpl-rx').content, true).firstElementChild;
    slot.textContent = ''; slot.appendChild(this.root);
    var q = function (s) { return $(s, self.root); };
    this.ui = { status: q('.rx-status'), fill: q('.bar-fill'), grid: q('.grid'), stats: q('.rx-stats'), err: q('.rx-err'), ok: q('.rx-ok'), okmsg: q('.rx-okmsg'), open: q('.rx-open'), again: q('.rx-again'), reset: q('.rx-reset'), clear: q('.rx-clear') };
    this.ui.again.addEventListener('click', function () { self.reset(); });
    this.ui.clear.addEventListener('click', function () { self.reset(); });
    this.ui.open.addEventListener('click', function () { if (self.lesson) { temp[self.lesson.id] = temp[self.lesson.id] || self.lesson; go('lesson', self.lesson.id); } });
    this.onDone = null;
    this.reset();
  }
  ReceiverPanel.prototype.reset = function () {
    this.asm = new LB.Assembler(); this.done = false; this.lesson = null; this.frames = 0; this.misses = 0; this.note = '';
    var u = this.ui;
    u.err.hidden = true; u.ok.hidden = true; u.reset.hidden = true; u.grid.textContent = '';
    u.fill.style.width = '0%'; u.stats.textContent = '';
    u.grid.setAttribute('aria-label', 'No parts received yet');
    u.status.textContent = this.kind === 'loopback' ? 'Loopback test ready. Reading the QR canvas above...' : 'Waiting for the first QR code. Point the camera at the beaming screen.';
  };
  ReceiverPanel.prototype.render = function () {
    var a = this.asm, u = this.ui;
    if (u.grid.children.length !== a.total) {
      u.grid.textContent = '';
      for (var i = 0; i < a.total; i++) u.grid.appendChild(el('i', { class: i === 0 ? 'meta' : '', title: i === 0 ? 'Header (checksum)' : 'Part ' + i }));
    }
    for (var j = 0; j < a.total; j++) u.grid.children[j].classList.toggle('got', a.have(j));
    u.grid.setAttribute('aria-label', a.count + ' of ' + a.total + ' parts received');
    u.fill.style.width = Math.round(100 * a.count / a.total) + '%';
    u.stats.textContent = 'Transfer ' + a.id + ': ' + a.count + ' of ' + a.total + ' parts. QR frames read: ' + this.frames + ' (' + a.dups + ' repeats, ' + a.bad + ' failed checksum).' + (this.note ? ' ' + this.note : '');
    if (!this.done) u.status.textContent = (this.kind === 'loopback' ? 'Loopback: ' : '') + 'Receiving: ' + a.count + ' of ' + a.total + ' parts';
  };
  ReceiverPanel.prototype.miss = function () { this.misses++; };
  ReceiverPanel.prototype.ingest = function (text) {
    if (this.done) return;
    var r = this.asm.ingest(text);
    if (r === 'ignored') { this.ui.status.textContent = 'That QR code is not a LessonBeam frame.'; return; }
    this.frames++;
    if (r === 'switched') this.note = 'A different lesson started; restarted.';
    if (r === 'bad') { this.render(); return; }
    this.render();
    if (this.asm.complete()) this.finalize();
  };
  ReceiverPanel.prototype.finalize = async function () {
    var self = this, u = this.ui;
    this.done = true;
    u.status.textContent = 'All parts received. Verifying SHA-256...';
    try {
      var res = await this.asm.finish();
      var st = upsert(res.lesson, 'received');
      this.lesson = res.lesson;
      var saved = { saved: 'Saved to your library.', exists: 'Already in your library.', builtin: 'This is a built-in sample, so it is already in your library.', failed: 'Could not save to browser storage, but you can read it now.' }[st];
      u.status.textContent = 'Verified.';
      u.okmsg.textContent = (this.kind === 'loopback' ? 'Loopback self-test passed. ' : '') + '“' + res.lesson.title + '”: ' + this.asm.total + ' parts, ' + fmt(res.packedBytes) + ' bytes' + (res.gzip ? ' (gzip)' : '') + ', SHA-256 ' + res.sha256.slice(0, 16) + '… matched. ' + saved;
      u.ok.hidden = false; u.reset.hidden = true;
    } catch (e) {
      u.status.textContent = 'Not accepted.';
      u.err.textContent = e.message + ' Clear and try again.';
      u.err.hidden = false; u.reset.hidden = false;
    }
    if (this.onDone) this.onDone(this);
  };

  /* ---------- sender ---------- */
  var beam = (function () {
    var canvas = $('#b-canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    var S = { mats: [], idx: 0, shown: 0, fps: 6, playing: true, timer: null, lesson: null, pass: 0, stats: null, loop: null, token: 0 };
    function buildMats(frames) {
      var type = 1;
      frames.forEach(function (f) { var q = qrcode(0, 'L'); q.addData(f); q.make(); type = Math.max(type, (q.getModuleCount() - 17) / 4); });
      return frames.map(function (f) {
        var q = qrcode(type, 'L'); q.addData(f); q.make();
        var n = q.getModuleCount(), bits = new Uint8Array(n * n);
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) bits[r * n + c] = q.isDark(r, c) ? 1 : 0;
        return { n: n, bits: bits };
      });
    }
    function draw(i) {
      var m = S.mats[i], W = canvas.width, scale = Math.floor(W / (m.n + 8)), off = Math.floor((W - m.n * scale) / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, W); ctx.fillStyle = '#000';
      for (var r = 0; r < m.n; r++) {
        var c = 0;
        while (c < m.n) {
          if (!m.bits[r * m.n + c]) { c++; continue; }
          var s = c; while (c < m.n && m.bits[r * m.n + c]) c++;
          ctx.fillRect(off + s * scale, off + r * scale, (c - s) * scale, scale);
        }
      }
    }
    function counter() {
      var total = S.mats.length;
      $('#b-counter').textContent = 'Frame ' + (S.shown + 1) + ' of ' + total + '  |  pass ' + (S.pass + 1) + '  |  full loop ≈ ' + (total / S.fps).toFixed(1) + ' s at ' + S.fps + ' fps';
    }
    function tick() {
      if (!S.mats.length) return;
      S.shown = S.idx; draw(S.idx); counter();
      if (S.loop && S.loop.active) loopbackRead();
      S.idx++; if (S.idx >= S.mats.length) { S.idx = 0; S.pass++; }
      if (S.playing && current === 'beam') S.timer = setTimeout(tick, 1000 / S.fps);
    }
    function loopbackRead() {
      var W = canvas.width, img = ctx.getImageData(0, 0, W, W);
      var code = jsQR(img.data, W, W, { inversionAttempts: 'dontInvert' });
      if (code) S.loop.panel.ingest(code.data); else S.loop.panel.miss();
      if (S.loop.panel.done) S.loop.active = false;
    }
    function clearTimer() { clearTimeout(S.timer); S.timer = null; }
    var api = {
      state: S,
      stop: function () { clearTimer(); S.token++; if (S.loop) S.loop.active = false; },
      play: function () { S.playing = true; clearTimer(); $('#b-play').textContent = 'Pause'; $('#b-play').setAttribute('aria-pressed', 'true'); tick(); },
      pause: function () { S.playing = false; clearTimer(); $('#b-play').textContent = 'Play'; $('#b-play').setAttribute('aria-pressed', 'false'); },
      load: async function (id) {
        var tok = ++S.token; clearTimer();
        var lesson = getLesson(id); if (!lesson) return;
        S.lesson = lesson;
        var chunk = Number($('#b-size').value);
        $('#b-counter').textContent = 'Preparing...';
        var p;
        try { p = await LB.pack(lesson, { chunkChars: chunk }); } catch (e) { $('#b-counter').textContent = 'Could not pack: ' + e.message; return; }
        if (tok !== S.token) return;
        S.mats = buildMats(p.frames); S.idx = 0; S.pass = 0; S.stats = p.stats;
        var n = S.mats[0].n;
        $('#b-stats').textContent = 'Lesson text ' + fmt(lesson.text.length) + ' characters, ' + fmt(p.stats.jsonBytes) + ' bytes as JSON, ' + fmt(p.stats.packedBytes) + ' bytes ' + (p.stats.gzip ? 'after gzip' : 'sent uncompressed') + ', split into ' + p.stats.frameCount + ' QR frames (QR size ' + n + 'x' + n + ' modules, transfer id ' + p.id + ').';
        api.play();
      },
      setFps: function (v) { S.fps = v; $('#b-fps-out').textContent = v + ' fps'; counter(); }
    };
    S.setLoop = function (loop) { S.loop = loop; };
    return api;
  })();

  var bPanel = null;
  function enterBeam(id) {
    var pick = $('#b-pick'), cur = id || pick.value || '';
    pick.textContent = '';
    allLessons().forEach(function (l) { var o = el('option', { value: l.id, text: l.title }); pick.appendChild(o); });
    if (cur && getLesson(cur)) { if (!$$('option', pick).some(function (o) { return o.value === cur; })) pick.appendChild(el('option', { value: cur, text: getLesson(cur).title })); pick.value = cur; }
    bPanel = new ReceiverPanel($('#b-rx'), 'loopback');
    bPanel.root.hidden = true;
    beam.state.setLoop({ active: false, panel: bPanel });
    beam.load(pick.value);
  }
  $('#b-pick').addEventListener('change', function () { location.hash = '#beam/' + encodeURIComponent(this.value); });
  $('#b-play').addEventListener('click', function () { if (beam.state.playing) beam.pause(); else beam.play(); });
  $('#b-fps').addEventListener('input', function () { beam.setFps(Number(this.value)); });
  $('#b-size').addEventListener('input', function () { $('#b-size-out').textContent = this.value; });
  $('#b-size').addEventListener('change', function () { beam.load($('#b-pick').value); });
  $('#b-selftest').addEventListener('click', function () {
    if (!beam.state.mats.length) return;
    bPanel.reset(); bPanel.root.hidden = false;
    bPanel.onDone = null;
    beam.state.loop.active = true;
    beam.state.idx = Math.floor(beam.state.mats.length / 2); /* join mid-loop on purpose */
    if (!beam.state.playing) beam.play(); else { beam.pause(); beam.play(); }
    bPanel.root.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  /* ---------- camera receiver ---------- */
  var cam = (function () {
    var stream = null, timer = null, panel = null, busy = false;
    var video = $('#r-video'), work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
    function err(msg) { var e = $('#r-error'); e.textContent = msg; e.hidden = !msg; }
    function scan() {
      timer = setTimeout(scan, 60);
      if (busy || !video.videoWidth || video.readyState < 2) return;
      busy = true;
      try {
        var s = Math.min(1, 960 / video.videoWidth);
        work.width = Math.round(video.videoWidth * s); work.height = Math.round(video.videoHeight * s);
        wctx.drawImage(video, 0, 0, work.width, work.height);
        var img = wctx.getImageData(0, 0, work.width, work.height);
        var code = jsQR(img.data, work.width, work.height, { inversionAttempts: 'dontInvert' });
        if (code) panel.ingest(code.data);
      } finally { busy = false; }
    }
    var api = {
      ensurePanel: function () { if (!panel) panel = new ReceiverPanel($('#r-rx'), 'camera'); return panel; },
      start: async function () {
        err(''); api.ensurePanel();
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { err('Camera access is not available here. It needs a modern browser on HTTPS or localhost.'); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        } catch (e) {
          var n = e && e.name;
          if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') err('Camera permission was denied. Allow camera access for this site in your browser settings, then tap Start camera again. You can still run the self-test on the Beam tab.');
          else if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'NotSupportedError' || n === 'OverconstrainedError') err('No usable camera was found on this device (or it is blocked).');
          else if (n === 'NotReadableError') err('The camera is busy. Close other apps that use it and try again.');
          else err('Could not start the camera (' + (n || 'unknown error') + ').');
          return;
        }
        video.srcObject = stream; await video.play().catch(function () {});
        $('#cam-wrap').hidden = false; $('#r-start').hidden = true; $('#r-stop').hidden = false;
        clearTimeout(timer); scan();
      },
      stop: function () {
        clearTimeout(timer); timer = null;
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null; video.srcObject = null;
        $('#cam-wrap').hidden = true; $('#r-start').hidden = false; $('#r-stop').hidden = true;
      }
    };
    return api;
  })();
  $('#r-start').addEventListener('click', function () { cam.start(); });
  $('#r-stop').addEventListener('click', function () { cam.stop(); });
  cam.ensurePanel();

  /* ---------- lesson view + quiz ---------- */
  var viewing = null;
  function renderLesson(id) {
    var l = getLesson(id); viewing = l;
    if (!l) { go('library'); return; }
    $('#l-title').textContent = l.title;
    $('#l-meta').textContent = { sample: 'Built-in sample', created: 'Created on this device', received: 'Received by beam' }[l.source || 'received'] + ' · ' + fmt(l.text.length) + ' characters';
    var body = $('#l-body'); body.textContent = '';
    l.text.split(/\n{2,}/).forEach(function (p) { if (p.trim()) body.appendChild(el('p', { text: p.trim() })); });
    renderQuiz(l);
    $('#l-title').setAttribute('tabindex', '-1');
  }
  function renderQuiz(l) {
    var box = $('#l-quizbox'), form = $('#l-quiz'), sc = $('#l-score');
    form.textContent = ''; sc.hidden = true;
    box.hidden = !l.quiz.length;
    l.quiz.forEach(function (q, i) {
      var fs = el('fieldset', { class: 'quizq' }, [el('legend', { text: (i + 1) + '. ' + q.q })]);
      q.options.forEach(function (o, j) {
        var inp = el('input', { type: 'radio', name: 'ans' + i, value: String(j) });
        fs.appendChild(el('label', {}, [inp, el('span', { text: o })]));
      });
      form.appendChild(fs);
    });
    if (l.quiz.length) form.appendChild(el('div', { class: 'actions' }, [el('button', { class: 'btn primary', type: 'submit', text: 'Check my answers' })]));
  }
  $('#l-quiz').addEventListener('submit', function (e) {
    e.preventDefault();
    var l = viewing, score = 0, sc = $('#l-score');
    var fss = $$('fieldset', this);
    if (fss.some(function (fs, i) { return !$('input:checked', fs); })) { sc.className = 'msg err'; sc.textContent = 'Please answer every question first.'; sc.hidden = false; return; }
    fss.forEach(function (fs, i) {
      var pick = Number($('input:checked', fs).value), ok = pick === l.quiz[i].answer;
      if (ok) score++;
      fs.classList.remove('right', 'wrong'); fs.classList.add(ok ? 'right' : 'wrong');
      var old = $('.fb', fs); if (old) old.remove();
      fs.appendChild(el('p', { class: 'fb', text: ok ? 'Correct.' : 'Not quite. Correct answer: ' + l.quiz[i].options[l.quiz[i].answer] }));
    });
    sc.className = 'msg ok'; sc.textContent = 'You scored ' + score + ' of ' + l.quiz.length + '. (Scored on this device only.)'; sc.hidden = false;
  });
  $('#l-beam').addEventListener('click', function () { if (viewing) go('beam', viewing.id); });

  /* ---------- network + offline status ---------- */
  var swReady = false;
  function updateNet() {
    var on = navigator.onLine;
    var n = $('#netstate'); n.className = 'net ' + (on ? 'on' : 'off');
    $('#nettext').textContent = (on ? 'Online' : 'Offline') + (swReady ? ' · works offline' : '');
  }
  window.addEventListener('online', updateNet); window.addEventListener('offline', updateNet);
  updateNet();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function () { swReady = true; updateNet(); }).catch(function () {});
  }

  route();
})();
