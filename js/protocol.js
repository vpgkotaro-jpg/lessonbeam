/* LessonBeam protocol (LB1). No dependencies. Exposes window.LB.
 * Frame:  LB1|<transferId>|<index>|<total>|<crc32 of payload, 8 hex>|<payload>
 * Frame 0 is a meta frame: payload = "<gz 0|1>.<byteLength>.<sha256 hex of packed bytes>"
 * Frames 1..total-1 carry base64url slices of the packed bytes (gzip of the lesson JSON, or raw JSON).
 */
(function (g) {
  'use strict';
  var MAGIC = 'LB1';
  var MAX_FRAMES = 600;
  var MAX_PACKED = 120000;

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();

  function crc32(str) {
    var c = 0xffffffff;
    for (var i = 0; i < str.length; i++) c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xff] ^ (c >>> 8);
    return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  }

  function bytesToB64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64ToBytes(b64) {
    var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    var u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  async function pipe(u8, stream) {
    var w = stream.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  }
  async function gzip(u8) { return g.CompressionStream ? pipe(u8, new CompressionStream('gzip')) : null; }
  async function gunzip(u8) {
    if (!g.DecompressionStream) throw lbError('NOGZIP', 'This browser cannot decompress the lesson (no DecompressionStream).');
    return pipe(u8, new DecompressionStream('gzip'));
  }
  async function sha256hex(u8) {
    if (!(g.crypto && g.crypto.subtle)) throw lbError('NOCRYPTO', 'SHA-256 is unavailable here. Open the app over HTTPS or localhost.');
    var d = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
    return Array.prototype.map.call(d, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function lbError(code, msg) { var e = new Error(msg); e.code = code; return e; }

  function cleanLesson(l) {
    var s = function (v, max) { return String(v == null ? '' : v).slice(0, max); };
    var out = { v: 1, id: s(l.id, 40) || ('l' + Date.now().toString(36)), title: s(l.title, 120).trim(), text: s(l.text, 6000), quiz: [] };
    if (Array.isArray(l.quiz)) l.quiz.slice(0, 5).forEach(function (q) {
      if (!q || !Array.isArray(q.options)) return;
      var opts = q.options.slice(0, 4).map(function (o) { return s(o, 200); });
      var a = Number(q.answer);
      if (!s(q.q, 300).trim() || opts.length < 2 || !(a >= 0 && a < opts.length)) return;
      out.quiz.push({ q: s(q.q, 300), options: opts, answer: a | 0 });
    });
    return out;
  }
  function validateLesson(l) {
    if (!l || typeof l !== 'object' || typeof l.title !== 'string' || typeof l.text !== 'string') throw lbError('SHAPE', 'The data decoded, but it is not a LessonBeam lesson.');
    var c = cleanLesson(l);
    if (!c.title) throw lbError('SHAPE', 'The lesson has no title.');
    return c;
  }

  /** lesson -> { id, frames:[string], stats } */
  async function pack(lesson, opts) {
    var chunkChars = Math.max(120, Math.min(420, (opts && opts.chunkChars) || 300));
    var json = new TextEncoder().encode(JSON.stringify(cleanLesson(lesson)));
    var gz = await gzip(json);
    var useGz = !!gz && gz.length < json.length;
    var packed = useGz ? gz : json;
    if (packed.length > MAX_PACKED) throw lbError('TOOBIG', 'Lesson is too large to beam.');
    var sha = await sha256hex(packed);
    var id = sha.slice(0, 8);
    var per = Math.floor(chunkChars * 3 / 4);
    var parts = Math.max(1, Math.ceil(packed.length / per));
    var total = parts + 1;
    var frames = [];
    var meta = (useGz ? '1' : '0') + '.' + packed.length + '.' + sha;
    frames.push([MAGIC, id, 0, total, crc32(meta), meta].join('|'));
    for (var i = 0; i < parts; i++) {
      var p = bytesToB64(packed.subarray(i * per, (i + 1) * per));
      frames.push([MAGIC, id, i + 1, total, crc32(p), p].join('|'));
    }
    return { id: id, frames: frames, stats: { jsonBytes: json.length, packedBytes: packed.length, gzip: useGz, frameCount: total, chunkChars: chunkChars } };
  }

  function parseFrame(text) {
    if (typeof text !== 'string' || text.slice(0, 4) !== MAGIC + '|') return { ok: false, reason: 'notlb' };
    var p = text.split('|');
    if (p.length < 6) return { ok: false, reason: 'format' };
    var idx = Number(p[2]), total = Number(p[3]);
    var payload = p.slice(5).join('|');
    if (!/^[0-9a-f]{1,16}$/.test(p[1]) || !Number.isInteger(idx) || !Number.isInteger(total) || total < 2 || total > MAX_FRAMES || idx < 0 || idx >= total) return { ok: false, reason: 'format' };
    if (crc32(payload) !== p[4]) return { ok: false, reason: 'crc' };
    return { ok: true, id: p[1], idx: idx, total: total, payload: payload };
  }

  function Assembler() { this.reset(); }
  Assembler.prototype.reset = function () { this.id = null; this.total = 0; this.parts = {}; this.count = 0; this.bad = 0; this.dups = 0; };
  Assembler.prototype.have = function (i) { return Object.prototype.hasOwnProperty.call(this.parts, i); };
  /** returns 'new' | 'dup' | 'bad' | 'ignored' | 'switched' (new transfer started, frame accepted) */
  Assembler.prototype.ingest = function (text) {
    var f = parseFrame(text);
    if (!f.ok) { if (f.reason === 'notlb') return 'ignored'; this.bad++; return 'bad'; }
    var switched = false;
    if (this.id !== f.id || this.total !== f.total) {
      switched = this.id !== null && this.count > 0;
      this.reset(); this.id = f.id; this.total = f.total;
    }
    if (this.have(f.idx)) { this.dups++; return 'dup'; }
    this.parts[f.idx] = f.payload; this.count++;
    return switched ? 'switched' : 'new';
  };
  Assembler.prototype.complete = function () { return this.total > 0 && this.count === this.total; };
  /** Verifies SHA-256 and returns the lesson. Throws Error with .code HASH | LEN | SHAPE | PARSE | ... */
  Assembler.prototype.finish = async function () {
    if (!this.complete()) throw lbError('INCOMPLETE', 'Not all parts have arrived.');
    var m = this.parts[0].split('.');
    if (m.length !== 3 || !/^[0-9a-f]{64}$/.test(m[2])) throw lbError('META', 'The header frame is malformed.');
    var len = Number(m[1]), chunks = [];
    for (var i = 1; i < this.total; i++) chunks.push(b64ToBytes(this.parts[i]));
    var packed = new Uint8Array(chunks.reduce(function (a, c) { return a + c.length; }, 0)), off = 0;
    chunks.forEach(function (c) { packed.set(c, off); off += c.length; });
    if (packed.length !== len) throw lbError('LEN', 'Length mismatch: expected ' + len + ' bytes, got ' + packed.length + '.');
    var sha = await sha256hex(packed);
    if (sha !== m[2]) throw lbError('HASH', 'Hash mismatch: the reassembled lesson does not match the sender’s SHA-256. It was NOT accepted.');
    var json = m[0] === '1' ? await gunzip(packed) : packed;
    var obj;
    try { obj = JSON.parse(new TextDecoder().decode(json)); } catch (e) { throw lbError('PARSE', 'The lesson data could not be read.'); }
    var lesson = validateLesson(obj);
    return { lesson: lesson, sha256: sha, packedBytes: packed.length, gzip: m[0] === '1' };
  };

  g.LB = { crc32: crc32, pack: pack, parseFrame: parseFrame, Assembler: Assembler, cleanLesson: cleanLesson, validateLesson: validateLesson, sha256hex: sha256hex, bytesToB64: bytesToB64, b64ToBytes: b64ToBytes, MAX_TEXT: 6000 };
})(typeof window !== 'undefined' ? window : globalThis);
