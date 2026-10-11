/* ============================================================================
 *  翼支付 · 刷金币  —— Loon 移植版
 *  ---------------------------------------------------------------------------
 *  原脚本 bestpay_task_scheduler.cjs 的正文【逐字保留】，未改一行业务逻辑。
 *  本文件只做一件事：为原脚本提供它原本依赖的 Node 运行环境。
 *
 *  被垫掉的 Node 能力：
 *    require('fs'|'path'|'os'|'https'|'zlib'|'readline'|'child_process')
 *    Buffer / process / __dirname / global / setTimeout.unref() / URL
 *
 *  被替换的平台能力：
 *    三个 wasm 资产  →  运行时从 URL 拉取（§0），自带 inflate 兜底解压
 *    ~/.bestpay_*.json  →  Loon $persistentStore（比明文文件安全）
 *    网络            →  原生 fetch（$httpClient 二进制不保真，已实测排除）
 *    Bark 推送       →  原脚本自带，走同一个 https 垫片，无需改动
 *    命令行参数      →  Loon [Task] 的 argument= 映射成 process.argv
 *
 *  [Task] 配置示例：
 *    cron "10 10 * * *" script-path=bestpay_loon.js, tag=bestpay-am, argument="--all"
 *    cron "10 20 * * *" script-path=bestpay_loon.js, tag=bestpay-pm, argument="--all"
 *    登录：argument="--login --phone 13800138000 --code 123456"
 *
 *  作者：Little Code Sauce
 * ========================================================================== */

/* ---------- §0  资产地址（运行时拉取）------------------------------------
 * 三个 wasm/js 资产不内联，运行时按下列地址取回，脚本体积从 828KB 降到 ~50KB。
 * 若返回体是 gzip/zlib 压缩格式，自动解压（见 §1c）；未压缩原文件也能直接用。
 * 建议：把 gzip 后的 .gz 文件传上去，省流量、下载快。
 * ------------------------------------------------------------------------- */
var __ASSET_URLS = {
  gwcli: '%%URL_GWCLI%%',
  wbaes: '%%URL_WBAES%%',
  mpaas: '%%URL_MPAAS%%',
};

/* ---------- §2  字节 / 编码工具 ------------------------------------------ */
var __G = (typeof globalThis !== 'undefined') ? globalThis
         : (typeof global !== 'undefined') ? global
         : this;
var global = __G;

/* ---------- §1c 极简 DEFLATE 解压（gzip / zlib / raw）----------
 * 用途：资产从 CDN 拉回时可能被服务端压缩，而 Loon 的 fetch 未必自动解压。
 * 只在检测到压缩魔数时启用，正常情况下不参与。已对三个资产全量校验。 */
var __INFLATE = (function () {
  var LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258],
      LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],
      DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],
      DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],
      CL = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function inflate(src, start) {
    var p = start | 0, bit = 0, cap = 1 << 16, buf = new Uint8Array(cap), o = 0;
    function ensure(n) {
      if (o + n > cap) { var nc = cap; while (nc < o + n) nc <<= 1;
        var nb = new Uint8Array(nc); nb.set(buf.subarray(0, o)); buf = nb; cap = nc; }
    }
    function get(n) { var v = 0, i; for (i = 0; i < n; i++) { v |= ((src[p] >> bit) & 1) << i; if (++bit === 8) { bit = 0; p++; } } return v; }
    function build(lens) {
      var i, max = 0, c, offs, sym;
      for (i = 0; i < lens.length; i++) if (lens[i] > max) max = lens[i];
      c = new Array(max + 1); for (i = 0; i <= max; i++) c[i] = 0;
      for (i = 0; i < lens.length; i++) c[lens[i]]++;
      c[0] = 0; offs = new Array(max + 1); offs[0] = 0;
      for (i = 1; i <= max; i++) offs[i] = offs[i - 1] + c[i - 1];
      sym = new Array(lens.length);
      for (i = 0; i < lens.length; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
      return { c: c, s: sym, n: max };
    }
    function dec(h) {
      var code = 0, first = 0, index = 0, len = 1, c = h.c, count;
      for (; len <= h.n; len++) {
        code |= get(1); count = c[len];
        if (code - first < count) return h.s[index + (code - first)];
        index += count; first = (first + count) << 1; code <<= 1;
      }
      throw new Error('bad huffman code');
    }
    var i, last, type, h1, h2, hlit, hdist, hclen, lens, clen, i2, sym, len, dist, L, q;
    do {
      last = get(1); type = get(2);
      if (type === 0) {
        if (bit) { bit = 0; p++; }
        L = src[p] | (src[p + 1] << 8); p += 4;
        ensure(L); for (i = 0; i < L; i++) buf[o++] = src[p++];
      } else {
        if (type === 1) {
          lens = new Array(288);
          for (i = 0; i < 144; i++) lens[i] = 8; for (; i < 256; i++) lens[i] = 9;
          for (; i < 280; i++) lens[i] = 7; for (; i < 288; i++) lens[i] = 8;
          h1 = build(lens);
          lens = new Array(30); for (i = 0; i < 30; i++) lens[i] = 5;
          h2 = build(lens);
        } else if (type === 2) {
          hlit = get(5) + 257; hdist = get(5) + 1; hclen = get(4) + 4;
          lens = new Array(19); for (i = 0; i < 19; i++) lens[i] = 0;
          for (i = 0; i < hclen; i++) lens[CL[i]] = get(3);
          var hc = build(lens);
          lens = new Array(hlit + hdist); i = 0;
          while (i < hlit + hdist) {
            sym = dec(hc);
            if (sym < 16) lens[i++] = sym;
            else if (sym === 16) { len = lens[i - 1]; for (i2 = 0, q = get(2) + 3; i2 < q; i2++) lens[i++] = len; }
            else if (sym === 17) { for (i2 = 0, q = get(3) + 3; i2 < q; i2++) lens[i++] = 0; }
            else { for (i2 = 0, q = get(7) + 11; i2 < q; i2++) lens[i++] = 0; }
          }
          h1 = build(lens.slice(0, hlit));
          h2 = build(lens.slice(hlit));
        } else throw new Error('bad block type ' + type);
        for (;;) {
          sym = dec(h1);
          if (sym < 256) { ensure(1); buf[o++] = sym; }
          else if (sym === 256) break;
          else {
            sym -= 257; len = LB[sym] + get(LE[sym]);
            dist = dec(h2); dist = DB[dist] + get(DE[dist]);
            ensure(len);
            for (i = 0; i < len; i++) { buf[o] = buf[o - dist]; o++; }
          }
        }
      }
    } while (!last);
    return buf.subarray(0, o);
  }

  function maybe(u8) {
    if (!u8 || u8.length < 2) return u8;
    if (u8[0] === 0x1f && u8[1] === 0x8b) {
      var flg = u8[3], q = 10;
      if (flg & 4) { q += 2 + (u8[q] | (u8[q + 1] << 8)); }
      if (flg & 8) { while (u8[q]) q++; q++; }
      if (flg & 16) { while (u8[q]) q++; q++; }
      if (flg & 2) q += 2;
      return inflate(u8, q);
    }
    if (u8[0] === 0x78 && u8[1] === 0x9c) return inflate(u8, 2);
    if (u8[0] === 0x78 && u8[1] === 0x01) return inflate(u8, 2);
    if (u8[0] === 0x78 && u8[1] === 0xda) return inflate(u8, 2);
    return u8;
  }
  return { inflate: inflate, maybe: maybe };
})();


/*__FFLATE__*/

var __B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var __B64MAP = (function () { var m = {}, i; for (i = 0; i < __B64CHARS.length; i++) m[__B64CHARS[i]] = i; return m; })();

function __b64ToU8(s) {
  s = String(s).replace(/[\s\r\n]/g, '');
  var n = s.length, pad = 0;
  if (n && s.charAt(n - 1) === '=') pad++;
  if (n > 1 && s.charAt(n - 2) === '=') pad++;
  var out = new Uint8Array(((n >> 2) * 3) - pad);
  var o = 0, buf = 0, bits = 0, i, v;
  for (i = 0; i < n; i++) {
    v = __B64MAP[s.charAt(i)];
    if (v === undefined) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return out.subarray(0, o);
}

function __u8ToB64(u8) {
  var s = '', i, b;
  for (i = 0; i < u8.length; i += 3) {
    b = (u8[i] << 16) | ((i + 1 < u8.length ? u8[i + 1] : 0) << 8) | (i + 2 < u8.length ? u8[i + 2] : 0);
    s += __B64CHARS.charAt((b >> 18) & 63) + __B64CHARS.charAt((b >> 12) & 63)
       + (i + 1 < u8.length ? __B64CHARS.charAt((b >> 6) & 63) : '=')
       + (i + 2 < u8.length ? __B64CHARS.charAt(b & 63) : '=');
  }
  return s;
}

function __utf8Decode(u8) {
  var out = '', i = 0, n = u8.length, c, cp;
  while (i < n) {
    c = u8[i++];
    if (c < 0x80) { out += String.fromCharCode(c); }
    else if (c < 0xE0) { out += String.fromCharCode(((c & 0x1F) << 6) | (u8[i++] & 0x3F)); }
    else if (c < 0xF0) { out += String.fromCharCode(((c & 0x0F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F)); }
    else {
      cp = ((c & 0x07) << 18) | ((u8[i++] & 0x3F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F);
      cp -= 0x10000;
      out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
    }
  }
  return out;
}

function __utf8Encode(str) {
  var out = [], i, c, c2, cp;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
      c2 = str.charCodeAt(++i);
      cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    } else {
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
  }
  return new Uint8Array(out);
}

function __latin1Decode(u8) { var s = '', i; for (i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; }

function __concatU8(list) {
  var total = 0, i, off = 0, out;
  for (i = 0; i < list.length; i++) total += list[i].length;
  out = new Uint8Array(total);
  for (i = 0; i < list.length; i++) { out.set(list[i], off); off += list[i].length; }
  return out;
}

/* ---------- §3  Buffer 垫片（Uint8Array 子类语义）------------------------- */
var __BufProto = Object.create(Uint8Array.prototype);
__BufProto.toString = function (enc) {
  enc = String(enc || 'utf8').toLowerCase();
  if (enc === 'latin1' || enc === 'binary') return __latin1Decode(this);
  if (enc === 'hex') { var h = '', i; for (i = 0; i < this.length; i++) h += ('0' + this[i].toString(16)).slice(-2); return h; }
  if (enc === 'base64') return __u8ToB64(this);
  return __utf8Decode(this);
};

function __mkBuf(u8) { var b = new Uint8Array(u8); Object.setPrototypeOf(b, __BufProto); return b; }

var Buffer = {
  isBuffer: function (x) { return !!x && Object.getPrototypeOf(x) === __BufProto; },
  isView: function (x) { return x != null && ArrayBuffer.isView(x); },
  alloc: function (n, fill) { var b = new Uint8Array(n | 0); if (fill !== undefined) b.fill(fill); return __mkBuf(b); },
  from: function (src, a, b) {
    if (src == null) return __mkBuf(new Uint8Array(0));
    if (typeof src === 'string') return __mkBuf(__utf8Encode(src));
    if (src instanceof ArrayBuffer) {
      return (a !== undefined) ? __mkBuf(new Uint8Array(src, a, b)) : __mkBuf(new Uint8Array(src));
    }
    if (ArrayBuffer.isView(src)) {
      return (a !== undefined)
        ? __mkBuf(new Uint8Array(src.buffer, src.byteOffset + a, b))
        : __mkBuf(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
    }
    if (Array.isArray(src)) return __mkBuf(new Uint8Array(src));
    return __mkBuf(new Uint8Array(0));
  },
  concat: function (list) { return __mkBuf(__concatU8(list)); },
};

/* ---------- §4  抓取原生能力（必须在原脚本改写 global.fetch 之前）--------- */
var __NATIVE_FETCH = (typeof fetch !== 'undefined') ? fetch : null;
var __NATIVE_ST = (typeof setTimeout !== 'undefined') ? setTimeout : null;
var __NATIVE_CT = (typeof clearTimeout !== 'undefined') ? clearTimeout : null;

/* setTimeout 返回值的 .unref() —— 原脚本对看门狗定时器调了它，JSC 返回数字会炸 */
try {
  var __stProbe = __NATIVE_ST(function () {}, 0);
  if (typeof __stProbe === 'number') {
    Number.prototype.unref = function () { return this; };
    Number.prototype.ref = function () { return this; };
  } else if (__stProbe && typeof __stProbe.unref !== 'function') {
    var __stProto = Object.getPrototypeOf(__stProbe);
    if (__stProto && typeof __stProto.unref !== 'function') {
      __stProto.unref = function () { return this; };
      __stProto.ref = function () { return this; };
    }
  }
  __NATIVE_CT(__stProbe);
} catch (e) { /* 兜底：下面还有一层 */ }

/* URL —— Loon 若自带就用自带 */
if (typeof URL === 'undefined' || !URL) {
  __G.URL = function (href) {
    var m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\/:?#]*)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/.exec(String(href));
    if (!m) throw new TypeError('Invalid URL: ' + href);
    this.protocol = m[1] + ':';
    this.hostname = m[2];
    this.port = m[3] || '';
    this.host = m[3] ? m[2] + ':' + m[3] : m[2];
    this.pathname = m[4] || '/';
    this.search = m[5] || '';
    this.hash = m[6] || '';
    this.href = String(href);
  };
}

/* ---------- §5  日志缓冲（运行结束汇总推送）------------------------------ */
var __LOG = [];
var __CONSOLE_LOG = (typeof console !== 'undefined' && console.log) ? console.log : function () {};

/* 防御：Loon 的 console 若缺 info/debug/trace，mpaas 模块内部 (console)['info'].apply 会崩 */
try {
  if (typeof console !== 'undefined' && console) {
    var __CM = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table',
                'time', 'timeEnd', 'group', 'groupEnd', 'groupCollapsed', 'assert'];
    for (var __ci = 0; __ci < __CM.length; __ci++) {
      if (typeof console[__CM[__ci]] !== 'function') console[__CM[__ci]] = __CONSOLE_LOG;
    }
  }
} catch (e) {}
var __CONSOLE_ERR = (typeof console !== 'undefined' && console.error) ? console.error : __CONSOLE_LOG;

function __fmtLogArg(a) {
  if (typeof a === 'string') return a;
  if (a && a.stack) return a.stack;
  if (a instanceof Error) return a.message;
  try { return JSON.stringify(a); } catch (e) { return String(a); }
}
function __pushLog(parts) {
  var s = parts.join(' ');
  __LOG.push(s);
  if (__LOG.length > 500) __LOG.shift();
  try { __CONSOLE_LOG(s); } catch (e) {}
}
if (typeof console !== 'undefined') {
  console.log = function () { __pushLog(Array.prototype.map.call(arguments, __fmtLogArg)); };
  console.error = function () { __pushLog(Array.prototype.map.call(arguments, __fmtLogArg)); };
}

/* ---------- §6  Loon 持久化（替代 ~/.bestpay_*.json）--------------------- */
var __STORE = {
  get: function (k) { try { return (typeof $persistentStore !== 'undefined') ? $persistentStore.read(k) : null; } catch (e) { return null; } },
  set: function (k, v) { try { if (typeof $persistentStore !== 'undefined') $persistentStore.write(String(v), k); } catch (e) {} },
  del: function (k) { try { if (typeof $persistentStore !== 'undefined') $persistentStore.write(null, k); } catch (e) {} },
};

/* ---------- §7  参数：Loon [Task] argument= → process.argv ----------------- */
var __RAW_ARG = '';
try { if (typeof $argument !== 'undefined' && $argument != null) __RAW_ARG = String($argument); } catch (e) {}

/* ---------- 资产基址：--assets <base> 优先，其次持久化 bp_assets ----------
 * 这样脚本本身不用改，资产换地址只改 Loon 的 argument 或重设一次即可。 */
(function () {
  var m = String(__RAW_ARG || '').match(/--assets\s+(\S+)/);
  var base = m ? m[1] : null;
  if (base) { try { __STORE.set('bp_assets', base); } catch (e) {} }
  else { try { base = __STORE.get('bp_assets'); } catch (e) {} }
  if (base) {
    base = base.replace(/\/+$/, '');
    __ASSET_URLS = {
      gwcli: base + '/gwcli1-0-2.wasm.gz',
      wbaes: base + '/WBAES.wasm.gz',
      mpaas: base + '/mpaas_raw_mod.js.gz',
    };
  }
})();
if (!__RAW_ARG) { try { if (typeof $script !== 'undefined' && $script && $script.argument) __RAW_ARG = String($script.argument); } catch (e) {} }

var __ARGV = (function () {
  var toks = __RAW_ARG.split(/\s+/).filter(function (x) { return x.length > 0; });
  var env = {}, args = [], i, m;
  for (i = 0; i < toks.length; i++) {
    m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(toks[i]);
    if (m) { env[m[1]] = m[2]; } else { args.push(toks[i]); }
  }
  var code = '';
  for (i = 0; i < args.length; i++) {
    if ((args[i] === '--code' || args[i] === '--sms-code') && args[i + 1]) code = args[i + 1];
  }
  var ai = args.indexOf('--assets');
  if (ai >= 0) args.splice(ai, 2);
  if (args.length === 0) args.push('--all');   // Loon cron 默认跑全任务

  // ---- Bark 推送地址：从持久化读取，支持 --bark <url> 设置 ----
  var barkIdx = args.indexOf('--bark');
  if (barkIdx >= 0 && args[barkIdx + 1]) {
    try { __STORE.set('bp_bark', args[barkIdx + 1]); } catch (e) {}
    env.BESTPAY_BARK_KEY = args[barkIdx + 1];
    args.splice(barkIdx, 2);
  } else {
    var savedBark = null;
    try { savedBark = __STORE.get('bp_bark'); } catch (e) {}
    if (savedBark) env.BESTPAY_BARK_KEY = savedBark;
  }
  return { args: args, env: env, code: code };
})();

/* ---------- §8  资产：预载 + 缓存 ---------------------------------------- */
var __ASSETS = {};

function __preloadAssets() {
  var keys = Object.keys(__ASSET_URLS);
  var pending = [];
  keys.forEach(function (k) {
    var url = __ASSET_URLS[k];
    if (!url || url.indexOf('%%') === 0) {
      throw new Error('资产地址未配置: ' + k);
    }
    pending.push(
      __NATIVE_FETCH(url, { cache: 'no-store' }).then(function (r) {
        if (!r || !r.ok) throw new Error('资产拉取失败 ' + k + ' HTTP ' + (r && r.status));
        return r.arrayBuffer();
      }).then(function (ab) {
        var u8 = new Uint8Array(ab);
        var size0 = u8.length;
        u8 = __INFLATE.maybe(u8);
        __ASSETS[k] = (k === 'mpaas') ? __utf8Decode(u8) : u8;
        __pushLog(['  资产 ' + k + ': ' + size0 + ' -> ' + u8.length + ' 字节']);
      })
    );
  });
  return Promise.all(pending);
}

function __asset(name) {
  if (__ASSETS[name]) return __ASSETS[name];
  throw new Error('资产未预载: ' + name);
}

/* ---------- §9  fs / path / os 垫片 ------------------------------------- */
function __classifyPath(p) {
  p = String(p);
  if (/gwcli/i.test(p)) return 'gwcli';
  if (/WBAES/i.test(p)) return 'wbaes';
  if (/mpaas_raw_mod/i.test(p)) return 'mpaas';
  if (/bestpay_sessions/i.test(p)) return 'sessions';
  if (/bestpay_sms_uid/i.test(p)) return 'smsuid';
  return null;
}
function __enoent(p) {
  var e = new Error("ENOENT: no such file or directory, open '" + p + "'");
  e.code = 'ENOENT'; e.errno = -2; e.path = p;
  return e;
}

var __FS = {
  existsSync: function (p) {
    var k = __classifyPath(p);
    if (k === 'sessions' || k === 'smsuid') return __STORE.get('bp_' + k) != null;
    return k != null;
  },
  readFileSync: function (p, enc) {
    var k = __classifyPath(p), res;
    if (k === 'gwcli' || k === 'wbaes') res = __mkBuf(__asset(k));
    else if (k === 'mpaas') res = __asset('mpaas');
    else if (k === 'sessions' || k === 'smsuid') {
      var v = __STORE.get('bp_' + k);
      if (v == null) throw __enoent(p);
      res = String(v);
    } else { throw __enoent(p); }
    if (typeof enc === 'string' && !(res instanceof Uint8Array)) return String(res);
    return res;
  },
  writeFileSync: function (p, data) {
    var k = __classifyPath(p);
    if (k === 'sessions' || k === 'smsuid') {
      __STORE.set('bp_' + k, (typeof data === 'string') ? data : __utf8Decode(data));
      return;
    }
    /* 日志文件等：直接丢进 Loon 日志 */
    try { __CONSOLE_LOG('[writeFileSync] ' + p + ' (' + (data && data.length || 0) + ' bytes)'); } catch (e) {}
  },
  appendFileSync: function (p, data) {
    try { __CONSOLE_LOG('[append] ' + p + ' ' + String(data).replace(/\s+$/, '')); } catch (e) {}
  },
  unlinkSync: function (p) {
    var k = __classifyPath(p);
    if (k === 'sessions' || k === 'smsuid') __STORE.del('bp_' + k);
  },
  mkdirSync: function () {},
  readdirSync: function () { return []; },
  statSync: function (p) {
    var k = __classifyPath(p);
    if (k === 'sessions' || k === 'smsuid') {
      if (__STORE.get('bp_' + k) == null) throw __enoent(p);
      return { isFile: function () { return true; }, size: String(__STORE.get('bp_' + k)).length };
    }
    if (k) return { isFile: function () { return true; }, size: 1 };
    throw __enoent(p);
  },
};

var __PATH = {
  sep: '/',
  join: function () {
    var parts = Array.prototype.slice.call(arguments).filter(function (x) { return x != null && x !== ''; });
    return parts.join('/').replace(/\/{2,}/g, '/');
  },
  basename: function (p, ext) {
    p = String(p).replace(/\/+$/, '');
    var b = p.slice(p.lastIndexOf('/') + 1);
    if (ext && b.length > ext.length && b.slice(-ext.length) === ext) b = b.slice(0, -ext.length);
    return b;
  },
  dirname: function (p) {
    p = String(p);
    var i = p.lastIndexOf('/');
    return i < 0 ? '.' : (i === 0 ? '/' : p.slice(0, i));
  },
  extname: function (p) { var b = __PATH.basename(p); var i = b.lastIndexOf('.'); return i <= 0 ? '' : b.slice(i); },
  resolve: function () { return __PATH.join.apply(null, arguments); },
};

var __OS = {
  homedir: function () { return '/root'; },
  tmpdir: function () { return '/tmp'; },
  platform: function () { return 'linux'; },
  release: function () { return 'loon'; },
  EOL: '\n',
};

/* ---------- §10 zlib 垫片（自带 inflate 实现）--------------------------- */
var __ZLIB = {
  gunzipSync: function (b) { return __mkBuf(__INFLATE.maybe(b instanceof Uint8Array ? b : new Uint8Array(b))); },
  inflateSync: function (b) { return __mkBuf(__INFLATE.maybe(b instanceof Uint8Array ? b : new Uint8Array(b))); },
  inflateRawSync: function (b) { return __mkBuf(__INFLATE.inflate(b instanceof Uint8Array ? b : new Uint8Array(b), 0)); },
  deflateSync: function () { throw new Error('zlib.deflateSync 未实现（本脚本未使用）'); },
  gzipSync: function () { throw new Error('zlib.gzipSync 未实现（本脚本未使用）'); },
};

/* ---------- §11 https 垫片（基于原生 fetch，二进制保真）------------------ */
/* 实测结论：$httpClient 字符串 body 会被 UTF-8 撑爆，ArrayBuffer 会被字符串化，
 *           只有原生 fetch 的 Uint8Array body 字节级保真 —— 故走 fetch。      */
var __HTTPS = (function () {
  function request(opts, cb) {
    var chunks = [], errCb = null, toMs = 0, toFn = null, destroyed = false, timer = null;

    var req = {
      on: function (ev, fn) { if (ev === 'error') errCb = fn; return req; },
      setTimeout: function (ms, fn) { toMs = ms; toFn = fn; return req; },
      destroy: function () { destroyed = true; if (timer) __NATIVE_CT(timer); },
      write: function (d) { if (d != null) chunks.push(d instanceof Uint8Array ? d : __utf8Encode(String(d))); return true; },
      end: function () { send(); return req; },
    };

    function send() {
      if (!__NATIVE_FETCH) {
        if (errCb) errCb(new Error('Loon 环境缺少原生 fetch，无法联网'));
        return;
      }
      var host = opts.hostname || opts.host || '';
      var port = opts.port ? String(opts.port) : '';
      var url = 'https://' + host + ((port && port !== '443') ? ':' + port : '') + (opts.path || '/');
      var body = __concatU8(chunks);
      var headers = {}, src = opts.headers || {}, k;
      for (k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k) && k.toLowerCase() !== 'content-length') headers[k] = src[k];
      }
      var init = { method: (opts.method || 'POST').toUpperCase(), headers: headers };
      if (body.length) init.body = body;

      if (toMs) { timer = __NATIVE_ST(function () { destroyed = true; if (toFn) toFn(); }, toMs); }

      __NATIVE_FETCH(url, init).then(function (r) {
        return r.arrayBuffer().then(function (ab) {
          if (timer) { __NATIVE_CT(timer); timer = null; }
          if (destroyed) return;
          var data = new Uint8Array(ab);
          var hdrs = {};
          try { r.headers.forEach(function (v, kk) { hdrs[kk] = v; }); } catch (e) {}
          var res = {
            statusCode: r.status, status: r.status, headers: hdrs,
            on: function (ev, fn) {
              if (ev === 'data') { if (data.length) fn(__mkBuf(data)); }
              else if (ev === 'end') { fn(); }
              return res;
            },
          };
          cb(res);
        });
      }).catch(function (e) {
        if (timer) { __NATIVE_CT(timer); timer = null; }
        if (destroyed) return;
        if (errCb) errCb(e instanceof Error ? e : new Error(String(e)));
      });
    }
    return req;
  }
  return {
    request: request,
    get: function (o, cb) { o = o || {}; o.method = 'GET'; var r = request(o, cb); r.end(); return r; },
  };
})();

/* ---------- §12 readline / child_process 垫片 ---------------------------- */
var __READLINE = {
  createInterface: function () {
    return {
      question: function (q, cb) {
        if (__ARGV.code) { cb(__ARGV.code); return; }
        throw new Error(
          'Loon 无法交互输入验证码。请把验证码写进 [Task] 的 argument，例如：\n' +
          '  argument="--login --phone 你的手机号 --code 123456"'
        );
      },
      close: function () {}, on: function () { return this; }, pause: function () { return this; }, resume: function () { return this; },
    };
  },
};
var __CP = {
  execSync: function () { return ''; },
  exec: function () {},
  spawnSync: function () { return { status: 0, stdout: '', stderr: '' }; },
};

/* ---------- §13 process / require ---------------------------------------- */
var __EXITED = false;
var __WATCHDOG = null;
function __finish() {
  if (__EXITED) return;
  __EXITED = true;
  if (__WATCHDOG) { try { __NATIVE_CT(__WATCHDOG); } catch (e) {} __WATCHDOG = null; }
  var tail = __LOG.slice(-24).join('\n');
  if (tail && __ARGV.args.indexOf('--quiet') < 0) {
    try { $notification.post('翼支付刷金币', __ARGV.args.join(' ') || '(默认)', tail); } catch (e) {}
  }
  try { $done({}); } catch (e) {}
}

__WATCHDOG = __NATIVE_ST(function () {
  __pushLog(['[看门狗] 运行超时(180s)，强制收尾']);
  __finish();
}, 180000);

var process = {
  argv: ['node', 'bestpay_task_scheduler.cjs'].concat(__ARGV.args),
  env: __ARGV.env,
  platform: 'linux',
  arch: 'arm64',
  version: 'v22.0.0',
  pid: 1,
  exit: function () { __finish(); },
  nextTick: function (fn) {
    var rest = Array.prototype.slice.call(arguments, 1);
    __NATIVE_ST(function () { fn.apply(null, rest); }, 0);
  },
  stdout: { write: function (s) { __pushLog([String(s).replace(/\n$/, '')]); return true; } },
  stderr: { write: function (s) { __pushLog([String(s).replace(/\n$/, '')]); return true; } },
  stdin: { on: function () { return this; }, once: function () { return this; }, resume: function () {}, pause: function () {}, setEncoding: function () {}, read: function () { return null; } },
};

var __MODULES = {
  fs: __FS, path: __PATH, os: __OS, https: __HTTPS, zlib: __ZLIB,
  readline: __READLINE, child_process: __CP, buffer: { Buffer: Buffer },
  crypto: {}, net: {}, tls: {}, url: { URL: __G.URL }, util: { inspect: function (x) { return String(x); } },
  events: { EventEmitter: function () { this.on = function () { return this; }; this.emit = function () {}; } },
  stream: { Readable: function () {}, Writable: function () {} },
  assert: function (c, m) { if (!c) throw new Error(m || 'assertion failed'); },
};
var require = function (name) {
  var key = String(name).replace(/^node:/, '');
  return Object.prototype.hasOwnProperty.call(__MODULES, key) ? __MODULES[key] : {};
};
__G.require = require;

var __dirname = '/loon';
var __filename = '/loon/bestpay_task_scheduler.cjs';

/* ==== 原脚本正文开始（逐字保留）==== */
Promise.resolve().then(function () { return __preloadAssets(); }).then(function () {
/**
 * 翼支付 · 赚金币 定时任务脚本 (Mac launchd)
 * 进程内加载一次 wasm, 内联调接口. 覆盖:
 *   - 签到 signIn
 *   - AD_show 看视频 (+6000/次, 每日10次上限)
 *   - AD_click 点广告 (+10/次, 每日20次上限)
 *   - DRAMA_DURATION 短剧 (+50/次, 每日3次上限)
 * 特性: 分批 + 随机延时(短) + 硬超时防卡死 + 断点续跑
 *
 * 用法：
 *   node bestpay_task_scheduler.cjs --login --phone 13800000000   # 手机号短信登录(存 session)
 *   node bestpay_task_scheduler.cjs --login --phone 13800000000 --code 123456  # 非交互登录(面板两步)
 *   node bestpay_task_scheduler.cjs --send-sms --phone 13800000000            # 只发短信, 拿 smsUid
 *   node bestpay_task_scheduler.cjs --all               # 所有 session 账号
 *   node bestpay_task_scheduler.cjs --phone 13800000000 # 指定账号
 *   node bestpay_task_scheduler.cjs --tasks ad_show,ad_click,drama   # 指定任务
 *   node bestpay_task_scheduler.cjs --dry-run           # 只查不报
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');

const DEPS_DIR = path.join(__dirname, 'deps');
const WASM = path.join(DEPS_DIR, 'gwcli1-0-2.wasm');
const WBAES = path.join(DEPS_DIR, 'WBAES.wasm');
const MOD = path.join(DEPS_DIR, 'mpaas_raw_mod.js');
const SESSIONS_FILE = path.join(os.homedir(), '.bestpay_sessions.json');

const PUB = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoEcz1UBgi0DQgAEhYXsxs453JtwhnUbksd1oNu0ujvM
+gRo1+HiRg4ZSr0GMjDf5cMToOyNQPALyhs9Hc+OIt0SirlE/efpl3NhfQ==
-----END PUBLIC KEY-----`;
const SECRET = '63cb711f852f6ab6f1ecc9ade8f518c7';
const APPID = 'FC1902C211615';
const WORKSPACE = 'PRD';
const AUTH_SSU = '8901010699000117';
const WXID = 'wx1c4a70bbdfaa2029';
const IP_R_MALL = '890810000066411740580000';

const OP = {
  queryTaskListOutput: 'com.bestpay.marketingadapter.api.y2024.mission.MissionOutputService.queryTheMonthTaskList',
  sendTaskMessAge: 'com.bestpay.redbag.product.api.y2022.mission.service.MissionTaskService.sendTaskMessAge',
  queryTotalScore: 'com.bestpay.minsheng.mkt.api.money.MakeMoneyService.queryTotalScoreAndExchangeAmount',
  queryMoneyMainInfo: 'com.bestpay.minsheng.mkt.api.money.MakeMoneyService.queryMoneyMainInfo',
  getDynamicScore: 'com.bestpay.minsheng.mkt.api.money.MakeMoneyService.getDynamicScore',
  signIn: 'com.bestpay.redbag.product.api.signin.SignInService.signIn',
  querySignInConfigInfo: 'com.bestpay.redbag.product.api.signin.SignInService.querySignInConfigInfo',
  queryPageConfig: 'com.bestpay.marketingadapter.api.y2025.score.market.ScoreMarketService.queryPageConfig',
  getReward: 'com.bestpay.marketingadapter.api.y2024.mission.MissionService.newGetReward',
  authTokenLogin: 'com.bestpay.mbp.customer.facade.LoginFacade.authTokenLogin',
  // 手机号短信登录 (LoginEvent 链)
  sendSms: 'com.bestpay.mobile.service.account.prd.event.LoginEvent.sendSmsVerifyCode',
  verifySms: 'com.bestpay.mobile.service.account.prd.event.LoginEvent.authSmsVerifyCode',
};

// ============ 脱敏配置 ============
// 默认手机号改为占位符; 运行时用 --phone / BESTPAY_PHONE / 环境覆盖
const MASK_PHONE = '13800000000';                 // 占位示例号
const PHONE_RE = /^1\d{10}$/;
// 手机号打码: 138****0000
function maskPhone(p) {
  const s = String(p || '');
  return PHONE_RE.test(s) ? s.slice(0, 3) + '****' + s.slice(7) : (s ? '***' : '');
}
function normalizePhone(p) {
  const s = String(p || '').trim();
  if (PHONE_RE.test(s)) return s;                 // 13800000000
  if (/^\+?86\d{11}$/.test(s)) return s.replace(/^\+?86/, '');  // +8613800000000 / 8613800000000
  return '';                                      // 空/无效 → 视为无账号
}
function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (ans) => { rl.close(); resolve(String(ans || '').trim()); }));
}

// ============ 基础封装 (与 bestpay_task_test.cjs 一致) ============
function log(...a) { console.log(new Date().toTimeString().slice(0, 8), ...a); }

// Bark 推送 (独立 https 请求, 不依赖被 wasm 重写的 global.fetch)
// key 后端 CF 前挡, 需浏览器 UA 否则 1010/403
const BARK_KEY = process.env.BESTPAY_BARK_KEY || 'https://bark.day.app/FILL_ME_BARK_KEY';
const BARK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
function sendBark(title, body) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const url = BARK_KEY + '/' + encodeURIComponent(title) + '/' + encodeURIComponent(body || '');
      const req = https.get(url, {
        headers: { 'User-Agent': BARK_UA, 'Accept': '*/*' },
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          log(`  [bark] ${res.statusCode} ${Buffer.concat(chunks).toString('utf8').slice(0, 60)}`);
          resolve(res.statusCode);
        });
      });
      req.on('error', (e) => { log(`  [bark] 失败: ${e.message}`); resolve(0); });
      req.setTimeout(8000, () => { req.destroy(); resolve(0); });
    } catch (e) { log(`  [bark] 异常: ${e.message}`); resolve(0); }
  });
}

function loadWasmEnv() {
  const wasmBuf = fs.readFileSync(WASM);
  const wasmAB = wasmBuf.buffer.slice(wasmBuf.byteOffset, wasmBuf.byteOffset + wasmBuf.byteLength);
  global.self = global; global.window = global;
  global.document = {
    currentScript: null, getElementsByTagName: () => [],
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
  };
  global.navigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.75 NetType/WIFI Language/zh_CN',
  };
  global.location = { href: `https://servicewechat.com/${WXID}/382/page-frame.html`, pathname: '/', search: '', hash: '' };
  global.__g = global;
  global.__vd_version_info__ = { version: '3.0.0' };
  global.__wxAppCode__ = {}; global.__wxRoute = ''; global.__wxRouteBegin = false; global.__wxAppCurrentFile__ = '';
  global.$gwx0_XC_0 = () => () => {};
  global.getApp = () => ({ globalData: { wasmBinary: wasmAB } });

  const RealWA = WebAssembly;
  async function resolveWasm(source) {
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source) || source instanceof RealWA.Module) return source;
    if (typeof source === 'string') {
      let file = source;
      if (source.includes('gwcli')) file = WASM;
      else if (source.includes('WBAES')) file = WBAES;
      else if (!source.startsWith('/')) file = path.join(DEPS_DIR, path.basename(source).replace(/\.br$/, ''));
      const b = fs.readFileSync(file);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    if (source && typeof source.arrayBuffer === 'function') return source.arrayBuffer();
    throw new TypeError('bad wasm source');
  }
  global.WebAssembly = {
    Module: RealWA.Module, Instance: RealWA.Instance, Memory: RealWA.Memory, Table: RealWA.Table,
    CompileError: RealWA.CompileError, LinkError: RealWA.LinkError, RuntimeError: RealWA.RuntimeError,
    validate: RealWA.validate.bind(RealWA),
    compile: async (src) => RealWA.compile(await resolveWasm(src)),
    instantiate: async (src, imports) => RealWA.instantiate(await resolveWasm(src), imports),
    instantiateStreaming: async (resp, imports) => {
      const ab = resp && typeof resp.arrayBuffer === 'function' ? await resp.arrayBuffer() : await resolveWasm(resp);
      return RealWA.instantiate(ab, imports);
    },
  };
  global.WXWebAssembly = global.WebAssembly;
  global.Module = {
    wasmBinary: wasmAB,
    locateFile(u) {
      u = String(u);
      if (u.includes('gwcli')) return WASM;
      if (u.includes('WBAES')) return WBAES;
      return path.join(DEPS_DIR, path.basename(u).replace(/\.br$/, ''));
    },
    instantiateWasm(imports, successCallback) {
      RealWA.instantiate(wasmAB, imports).then((pair) => successCallback(pair.instance, pair.module));
      return {};
    },
  };
  global.fetch = async (url) => {
    let file = String(url);
    if (file.includes('gwcli')) file = WASM;
    else if (file.includes('WBAES')) file = WBAES;
    const b = fs.readFileSync(file);
    return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  };

  global.wx = {
    request(opts) {
      const url = new URL(opts.url);
      let body = Buffer.alloc(0);
      if (opts.data instanceof ArrayBuffer) body = Buffer.from(opts.data);
      else if (ArrayBuffer.isView(opts.data)) body = Buffer.from(opts.data.buffer, opts.data.byteOffset, opts.data.byteLength);
      else if (opts.data) body = Buffer.from(opts.data);
      const headers = Object.assign({
        'content-type': 'application/json',
        'user-agent': global.navigator.userAgent,
        referer: 'https://h5.bestpay.cn/',
        origin: 'https://h5.bestpay.cn',
        'accept-encoding': 'gzip,compress,br,deflate',
      }, opts.header || {});
      for (const k of Object.keys(headers)) if (typeof headers[k] === 'number') headers[k] = String(headers[k]);
      const https = require('https');
      const req = https.request({
        hostname: url.hostname, port: url.port || 443,
        path: url.pathname + (url.search || ''),
        method: (opts.method || 'POST').toUpperCase(),
        headers: Object.assign({ 'Content-Length': body.length }, headers),
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let buf = Buffer.concat(chunks);
          const header = {};
          for (const [k, v] of Object.entries(res.headers)) header[k] = Array.isArray(v) ? v.join(',') : String(v);
          const enc = String(header['content-encoding'] || '').toLowerCase();
          const zlib = require('zlib');
          if (enc.includes('gzip') || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)) {
            try { buf = zlib.gunzipSync(buf); } catch (_) {}
          } else if (enc.includes('deflate')) {
            try { buf = zlib.inflateSync(buf); } catch (_) { try { buf = zlib.inflateRawSync(buf); } catch (__) {} }
          }
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          const out = { data: ab, header, statusCode: res.statusCode, status: res.statusCode };
          opts.success && opts.success(out);
          opts.complete && opts.complete(out);
        });
      });
      req.on('error', (e) => opts.fail && opts.fail({ errMsg: e.message }));
      req.write(body); req.end();
    },
    getStorageSync() { return null; }, setStorageSync() {},
    getSystemInfoSync() { return { platform: 'ios', system: 'iOS 17.0', brand: 'iPhone', model: 'iPhone' }; },
    getAccountInfoSync() { return { miniProgram: { appId: WXID } }; },
    getNetworkType({ success }) { success && success({ networkType: 'wifi' }); },
    getAppBaseInfo() { return { SDKVersion: '3.0.0', version: '8.0.75' }; },
    getWindowInfo() { return { windowWidth: 390, windowHeight: 844, pixelRatio: 3 }; },
    getSystemSetting() { return {}; },
    getDeviceInfo() { return { brand: 'iPhone', model: 'iPhone' }; },
  };
}

function loadMGS() {
  const captured = [];
  function note(obj) { if (obj && typeof obj.call === 'function') captured.push(obj); }
  let finalExports = null;
  function define(name, factory) {
    const target = {};
    const exports = new Proxy(target, {
      set(t, p, v) {
        t[p] = v;
        if (p === 'MGS') note(v);
        if (p === 'default' && v && v.MGS) note(v.MGS);
        return true;
      },
    });
    const module = { exports };
    try {
      factory((n) => { throw new Error('require ' + n); }, module, exports,
        global, global.document, {}, global, global.location, global.navigator,
        {}, {}, {}, {}, {}, () => {}, () => {}, () => {}, class {}, class {}, {}, {}, {});
    } catch (_) {}
    finalExports = module.exports || target;
    if (finalExports && finalExports.MGS) note(finalExports.MGS);
  }
  global.define = define;
  try { eval(fs.readFileSync(MOD, 'utf8')); } catch (_) {}
  const MGS = captured.find((x) => x && typeof x.call === 'function') || (finalExports && finalExports.MGS);
  if (!MGS || typeof MGS.call !== 'function') throw new Error('MGS not loaded');
  return MGS;
}

function rpc(MGS, operationType, data, extraHeaderInfos = {}, session = {}) {
  const headers = Object.assign({
    'event-context': JSON.stringify({
      env: 'PRD', tntId: '0108',
      ipTId: session.ipTId || '', ipRId: session.ipRId || '',
    }),
    sessionKey: session.sessionKey || '',
    authSsuCode: session.authSsuCode || AUTH_SSU,
  }, extraHeaderInfos);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('rpc timeout: ' + operationType)), 30000);
    try {
      const p = MGS.call('rpc', {
        baseURL: 'https://spanner.bestpay.com.cn:10081',
        method: 'post', operationType, appid: APPID, workspaceid: WORKSPACE,
        signType: 'md5', secretKey: SECRET, encryptType: 2, publicKey: PUB,
        data, extraHttpConfig: {}, signHeaders: {}, extraHeaderInfos: headers,
      }, (res) => { clearTimeout(timer); resolve(res); });
      if (p && typeof p.then === 'function') p.then((res) => { clearTimeout(timer); resolve(res); }, (e) => { clearTimeout(timer); reject(e); });
    } catch (e) { clearTimeout(timer); reject(e); }
  });
}

function parseRpcData(res) {
  if (!res) return null;
  if (res.status && String(res.status) !== '200' && String(res.status) !== '1000' && res.data == null) {
    return { success: false, status: res.status, reason: res.reason, mgwStatus: res.status };
  }
  let d = res.data;
  if (d instanceof ArrayBuffer) { try { d = Buffer.from(d).toString('utf8'); } catch (_) {} }
  if (Buffer.isBuffer(d)) d = d.toString('utf8');
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return { raw: d, status: res.status }; } }
  if (d && typeof d === 'object') { d.mgwStatus = res.status; d.mgwReason = res.reason; }
  return d;
}

function apiParams() {
  return { appId: WXID, serveEnv: 'prod', appType: '117', authorizedType: 'MINI_DS', requestSystem: 'authlogin-wx-h5' };
}
function unwrap(d) {
  if (!d || typeof d !== 'object') return {};
  if (d.data && d.data.t && typeof d.data.t === 'object') return d.data.t;
  if (d.result && typeof d.result === 'object') return d.result;
  if (d.data && typeof d.data === 'object' && (d.data.sessionKey || d.data.smsUid)) return d.data;
  if (d.t && typeof d.t === 'object') return d.t;
  return d;
}
function readSessionsFile() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || {};
  } catch (e) {}
  return {};
}

function h5Body(session, appType, bizParams) {
  const rid = String(Date.now());
  return Object.assign({
    appType, traceLogId: rid, traceNo: rid, reqId: rid,
    sessionKey: session.sessionKey || '',
    productNo: session.productNo || '',
    ipTId: session.ipTId || '',
    ipRId: session.ipRId || '',
  }, bizParams);
}
function h5Headers(session, appType, env) {
  const authMap = { '45': '8901010699000045', '117': '8901010699000117', '116': '8901010699000116', '00': '8901010699000000' };
  return {
    'event-context': JSON.stringify({
      env: env || 'PRD', tntId: '0101',
      ipTId: session.ipTId || '', ipRId: session.ipRId || '',
    }),
    sessionKey: session.sessionKey || '',
    authSsuCode: authMap[appType] || '8901010699000045',
  };
}

async function authTokenLogin(MGS, session) {
  if (!session || !session.loginToken) throw new Error('无 loginToken');
  const res = await rpc(MGS, OP.authTokenLogin, Object.assign({
    loginToken: session.loginToken, productNo: session.productNo,
  }, apiParams()), {
    'event-context': JSON.stringify({
      env: '', tntId: '0108', ipTId: session.ipTId || '', ipRId: session.ipRId || IP_R_MALL,
      arNo: '8901011101110001', pdPath: 'appletAuthorize', pdCd: '01110110',
    }),
    sessionKey: session.sessionKey || '', authSsuCode: AUTH_SSU,
  }, {});
  const d = parseRpcData(res); const t = unwrap(d);
  if (!t.sessionKey) throw new Error('authTokenLogin fail: ' + JSON.stringify(d).slice(0, 200));
  const s = {
    sessionKey: t.sessionKey,
    loginToken: t.loginToken || session.loginToken,
    productNo: t.productNo || t.alias || session.productNo,
    ipTId: t.ipTId || t.ipTid || session.ipTId || '',
    ipRId: (t.ipRId || t.ipRid) || (Array.isArray(t.memberTypeList) && t.memberTypeList[0] && t.memberTypeList[0].ipRid) || session.ipRId || '',
    operatorNo: t.operatorNo || session.operatorNo || '',
    userIp: session.userIp || '',
    // 无条件继承旧 couponClaimed(无论 true/false/undefined),防止续期把抢到状态重置丢
    couponClaimed: session.couponClaimed,
    authSsuCode: AUTH_SSU,
    note: 'scheduler',
    updatedAt: new Date().toISOString(),
    __phone: session.__phone || session.productNo,
  };
  return s;
}

// ============ 手机号短信登录 ============
// 与权益币脚本(bestpay_equity_coin_sniper.cjs)同款登录链:
//   sendSmsVerifyCode -> authSmsVerifyCode -> authTokenLogin
// smsUid 落盘到 ~/.bestpay_sms_uid.json, 支持"先发短信→再填验证码"的面板两步流程。
const SMS_UID_FILE = path.join(os.homedir(), '.bestpay_sms_uid.json');

function loginExtra() {
  return {
    'event-context': JSON.stringify({
      env: '', tntId: '0101', ipTId: '', ipRId: '',
      arNo: '8901011101600001', pdPath: 'sendSmsEvent', pdCd: '01110160',
    }),
    sessionKey: '', authSsuCode: AUTH_SSU,
  };
}
function loginParams(extra) {
  return Object.assign({
    appId: WXID, serveEnv: 'prod', appType: '117', authorizedType: 'MINI_DS',
    requestSystem: 'authlogin-wx-h5',
  }, extra || {});
}

async function interactiveLogin(MGS, { phone: phoneArg = '', smsCode: codeArg = '', sendSmsOnly = false } = {}) {
  const phone = normalizePhone(phoneArg || await ask('请输入手机号: '));
  if (!phone) throw new Error('手机号无效 (需 11 位: 1xxxxxxxxxx)');

  let smsUid = '';
  // 已有验证码 + 已存 smsUid → 直接校验, 不再发短信 (面板两步)
  if (codeArg && !sendSmsOnly && fs.existsSync(SMS_UID_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SMS_UID_FILE, 'utf8'));
      if (saved && saved.phone === phone && saved.smsUid) {
        smsUid = saved.smsUid;
        log('复用已存 smsUid=', smsUid, 'phone=', maskPhone(phone));
      }
    } catch (_) {}
  }

  if (!smsUid) {
    log('发送短信 ->', maskPhone(phone));
    const sendRes = await rpc(MGS, OP.sendSms, loginParams({ productNo: phone }), loginExtra());
    const sd = parseRpcData(sendRes);
    smsUid = sd && sd.data && sd.data.t && sd.data.t.smsUid;
    if (!smsUid) throw new Error('发短信失败: ' + JSON.stringify(sd).slice(0, 300));
    log('已发码 smsUid=', smsUid);
    try { fs.writeFileSync(SMS_UID_FILE, JSON.stringify({ phone, smsUid, at: new Date().toISOString() }, null, 2)); } catch (_) {}
  }

  if (sendSmsOnly) {
    log('send-sms-only ok, smsUid 已存', SMS_UID_FILE);
    return { phone, smsUid, sendSmsOnly: true };
  }

  let code = codeArg;
  if (!code) code = await ask('请输入短信验证码: ');
  if (!/^\d{4,8}$/.test(code)) throw new Error('验证码无效');
  const verifyRes = await rpc(MGS, OP.verifySms, loginParams({
    verifyCode: code, smsUid, productNo: phone,
    issueSite: '0101', externalChannel: 'WECHAT', deviceId: phone,
    authPayChannel: '100005', regFrom: 'MINI_PROGRAM', deviceAttribute: '',
  }), loginExtra());
  const vd = parseRpcData(verifyRes);
  const t = (vd && vd.data && vd.data.t) || {};
  if (!t.sessionKey) throw new Error('登录失败: ' + JSON.stringify(vd).slice(0, 400));
  const list = t.memberTypeList || [];
  const tech = list.find((x) => String(x.type) === '8901' || x.type === 'KJHY') || list[0] || {};
  const s = {
    sessionKey: t.sessionKey,
    loginToken: t.loginToken || '',
    productNo: t.alias || t.productNo || phone,
    ipTId: t.ipTId || '',
    ipRId: tech.ipRid || IP_R_MALL,
    operatorNo: t.operatorNo || '',
    authSsuCode: AUTH_SSU,
    memberTypeList: list,
    updatedAt: new Date().toISOString(),
    note: 'sms-login',
    __phone: phone,
  };
  try { Object.assign(s, await authTokenLogin(MGS, s)); } catch (_) {}
  saveSession(s);
  try { fs.unlinkSync(SMS_UID_FILE); } catch (_) {}
  log('登录成功', maskPhone(phone), String(s.sessionKey).slice(0, 12) + '...');
  return s;
}

function saveSession(s) {
  try {
    const all = readSessionsFile();
    const key = s.productNo || s.__phone;
    if (!key) return;
    all[key] = s;
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(all, null, 2));
    log('已保存 session ->', SESSIONS_FILE, '(' + maskPhone(key) + ')');
  } catch (e) { log('保存 session 失败:', e.message); }
}

async function queryMoneyMainInfo(MGS, session, appType = '117') {
  const body = h5Body(session, appType, {});
  const res = await rpc(MGS, OP.queryMoneyMainInfo, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}
async function queryBalance(MGS, session, appType = '117', configNo = '') {
  const body = h5Body(session, appType, { activityConfigNo: configNo });
  const res = await rpc(MGS, OP.queryTotalScore, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}
async function queryMoneyTasks(MGS, session, sceneType, appType = '117') {
  const body = h5Body(session, appType, { sceneType });
  const res = await rpc(MGS, OP.queryTaskListOutput, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}
async function getDynamicScore(MGS, session, configNo, unitPrice, appType = '117') {
  const body = h5Body(session, appType, { activityConfigNo: configNo, unitPrice, formulaType: 'moxi' });
  const res = await rpc(MGS, OP.getDynamicScore, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}
async function finishTask(MGS, session, taskNo, missionType, passAmt, appType = '117') {
  const biz = { notifyType: 'FINISH', missionType, taskNo };
  if (passAmt != null) { biz.passAmt = passAmt; biz.formulaType = 'moxi'; }
  const body = h5Body(session, appType, biz);
  const res = await rpc(MGS, OP.sendTaskMessAge, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}
// 领取任务奖励 (GET 模式金币任务必须显式领取才到账)
async function getReward(MGS, session, taskNo, appType = '117') {
  const body = h5Body(session, appType, { taskNo, channel: 'App' });
  const res = await rpc(MGS, OP.getReward, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}
async function signIn(MGS, session, activityNo, appType = '117') {
  const body = h5Body(session, appType, { signInActivityConfigNo: activityNo || '', traceLogId: String(Date.now()) });
  const res = await rpc(MGS, OP.signIn, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}

async function queryPageConfig(MGS, session, appType = '117') {
  const body = h5Body(session, appType, { signInSceneCode: 'APP_SIGNIN' });
  const res = await rpc(MGS, OP.queryPageConfig, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}

async function querySignInConfigInfo(MGS, session, sceneCode, appType = '117') {
  const body = h5Body(session, appType, { sceneCode });
  const res = await rpc(MGS, OP.querySignInConfigInfo, body, h5Headers(session, appType), session);
  return parseRpcData(res);
}

// 完整签到: queryPageConfig -> querySignInConfigInfo -> signIn
async function fullSignIn(MGS, session, appType = '117') {
  // 1. queryPageConfig 拿 sceneCode
  const pc = await queryPageConfig(MGS, session, appType);
  const pcRes = pc && pc.data && (pc.data.t || pc.data.result);
  const sceneCode = pcRes && pcRes.signInSceneCode;
  if (!sceneCode) return { step: 'queryPageConfig', error: 'no sceneCode', raw: pc };
  // 2. querySignInConfigInfo 拿 activityNo
  const ci = await querySignInConfigInfo(MGS, session, sceneCode, appType);
  const ciRes = ci && ci.data && (ci.data.t || ci.data.result);
  const info = ciRes && ciRes.signInActivityConfigInfo;
  const activityNo = info && info.activityNo;
  if (!activityNo) return { step: 'querySignInConfigInfo', sceneCode, error: 'no activityNo', raw: ci };
  // 3. signIn
  const si = await signIn(MGS, session, activityNo, appType);
  return { step: 'signIn', sceneCode, activityNo, raw: si };
}

// ============ 工具 ============
// 跑满后停掉 launchd 调度 (当天不再触发); 由 com.bestpay.task.reset 每天0点重新 load
const SCHED_PLIST = path.join(os.homedir(), 'Library/LaunchAgents/com.bestpay.task.scheduler.plist');
function disableLaunchd(reason) {
  try {
    execSync('launchctl unload ' + SCHED_PLIST, { stdio: 'ignore' });
    log(`[停调度] ${reason} → 已 unload com.bestpay.task.scheduler (明天0点由 reset 恢复)`);
    return true;
  } catch (e) {
    log(`[停调度] unload 失败: ${e.message}`);
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 硬超时包装: 防卡死, 超时返回 null
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('HARD_TIMEOUT ' + (label || '') + ' ' + ms + 'ms')), ms)),
  ]);
}
// 随机延时 [min, max] 秒
const randSleep = async (min, max) => {
  const ms = min * 1000 + Math.random() * ((max - min) * 1000);
  await sleep(Math.round(ms));
};

// 从任务列表结果里取任务数组 (字段名 missionList)
function extractTaskList(d) {
  if (!d) return [];
  const t = unwrap(d);
  const list = (t && t.missionList) || (d.data && d.data.result && d.data.result.missionList) || (d.data && d.data.t && d.data.t.missionList) || [];
  return Array.isArray(list) ? list : [];
}
// 从金额主页取 configNo
function extractConfigNo(mi) {
  const t = mi && unwrap(mi);
  return (t && t.configNo) || '';
}

// ============ 单账号刷任务 ============
// 任务类型定义: {missionType, maxPerDay, unitPrice?, batch}
const TASK_DEFS = {
  ad_show: { missionType: 'AD_show', maxPerDay: 10, unitPrice: 150000, batch: 3, name: '看视频' },
  ad_click: { missionType: 'AD_click', maxPerDay: 20, batch: 5, name: '点广告' },
  drama: { missionType: 'DRAMA_DURATION', maxPerDay: 3, batch: 3, name: '看短剧' },
};

async function runAccount(MGS, phone, session, taskKeys, opts) {
  const dryRun = opts.dryRun;
  const maxPerRun = opts.maxPerRun || 3; // 每次运行最多报的次数
  let signInStatus = '未执行';
  const doneByTask = {};
  log(`\n===== 账号 ${maskPhone(phone)} =====`);
  // 续期
  try {
    const fresh = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin');
    Object.assign(session, fresh);
    log(`  续期OK sessionKey=${session.sessionKey.slice(0, 8)}...`);
  } catch (e) {
    log(`  续期失败: ${e.message}`);
  }

  // 查 configNo + 余额
  let configNo = '';
  try {
    const mi = await withTimeout(queryMoneyMainInfo(MGS, session, '117'), 35000, 'queryMoneyMainInfo');
    configNo = extractConfigNo(mi);
    log(`  configNo=${configNo}`);
  } catch (e) {
    log(`  queryMoneyMainInfo失败: ${e.message}`);
  }
  let balBefore = -1;
  try {
    const bal = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
    const t = unwrap(bal);
    balBefore = (t && t.totalScore) != null ? t.totalScore : balBefore;
    log(`  余额=${balBefore}`);
  } catch (e) {
    log(`  查余额失败: ${e.message}`);
  }

  // 签到
  try {
    const si = await withTimeout(fullSignIn(MGS, session, '117'), 40000, 'fullSignIn');
    log(`  签到[${si.step}] ${si.error ? '失败: ' + si.error : (si.activityNo ? 'activityNo=' + si.activityNo : '')}`);
    if (si.step === 'signIn') {
      const siRaw = si.raw && si.raw.data;
      const siRes = siRaw && (siRaw.t || siRaw.result || siRaw); // data 平铺时直接用 data 本体
      const ok = !!(siRes && (siRes.ok === true || siRes.status === 'SUCCESS' || siRes.success === true || siRes.rewardDesc || siRes.balance));
      signInStatus = ok ? '成功' : ((siRes && (siRes.primaryErrMsg || siRes.errMsg)) || '返回异常');
      log(`  签到结果: ${ok ? 'SUCCESS' : JSON.stringify(siRes || si.raw).slice(0, 160)}`);
    } else {
      signInStatus = '跳过:' + si.error;
    }
  } catch (e) {
    signInStatus = '失败:' + e.message;
    log(`  签到失败: ${e.message}`);
  }
  await randSleep(1, 3);

  // 全满预检: 拉一次列表, 若 taskKeys 所有任务都已完成/满, 直接停 (不上报不空转)
  try {
    const pre = await withTimeout(queryMoneyTasks(MGS, session, 'MAKE_MONEY_MISSION', '117'), 35000, 'queryMoneyTasks(pre)');
    const preTasks = extractTaskList(pre);
    const allFinished = taskKeys.every((k) => {
      const def = TASK_DEFS[k];
      if (!def) return false;
      const t = preTasks.find((x) => x.businessType === def.missionType || x.missionType === def.missionType);
      if (!t) return true; // 任务不存在视为已完成, 跳过
      const al = t.alreadyCompleteCount != null ? t.alreadyCompleteCount : (t.alreadyComplete || t.completedCount || 0);
      return t.status === 'FINISH' || al >= def.maxPerDay;
    });
    if (allFinished && taskKeys.length > 0) {
      log(`[全满] 所有任务(${taskKeys.join(',')})已跑满, 本轮无需执行, 直接停`);
      disableLaunchd('所有任务已跑满');
      return;
    }
  } catch (e) {
    log(`  全满预检失败: ${e.message} → 继续正常跑`);
  }

  for (const key of taskKeys) {
    const def = TASK_DEFS[key];
    if (!def) { log(`  未知任务 ${key}`); continue; }
    log(`\n  --- ${def.name} (${def.missionType}, 上限${def.maxPerDay}/天) ---`);
    await randSleep(1, 3);

    // 每次重新拉列表拿最新 taskNo 和 alreadyComplete, 断点续跑
    // 每次运行只报 maxPerRun 次 (默认2), 靠 launchd 多次触发累积到日上限, 防一次跑满触发风控
    const runLimit = Math.min(def.maxPerDay, maxPerRun);
    log(`  本次运行最多 ${runLimit} 次 (日上限${def.maxPerDay})`);
    let doneCount = 0;
    let remaining = def.maxPerDay;
    for (let round = 0; round < runLimit; round++) {
      let tasks = [];
      try {
        const d = await withTimeout(queryMoneyTasks(MGS, session, 'MAKE_MONEY_MISSION', '117'), 35000, 'queryMoneyTasks');
        tasks = extractTaskList(d);
      } catch (e) {
        log(`  拉任务列表失败(第${round + 1}轮): ${e.message} → 跳过本轮`);
        await randSleep(3, 6);
        continue;
      }
      // 找到匹配 missionType 的任务
      const task = tasks.find((t) => t.businessType === def.missionType || t.missionType === def.missionType);
      if (!task) { log(`  未找到 ${def.missionType} 任务, 停止`); break; }
      const taskNo = task.taskNo;
      const already = task.alreadyCompleteCount != null ? task.alreadyCompleteCount : (task.alreadyComplete || task.completedCount || 0);
      const finished = task.status === 'FINISH' || already >= def.maxPerDay;
      if (finished) { log(`  已完成 ${already}/${def.maxPerDay} (status=${task.status}), 跳过`); remaining = 0; break; }

      // 看视频走 getDynamicScore 拿分数
      let passAmt = null;
      if (key === 'ad_show') {
        try {
          // 随机上报单价(到账=unitPrice*0.04), 每次不同防风控规律
          // 单次到账>=2800 -> 上报>=70000; 范围70000~90000, 10次最低总额=28000
          const unitPrice = 70000 + Math.floor(Math.random() * 20001); // 70000..90000
          const ds = await withTimeout(getDynamicScore(MGS, session, configNo, unitPrice, '117'), 35000, 'getDynamicScore');
          const dt = unwrap(ds);
          const score = (dt && dt.score) != null ? dt.score : -1;
          if (score <= 1) { log(`  动态分数=${score} 异常(可能已封顶), 停止`); break; }
          passAmt = unitPrice;
          log(`  动态分数=${score} (unitPrice=${unitPrice})`);
        } catch (e) {
          log(`  getDynamicScore失败: ${e.message} → 跳过`); continue;
        }
      }

      if (dryRun) { log(`  [dry-run] 上报 ${def.missionType} taskNo=${taskNo} passAmt=${passAmt}`); doneCount++; continue; }

      try {
        const fd = await withTimeout(finishTask(MGS, session, taskNo, def.missionType, passAmt, '117'), 35000, 'finishTask');
        const fdt = unwrap(fd);
        const ok = fd && fd.success === true || (fdt && fdt.status === 'SUCCESS');
        log(`  第${round + 1}次 上报 → ${ok ? 'SUCCESS' : JSON.stringify(fd).slice(0, 120)}`);
        if (!ok) {
          // 若返回已领取/已满, 停止
          const s = JSON.stringify(fd || '');
          if (s.includes('already') || s.includes('complete') || s.includes('已领取') || s.includes('已满')) break;
        }
        doneCount++;
        // 上报成功后领取奖励 (GET 模式金币任务必须显式领取才到账)
        if (!dryRun) {
          try {
            log(`  领取奖励 ${def.missionType}...`);
            const gr = await withTimeout(getReward(MGS, session, taskNo, '117'), 35000, 'getReward');
            const g = JSON.stringify(gr || '');
            if (g.includes('TB0001') || g.includes('太频繁')) {
              log(`  领取被风控拦截(TB0001): ${g.slice(0, 120)} → 停止本轮避免加剧`);
              break;
            }
            log(`  领取结果: ${g.slice(0, 160)}`);
          } catch (e) {
            log(`  领取失败: ${e.message}`);
          }
        }
      } catch (e) {
        log(`  上报失败(第${round + 1}次): ${e.message}`);
        // 网络抖动重试, 指数退避
        await randSleep(3, 6);
        continue;
      }

      // 随机延时 (拉长, 降低触发服务端吞分风控): 单次 8-15s, 每批(3次)后 20-40s
      if ((round + 1) % def.batch === 0 && round + 1 < def.maxPerDay) {
        log(`    批间休息...`);
        await randSleep(20, 40);
      } else if (round + 1 < def.maxPerDay) {
        await randSleep(8, 15);
      }
    }
    log(`  ${def.name} 本轮完成 ${doneCount} 次`);
    doneByTask[def.name] = doneCount;
    await randSleep(2, 4);
  }

  // 最终余额:先重新续期 session, 避免上报过程中 session 失效导致查到旧值
  let balAfter = balBefore;
  if (!dryRun && configNo) {
    try {
      const fresh2 = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin(最终)');
      Object.assign(session, fresh2);
      const bal = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
      const t = unwrap(bal);
      balAfter = (t && t.totalScore) != null ? t.totalScore : balAfter;
      log(`\n  余额 ${balBefore} → ${balAfter}  (+${balAfter - balBefore})`);
    } catch (e) {
      log(`  查最终余额失败: ${e.message}`);
    }
  }
  return { phone, balBefore, balAfter, signIn: signInStatus, done: doneByTask };
}

// ============ 主流程 ============
// 全局看门狗: 单次运行总预算(默认 25 分钟), 到点强制退出, 防任何 await 卡死
const GLOBAL_BUDGET_MS = 25 * 60 * 1000;
const _watchdog = setTimeout(() => {
  log(`[watchdog] 总运行超 ${GLOBAL_BUDGET_MS / 60000} 分钟, 强制退出`);
  process.exit(0);
}, GLOBAL_BUDGET_MS);
_watchdog.unref();

async function main() {
  const args = process.argv.slice(2);
  const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? String(args[i + 1] || '') : ''; };
  const rawArgPhone = argVal('--phone');
  const envPhone = normalizePhone(process.env.BESTPAY_PHONE || '');
  const argPhone = normalizePhone(rawArgPhone);
  if (rawArgPhone && !argPhone) { log('手机号无效: ' + rawArgPhone + ' (需 11 位: 1xxxxxxxxxx)'); return; }
  const doLogin = args.includes('--login') || args.includes('--send-sms');
  const all = readSessionsFile();
  const phones = args.includes('--all') ? Object.keys(all) : [];
  if (!args.includes('--all')) {
    const p = argPhone || envPhone;
    if (p) phones.push(p);
    else if (!doLogin) log('提示: 未指定手机号 (--phone <手机号> 或 BESTPAY_PHONE)');
  }
  // 去重 + 过滤无 sessionKey 的
  const valid = [...new Set(phones)].filter((p) => all[p] && all[p].sessionKey);
  if (valid.length === 0 && !doLogin) { log('无有效 session; 首次使用请先: --login --phone <手机号>'); return; }

  // 任务选择
  const ti = args.indexOf('--tasks');
  let taskKeys = ['ad_show', 'ad_click', 'drama'];
  if (ti >= 0) {
    taskKeys = args[ti + 1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  const dryRun = args.includes('--dry-run');
  // 每次运行最多报的次数 (默认3, 防一次跑满触发风控); 通过 launchd 多次触发累积到日上限
  const mi2 = args.indexOf('--max');
  const maxPerRun = mi2 >= 0 ? parseInt(args[mi2 + 1], 10) : 3;
  if (maxPerRun < 1) { log('--max 必须 >=1'); return; }
  // 随机模式 (launchd StartInterval 每30分钟触发): 每次随机决定是否执行, 上报前随机延时
  // 使上报时间点完全随机, 避免固定时间被风控识别
  if (args.includes('--rand')) {
    const skipChance = 0.5; // 50% 概率本轮跳过
    if (Math.random() < skipChance) {
      log(`[随机] 本轮跳过 (50%概率), 时间=${new Date().toLocaleTimeString('zh-CN', {hour12:false})}`);
      return;
    }
    // 上报前随机延时 0-5 分钟, 打散时间点
    const delaySec = Math.floor(Math.random() * 300);
    log(`[随机] 本轮执行, 延时 ${delaySec}s 打散时间点`);
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }

  log('加载 wasm 引擎...');
  loadWasmEnv();
  const MGS = loadMGS();
  log('MGS 就绪, 账号数=' + valid.length + ', 任务=' + taskKeys.join(',') + (dryRun ? ' (dry-run)' : ''));

  // 手机号短信登录 / 只发短信 (发码→填码两段式面板)
  if (doLogin) {
    const phone = argPhone || envPhone || await ask('请输入手机号: ');
    if (args.includes('--send-sms')) {
      await interactiveLogin(MGS, { phone, sendSmsOnly: true });
      return;
    }
    const code = (argVal('--code') || argVal('--sms-code') || process.env.BESTPAY_SMS_CODE || '').trim();
    await interactiveLogin(MGS, { phone, smsCode: code });
    log('登录完成, 当前账号:', Object.keys(readSessionsFile()).map(maskPhone).join(', ') || '(无)');
    return;
  }

  // 单次上报测试: --report <ad_show|ad_click|drama> 强制上报一次 + 查余额对比
  const ri = args.indexOf('--report');
  if (ri >= 0) {
    const rkey = (args[ri + 1] || 'ad_show').trim();
    const def = TASK_DEFS[rkey];
    if (!def) { log('未知任务: ' + rkey); return; }
    const phone = valid[0];
    if (!phone) { log('需 --phone <手机号> 指定账号'); return; }
    const session = all[phone];
    session.__phone = phone;
    log(`单次上报测试: ${maskPhone(phone)} → ${def.name}`);
    try {
      const fresh = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin');
      Object.assign(session, fresh);
      log('  续期OK sessionKey=' + session.sessionKey.slice(0, 8) + '...');
      const mi = await withTimeout(queryMoneyMainInfo(MGS, session, '117'), 35000, 'queryMoneyMainInfo');
      const configNo = extractConfigNo(mi);
      log('  configNo=' + configNo);
      const bal0 = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
      const b0 = (unwrap(bal0) && unwrap(bal0).totalScore) != null ? unwrap(bal0).totalScore : -1;
      log('  上报前余额=' + b0);
      // 拉任务列表拿 taskNo
      const d = await withTimeout(queryMoneyTasks(MGS, session, 'MAKE_MONEY_MISSION', '117'), 35000, 'queryMoneyTasks');
      const tasks = extractTaskList(d);
      const task = tasks.find((t) => t.businessType === def.missionType || t.missionType === def.missionType);
      if (!task) { log('  未找到 ' + def.missionType + ' 任务, 中止'); return; }
      log('  taskNo=' + task.taskNo + ' alreadyComplete=' + task.alreadyCompleteCount + ' status=' + task.status);
      // 看视频先 getDynamicScore
      let passAmt = null;
      if (rkey === 'ad_show') {
        // 随机上报单价(到账=unitPrice*0.04), 每次不同防风控规律
        // 单次到账>=2800 -> 上报>=70000; 范围70000~90000, 10次最低总额=28000
        const unitPrice = 70000 + Math.floor(Math.random() * 20001); // 70000..90000
        const ds = await withTimeout(getDynamicScore(MGS, session, configNo, unitPrice, '117'), 35000, 'getDynamicScore');
        const dt = unwrap(ds);
        const score = (dt && dt.score) != null ? dt.score : -1;
        log('  动态分数=' + score + ' (unitPrice=' + unitPrice + ')');
        if (score > 1) passAmt = unitPrice;
      }
      const fd = await withTimeout(finishTask(MGS, session, task.taskNo, def.missionType, passAmt, '117'), 35000, 'finishTask');
      log('  上报结果: ' + JSON.stringify(fd).slice(0, 200));
      // GET 模式金币任务必须领取: 上报后调 newGetReward
      log('  尝试领取 newGetReward...');
      const gr = await withTimeout(getReward(MGS, session, task.taskNo, '117'), 35000, 'getReward');
      log('  领取结果: ' + JSON.stringify(gr).slice(0, 300));
      // 查余额(先续期避免失效 session)
      const fresh2 = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin(后)');
      Object.assign(session, fresh2);
      const bal1 = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
      const b1 = (unwrap(bal1) && unwrap(bal1).totalScore) != null ? unwrap(bal1).totalScore : -1;
      log('  上报后余额=' + b1 + '  (+' + (b1 - b0) + ')');
    } catch (e) {
      log('  单次上报异常: ' + e.message);
    }
    return;
  }

  // 逐个账号跑 (串行, 避免并发风控)
  const results = [];
  for (const phone of valid) {
    const session = all[phone];
    session.__phone = phone;
    // 每账号硬超时保护: 单账号最多 12 分钟
    try {
      const r = await withTimeout(runAccount(MGS, phone, session, taskKeys, { dryRun, maxPerRun }), 720000, 'account-' + phone);
      results.push(r);
    } catch (e) {
      log(`账号 ${maskPhone(phone)} 整体超时/失败: ${e.message}`);
      results.push({ phone, error: e.message });
    }
    // 账号间随机延时
    if (phone !== valid[valid.length - 1]) {
      log(`账号间休息...`);
      await randSleep(15, 40);
    }
  }
  log(`\n===== 全部完成, 处理账号 ${results.length} 个 =====`);

  // Bark 通知 (成功/失败都推, 内容带活动金币)
  const parts = results.map((r) => {
    if (!r || r.error) {
      return `${r && r.phone ? maskPhone(r.phone) : '?'}: 失败 ${r && r.error ? r.error : ''}`;
    }
    const d = r.done || {};
    const doneDesc = Object.keys(d).length
      ? Object.entries(d).map(([k, v]) => `${k}${v}`).join('/')
      : '无';
    const bal = (r.balAfter != null && r.balBefore != null) ? `${r.balBefore}→${r.balAfter}(+${r.balAfter - r.balBefore})` : '?';
    return `${maskPhone(r.phone)}: 签到${r.signIn} · ${doneDesc} · 金币${bal}`;
  });
  const title = dryRun ? '翼支付刷金币(dry-run)' : `翼支付刷金币完成 ${results.length}号`;
  await sendBark(title, parts.join('\n'));
  log('bark 通知已发送');
}

main().catch((e) => { log('FATAL:', e); process.exit(1); }).then(() => process.exit(0));

}, function (e) {
  __pushLog(['资产预载失败: ' + (e && e.message ? e.message : e)]);
  __finish();
});
/* ==== 原脚本正文结束 ==== */
