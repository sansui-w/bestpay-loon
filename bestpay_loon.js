/* =======================================================================
 *  bestpay  /  Loon  --  LOCAL CONFIG BLOCK        <<<  EDIT HERE  >>>
 * -----------------------------------------------------------------------
 *  Loon has no command-line arguments ("--xxx" does not work), so the
 *  whole run config is driven by this block + $persistentStore keys.
 *  Change a value here, save, then just run the task again. That's it.
 *
 *  assets : repo base URL (assets live under <base>/assets_parts/).
 *           Leave it as-is normally -- if a mirror is down the script
 *           auto-falls-back through a built-in mirror list.
 *  phones : mobile number(s), 11 digits.  e.g. ["13800138000"]
 *  mode   : "all"      run every saved account     <-- normal daily use
 *           "phone"    run only phones[0]
 *           "send-sms" login step 1: send SMS code
 *           "login"    login step 2: phones[0] + code
 *  code   : the SMS code you received  (only used while mode = "login")
 *  tasks  : which missions to run
 *  max    : max reports per task per run   (3 = default)
 *  dryRun : true = query only, never report   (safe first test)
 *  bark   : optional Bark key/URL for push notifications
 * ======================================================================= */
var BP_SETUP = {
  assets: "https://fastly.jsdelivr.net/gh/sansui-w/bestpay-loon@main",
  phones: [],
  mode: "all",
  code: "",
  tasks: ["ad_show", "ad_click", "drama"],
  max: 3,
  dryRun: false,
  bark: ""
};
/* ======================================================================= */

/* ============================================================================
 *  \u7ffc\u652f\u4ed8 \u00b7 \u5237\u91d1\u5e01  \u2014\u2014 Loon \u79fb\u690d\u7248
 *  ---------------------------------------------------------------------------
 *  \u539f\u811a\u672c bestpay_task_scheduler.cjs \u7684\u6b63\u6587\u3010\u9010\u5b57\u4fdd\u7559\u3011\uff0c\u672a\u6539\u4e00\u884c\u4e1a\u52a1\u903b\u8f91\u3002
 *  \u672c\u6587\u4ef6\u53ea\u505a\u4e00\u4ef6\u4e8b\uff1a\u4e3a\u539f\u811a\u672c\u63d0\u4f9b\u5b83\u539f\u672c\u4f9d\u8d56\u7684 Node \u8fd0\u884c\u73af\u5883\u3002
 *
 *  \u88ab\u57ab\u6389\u7684 Node \u80fd\u529b\uff1a
 *    require('fs'|'path'|'os'|'https'|'zlib'|'readline'|'child_process')
 *    Buffer / process / __dirname / global / setTimeout.unref() / URL
 *
 *  \u88ab\u66ff\u6362\u7684\u5e73\u53f0\u80fd\u529b\uff1a
 *    \u4e09\u4e2a wasm \u8d44\u4ea7  \u2192  \u8fd0\u884c\u65f6\u4ece URL \u62c9\u53d6\uff08\u00a70\uff09\uff0c\u81ea\u5e26 inflate \u515c\u5e95\u89e3\u538b
 *    ~/.bestpay_*.json  \u2192  Loon $persistentStore\uff08\u6bd4\u660e\u6587\u6587\u4ef6\u5b89\u5168\uff09
 *    \u7f51\u7edc            \u2192  \u539f\u751f fetch\uff08$httpClient \u4e8c\u8fdb\u5236\u4e0d\u4fdd\u771f\uff0c\u5df2\u5b9e\u6d4b\u6392\u9664\uff09
 *    Bark \u63a8\u9001       \u2192  \u539f\u811a\u672c\u81ea\u5e26\uff0c\u8d70\u540c\u4e00\u4e2a https \u57ab\u7247\uff0c\u65e0\u9700\u6539\u52a8
 *    \u547d\u4ee4\u884c\u53c2\u6570      \u2192  Loon [Task] \u7684 argument= \u6620\u5c04\u6210 process.argv
 *
 *  [Task] \u914d\u7f6e\u793a\u4f8b\uff1a
 *    cron "10 10 * * *" script-path=bestpay_loon.js, tag=bestpay-am, argument="--all"
 *    cron "10 20 * * *" script-path=bestpay_loon.js, tag=bestpay-pm, argument="--all"
 *    \u767b\u5f55\uff1aargument="--login --phone 13800138000 --code 123456"
 *
 *  \u4f5c\u8005\uff1aLittle Code Sauce
 * ========================================================================== */

/* ---------- \u00a70  \u8d44\u4ea7\u5730\u5740\uff08\u8fd0\u884c\u65f6\u62c9\u53d6\uff09------------------------------------
 * \u4e09\u4e2a wasm/js \u8d44\u4ea7\u4e0d\u5185\u8054\uff0c\u8fd0\u884c\u65f6\u6309\u4e0b\u5217\u5730\u5740\u53d6\u56de\uff0c\u811a\u672c\u4f53\u79ef\u4ece 828KB \u964d\u5230 ~50KB\u3002
 * \u82e5\u8fd4\u56de\u4f53\u662f gzip/zlib \u538b\u7f29\u683c\u5f0f\uff0c\u81ea\u52a8\u89e3\u538b\uff08\u89c1 \u00a71c\uff09\uff1b\u672a\u538b\u7f29\u539f\u6587\u4ef6\u4e5f\u80fd\u76f4\u63a5\u7528\u3002
 * \u5efa\u8bae\uff1a\u628a gzip \u540e\u7684 .gz \u6587\u4ef6\u4f20\u4e0a\u53bb\uff0c\u7701\u6d41\u91cf\u3001\u4e0b\u8f7d\u5feb\u3002
 * ------------------------------------------------------------------------- */
var __REPO = 'sansui-w/bestpay-loon';
var __BR = 'main';
var __PART_DIR = 'assets_parts';
/* \u539f\u59cb(\u672a\u538b\u7f29)\u8d44\u4ea7\u6309 64KB \u5207\u5757, \u5206\u5757\u540d = <\u6587\u4ef6\u540d>.p0/.p1/... \u653e\u5728 __PART_DIR \u4e0b\u3002
 * \u4e3a\u4ec0\u4e48\u4f20\u539f\u59cb\u800c\u4e0d\u4f20 gz: Loon \u7684 JS \u73af\u5883(JSC)\u8dd1\u7eaf JS inflate \u6781\u6162,
 * \u5b9e\u6d4b Node(\u5feb\u5f97\u591a)\u91cc\u89e3\u538b 460KB->1MB \u5c31\u8981 13 \u79d2\u3002\u6539\u6210\u5e76\u884c\u62c9\u53d6\u539f\u59cb\u5206\u5757,
 * \u7528\u7f51\u7edc(\u5feb\u3001\u53ef\u5e76\u884c)\u6362 CPU(\u6162\u3001\u4e32\u884c), \u603b\u8017\u65f6\u53cd\u800c\u66f4\u4f4e\u3002 */
var __ASSET_FILE = {
  wbaes: 'WBAES.wasm',
  mpaas: 'mpaas_raw_mod.js',
  gwcli: 'gwcli1-0-2.wasm',
};
var __ASSET_PARTS = { wbaes: 2, mpaas: 5, gwcli: 17 };
var __ASSET_SIZE = { wbaes: 68625, mpaas: 283185, gwcli: 1058502 };
var __CONCURRENCY = 6;   // \u540c\u65f6\u6700\u591a\u51e0\u4e2a\u5206\u5757\u8bf7\u6c42\uff08Loon \u5e76\u53d1\u592a\u591a\u4f1a\u538b\u57ae\uff09
/* \u955c\u50cf\u6e05\u5355\uff1a\u6309\u4f18\u5148\u7ea7\u987a\u5e8f\u5c1d\u8bd5\uff08\u5148\u62ff\u6700\u5c0f\u5206\u5757\u63a2\u6d3b\uff09\uff0c\u4efb\u4e00\u6210\u529f\u5373\u7528\u3002
 * \u914d\u7f6e\u5757\u91cc\u7684 assets \u82e5\u975e\u7a7a\uff0c\u4f1a\u88ab\u63d2\u5230\u6700\u524d\u9762\u4f18\u5148\u7528\u3002 */
var __ASSET_MIRRORS = [
  'https://fastly.jsdelivr.net/gh/' + __REPO + '@' + __BR,
  'https://jsd.onmicrosoft.cn/gh/' + __REPO + '@' + __BR,
  'https://gcore.jsdelivr.net/gh/' + __REPO + '@' + __BR,
  'https://gh-proxy.com/https://raw.githubusercontent.com/' + __REPO + '/' + __BR,
  'https://ghproxy.net/https://raw.githubusercontent.com/' + __REPO + '/' + __BR,
  'https://ghfast.top/https://raw.githubusercontent.com/' + __REPO + '/' + __BR,
];
var __ASSET_URLS = {};   // \u7531 \u00a77 \u586b\u5145: key -> [\u5019\u9009 URL...]

/* ---------- \u00a72  \u5b57\u8282 / \u7f16\u7801\u5de5\u5177 ------------------------------------------ */
var __G = (typeof globalThis !== 'undefined') ? globalThis
         : (typeof global !== 'undefined') ? global
         : this;
/* global \u7528 Proxy \u5305\u4e00\u5c42\u3002
   \u6b63\u6587\u4f1a\u7ed9 global.location / global.navigator / global.document \u7b49\u8d4b\u503c\uff0c\u800c Loon \u7684
   \u5168\u5c40\u5bf9\u8c61\u4e0a\u8fd9\u4e9b\u662f\u539f\u751f accessor \u2014\u2014 \u5176 setter \u4f1a\u628a\u8d4b\u503c\u5f53 URL \u89e3\u6790\uff0c\u8d4b\u4e00\u4e2a\u5bf9\u8c61\u5c31\u4f1a\u629b
   "Invalid URL"\uff0c\u76f4\u63a5\u6253\u65ad loadWasmEnv()\u3002Proxy \u7684 set \u9677\u9631\u6539\u7528 defineProperty \u5f3a\u5236
   \u5199\u6210\u53ef\u5199\u6570\u636e\u5c5e\u6027\uff0c\u7ed5\u8fc7\u539f\u751f setter\uff1b\u5373\u4fbf defineProperty \u5931\u8d25\u4e5f\u7edd\u4e0d\u629b\u9519\u3002 */
var global = (typeof Proxy === 'function') ? new Proxy(__G, {
  set: function (t, k, v) {
    try {
      Object.defineProperty(t, k, { value: v, writable: true, enumerable: true, configurable: true });
      return true;
    } catch (e) {
      try { t[k] = v; } catch (e2) {
        try { if (typeof __pushLog === 'function') __pushLog(['  [global \u515c\u5e95] ' + String(k) + ' \u8d4b\u503c\u5931\u8d25: ' + (e2 && e2.message)]); } catch (_e) {}
      }
      return true;
    }
  },
  get: function (t, k) { return t[k]; },
  has: function (t, k) { return k in t; },
  deleteProperty: function (t, k) { try { delete t[k]; } catch (e) {} return true; },
  ownKeys: function (t) { return Reflect.ownKeys(t); },
  getOwnPropertyDescriptor: function (t, k) { return Object.getOwnPropertyDescriptor(t, k); }
}) : __G;

/* ---------- \u00a71c \u6781\u7b80 DEFLATE \u89e3\u538b\uff08gzip / zlib / raw\uff09----------
 * \u7528\u9014\uff1a\u8d44\u4ea7\u4ece CDN \u62c9\u56de\u65f6\u53ef\u80fd\u88ab\u670d\u52a1\u7aef\u538b\u7f29\uff0c\u800c Loon \u7684 fetch \u672a\u5fc5\u81ea\u52a8\u89e3\u538b\u3002
 * \u53ea\u5728\u68c0\u6d4b\u5230\u538b\u7f29\u9b54\u6570\u65f6\u542f\u7528\uff0c\u6b63\u5e38\u60c5\u51b5\u4e0b\u4e0d\u53c2\u4e0e\u3002\u5df2\u5bf9\u4e09\u4e2a\u8d44\u4ea7\u5168\u91cf\u6821\u9a8c\u3002 */
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
  /* \u539f\u751f TextDecoder \u5728 JSC \u91cc\u662f C++ \u5b9e\u73b0\u7684\uff0c\u6bd4\u4e0b\u9762\u9010\u5b57\u8282\u5faa\u73af\u5feb\u4e00\u4e2a\u6570\u91cf\u7ea7\u3002
   * 283KB \u7684 mpaas \u6a21\u5757\u5728 Node \u91cc\u624b\u5199\u5faa\u73af\u5c31\u8981 1.2 \u79d2\uff0cJSC \u91cc\u66f4\u6162 \u2014\u2014 \u4f18\u5148\u8d70\u539f\u751f\u3002 */
  try {
    if (typeof TextDecoder === 'function') {
      return new TextDecoder('utf-8').decode(u8);
    }
  } catch (e) { /* \u843d\u5230\u624b\u5199\u5faa\u73af */ }
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

/* ---------- \u00a73  Buffer \u57ab\u7247\uff08Uint8Array \u5b50\u7c7b\u8bed\u4e49\uff09------------------------- */
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

/* ---------- \u00a74  \u6293\u53d6\u539f\u751f\u80fd\u529b\uff08\u5fc5\u987b\u5728\u539f\u811a\u672c\u6539\u5199 global.fetch \u4e4b\u524d\uff09--------- */
var __NATIVE_FETCH = (typeof fetch !== 'undefined') ? fetch : null;
var __NATIVE_ST = (typeof setTimeout !== 'undefined') ? setTimeout : null;
var __NATIVE_CT = (typeof clearTimeout !== 'undefined') ? clearTimeout : null;

/* setTimeout \u8fd4\u56de\u503c\u7684 .unref() \u2014\u2014 \u539f\u811a\u672c\u5bf9\u770b\u95e8\u72d7\u5b9a\u65f6\u5668\u8c03\u4e86\u5b83\uff0cJSC \u8fd4\u56de\u6570\u5b57\u4f1a\u70b8 */
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
} catch (e) { /* \u515c\u5e95\uff1a\u4e0b\u9762\u8fd8\u6709\u4e00\u5c42 */ }

/* ---------- \u00a74b \u5b9a\u65f6\u5668\u5305\u88c5 ----------
   \u65e0\u8bba Loon \u539f\u751f setTimeout \u8fd4\u56de\u4ec0\u4e48(\u6570\u5b57/\u5bf9\u8c61/undefined)\uff0c\u5305\u88c5\u540e\u8fd4\u56de\u503c\u6c38\u8fdc\u5e26
   .unref()/.ref()/.close()\u3002\u539f\u811a\u672c\u5bf9\u770b\u95e8\u72d7\u5b9a\u65f6\u5668\u8c03\u4e86 .unref()\uff0c
   JSC \u8fd4\u56de undefined \u65f6\u4f1a\u629b TypeError\uff0c\u4e14\u88ab Promise \u94fe\u9759\u9ed8\u541e\u6389\u3002 */
var __NATIVE_SI = (typeof setInterval !== 'undefined') ? setInterval : null;
var __NATIVE_CI = (typeof clearInterval !== 'undefined') ? clearInterval : null;
(function () {
  function wrapTimer(nativeId, clearFn) {
    var o = {
      _id: nativeId,
      unref: function () { return o; },
      ref: function () { return o; },
      hasRef: function () { return true; },
      refresh: function () { return o; },
      close: function () { try { if (clearFn && nativeId != null) clearFn(nativeId); } catch (e) {} }
    };
    return o;
  }
  function unwrap(t) {
    return (t && typeof t === 'object' && t._id !== undefined) ? t._id : t;
  }
  if (__NATIVE_ST) {
    __G.setTimeout = function (fn, ms) {
      var rest = Array.prototype.slice.call(arguments, 2);
      var id = __NATIVE_ST(function () {
        try { fn.apply(null, rest); }
        catch (e) { try { if (typeof __pushLog === 'function') __pushLog(['[timer \u56de\u8c03\u5f02\u5e38] ' + (e && e.message ? e.message : e)]); } catch (_e) {} }
      }, ms);
      return wrapTimer(id, __NATIVE_CT);
    };
  }
  if (__NATIVE_SI) {
    __G.setInterval = function (fn, ms) {
      var rest = Array.prototype.slice.call(arguments, 2);
      var id = __NATIVE_SI(function () {
        try { fn.apply(null, rest); }
        catch (e) { try { if (typeof __pushLog === 'function') __pushLog(['[interval \u56de\u8c03\u5f02\u5e38] ' + (e && e.message ? e.message : e)]); } catch (_e) {} }
      }, ms);
      return wrapTimer(id, __NATIVE_CI);
    };
  }
  if (__NATIVE_CT) __G.clearTimeout = function (t) { try { __NATIVE_CT(unwrap(t)); } catch (e) {} };
  if (__NATIVE_CI) __G.clearInterval = function (t) { try { __NATIVE_CI(unwrap(t)); } catch (e) {} };
})();

var __NATIVE_URL = (typeof URL !== 'undefined' && URL) ? URL : null;   // \u4fdd\u7559\u539f\u751f, \u4f9b\u63a2\u9488\u6bd4\u5bf9

/* ---------- \u00a74c URL \u515c\u5e95 ----------
   \u539f\u811a\u672c\u7b2c 174 \u884c `new URL(opts.url)` \u89e3\u6790\u8bf7\u6c42\u5730\u5740\u3002Loon \u7684\u539f\u751f URL \u5bf9
   \u76f8\u5bf9\u8def\u5f84/\u5f02\u5e38\u4e32\u4f1a\u629b TypeError: Invalid URL\uff0c\u76f4\u63a5\u6253\u65ad main()\u3002
   \u8fd9\u91cc\u5305\u4e00\u5c42\uff1a\u5148\u8bd5\u539f\u751f\uff1b\u5931\u8d25\u5219\u6309 base \u81ea\u884c\u89e3\u6790\uff1b\u6c38\u4e0d\u629b\u3002 */
(function () {
  var __BASE = 'https://h5.bestpay.cn/';
  var __RealURL = (typeof URL !== 'undefined' && URL) ? URL : null;
  var __RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\/:?#]*)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/;

  function __abs(s, base) {
    s = String(s == null ? '' : s);
    if (__RE.test(s)) return s;
    var origin = __BASE.replace(/\/+$/, '');
    if (base) {
      var bm = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\/:?#]*)(?::(\d+))?/.exec(String(base));
      if (bm) origin = bm[1] + '://' + bm[2] + (bm[3] ? ':' + bm[3] : '');
    }
    if (!s) return origin + '/';
    if (s.charAt(0) === '/') return origin + s;
    return origin + '/' + s;
  }

  function __parse(href, base) {
    var s = __abs(href, base);
    var m = __RE.exec(s) || __RE.exec(__BASE);
    var p = m[3] || '';
    return {
      protocol: m[1] + ':', hostname: m[2], port: p, host: p ? m[2] + ':' + p : m[2],
      pathname: m[4] || '/', search: m[5] || '', hash: m[6] || '', origin: m[1] + '://' + m[2] + (p ? ':' + p : ''),
      href: m[1] + '://' + m[2] + (p ? ':' + p : '') + (m[4] || '/') + (m[5] || '') + (m[6] || ''),
      searchParams: { get: function () { return null; }, has: function () { return false; } },
      toString: function () { return this.href; }
    };
  }

  function URLShim(href, base) {
    var raw = String(href == null ? '' : href);
    if (__RealURL) {
      try { return (base !== undefined) ? new __RealURL(href, base) : new __RealURL(href); }
      catch (e) { /* \u843d\u5230\u81ea\u5e26\u89e3\u6790 */ }
    }
    try { if (typeof __pushLog === 'function') __pushLog(['  [URL\u515c\u5e95] \u539f\u751f\u62d2\u7edd "' + raw.slice(0, 140) + '", \u6309 ' + __BASE + ' \u89e3\u6790']); } catch (_e) {}
    return __parse(raw, base);
  }
  if (__RealURL) {
    try { URLShim.createObjectURL = __RealURL.createObjectURL; } catch (e) {}
    try { URLShim.revokeObjectURL = __RealURL.revokeObjectURL; } catch (e) {}
    try { URLShim.canParse = __RealURL.canParse; } catch (e) {}
  }
  URLShim.__parseFallback = __parse;
  __G.URL = URLShim;
})();

/* URL \u2014\u2014 Loon \u82e5\u5b8c\u5168\u6ca1\u81ea\u5e26\uff0c\u624d\u7528\u6700\u7b80\u7248\uff08\u4e0a\u9762\u7684\u515c\u5e95\u5df2\u8986\u76d6\u7edd\u5927\u591a\u6570\u60c5\u51b5\uff09 */
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

/* ---------- \u00a75  \u65e5\u5fd7\u7f13\u51b2\uff08\u8fd0\u884c\u7ed3\u675f\u6c47\u603b\u63a8\u9001\uff09------------------------------ */
var __LOG = [];
var __CONSOLE_LOG = (typeof console !== 'undefined' && console.log) ? console.log : function () {};

/* \u9632\u5fa1\uff1aLoon \u7684 console \u82e5\u7f3a info/debug/trace\uff0cmpaas \u6a21\u5757\u5185\u90e8 (console)['info'].apply \u4f1a\u5d29 */
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

/* ---------- \u00a76b  Date.toTimeString \u515c\u5e95 ----------------------------------
 * \u6b63\u6587 log() \u7b2c\u4e00\u4ef6\u4e8b\u5c31\u662f new Date().toTimeString().slice(0,8)\u3002
 * \u82e5\u5b83\u5728\u5bbf\u4e3b JSC \u91cc\u629b\u9519: main() \u5728\u7b2c\u4e00\u6761\u65e5\u5fd7\u524d\u5c31 reject, .catch \u91cc\u518d\u8c03 log()
 * \u53c8\u629b \u2192 rejection \u65e0\u4eba\u63a5\u88ab\u9759\u9ed8\u541e\u6389 \u2192 \u8868\u73b0\u4e3a"\u65e0\u4efb\u4f55\u6b63\u6587\u65e5\u5fd7 + \u5fc3\u8df3\u8fd8\u5728\u8df3"\u3002
 * \u76f4\u63a5\u7528\u672c\u5730\u5b9e\u73b0\u8986\u76d6, \u6c38\u4e0d\u629b\u9519\uff08\u8f93\u51fa\u683c\u5f0f\u4e0e\u539f\u751f\u4e00\u81f4\u7684\u524d 8 \u4f4d\uff09\u3002
 * ------------------------------------------------------------------------ */
(function () {
  function __tts() {
    try {
      var d = this, p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' GMT+0800';
    } catch (e) { return '00:00:00'; }
  }
  try { Date.prototype.toTimeString = __tts; } catch (e) {}
})();

/* ---------- \u00a76  Loon \u6301\u4e45\u5316\uff08\u66ff\u4ee3 ~/.bestpay_*.json\uff09--------------------- */
var __STORE = {
  get: function (k) { try { return (typeof $persistentStore !== 'undefined') ? $persistentStore.read(k) : null; } catch (e) { return null; } },
  set: function (k, v) { try { if (typeof $persistentStore !== 'undefined') $persistentStore.write(String(v), k); } catch (e) {} },
  del: function (k) { try { if (typeof $persistentStore !== 'undefined') $persistentStore.write(null, k); } catch (e) {} },
};

/* ---------- \u00a77  \u914d\u7f6e\uff1a\u5168\u90e8\u8bfb $persistentStore \u952e --------------------------
 * Loon \u4e0d\u8ba4 "--xxx" \u8fd9\u79cd\u547d\u4ee4\u884c\u53c2\u6570, \u6240\u4ee5\u8fd0\u884c\u914d\u7f6e\u6539\u6210:
 *   \u811a\u672c\u9876\u90e8 BP_SETUP \u914d\u7f6e\u5757   <-- \u4f60\u7684\u7f16\u8f91\u9762(\u975e\u7a7a\u5373\u751f\u6548)
 *   \u5b58\u50a8\u952e bp_conf            <-- \u8fd0\u884c\u65f6\u5feb\u7167 + \u7f3a\u7701\u8865\u4f4d
 * \u518d\u628a\u914d\u7f6e**\u53cd\u5411\u62fc\u6210 process.argv**, \u539f\u811a\u672c\u4f53\u4e00\u884c\u90fd\u4e0d\u7528\u6539.
 * ------------------------------------------------------------------------ */
var __DEFAULT_CONF = {
  assets: '',
  phones: [],
  mode: 'all',
  code: '',
  tasks: ['ad_show', 'ad_click', 'drama'],
  max: 3,
  dryRun: false,
  bark: ''
};

function __has(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function __hash(s) { var h = 5381, i; for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); }

/* ---- \u4e00\u6b21\u6027\u53c2\u6570(\u624b\u52a8\u8fd0\u884c\u65f6\u624d\u53ef\u80fd\u6709): \u4f18\u5148\u7ea7\u6700\u9ad8, \u5e76\u5199\u56de\u5b58\u50a8\u952e ---- */
var __ARG_RAW = '';
try { if (typeof $argument !== 'undefined' && $argument != null) __ARG_RAW = String($argument); } catch (e) {}
if (!__ARG_RAW) { try { if (typeof $script !== 'undefined' && $script && $script.argument) __ARG_RAW = String($script.argument); } catch (e) {} }

var __ARGOVR = (function () {
  if (!__ARG_RAW) return null;
  var t = __ARG_RAW.split(/\s+/).filter(function (x) { return x.length; }), o = {}, i, v;
  function val(i) { return (i + 1 < t.length && t[i + 1].charAt(0) !== '-') ? t[i + 1] : ''; }
  for (i = 0; i < t.length; i++) {
    v = t[i];
    if (v === '--all') o.mode = 'all';
    else if (v === '--login') o.mode = 'login';
    else if (v === '--send-sms') o.mode = 'send-sms';
    else if (v === '--dry-run') o.dryRun = true;
    else if (v === '--phone') { o.phones = [val(i)]; i++; }
    else if (v === '--code' || v === '--sms-code') { o.code = val(i); i++; }
    else if (v === '--max') { o.max = parseInt(val(i), 10); i++; }
    else if (v === '--tasks') { o.tasks = val(i).split(','); i++; }
    else if (v === '--bark') { o.bark = val(i); i++; }
    else if (v === '--assets') { o.assets = val(i); i++; }
  }
  return o;
})();

var __CONF = (function () {
  var saved = {};
  try { saved = JSON.parse(__STORE.get('bp_conf') || '{}') || {}; } catch (e) { saved = {}; }
  var local = (typeof BP_SETUP !== 'undefined' && BP_SETUP && typeof BP_SETUP === 'object') ? BP_SETUP : {};
  var hash = __hash(JSON.stringify(local));
  var prev = '';
  try { prev = String(__STORE.get('bp_conf_hash') || ''); } catch (e) {}
  /* \u914d\u7f6e\u5757\u5185\u5bb9\u53d8\u4e86 -> \u4ee5\u5757\u4e3a\u51c6; \u6ca1\u53d8 -> \u4ee5\u5b58\u50a8\u952e\u4e3a\u51c6(\u811a\u672c\u81ea\u5df1\u6539\u7684\u72b6\u6001\u624d\u7559\u5f97\u4f4f) */
  var byBlock = (hash !== prev) || __ARGOVR;
  var c = {}, k, src;
  for (k in __DEFAULT_CONF) {
    if (__ARGOVR && __has(__ARGOVR[k])) src = __ARGOVR[k];
    else if (byBlock) src = __has(local[k]) ? local[k] : (__has(saved[k]) ? saved[k] : __DEFAULT_CONF[k]);
    else src = __has(saved[k]) ? saved[k] : (__has(local[k]) ? local[k] : __DEFAULT_CONF[k]);
    c[k] = src;
  }
  c.dryRun = (__ARGOVR && __ARGOVR.dryRun === true) || (byBlock ? local.dryRun === true
    : (saved.dryRun === true || (saved.dryRun == null && local.dryRun === true)));
  c.max = parseInt(c.max, 10) || 3;
  try { __STORE.set('bp_conf', JSON.stringify(c)); } catch (e) {}
  try { __STORE.set('bp_conf_hash', hash); } catch (e) {}
  if (typeof __ARGOVR === 'object') { try { __STORE.set('bp_setup_by', 'arg'); } catch (e) {} }
  return c;
})();

/* \u8d44\u4ea7\u57fa\u5740\u6e05\u5355: \u914d\u7f6e\u5757/\u5b58\u50a8\u952e\u91cc\u7684 base \u4f18\u5148, \u5176\u540e\u63a5\u5185\u7f6e\u955c\u50cf */
var __ASSET_BASES = (function () {
  var base = String(__CONF.assets || '').replace(/\/+$/, '');
  if (!base) { try { base = String(__STORE.get('bp_assets') || '').replace(/\/+$/, ''); } catch (e) {} }
  var out = [];
  if (base && base.indexOf('%%') !== 0) {
    out.push(base);
    try { __STORE.set('bp_assets', base); } catch (e) {}
  }
  __ASSET_MIRRORS.forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); });
  return out;
})();

/* \u914d\u7f6e -> process.argv. \u539f\u811a\u672c\u4f53\u7167\u65e7\u89e3\u6790 argv, \u4e00\u884c\u90fd\u4e0d\u7528\u52a8. */
var __ARGV = (function () {
  var c = __CONF, env = {}, args = [];
  var mode = String(c.mode || 'all').toLowerCase();

  var phones = (Array.isArray(c.phones) ? c.phones : String(c.phones || '').split(/[,\s]+/))
    .map(function (p) { return String(p).replace(/\D/g, ''); })
    .filter(function (p) { return /^1\d{10}$/.test(p); });

  if (mode === 'send-sms') {
    args.push('--send-sms');
    if (phones[0]) { args.push('--phone', phones[0]); env.BESTPAY_PHONE = phones[0]; }
  } else if (mode === 'login') {
    args.push('--login');
    if (phones[0]) { args.push('--phone', phones[0]); env.BESTPAY_PHONE = phones[0]; }
    if (__has(c.code)) { var cd = String(c.code).trim(); args.push('--code', cd); env.BESTPAY_SMS_CODE = cd; }
  } else if (mode === 'phone') {
    if (phones[0]) { args.push('--phone', phones[0]); env.BESTPAY_PHONE = phones[0]; }
  } else {
    args.push('--all');                       // \u65e5\u5e38: \u6240\u6709\u5df2\u4fdd\u5b58\u8d26\u53f7
  }

  var tasks = (Array.isArray(c.tasks) ? c.tasks : String(c.tasks || '').split(','))
    .map(function (s) { return String(s).trim(); }).filter(Boolean);
  if (tasks.length && tasks.join(',') !== 'ad_show,ad_click,drama') args.push('--tasks', tasks.join(','));

  var mx = parseInt(c.max, 10);
  if (mx >= 1 && mx !== 3) args.push('--max', String(mx));
  if (c.dryRun === true) args.push('--dry-run');

  var bark = String(c.bark || '');
  if (!bark) { try { bark = String(__STORE.get('bp_bark') || ''); } catch (e) {} }
  if (bark) env.BESTPAY_BARK_KEY = bark;

  return { args: args.length ? args : ['--all'], env: env };
})();

/* ---------- \u00a78  \u8d44\u4ea7\uff1a\u9884\u8f7d + \u7f13\u5b58 ---------------------------------------- */
var __ASSETS = {};

/* \u5355\u4e2a URL \u5e26\u8d85\u65f6\u7684 fetch\uff1b\u8d85\u65f6/\u5931\u8d25\u90fd reject\uff0c\u4ea4\u7ed9\u4e0a\u5c42\u6362\u955c\u50cf */
function __fetchOne(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return; done = true;
      reject(new Error('\u8d85\u65f6' + timeoutMs + 'ms'));
    }, timeoutMs);
    Promise.resolve()
      .then(function () { return __NATIVE_FETCH(url, { cache: 'no-store' }); })
      .then(function (r) {
        if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status));
        return r.arrayBuffer();
      })
      .then(function (ab) { if (done) return; done = true; clearTimeout(timer); resolve(ab); })
      .catch(function (e) { if (done) return; done = true; clearTimeout(timer); reject(e); });
  });
}

/* \u5148\u7528\u6700\u5c0f\u7684\u5206\u5757\u63a2\u6d3b\uff0c\u627e\u5230\u7b2c\u4e00\u4e2a\u53ef\u7528\u955c\u50cf\uff0c\u518d\u7528\u5b83\u62c9\u5168\u90e8\u5206\u5757 */
function __resolveBase() {
  var i = 0;
  function attempt() {
    if (i >= __ASSET_BASES.length) return Promise.reject(new Error('\u6240\u6709\u955c\u50cf\u5747\u4e0d\u53ef\u7528'));
    var b = __ASSET_BASES[i++];
    return __fetchOne(b + '/' + __PART_DIR + '/' + __ASSET_FILE.wbaes + '.p0', 15000).then(function () {
      __pushLog(['  \u955c\u50cf\u53ef\u7528 [' + i + '/' + __ASSET_BASES.length + '] ' + b]);
      return b;
    }).catch(function (e) {
      __pushLog(['  \u955c\u50cf\u5931\u8d25 [' + i + '/' + __ASSET_BASES.length + '] ' + b + ' : ' + (e && e.message ? e.message : e)]);
      return attempt();
    });
  }
  return attempt();
}

/* \u7b80\u6613\u5e76\u53d1\u6c60\uff1a\u6700\u591a n \u4e2a\u4efb\u52a1\u540c\u65f6\u8dd1 */
function __pool(jobs, n) {
  var out = new Array(jobs.length), idx = 0, running = 0, failed = false, done = 0;
  return new Promise(function (resolve, reject) {
    function step() {
      if (failed) return;
      if (idx >= jobs.length && running === 0) {
        if (typeof __DBG_TRACE === 'function') __DBG_TRACE('\u6c60\u6392\u7a7a ' + done + '/' + jobs.length);
        return resolve(out);
      }
      while (running < n && idx < jobs.length) {
        (function (i) {
          running++; idx++;
          Promise.resolve().then(jobs[i]).then(function (v) {
            out[i] = v; running--; done++;
            if (typeof __DBG_TRACE === 'function') __DBG_TRACE('\u5206\u5757 ' + done + '/' + jobs.length + ' \u5b8c\u6210');
            step();
          }, function (e) {
            if (!failed) { failed = true; reject(e); }
          });
        })(idx);
      }
    }
    step();
  });
}

/* \u6240\u6709\u5206\u5757\u644a\u5e73\u6210\u4e00\u5f20\u4efb\u52a1\u8868\uff0c\u7edf\u4e00\u5e76\u53d1\u9650\u6d41\u62c9\u53d6\uff0c\u518d\u6309\u8d44\u4ea7\u62fc\u88c5 */
function __preloadAssets() {
  return __resolveBase().then(function (base) {
    var jobs = [];
    Object.keys(__ASSET_PARTS).forEach(function (k) {
      var n = __ASSET_PARTS[k], f = __ASSET_FILE[k], i;
      for (i = 0; i < n; i++) {
        (function (k, f, i) {
          jobs.push(function () {
            return __fetchOne(base + '/' + __PART_DIR + '/' + f + '.p' + i, 25000)
              .then(function (ab) { return { k: k, i: i, buf: ab }; });
          });
        })(k, f, i);
      }
    });
    return __pool(jobs, __CONCURRENCY).then(function (res) {
      var byKey = {};
      res.forEach(function (r) { (byKey[r.k] = byKey[r.k] || [])[r.i] = new Uint8Array(r.buf); });
      Object.keys(__ASSET_PARTS).forEach(function (k) {
        var chunks = byKey[k] || [], total = 0, j;
        for (j = 0; j < __ASSET_PARTS[k]; j++) {
          if (!chunks[j]) throw new Error('\u7f3a\u5757 ' + k + ' p' + j);
          total += chunks[j].length;
        }
        if (total !== __ASSET_SIZE[k]) {
          throw new Error('\u62fc\u63a5\u5927\u5c0f\u4e0d\u7b26 ' + k + ': ' + total + ' != ' + __ASSET_SIZE[k]);
        }
        var u8 = new Uint8Array(total), off = 0;
        for (j = 0; j < chunks.length; j++) { u8.set(chunks[j], off); off += chunks[j].length; }
        u8 = __INFLATE.maybe(u8);   // \u539f\u59cb\u6570\u636e\u539f\u6837\u8fd4\u56de\uff08\u6362\u56de gz \u4e5f\u80fd\u7528\uff09
        __ASSETS[k] = (k === 'mpaas') ? __utf8Decode(u8) : u8;
        __pushLog(['  \u8d44\u4ea7 ' + k + ': ' + chunks.length + '\u5757/' + total + 'B -> ' + u8.length + ' \u5b57\u8282']);
      });
      if (typeof __DBG_TRACE === 'function') __DBG_TRACE('\u8d44\u4ea7\u88c5\u914d\u5b8c\u6210, \u5373\u5c06\u8fdb\u5165\u6b63\u6587');
    });
  });
}

function __asset(name) {
  if (__ASSETS[name]) return __ASSETS[name];
  throw new Error('\u8d44\u4ea7\u672a\u9884\u8f7d: ' + name);
}

/* ---------- \u00a79  fs / path / os \u57ab\u7247 ------------------------------------- */
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
    /* \u65e5\u5fd7\u6587\u4ef6\u7b49\uff1a\u76f4\u63a5\u4e22\u8fdb Loon \u65e5\u5fd7 */
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

/* ---------- \u00a710 zlib \u57ab\u7247\uff08\u81ea\u5e26 inflate \u5b9e\u73b0\uff09--------------------------- */
var __ZLIB = {
  gunzipSync: function (b) { return __mkBuf(__INFLATE.maybe(b instanceof Uint8Array ? b : new Uint8Array(b))); },
  inflateSync: function (b) { return __mkBuf(__INFLATE.maybe(b instanceof Uint8Array ? b : new Uint8Array(b))); },
  inflateRawSync: function (b) { return __mkBuf(__INFLATE.inflate(b instanceof Uint8Array ? b : new Uint8Array(b), 0)); },
  deflateSync: function () { throw new Error('zlib.deflateSync \u672a\u5b9e\u73b0\uff08\u672c\u811a\u672c\u672a\u4f7f\u7528\uff09'); },
  gzipSync: function () { throw new Error('zlib.gzipSync \u672a\u5b9e\u73b0\uff08\u672c\u811a\u672c\u672a\u4f7f\u7528\uff09'); },
};

/* ---------- \u00a711 https \u57ab\u7247\uff08\u57fa\u4e8e\u539f\u751f fetch\uff0c\u4e8c\u8fdb\u5236\u4fdd\u771f\uff09------------------ */
/* \u5b9e\u6d4b\u7ed3\u8bba\uff1a$httpClient \u5b57\u7b26\u4e32 body \u4f1a\u88ab UTF-8 \u6491\u7206\uff0cArrayBuffer \u4f1a\u88ab\u5b57\u7b26\u4e32\u5316\uff0c
 *           \u53ea\u6709\u539f\u751f fetch \u7684 Uint8Array body \u5b57\u8282\u7ea7\u4fdd\u771f \u2014\u2014 \u6545\u8d70 fetch\u3002      */
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
        if (errCb) errCb(new Error('Loon \u73af\u5883\u7f3a\u5c11\u539f\u751f fetch\uff0c\u65e0\u6cd5\u8054\u7f51'));
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

/* ---------- \u00a712 readline / child_process \u57ab\u7247 ---------------------------- */
var __READLINE = {
  createInterface: function () {
    return {
      question: function (q, cb) {
        if (__ARGV.code) { cb(__ARGV.code); return; }
        throw new Error(
          'Loon \u65e0\u6cd5\u4ea4\u4e92\u8f93\u5165\u9a8c\u8bc1\u7801\u3002\u8bf7\u628a\u9a8c\u8bc1\u7801\u5199\u8fdb [Task] \u7684 argument\uff0c\u4f8b\u5982\uff1a\n' +
          '  argument="--login --phone \u4f60\u7684\u624b\u673a\u53f7 --code 123456"'
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

/* ---------- \u00a713 process / require ---------------------------------------- */
var __EXITED = false;
var __WATCHDOG = null;
function __finish() {
  if (__EXITED) return;
  __EXITED = true;
  if (__WATCHDOG) { try { __NATIVE_CT(__WATCHDOG); } catch (e) {} __WATCHDOG = null; }
  var tail = __LOG.slice(-24).join('\n');
  if (tail && __ARGV.args.indexOf('--quiet') < 0) {
    try { $notification.post('\u7ffc\u652f\u4ed8\u5237\u91d1\u5e01', __ARGV.args.join(' ') || '(\u9ed8\u8ba4)', tail); } catch (e) {}
  }
  try { $done({}); } catch (e) {}
}

__WATCHDOG = __NATIVE_ST(function () {
  __pushLog(['[\u770b\u95e8\u72d7] \u8fd0\u884c\u8d85\u65f6(180s)\uff0c\u5f3a\u5236\u6536\u5c3e']);
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

/* \u9996\u6b21\u4f7f\u7528/\u65e0\u8d26\u53f7\u65f6\u8865\u4e00\u53e5\u4eba\u8bdd\u63d0\u793a(\u539f\u811a\u672c\u4f53\u91cc\u7684\u63d0\u793a\u8fd8\u662f\u8001\u547d\u4ee4\u884c\u5199\u6cd5, \u4e0d\u6539\u6b63\u6587) */
(function () {
  var __origPush = __pushLog, __hinted = false;
  __pushLog = function (parts) {
    try {
      var s = Array.prototype.join.call(parts, ' ');
      if (!__hinted && (s.indexOf('\u65e0\u6709\u6548 session') >= 0 || s.indexOf('\u65e0\u6709\u6548sess') >= 0)) {
        __hinted = true;
        __origPush(['', '===== \u600e\u4e48\u914d\u7f6e =====',
          '1) \u7528\u7f16\u8f91\u5668\u6253\u5f00 bestpay_loon.js \u9876\u90e8\u7684 BP_SETUP \u914d\u7f6e\u5757',
          '2) phones \u586b\u624b\u673a\u53f7, mode \u6539\u6210 "send-sms", \u8dd1\u4e00\u6b21\u6536\u77ed\u4fe1\u9a8c\u8bc1\u7801',
          '3) mode \u6539\u6210 "login", \u628a\u9a8c\u8bc1\u7801\u586b\u8fdb code, \u518d\u8dd1\u4e00\u6b21\u5b8c\u6210\u767b\u5f55',
          '4) mode \u6539\u56de "all", \u4e4b\u540e\u6bcf\u5929\u81ea\u52a8\u8dd1']);
      }
    } catch (e) {}
    return __origPush(parts);
  };
})();

/* ==== \u539f\u811a\u672c\u6b63\u6587\u5f00\u59cb\uff08\u9010\u5b57\u4fdd\u7559\uff09==== */
Promise.resolve().then(function () { return __preloadAssets(); }).then(function () {
if (typeof __DBG_TRACE === 'function') __DBG_TRACE('\u6b63\u6587\u5f00\u59cb\u6267\u884c');
/**
 * \u7ffc\u652f\u4ed8 \u00b7 \u8d5a\u91d1\u5e01 \u5b9a\u65f6\u4efb\u52a1\u811a\u672c (Mac launchd)
 * \u8fdb\u7a0b\u5185\u52a0\u8f7d\u4e00\u6b21 wasm, \u5185\u8054\u8c03\u63a5\u53e3. \u8986\u76d6:
 *   - \u7b7e\u5230 signIn
 *   - AD_show \u770b\u89c6\u9891 (+6000/\u6b21, \u6bcf\u65e510\u6b21\u4e0a\u9650)
 *   - AD_click \u70b9\u5e7f\u544a (+10/\u6b21, \u6bcf\u65e520\u6b21\u4e0a\u9650)
 *   - DRAMA_DURATION \u77ed\u5267 (+50/\u6b21, \u6bcf\u65e53\u6b21\u4e0a\u9650)
 * \u7279\u6027: \u5206\u6279 + \u968f\u673a\u5ef6\u65f6(\u77ed) + \u786c\u8d85\u65f6\u9632\u5361\u6b7b + \u65ad\u70b9\u7eed\u8dd1
 *
 * \u7528\u6cd5\uff1a
 *   node bestpay_task_scheduler.cjs --login --phone 13800000000   # \u624b\u673a\u53f7\u77ed\u4fe1\u767b\u5f55(\u5b58 session)
 *   node bestpay_task_scheduler.cjs --login --phone 13800000000 --code 123456  # \u975e\u4ea4\u4e92\u767b\u5f55(\u9762\u677f\u4e24\u6b65)
 *   node bestpay_task_scheduler.cjs --send-sms --phone 13800000000            # \u53ea\u53d1\u77ed\u4fe1, \u62ff smsUid
 *   node bestpay_task_scheduler.cjs --all               # \u6240\u6709 session \u8d26\u53f7
 *   node bestpay_task_scheduler.cjs --phone 13800000000 # \u6307\u5b9a\u8d26\u53f7
 *   node bestpay_task_scheduler.cjs --tasks ad_show,ad_click,drama   # \u6307\u5b9a\u4efb\u52a1
 *   node bestpay_task_scheduler.cjs --dry-run           # \u53ea\u67e5\u4e0d\u62a5
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
  // \u624b\u673a\u53f7\u77ed\u4fe1\u767b\u5f55 (LoginEvent \u94fe)
  sendSms: 'com.bestpay.mobile.service.account.prd.event.LoginEvent.sendSmsVerifyCode',
  verifySms: 'com.bestpay.mobile.service.account.prd.event.LoginEvent.authSmsVerifyCode',
};

// ============ \u8131\u654f\u914d\u7f6e ============
// \u9ed8\u8ba4\u624b\u673a\u53f7\u6539\u4e3a\u5360\u4f4d\u7b26; \u8fd0\u884c\u65f6\u7528 --phone / BESTPAY_PHONE / \u73af\u5883\u8986\u76d6
const MASK_PHONE = '13800000000';                 // \u5360\u4f4d\u793a\u4f8b\u53f7
const PHONE_RE = /^1\d{10}$/;
// \u624b\u673a\u53f7\u6253\u7801: 138****0000
function maskPhone(p) {
  const s = String(p || '');
  return PHONE_RE.test(s) ? s.slice(0, 3) + '****' + s.slice(7) : (s ? '***' : '');
}
function normalizePhone(p) {
  const s = String(p || '').trim();
  if (PHONE_RE.test(s)) return s;                 // 13800000000
  if (/^\+?86\d{11}$/.test(s)) return s.replace(/^\+?86/, '');  // +8613800000000 / 8613800000000
  return '';                                      // \u7a7a/\u65e0\u6548 \u2192 \u89c6\u4e3a\u65e0\u8d26\u53f7
}
function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (ans) => { rl.close(); resolve(String(ans || '').trim()); }));
}

// ============ \u57fa\u7840\u5c01\u88c5 (\u4e0e bestpay_task_test.cjs \u4e00\u81f4) ============
function log(...a) { console.log(new Date().toTimeString().slice(0, 8), ...a); }

// Bark \u63a8\u9001 (\u72ec\u7acb https \u8bf7\u6c42, \u4e0d\u4f9d\u8d56\u88ab wasm \u91cd\u5199\u7684 global.fetch)
// key \u540e\u7aef CF \u524d\u6321, \u9700\u6d4f\u89c8\u5668 UA \u5426\u5219 1010/403
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
      req.on('error', (e) => { log(`  [bark] \u5931\u8d25: ${e.message}`); resolve(0); });
      req.setTimeout(8000, () => { req.destroy(); resolve(0); });
    } catch (e) { log(`  [bark] \u5f02\u5e38: ${e.message}`); resolve(0); }
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
  if (!session || !session.loginToken) throw new Error('\u65e0 loginToken');
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
    // \u65e0\u6761\u4ef6\u7ee7\u627f\u65e7 couponClaimed(\u65e0\u8bba true/false/undefined),\u9632\u6b62\u7eed\u671f\u628a\u62a2\u5230\u72b6\u6001\u91cd\u7f6e\u4e22
    couponClaimed: session.couponClaimed,
    authSsuCode: AUTH_SSU,
    note: 'scheduler',
    updatedAt: new Date().toISOString(),
    __phone: session.__phone || session.productNo,
  };
  return s;
}

// ============ \u624b\u673a\u53f7\u77ed\u4fe1\u767b\u5f55 ============
// \u4e0e\u6743\u76ca\u5e01\u811a\u672c(bestpay_equity_coin_sniper.cjs)\u540c\u6b3e\u767b\u5f55\u94fe:
//   sendSmsVerifyCode -> authSmsVerifyCode -> authTokenLogin
// smsUid \u843d\u76d8\u5230 ~/.bestpay_sms_uid.json, \u652f\u6301"\u5148\u53d1\u77ed\u4fe1\u2192\u518d\u586b\u9a8c\u8bc1\u7801"\u7684\u9762\u677f\u4e24\u6b65\u6d41\u7a0b\u3002
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
  const phone = normalizePhone(phoneArg || await ask('\u8bf7\u8f93\u5165\u624b\u673a\u53f7: '));
  if (!phone) throw new Error('\u624b\u673a\u53f7\u65e0\u6548 (\u9700 11 \u4f4d: 1xxxxxxxxxx)');

  let smsUid = '';
  // \u5df2\u6709\u9a8c\u8bc1\u7801 + \u5df2\u5b58 smsUid \u2192 \u76f4\u63a5\u6821\u9a8c, \u4e0d\u518d\u53d1\u77ed\u4fe1 (\u9762\u677f\u4e24\u6b65)
  if (codeArg && !sendSmsOnly && fs.existsSync(SMS_UID_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SMS_UID_FILE, 'utf8'));
      if (saved && saved.phone === phone && saved.smsUid) {
        smsUid = saved.smsUid;
        log('\u590d\u7528\u5df2\u5b58 smsUid=', smsUid, 'phone=', maskPhone(phone));
      }
    } catch (_) {}
  }

  if (!smsUid) {
    log('\u53d1\u9001\u77ed\u4fe1 ->', maskPhone(phone));
    const sendRes = await rpc(MGS, OP.sendSms, loginParams({ productNo: phone }), loginExtra());
    const sd = parseRpcData(sendRes);
    smsUid = sd && sd.data && sd.data.t && sd.data.t.smsUid;
    if (!smsUid) throw new Error('\u53d1\u77ed\u4fe1\u5931\u8d25: ' + JSON.stringify(sd).slice(0, 300));
    log('\u5df2\u53d1\u7801 smsUid=', smsUid);
    try { fs.writeFileSync(SMS_UID_FILE, JSON.stringify({ phone, smsUid, at: new Date().toISOString() }, null, 2)); } catch (_) {}
  }

  if (sendSmsOnly) {
    log('send-sms-only ok, smsUid \u5df2\u5b58', SMS_UID_FILE);
    return { phone, smsUid, sendSmsOnly: true };
  }

  let code = codeArg;
  if (!code) code = await ask('\u8bf7\u8f93\u5165\u77ed\u4fe1\u9a8c\u8bc1\u7801: ');
  if (!/^\d{4,8}$/.test(code)) throw new Error('\u9a8c\u8bc1\u7801\u65e0\u6548');
  const verifyRes = await rpc(MGS, OP.verifySms, loginParams({
    verifyCode: code, smsUid, productNo: phone,
    issueSite: '0101', externalChannel: 'WECHAT', deviceId: phone,
    authPayChannel: '100005', regFrom: 'MINI_PROGRAM', deviceAttribute: '',
  }), loginExtra());
  const vd = parseRpcData(verifyRes);
  const t = (vd && vd.data && vd.data.t) || {};
  if (!t.sessionKey) throw new Error('\u767b\u5f55\u5931\u8d25: ' + JSON.stringify(vd).slice(0, 400));
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
  log('\u767b\u5f55\u6210\u529f', maskPhone(phone), String(s.sessionKey).slice(0, 12) + '...');
  return s;
}

function saveSession(s) {
  try {
    const all = readSessionsFile();
    const key = s.productNo || s.__phone;
    if (!key) return;
    all[key] = s;
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(all, null, 2));
    log('\u5df2\u4fdd\u5b58 session ->', SESSIONS_FILE, '(' + maskPhone(key) + ')');
  } catch (e) { log('\u4fdd\u5b58 session \u5931\u8d25:', e.message); }
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
// \u9886\u53d6\u4efb\u52a1\u5956\u52b1 (GET \u6a21\u5f0f\u91d1\u5e01\u4efb\u52a1\u5fc5\u987b\u663e\u5f0f\u9886\u53d6\u624d\u5230\u8d26)
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

// \u5b8c\u6574\u7b7e\u5230: queryPageConfig -> querySignInConfigInfo -> signIn
async function fullSignIn(MGS, session, appType = '117') {
  // 1. queryPageConfig \u62ff sceneCode
  const pc = await queryPageConfig(MGS, session, appType);
  const pcRes = pc && pc.data && (pc.data.t || pc.data.result);
  const sceneCode = pcRes && pcRes.signInSceneCode;
  if (!sceneCode) return { step: 'queryPageConfig', error: 'no sceneCode', raw: pc };
  // 2. querySignInConfigInfo \u62ff activityNo
  const ci = await querySignInConfigInfo(MGS, session, sceneCode, appType);
  const ciRes = ci && ci.data && (ci.data.t || ci.data.result);
  const info = ciRes && ciRes.signInActivityConfigInfo;
  const activityNo = info && info.activityNo;
  if (!activityNo) return { step: 'querySignInConfigInfo', sceneCode, error: 'no activityNo', raw: ci };
  // 3. signIn
  const si = await signIn(MGS, session, activityNo, appType);
  return { step: 'signIn', sceneCode, activityNo, raw: si };
}

// ============ \u5de5\u5177 ============
// \u8dd1\u6ee1\u540e\u505c\u6389 launchd \u8c03\u5ea6 (\u5f53\u5929\u4e0d\u518d\u89e6\u53d1); \u7531 com.bestpay.task.reset \u6bcf\u59290\u70b9\u91cd\u65b0 load
const SCHED_PLIST = path.join(os.homedir(), 'Library/LaunchAgents/com.bestpay.task.scheduler.plist');
function disableLaunchd(reason) {
  try {
    execSync('launchctl unload ' + SCHED_PLIST, { stdio: 'ignore' });
    log(`[\u505c\u8c03\u5ea6] ${reason} \u2192 \u5df2 unload com.bestpay.task.scheduler (\u660e\u59290\u70b9\u7531 reset \u6062\u590d)`);
    return true;
  } catch (e) {
    log(`[\u505c\u8c03\u5ea6] unload \u5931\u8d25: ${e.message}`);
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// \u786c\u8d85\u65f6\u5305\u88c5: \u9632\u5361\u6b7b, \u8d85\u65f6\u8fd4\u56de null
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('HARD_TIMEOUT ' + (label || '') + ' ' + ms + 'ms')), ms)),
  ]);
}
// \u968f\u673a\u5ef6\u65f6 [min, max] \u79d2
const randSleep = async (min, max) => {
  const ms = min * 1000 + Math.random() * ((max - min) * 1000);
  await sleep(Math.round(ms));
};

// \u4ece\u4efb\u52a1\u5217\u8868\u7ed3\u679c\u91cc\u53d6\u4efb\u52a1\u6570\u7ec4 (\u5b57\u6bb5\u540d missionList)
function extractTaskList(d) {
  if (!d) return [];
  const t = unwrap(d);
  const list = (t && t.missionList) || (d.data && d.data.result && d.data.result.missionList) || (d.data && d.data.t && d.data.t.missionList) || [];
  return Array.isArray(list) ? list : [];
}
// \u4ece\u91d1\u989d\u4e3b\u9875\u53d6 configNo
function extractConfigNo(mi) {
  const t = mi && unwrap(mi);
  return (t && t.configNo) || '';
}

// ============ \u5355\u8d26\u53f7\u5237\u4efb\u52a1 ============
// \u4efb\u52a1\u7c7b\u578b\u5b9a\u4e49: {missionType, maxPerDay, unitPrice?, batch}
const TASK_DEFS = {
  ad_show: { missionType: 'AD_show', maxPerDay: 10, unitPrice: 150000, batch: 3, name: '\u770b\u89c6\u9891' },
  ad_click: { missionType: 'AD_click', maxPerDay: 20, batch: 5, name: '\u70b9\u5e7f\u544a' },
  drama: { missionType: 'DRAMA_DURATION', maxPerDay: 3, batch: 3, name: '\u770b\u77ed\u5267' },
};

async function runAccount(MGS, phone, session, taskKeys, opts) {
  const dryRun = opts.dryRun;
  const maxPerRun = opts.maxPerRun || 3; // \u6bcf\u6b21\u8fd0\u884c\u6700\u591a\u62a5\u7684\u6b21\u6570
  let signInStatus = '\u672a\u6267\u884c';
  const doneByTask = {};
  log(`\n===== \u8d26\u53f7 ${maskPhone(phone)} =====`);
  // \u7eed\u671f
  try {
    const fresh = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin');
    Object.assign(session, fresh);
    log(`  \u7eed\u671fOK sessionKey=${session.sessionKey.slice(0, 8)}...`);
  } catch (e) {
    log(`  \u7eed\u671f\u5931\u8d25: ${e.message}`);
  }

  // \u67e5 configNo + \u4f59\u989d
  let configNo = '';
  try {
    const mi = await withTimeout(queryMoneyMainInfo(MGS, session, '117'), 35000, 'queryMoneyMainInfo');
    configNo = extractConfigNo(mi);
    log(`  configNo=${configNo}`);
  } catch (e) {
    log(`  queryMoneyMainInfo\u5931\u8d25: ${e.message}`);
  }
  let balBefore = -1;
  try {
    const bal = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
    const t = unwrap(bal);
    balBefore = (t && t.totalScore) != null ? t.totalScore : balBefore;
    log(`  \u4f59\u989d=${balBefore}`);
  } catch (e) {
    log(`  \u67e5\u4f59\u989d\u5931\u8d25: ${e.message}`);
  }

  // \u7b7e\u5230
  try {
    const si = await withTimeout(fullSignIn(MGS, session, '117'), 40000, 'fullSignIn');
    log(`  \u7b7e\u5230[${si.step}] ${si.error ? '\u5931\u8d25: ' + si.error : (si.activityNo ? 'activityNo=' + si.activityNo : '')}`);
    if (si.step === 'signIn') {
      const siRaw = si.raw && si.raw.data;
      const siRes = siRaw && (siRaw.t || siRaw.result || siRaw); // data \u5e73\u94fa\u65f6\u76f4\u63a5\u7528 data \u672c\u4f53
      const ok = !!(siRes && (siRes.ok === true || siRes.status === 'SUCCESS' || siRes.success === true || siRes.rewardDesc || siRes.balance));
      signInStatus = ok ? '\u6210\u529f' : ((siRes && (siRes.primaryErrMsg || siRes.errMsg)) || '\u8fd4\u56de\u5f02\u5e38');
      log(`  \u7b7e\u5230\u7ed3\u679c: ${ok ? 'SUCCESS' : JSON.stringify(siRes || si.raw).slice(0, 160)}`);
    } else {
      signInStatus = '\u8df3\u8fc7:' + si.error;
    }
  } catch (e) {
    signInStatus = '\u5931\u8d25:' + e.message;
    log(`  \u7b7e\u5230\u5931\u8d25: ${e.message}`);
  }
  await randSleep(1, 3);

  // \u5168\u6ee1\u9884\u68c0: \u62c9\u4e00\u6b21\u5217\u8868, \u82e5 taskKeys \u6240\u6709\u4efb\u52a1\u90fd\u5df2\u5b8c\u6210/\u6ee1, \u76f4\u63a5\u505c (\u4e0d\u4e0a\u62a5\u4e0d\u7a7a\u8f6c)
  try {
    const pre = await withTimeout(queryMoneyTasks(MGS, session, 'MAKE_MONEY_MISSION', '117'), 35000, 'queryMoneyTasks(pre)');
    const preTasks = extractTaskList(pre);
    const allFinished = taskKeys.every((k) => {
      const def = TASK_DEFS[k];
      if (!def) return false;
      const t = preTasks.find((x) => x.businessType === def.missionType || x.missionType === def.missionType);
      if (!t) return true; // \u4efb\u52a1\u4e0d\u5b58\u5728\u89c6\u4e3a\u5df2\u5b8c\u6210, \u8df3\u8fc7
      const al = t.alreadyCompleteCount != null ? t.alreadyCompleteCount : (t.alreadyComplete || t.completedCount || 0);
      return t.status === 'FINISH' || al >= def.maxPerDay;
    });
    if (allFinished && taskKeys.length > 0) {
      log(`[\u5168\u6ee1] \u6240\u6709\u4efb\u52a1(${taskKeys.join(',')})\u5df2\u8dd1\u6ee1, \u672c\u8f6e\u65e0\u9700\u6267\u884c, \u76f4\u63a5\u505c`);
      disableLaunchd('\u6240\u6709\u4efb\u52a1\u5df2\u8dd1\u6ee1');
      return;
    }
  } catch (e) {
    log(`  \u5168\u6ee1\u9884\u68c0\u5931\u8d25: ${e.message} \u2192 \u7ee7\u7eed\u6b63\u5e38\u8dd1`);
  }

  for (const key of taskKeys) {
    const def = TASK_DEFS[key];
    if (!def) { log(`  \u672a\u77e5\u4efb\u52a1 ${key}`); continue; }
    log(`\n  --- ${def.name} (${def.missionType}, \u4e0a\u9650${def.maxPerDay}/\u5929) ---`);
    await randSleep(1, 3);

    // \u6bcf\u6b21\u91cd\u65b0\u62c9\u5217\u8868\u62ff\u6700\u65b0 taskNo \u548c alreadyComplete, \u65ad\u70b9\u7eed\u8dd1
    // \u6bcf\u6b21\u8fd0\u884c\u53ea\u62a5 maxPerRun \u6b21 (\u9ed8\u8ba42), \u9760 launchd \u591a\u6b21\u89e6\u53d1\u7d2f\u79ef\u5230\u65e5\u4e0a\u9650, \u9632\u4e00\u6b21\u8dd1\u6ee1\u89e6\u53d1\u98ce\u63a7
    const runLimit = Math.min(def.maxPerDay, maxPerRun);
    log(`  \u672c\u6b21\u8fd0\u884c\u6700\u591a ${runLimit} \u6b21 (\u65e5\u4e0a\u9650${def.maxPerDay})`);
    let doneCount = 0;
    let remaining = def.maxPerDay;
    for (let round = 0; round < runLimit; round++) {
      let tasks = [];
      try {
        const d = await withTimeout(queryMoneyTasks(MGS, session, 'MAKE_MONEY_MISSION', '117'), 35000, 'queryMoneyTasks');
        tasks = extractTaskList(d);
      } catch (e) {
        log(`  \u62c9\u4efb\u52a1\u5217\u8868\u5931\u8d25(\u7b2c${round + 1}\u8f6e): ${e.message} \u2192 \u8df3\u8fc7\u672c\u8f6e`);
        await randSleep(3, 6);
        continue;
      }
      // \u627e\u5230\u5339\u914d missionType \u7684\u4efb\u52a1
      const task = tasks.find((t) => t.businessType === def.missionType || t.missionType === def.missionType);
      if (!task) { log(`  \u672a\u627e\u5230 ${def.missionType} \u4efb\u52a1, \u505c\u6b62`); break; }
      const taskNo = task.taskNo;
      const already = task.alreadyCompleteCount != null ? task.alreadyCompleteCount : (task.alreadyComplete || task.completedCount || 0);
      const finished = task.status === 'FINISH' || already >= def.maxPerDay;
      if (finished) { log(`  \u5df2\u5b8c\u6210 ${already}/${def.maxPerDay} (status=${task.status}), \u8df3\u8fc7`); remaining = 0; break; }

      // \u770b\u89c6\u9891\u8d70 getDynamicScore \u62ff\u5206\u6570
      let passAmt = null;
      if (key === 'ad_show') {
        try {
          // \u968f\u673a\u4e0a\u62a5\u5355\u4ef7(\u5230\u8d26=unitPrice*0.04), \u6bcf\u6b21\u4e0d\u540c\u9632\u98ce\u63a7\u89c4\u5f8b
          // \u5355\u6b21\u5230\u8d26>=2800 -> \u4e0a\u62a5>=70000; \u8303\u56f470000~90000, 10\u6b21\u6700\u4f4e\u603b\u989d=28000
          const unitPrice = 70000 + Math.floor(Math.random() * 20001); // 70000..90000
          const ds = await withTimeout(getDynamicScore(MGS, session, configNo, unitPrice, '117'), 35000, 'getDynamicScore');
          const dt = unwrap(ds);
          const score = (dt && dt.score) != null ? dt.score : -1;
          if (score <= 1) { log(`  \u52a8\u6001\u5206\u6570=${score} \u5f02\u5e38(\u53ef\u80fd\u5df2\u5c01\u9876), \u505c\u6b62`); break; }
          passAmt = unitPrice;
          log(`  \u52a8\u6001\u5206\u6570=${score} (unitPrice=${unitPrice})`);
        } catch (e) {
          log(`  getDynamicScore\u5931\u8d25: ${e.message} \u2192 \u8df3\u8fc7`); continue;
        }
      }

      if (dryRun) { log(`  [dry-run] \u4e0a\u62a5 ${def.missionType} taskNo=${taskNo} passAmt=${passAmt}`); doneCount++; continue; }

      try {
        const fd = await withTimeout(finishTask(MGS, session, taskNo, def.missionType, passAmt, '117'), 35000, 'finishTask');
        const fdt = unwrap(fd);
        const ok = fd && fd.success === true || (fdt && fdt.status === 'SUCCESS');
        log(`  \u7b2c${round + 1}\u6b21 \u4e0a\u62a5 \u2192 ${ok ? 'SUCCESS' : JSON.stringify(fd).slice(0, 120)}`);
        if (!ok) {
          // \u82e5\u8fd4\u56de\u5df2\u9886\u53d6/\u5df2\u6ee1, \u505c\u6b62
          const s = JSON.stringify(fd || '');
          if (s.includes('already') || s.includes('complete') || s.includes('\u5df2\u9886\u53d6') || s.includes('\u5df2\u6ee1')) break;
        }
        doneCount++;
        // \u4e0a\u62a5\u6210\u529f\u540e\u9886\u53d6\u5956\u52b1 (GET \u6a21\u5f0f\u91d1\u5e01\u4efb\u52a1\u5fc5\u987b\u663e\u5f0f\u9886\u53d6\u624d\u5230\u8d26)
        if (!dryRun) {
          try {
            log(`  \u9886\u53d6\u5956\u52b1 ${def.missionType}...`);
            const gr = await withTimeout(getReward(MGS, session, taskNo, '117'), 35000, 'getReward');
            const g = JSON.stringify(gr || '');
            if (g.includes('TB0001') || g.includes('\u592a\u9891\u7e41')) {
              log(`  \u9886\u53d6\u88ab\u98ce\u63a7\u62e6\u622a(TB0001): ${g.slice(0, 120)} \u2192 \u505c\u6b62\u672c\u8f6e\u907f\u514d\u52a0\u5267`);
              break;
            }
            log(`  \u9886\u53d6\u7ed3\u679c: ${g.slice(0, 160)}`);
          } catch (e) {
            log(`  \u9886\u53d6\u5931\u8d25: ${e.message}`);
          }
        }
      } catch (e) {
        log(`  \u4e0a\u62a5\u5931\u8d25(\u7b2c${round + 1}\u6b21): ${e.message}`);
        // \u7f51\u7edc\u6296\u52a8\u91cd\u8bd5, \u6307\u6570\u9000\u907f
        await randSleep(3, 6);
        continue;
      }

      // \u968f\u673a\u5ef6\u65f6 (\u62c9\u957f, \u964d\u4f4e\u89e6\u53d1\u670d\u52a1\u7aef\u541e\u5206\u98ce\u63a7): \u5355\u6b21 8-15s, \u6bcf\u6279(3\u6b21)\u540e 20-40s
      if ((round + 1) % def.batch === 0 && round + 1 < def.maxPerDay) {
        log(`    \u6279\u95f4\u4f11\u606f...`);
        await randSleep(20, 40);
      } else if (round + 1 < def.maxPerDay) {
        await randSleep(8, 15);
      }
    }
    log(`  ${def.name} \u672c\u8f6e\u5b8c\u6210 ${doneCount} \u6b21`);
    doneByTask[def.name] = doneCount;
    await randSleep(2, 4);
  }

  // \u6700\u7ec8\u4f59\u989d:\u5148\u91cd\u65b0\u7eed\u671f session, \u907f\u514d\u4e0a\u62a5\u8fc7\u7a0b\u4e2d session \u5931\u6548\u5bfc\u81f4\u67e5\u5230\u65e7\u503c
  let balAfter = balBefore;
  if (!dryRun && configNo) {
    try {
      const fresh2 = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin(\u6700\u7ec8)');
      Object.assign(session, fresh2);
      const bal = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
      const t = unwrap(bal);
      balAfter = (t && t.totalScore) != null ? t.totalScore : balAfter;
      log(`\n  \u4f59\u989d ${balBefore} \u2192 ${balAfter}  (+${balAfter - balBefore})`);
    } catch (e) {
      log(`  \u67e5\u6700\u7ec8\u4f59\u989d\u5931\u8d25: ${e.message}`);
    }
  }
  return { phone, balBefore, balAfter, signIn: signInStatus, done: doneByTask };
}

// ============ \u4e3b\u6d41\u7a0b ============
// \u5168\u5c40\u770b\u95e8\u72d7: \u5355\u6b21\u8fd0\u884c\u603b\u9884\u7b97(\u9ed8\u8ba4 25 \u5206\u949f), \u5230\u70b9\u5f3a\u5236\u9000\u51fa, \u9632\u4efb\u4f55 await \u5361\u6b7b
const GLOBAL_BUDGET_MS = 25 * 60 * 1000;
const _watchdog = setTimeout(() => {
  log(`[watchdog] \u603b\u8fd0\u884c\u8d85 ${GLOBAL_BUDGET_MS / 60000} \u5206\u949f, \u5f3a\u5236\u9000\u51fa`);
  process.exit(0);
}, GLOBAL_BUDGET_MS);
_watchdog.unref();

async function main() {
  const args = process.argv.slice(2);
  const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? String(args[i + 1] || '') : ''; };
  const rawArgPhone = argVal('--phone');
  const envPhone = normalizePhone(process.env.BESTPAY_PHONE || '');
  const argPhone = normalizePhone(rawArgPhone);
  if (rawArgPhone && !argPhone) { log('\u624b\u673a\u53f7\u65e0\u6548: ' + rawArgPhone + ' (\u9700 11 \u4f4d: 1xxxxxxxxxx)'); return; }
  const doLogin = args.includes('--login') || args.includes('--send-sms');
  const all = readSessionsFile();
  const phones = args.includes('--all') ? Object.keys(all) : [];
  if (!args.includes('--all')) {
    const p = argPhone || envPhone;
    if (p) phones.push(p);
    else if (!doLogin) log('\u63d0\u793a: \u672a\u6307\u5b9a\u624b\u673a\u53f7 (--phone <\u624b\u673a\u53f7> \u6216 BESTPAY_PHONE)');
  }
  // \u53bb\u91cd + \u8fc7\u6ee4\u65e0 sessionKey \u7684
  const valid = [...new Set(phones)].filter((p) => all[p] && all[p].sessionKey);
  if (valid.length === 0 && !doLogin) { log('\u65e0\u6709\u6548 session; \u9996\u6b21\u4f7f\u7528\u8bf7\u5148: --login --phone <\u624b\u673a\u53f7>'); return; }

  // \u4efb\u52a1\u9009\u62e9
  const ti = args.indexOf('--tasks');
  let taskKeys = ['ad_show', 'ad_click', 'drama'];
  if (ti >= 0) {
    taskKeys = args[ti + 1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  const dryRun = args.includes('--dry-run');
  // \u6bcf\u6b21\u8fd0\u884c\u6700\u591a\u62a5\u7684\u6b21\u6570 (\u9ed8\u8ba43, \u9632\u4e00\u6b21\u8dd1\u6ee1\u89e6\u53d1\u98ce\u63a7); \u901a\u8fc7 launchd \u591a\u6b21\u89e6\u53d1\u7d2f\u79ef\u5230\u65e5\u4e0a\u9650
  const mi2 = args.indexOf('--max');
  const maxPerRun = mi2 >= 0 ? parseInt(args[mi2 + 1], 10) : 3;
  if (maxPerRun < 1) { log('--max \u5fc5\u987b >=1'); return; }
  // \u968f\u673a\u6a21\u5f0f (launchd StartInterval \u6bcf30\u5206\u949f\u89e6\u53d1): \u6bcf\u6b21\u968f\u673a\u51b3\u5b9a\u662f\u5426\u6267\u884c, \u4e0a\u62a5\u524d\u968f\u673a\u5ef6\u65f6
  // \u4f7f\u4e0a\u62a5\u65f6\u95f4\u70b9\u5b8c\u5168\u968f\u673a, \u907f\u514d\u56fa\u5b9a\u65f6\u95f4\u88ab\u98ce\u63a7\u8bc6\u522b
  if (args.includes('--rand')) {
    const skipChance = 0.5; // 50% \u6982\u7387\u672c\u8f6e\u8df3\u8fc7
    if (Math.random() < skipChance) {
      log(`[\u968f\u673a] \u672c\u8f6e\u8df3\u8fc7 (50%\u6982\u7387), \u65f6\u95f4=${new Date().toLocaleTimeString('zh-CN', {hour12:false})}`);
      return;
    }
    // \u4e0a\u62a5\u524d\u968f\u673a\u5ef6\u65f6 0-5 \u5206\u949f, \u6253\u6563\u65f6\u95f4\u70b9
    const delaySec = Math.floor(Math.random() * 300);
    log(`[\u968f\u673a] \u672c\u8f6e\u6267\u884c, \u5ef6\u65f6 ${delaySec}s \u6253\u6563\u65f6\u95f4\u70b9`);
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }

  log('\u52a0\u8f7d wasm \u5f15\u64ce...');
  loadWasmEnv();
  const MGS = loadMGS();
  log('MGS \u5c31\u7eea, \u8d26\u53f7\u6570=' + valid.length + ', \u4efb\u52a1=' + taskKeys.join(',') + (dryRun ? ' (dry-run)' : ''));

  // \u624b\u673a\u53f7\u77ed\u4fe1\u767b\u5f55 / \u53ea\u53d1\u77ed\u4fe1 (\u53d1\u7801\u2192\u586b\u7801\u4e24\u6bb5\u5f0f\u9762\u677f)
  if (doLogin) {
    const phone = argPhone || envPhone || await ask('\u8bf7\u8f93\u5165\u624b\u673a\u53f7: ');
    if (args.includes('--send-sms')) {
      await interactiveLogin(MGS, { phone, sendSmsOnly: true });
      return;
    }
    const code = (argVal('--code') || argVal('--sms-code') || process.env.BESTPAY_SMS_CODE || '').trim();
    await interactiveLogin(MGS, { phone, smsCode: code });
    log('\u767b\u5f55\u5b8c\u6210, \u5f53\u524d\u8d26\u53f7:', Object.keys(readSessionsFile()).map(maskPhone).join(', ') || '(\u65e0)');
    return;
  }

  // \u5355\u6b21\u4e0a\u62a5\u6d4b\u8bd5: --report <ad_show|ad_click|drama> \u5f3a\u5236\u4e0a\u62a5\u4e00\u6b21 + \u67e5\u4f59\u989d\u5bf9\u6bd4
  const ri = args.indexOf('--report');
  if (ri >= 0) {
    const rkey = (args[ri + 1] || 'ad_show').trim();
    const def = TASK_DEFS[rkey];
    if (!def) { log('\u672a\u77e5\u4efb\u52a1: ' + rkey); return; }
    const phone = valid[0];
    if (!phone) { log('\u9700 --phone <\u624b\u673a\u53f7> \u6307\u5b9a\u8d26\u53f7'); return; }
    const session = all[phone];
    session.__phone = phone;
    log(`\u5355\u6b21\u4e0a\u62a5\u6d4b\u8bd5: ${maskPhone(phone)} \u2192 ${def.name}`);
    try {
      const fresh = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin');
      Object.assign(session, fresh);
      log('  \u7eed\u671fOK sessionKey=' + session.sessionKey.slice(0, 8) + '...');
      const mi = await withTimeout(queryMoneyMainInfo(MGS, session, '117'), 35000, 'queryMoneyMainInfo');
      const configNo = extractConfigNo(mi);
      log('  configNo=' + configNo);
      const bal0 = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
      const b0 = (unwrap(bal0) && unwrap(bal0).totalScore) != null ? unwrap(bal0).totalScore : -1;
      log('  \u4e0a\u62a5\u524d\u4f59\u989d=' + b0);
      // \u62c9\u4efb\u52a1\u5217\u8868\u62ff taskNo
      const d = await withTimeout(queryMoneyTasks(MGS, session, 'MAKE_MONEY_MISSION', '117'), 35000, 'queryMoneyTasks');
      const tasks = extractTaskList(d);
      const task = tasks.find((t) => t.businessType === def.missionType || t.missionType === def.missionType);
      if (!task) { log('  \u672a\u627e\u5230 ' + def.missionType + ' \u4efb\u52a1, \u4e2d\u6b62'); return; }
      log('  taskNo=' + task.taskNo + ' alreadyComplete=' + task.alreadyCompleteCount + ' status=' + task.status);
      // \u770b\u89c6\u9891\u5148 getDynamicScore
      let passAmt = null;
      if (rkey === 'ad_show') {
        // \u968f\u673a\u4e0a\u62a5\u5355\u4ef7(\u5230\u8d26=unitPrice*0.04), \u6bcf\u6b21\u4e0d\u540c\u9632\u98ce\u63a7\u89c4\u5f8b
        // \u5355\u6b21\u5230\u8d26>=2800 -> \u4e0a\u62a5>=70000; \u8303\u56f470000~90000, 10\u6b21\u6700\u4f4e\u603b\u989d=28000
        const unitPrice = 70000 + Math.floor(Math.random() * 20001); // 70000..90000
        const ds = await withTimeout(getDynamicScore(MGS, session, configNo, unitPrice, '117'), 35000, 'getDynamicScore');
        const dt = unwrap(ds);
        const score = (dt && dt.score) != null ? dt.score : -1;
        log('  \u52a8\u6001\u5206\u6570=' + score + ' (unitPrice=' + unitPrice + ')');
        if (score > 1) passAmt = unitPrice;
      }
      const fd = await withTimeout(finishTask(MGS, session, task.taskNo, def.missionType, passAmt, '117'), 35000, 'finishTask');
      log('  \u4e0a\u62a5\u7ed3\u679c: ' + JSON.stringify(fd).slice(0, 200));
      // GET \u6a21\u5f0f\u91d1\u5e01\u4efb\u52a1\u5fc5\u987b\u9886\u53d6: \u4e0a\u62a5\u540e\u8c03 newGetReward
      log('  \u5c1d\u8bd5\u9886\u53d6 newGetReward...');
      const gr = await withTimeout(getReward(MGS, session, task.taskNo, '117'), 35000, 'getReward');
      log('  \u9886\u53d6\u7ed3\u679c: ' + JSON.stringify(gr).slice(0, 300));
      // \u67e5\u4f59\u989d(\u5148\u7eed\u671f\u907f\u514d\u5931\u6548 session)
      const fresh2 = await withTimeout(authTokenLogin(MGS, session), 35000, 'authTokenLogin(\u540e)');
      Object.assign(session, fresh2);
      const bal1 = await withTimeout(queryBalance(MGS, session, '117', configNo), 35000, 'queryBalance');
      const b1 = (unwrap(bal1) && unwrap(bal1).totalScore) != null ? unwrap(bal1).totalScore : -1;
      log('  \u4e0a\u62a5\u540e\u4f59\u989d=' + b1 + '  (+' + (b1 - b0) + ')');
    } catch (e) {
      log('  \u5355\u6b21\u4e0a\u62a5\u5f02\u5e38: ' + e.message);
    }
    return;
  }

  // \u9010\u4e2a\u8d26\u53f7\u8dd1 (\u4e32\u884c, \u907f\u514d\u5e76\u53d1\u98ce\u63a7)
  const results = [];
  for (const phone of valid) {
    const session = all[phone];
    session.__phone = phone;
    // \u6bcf\u8d26\u53f7\u786c\u8d85\u65f6\u4fdd\u62a4: \u5355\u8d26\u53f7\u6700\u591a 12 \u5206\u949f
    try {
      const r = await withTimeout(runAccount(MGS, phone, session, taskKeys, { dryRun, maxPerRun }), 720000, 'account-' + phone);
      results.push(r);
    } catch (e) {
      log(`\u8d26\u53f7 ${maskPhone(phone)} \u6574\u4f53\u8d85\u65f6/\u5931\u8d25: ${e.message}`);
      results.push({ phone, error: e.message });
    }
    // \u8d26\u53f7\u95f4\u968f\u673a\u5ef6\u65f6
    if (phone !== valid[valid.length - 1]) {
      log(`\u8d26\u53f7\u95f4\u4f11\u606f...`);
      await randSleep(15, 40);
    }
  }
  log(`\n===== \u5168\u90e8\u5b8c\u6210, \u5904\u7406\u8d26\u53f7 ${results.length} \u4e2a =====`);

  // Bark \u901a\u77e5 (\u6210\u529f/\u5931\u8d25\u90fd\u63a8, \u5185\u5bb9\u5e26\u6d3b\u52a8\u91d1\u5e01)
  const parts = results.map((r) => {
    if (!r || r.error) {
      return `${r && r.phone ? maskPhone(r.phone) : '?'}: \u5931\u8d25 ${r && r.error ? r.error : ''}`;
    }
    const d = r.done || {};
    const doneDesc = Object.keys(d).length
      ? Object.entries(d).map(([k, v]) => `${k}${v}`).join('/')
      : '\u65e0';
    const bal = (r.balAfter != null && r.balBefore != null) ? `${r.balBefore}\u2192${r.balAfter}(+${r.balAfter - r.balBefore})` : '?';
    return `${maskPhone(r.phone)}: \u7b7e\u5230${r.signIn} \u00b7 ${doneDesc} \u00b7 \u91d1\u5e01${bal}`;
  });
  const title = dryRun ? '\u7ffc\u652f\u4ed8\u5237\u91d1\u5e01(dry-run)' : `\u7ffc\u652f\u4ed8\u5237\u91d1\u5e01\u5b8c\u6210 ${results.length}\u53f7`;
  await sendBark(title, parts.join('\n'));
  log('bark \u901a\u77e5\u5df2\u53d1\u9001');
}

main().catch((e) => { log('FATAL:', e); process.exit(1); }).then(() => process.exit(0));

if (typeof __DBG_TRACE === 'function') __DBG_TRACE('\u6b63\u6587\u9876\u5c42\u6267\u884c\u5b8c\u6bd5(\u542b main \u8c03\u7528)');

}).catch(function (e) {
  __pushLog(['\u6b63\u6587/\u8d44\u4ea7\u5f02\u5e38: ' + (e && e.message ? e.message : e)
    + ' || ' + (e && e.stack ? String(e.stack).split('\n').slice(0, 4).join(' ~ ') : '(\u65e0\u5806\u6808)')]);
  __finish();
});
/* ==== \u539f\u811a\u672c\u6b63\u6587\u7ed3\u675f ==== */
