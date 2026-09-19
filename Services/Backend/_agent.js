📦
900401 /agent/index.js
✄
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// frida-shim:node_modules/@frida/base64-js/index.js
function getLens(b64) {
  const len = b64.length;
  if (len % 4 > 0) {
    throw new Error("Invalid string. Length must be a multiple of 4");
  }
  let validLen = b64.indexOf("=");
  if (validLen === -1) validLen = len;
  const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
  return [validLen, placeHoldersLen];
}
function _byteLength(b64, validLen, placeHoldersLen) {
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}
function toByteArray(b64) {
  const lens = getLens(b64);
  const validLen = lens[0];
  const placeHoldersLen = lens[1];
  const arr = new Uint8Array(_byteLength(b64, validLen, placeHoldersLen));
  let curByte = 0;
  const len = placeHoldersLen > 0 ? validLen - 4 : validLen;
  let i;
  for (i = 0; i < len; i += 4) {
    const tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
    arr[curByte++] = tmp >> 16 & 255;
    arr[curByte++] = tmp >> 8 & 255;
    arr[curByte++] = tmp & 255;
  }
  if (placeHoldersLen === 2) {
    const tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
    arr[curByte++] = tmp & 255;
  }
  if (placeHoldersLen === 1) {
    const tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
    arr[curByte++] = tmp >> 8 & 255;
    arr[curByte++] = tmp & 255;
  }
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
  const output = [];
  for (let i = start; i < end; i += 3) {
    const tmp = (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255);
    output.push(tripletToBase64(tmp));
  }
  return output.join("");
}
function fromByteArray(uint8) {
  const len = uint8.length;
  const extraBytes = len % 3;
  const parts = [];
  const maxChunkLength = 16383;
  for (let i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
  }
  if (extraBytes === 1) {
    const tmp = uint8[len - 1];
    parts.push(
      lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
    );
  } else if (extraBytes === 2) {
    const tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    parts.push(
      lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
    );
  }
  return parts.join("");
}
var lookup, revLookup, code2;
var init_base64_js = __esm({
  "frida-shim:node_modules/@frida/base64-js/index.js"() {
    "use strict";
    init_node_globals();
    lookup = [];
    revLookup = [];
    code2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0, len = code2.length; i < len; ++i) {
      lookup[i] = code2[i];
      revLookup[code2.charCodeAt(i)] = i;
    }
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
  }
});

// frida-shim:node_modules/@frida/ieee754/index.js
function read(buffer, offset, isLE, mLen, nBytes) {
  let e, m2;
  const eLen = nBytes * 8 - mLen - 1;
  const eMax = (1 << eLen) - 1;
  const eBias = eMax >> 1;
  let nBits = -7;
  let i = isLE ? nBytes - 1 : 0;
  const d = isLE ? -1 : 1;
  let s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;
  while (nBits > 0) {
    e = e * 256 + buffer[offset + i];
    i += d;
    nBits -= 8;
  }
  m2 = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;
  while (nBits > 0) {
    m2 = m2 * 256 + buffer[offset + i];
    i += d;
    nBits -= 8;
  }
  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m2 ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m2 = m2 + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m2 * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  let e, m2, c;
  let eLen = nBytes * 8 - mLen - 1;
  const eMax = (1 << eLen) - 1;
  const eBias = eMax >> 1;
  const rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  let i = isLE ? 0 : nBytes - 1;
  const d = isLE ? 1 : -1;
  const s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  value = Math.abs(value);
  if (isNaN(value) || value === Infinity) {
    m2 = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }
    if (e + eBias >= eMax) {
      m2 = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m2 = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m2 = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }
  while (mLen >= 8) {
    buffer[offset + i] = m2 & 255;
    i += d;
    m2 /= 256;
    mLen -= 8;
  }
  e = e << mLen | m2;
  eLen += mLen;
  while (eLen > 0) {
    buffer[offset + i] = e & 255;
    i += d;
    e /= 256;
    eLen -= 8;
  }
  buffer[offset + i - d] |= s * 128;
}
var init_ieee754 = __esm({
  "frida-shim:node_modules/@frida/ieee754/index.js"() {
    "use strict";
    init_node_globals();
  }
});

// frida-shim:node_modules/@frida/buffer/index.js
function createBuffer(length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"');
  }
  const buf = new Uint8Array(length);
  Object.setPrototypeOf(buf, Buffer2.prototype);
  return buf;
}
function Buffer2(arg, encodingOrOffset, length) {
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string") {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      );
    }
    return allocUnsafe(arg);
  }
  return from(arg, encodingOrOffset, length);
}
function from(value, encodingOrOffset, length) {
  if (typeof value === "string") {
    return fromString(value, encodingOrOffset);
  }
  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value);
  }
  if (value == null) {
    throw new TypeError(
      "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
    );
  }
  if (value instanceof ArrayBuffer || value && value.buffer instanceof ArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length);
  }
  if (value instanceof SharedArrayBuffer || value && value.buffer instanceof SharedArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length);
  }
  if (typeof value === "number") {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    );
  }
  const valueOf = value.valueOf && value.valueOf();
  if (valueOf != null && valueOf !== value) {
    return Buffer2.from(valueOf, encodingOrOffset, length);
  }
  const b = fromObject(value);
  if (b) return b;
  if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
    return Buffer2.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
  }
  throw new TypeError(
    "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
  );
}
function assertSize(size) {
  if (typeof size !== "number") {
    throw new TypeError('"size" argument must be of type number');
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"');
  }
}
function alloc(size, fill2, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(size);
  }
  if (fill2 !== void 0) {
    return typeof encoding === "string" ? createBuffer(size).fill(fill2, encoding) : createBuffer(size).fill(fill2);
  }
  return createBuffer(size);
}
function allocUnsafe(size) {
  assertSize(size);
  return createBuffer(size < 0 ? 0 : checked(size) | 0);
}
function fromString(string, encoding) {
  if (typeof encoding !== "string" || encoding === "") {
    encoding = "utf8";
  }
  if (!Buffer2.isEncoding(encoding)) {
    throw new TypeError("Unknown encoding: " + encoding);
  }
  const length = byteLength(string, encoding) | 0;
  let buf = createBuffer(length);
  const actual = buf.write(string, encoding);
  if (actual !== length) {
    buf = buf.slice(0, actual);
  }
  return buf;
}
function fromArrayLike(array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0;
  const buf = createBuffer(length);
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255;
  }
  return buf;
}
function fromArrayView(arrayView) {
  if (arrayView instanceof Uint8Array) {
    const copy2 = new Uint8Array(arrayView);
    return fromArrayBuffer(copy2.buffer, copy2.byteOffset, copy2.byteLength);
  }
  return fromArrayLike(arrayView);
}
function fromArrayBuffer(array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds');
  }
  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds');
  }
  let buf;
  if (byteOffset === void 0 && length === void 0) {
    buf = new Uint8Array(array);
  } else if (length === void 0) {
    buf = new Uint8Array(array, byteOffset);
  } else {
    buf = new Uint8Array(array, byteOffset, length);
  }
  Object.setPrototypeOf(buf, Buffer2.prototype);
  return buf;
}
function fromObject(obj) {
  if (Buffer2.isBuffer(obj)) {
    const len = checked(obj.length) | 0;
    const buf = createBuffer(len);
    if (buf.length === 0) {
      return buf;
    }
    obj.copy(buf, 0, 0, len);
    return buf;
  }
  if (obj.length !== void 0) {
    if (typeof obj.length !== "number" || Number.isNaN(obj.length)) {
      return createBuffer(0);
    }
    return fromArrayLike(obj);
  }
  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data);
  }
}
function checked(length) {
  if (length >= K_MAX_LENGTH) {
    throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
  }
  return length | 0;
}
function byteLength(string, encoding) {
  if (Buffer2.isBuffer(string)) {
    return string.length;
  }
  if (ArrayBuffer.isView(string) || string instanceof ArrayBuffer) {
    return string.byteLength;
  }
  if (typeof string !== "string") {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
    );
  }
  const len = string.length;
  const mustMatch = arguments.length > 2 && arguments[2] === true;
  if (!mustMatch && len === 0) return 0;
  let loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "ascii":
      case "latin1":
      case "binary":
        return len;
      case "utf8":
      case "utf-8":
        return utf8ToBytes(string).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return len * 2;
      case "hex":
        return len >>> 1;
      case "base64":
        return base64ToBytes(string).length;
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length;
        }
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
function slowToString(encoding, start, end) {
  let loweredCase = false;
  if (start === void 0 || start < 0) {
    start = 0;
  }
  if (start > this.length) {
    return "";
  }
  if (end === void 0 || end > this.length) {
    end = this.length;
  }
  if (end <= 0) {
    return "";
  }
  end >>>= 0;
  start >>>= 0;
  if (end <= start) {
    return "";
  }
  if (!encoding) encoding = "utf8";
  while (true) {
    switch (encoding) {
      case "hex":
        return hexSlice(this, start, end);
      case "utf8":
      case "utf-8":
        return utf8Slice(this, start, end);
      case "ascii":
        return asciiSlice(this, start, end);
      case "latin1":
      case "binary":
        return latin1Slice(this, start, end);
      case "base64":
        return base64Slice(this, start, end);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16leSlice(this, start, end);
      default:
        if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
        encoding = (encoding + "").toLowerCase();
        loweredCase = true;
    }
  }
}
function swap(b, n, m2) {
  const i = b[n];
  b[n] = b[m2];
  b[m2] = i;
}
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  if (buffer.length === 0) return -1;
  if (typeof byteOffset === "string") {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 2147483647) {
    byteOffset = 2147483647;
  } else if (byteOffset < -2147483648) {
    byteOffset = -2147483648;
  }
  byteOffset = +byteOffset;
  if (Number.isNaN(byteOffset)) {
    byteOffset = dir ? 0 : buffer.length - 1;
  }
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1;
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1;
  }
  if (typeof val === "string") {
    val = Buffer2.from(val, encoding);
  }
  if (Buffer2.isBuffer(val)) {
    if (val.length === 0) {
      return -1;
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === "number") {
    val = val & 255;
    if (typeof Uint8Array.prototype.indexOf === "function") {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }
  throw new TypeError("val must be string, number or Buffer");
}
function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  let indexSize = 1;
  let arrLength = arr.length;
  let valLength = val.length;
  if (encoding !== void 0) {
    encoding = String(encoding).toLowerCase();
    if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
      if (arr.length < 2 || val.length < 2) {
        return -1;
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }
  function read2(buf, i2) {
    if (indexSize === 1) {
      return buf[i2];
    } else {
      return buf.readUInt16BE(i2 * indexSize);
    }
  }
  let i;
  if (dir) {
    let foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read2(arr, i) === read2(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      let found = true;
      for (let j = 0; j < valLength; j++) {
        if (read2(arr, i + j) !== read2(val, j)) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
  }
  return -1;
}
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  const remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }
  const strLen = string.length;
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  let i;
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16);
    if (Number.isNaN(parsed)) return i;
    buf[offset + i] = parsed;
  }
  return i;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf);
  } else {
    return fromByteArray(buf.slice(start, end));
  }
}
function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  const res = [];
  let i = start;
  while (i < end) {
    const firstByte = buf[i];
    let codePoint = null;
    let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 192) === 128) {
            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
            if (tempCodePoint > 127) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
            if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
            if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
              codePoint = tempCodePoint;
            }
          }
      }
    }
    if (codePoint === null) {
      codePoint = 65533;
      bytesPerSequence = 1;
    } else if (codePoint > 65535) {
      codePoint -= 65536;
      res.push(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    res.push(codePoint);
    i += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
function decodeCodePointsArray(codePoints) {
  const len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints);
  }
  let res = "";
  let i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res;
}
function asciiSlice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 127);
  }
  return ret;
}
function latin1Slice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret;
}
function hexSlice(buf, start, end) {
  const len = buf.length;
  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;
  let out = "";
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]];
  }
  return out;
}
function utf16leSlice(buf, start, end) {
  const bytes = buf.slice(start, end);
  let res = "";
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res;
}
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
  if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
}
function checkInt(buf, value, offset, ext, max, min) {
  if (!Buffer2.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length) throw new RangeError("Index out of range");
}
function wrtBigUInt64LE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  return offset;
}
function wrtBigUInt64BE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset + 7] = lo;
  lo = lo >> 8;
  buf[offset + 6] = lo;
  lo = lo >> 8;
  buf[offset + 5] = lo;
  lo = lo >> 8;
  buf[offset + 4] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  buf[offset + 3] = hi;
  hi = hi >> 8;
  buf[offset + 2] = hi;
  hi = hi >> 8;
  buf[offset + 1] = hi;
  hi = hi >> 8;
  buf[offset] = hi;
  return offset + 8;
}
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError("Index out of range");
  if (offset < 0) throw new RangeError("Index out of range");
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4;
}
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8;
}
function E(sym, getMessage, Base) {
  errors[sym] = class NodeError extends Base {
    constructor() {
      super();
      Object.defineProperty(this, "message", {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      });
      this.name = `${this.name} [${sym}]`;
      this.stack;
      delete this.name;
    }
    get code() {
      return sym;
    }
    set code(value) {
      Object.defineProperty(this, "code", {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    }
    toString() {
      return `${this.name} [${sym}]: ${this.message}`;
    }
  };
}
function addNumericalSeparator(val) {
  let res = "";
  let i = val.length;
  const start = val[0] === "-" ? 1 : 0;
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`;
  }
  return `${val.slice(0, i)}${res}`;
}
function checkBounds(buf, offset, byteLength2) {
  validateNumber(offset, "offset");
  if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
    boundsError(offset, buf.length - (byteLength2 + 1));
  }
}
function checkIntBI(value, min, max, buf, offset, byteLength2) {
  if (value > max || value < min) {
    const n = typeof min === "bigint" ? "n" : "";
    let range;
    if (byteLength2 > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
      } else {
        range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`;
    }
    throw new errors.ERR_OUT_OF_RANGE("value", range, value);
  }
  checkBounds(buf, offset, byteLength2);
}
function validateNumber(value, name2) {
  if (typeof value !== "number") {
    throw new errors.ERR_INVALID_ARG_TYPE(name2, "number", value);
  }
}
function boundsError(value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type);
    throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
  }
  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
  }
  throw new errors.ERR_OUT_OF_RANGE(
    type || "offset",
    `>= ${type ? 1 : 0} and <= ${length}`,
    value
  );
}
function base64clean(str) {
  str = str.split("=")[0];
  str = str.trim().replace(INVALID_BASE64_RE, "");
  if (str.length < 2) return "";
  while (str.length % 4 !== 0) {
    str = str + "=";
  }
  return str;
}
function utf8ToBytes(string, units) {
  units = units || Infinity;
  let codePoint;
  const length = string.length;
  let leadSurrogate = null;
  const bytes = [];
  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);
    if (codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
          continue;
        } else if (i + 1 === length) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1) bytes.push(239, 191, 189);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1) bytes.push(239, 191, 189);
    }
    leadSurrogate = null;
    if (codePoint < 128) {
      if ((units -= 1) < 0) break;
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0) break;
      bytes.push(
        codePoint >> 6 | 192,
        codePoint & 63 | 128
      );
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0) break;
      bytes.push(
        codePoint >> 12 | 224,
        codePoint >> 6 & 63 | 128,
        codePoint & 63 | 128
      );
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0) break;
      bytes.push(
        codePoint >> 18 | 240,
        codePoint >> 12 & 63 | 128,
        codePoint >> 6 & 63 | 128,
        codePoint & 63 | 128
      );
    } else {
      throw new Error("Invalid code point");
    }
  }
  return bytes;
}
function asciiToBytes(str) {
  const byteArray = [];
  for (let i = 0; i < str.length; ++i) {
    byteArray.push(str.charCodeAt(i) & 255);
  }
  return byteArray;
}
function utf16leToBytes(str, units) {
  let c, hi, lo;
  const byteArray = [];
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break;
    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  let i;
  for (i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) break;
    dst[i + offset] = src[i];
  }
  return i;
}
var config, K_MAX_LENGTH, MAX_ARGUMENTS_LENGTH, errors, INVALID_BASE64_RE, hexSliceLookupTable;
var init_buffer = __esm({
  "frida-shim:node_modules/@frida/buffer/index.js"() {
    "use strict";
    init_node_globals();
    init_base64_js();
    init_ieee754();
    config = {
      INSPECT_MAX_BYTES: 50
    };
    K_MAX_LENGTH = 2147483647;
    Buffer2.TYPED_ARRAY_SUPPORT = true;
    Object.defineProperty(Buffer2.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer2.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer2.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer2.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    Buffer2.poolSize = 8192;
    Buffer2.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer2.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer2, Uint8Array);
    Buffer2.alloc = function(size, fill2, encoding) {
      return alloc(size, fill2, encoding);
    };
    Buffer2.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer2.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    Buffer2.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer2.prototype;
    };
    Buffer2.compare = function compare(a, b) {
      if (a instanceof Uint8Array) a = Buffer2.from(a, a.offset, a.byteLength);
      if (b instanceof Uint8Array) b = Buffer2.from(b, b.offset, b.byteLength);
      if (!Buffer2.isBuffer(a) || !Buffer2.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer2.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer2.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer2.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer2.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (buf instanceof Uint8Array) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer2.isBuffer(buf)) {
              buf = Buffer2.from(buf.buffer, buf.byteOffset, buf.byteLength);
            }
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer2.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    Buffer2.byteLength = byteLength;
    Buffer2.prototype._isBuffer = true;
    Buffer2.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer2.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer2.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer2.prototype.toString = function toString() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer2.prototype.toLocaleString = Buffer2.prototype.toString;
    Buffer2.prototype.equals = function equals(b) {
      if (!Buffer2.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer2.compare(this, b) === 0;
    };
    Buffer2.prototype.inspect = function inspect() {
      let str = "";
      const max = config.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    Buffer2.prototype[Symbol.for("nodejs.util.inspect.custom")] = Buffer2.prototype.inspect;
    Buffer2.prototype.compare = function compare2(target, start, end, thisStart, thisEnd) {
      if (target instanceof Uint8Array) {
        target = Buffer2.from(target, target.offset, target.byteLength);
      }
      if (!Buffer2.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer2.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer2.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer2.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    Buffer2.prototype.write = function write2(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer2.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    MAX_ARGUMENTS_LENGTH = 4096;
    Buffer2.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }
      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }
      if (end < start) end = start;
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer2.prototype);
      return newBuf;
    };
    Buffer2.prototype.readUintLE = Buffer2.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer2.prototype.readUintBE = Buffer2.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer2.prototype.readUint8 = Buffer2.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer2.prototype.readUint16LE = Buffer2.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer2.prototype.readUint16BE = Buffer2.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer2.prototype.readUint32LE = Buffer2.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer2.prototype.readUint32BE = Buffer2.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer2.prototype.readBigUInt64LE = function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    };
    Buffer2.prototype.readBigUInt64BE = function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    };
    Buffer2.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer2.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer2.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer2.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer2.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer2.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer2.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer2.prototype.readBigInt64LE = function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    };
    Buffer2.prototype.readBigInt64BE = function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    };
    Buffer2.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return read(this, offset, true, 23, 4);
    };
    Buffer2.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return read(this, offset, false, 23, 4);
    };
    Buffer2.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return read(this, offset, true, 52, 8);
    };
    Buffer2.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return read(this, offset, false, 52, 8);
    };
    Buffer2.prototype.writeUintLE = Buffer2.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer2.prototype.writeUintBE = Buffer2.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer2.prototype.writeUint8 = Buffer2.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer2.prototype.writeUint16LE = Buffer2.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer2.prototype.writeUint16BE = Buffer2.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer2.prototype.writeUint32LE = Buffer2.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer2.prototype.writeUint32BE = Buffer2.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer2.prototype.writeBigUInt64LE = function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    };
    Buffer2.prototype.writeBigUInt64BE = function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    };
    Buffer2.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer2.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer2.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer2.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer2.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer2.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer2.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer2.prototype.writeBigInt64LE = function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    };
    Buffer2.prototype.writeBigInt64BE = function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    };
    Buffer2.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer2.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    Buffer2.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer2.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer2.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer2.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target) {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer2.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer2.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code5 = val.charCodeAt(0);
          if (encoding === "utf8" && code5 < 128 || encoding === "latin1") {
            val = code5;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer2.isBuffer(val) ? val : Buffer2.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    errors = {};
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name2) {
        if (name2) {
          return `${name2} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name2, actual) {
        return `The "${name2}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    hexSliceLookupTable = function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    }();
  }
});

// frida-shim:node_modules/@frida/process/index.js
function nextTick(callback, ...args) {
  Script.nextTick(callback, ...args);
}
function noop() {
}
function binding(name2) {
  throw new Error("process.binding is not supported");
}
function cwd() {
  return Process.platform === "windows" ? "C:\\" : "/";
}
function chdir(dir) {
  throw new Error("process.chdir is not supported");
}
function umask() {
  return 0;
}
function detectPlatform() {
  const platform2 = Process.platform;
  return platform2 === "windows" ? "win32" : platform2;
}
var title, browser, platform, pid, env, argv, version, versions, on, addListener, once, off, removeListener, removeAllListeners, emit, prependListener, prependOnceListener, listeners, process_default;
var init_process = __esm({
  "frida-shim:node_modules/@frida/process/index.js"() {
    "use strict";
    init_node_globals();
    title = "Frida";
    browser = false;
    platform = detectPlatform();
    pid = Process.id;
    env = {
      FRIDA_COMPILE: "1"
    };
    argv = [];
    version = Frida.version;
    versions = {};
    on = noop;
    addListener = noop;
    once = noop;
    off = noop;
    removeListener = noop;
    removeAllListeners = noop;
    emit = noop;
    prependListener = noop;
    prependOnceListener = noop;
    listeners = function(name2) {
      return [];
    };
    process_default = {
      nextTick,
      title,
      browser,
      platform,
      pid,
      env,
      argv,
      version,
      versions,
      on,
      addListener,
      once,
      off,
      removeListener,
      removeAllListeners,
      emit,
      prependListener,
      prependOnceListener,
      listeners,
      binding,
      cwd,
      chdir,
      umask
    };
  }
});

// frida-builtins:/node-globals.js
var init_node_globals = __esm({
  "frida-builtins:/node-globals.js"() {
    "use strict";
    init_process();
  }
});

// agent/logger.ts
function safeStringify(value) {
  try {
    if (value === null)
      return "null";
    if (value === void 0)
      return "undefined";
    if (typeof value === "string")
      return value;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (typeof value === "object") {
      if (value instanceof Error) {
        return `${value.name}: ${value.message}${value.stack ? "\n" + value.stack : ""}`;
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return value.toString();
      }
    }
    return String(value);
  } catch (e) {
    return `[Unable to stringify: ${typeof value}]`;
  }
}
function createTimestamp() {
  try {
    return (/* @__PURE__ */ new Date()).toISOString();
  } catch {
    return "[timestamp error]";
  }
}
function logMessage(level, message) {
  try {
    const timestamp = createTimestamp();
    const stringMessage = safeStringify(message);
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${stringMessage}`;
    console.log(formattedMessage);
    try {
      send({
        type: "log",
        level,
        message: stringMessage,
        timestamp
      });
    } catch (sendError) {
      console.log(`[${timestamp}] [WARN] Send failed: ${safeStringify(sendError)}`);
    }
  } catch (e) {
    try {
      console.log(`[LOG ERROR] ${safeStringify(e)}`);
    } catch {
      console.log("[CRITICAL LOG ERROR - Unable to log]");
    }
  }
}
function log(message) {
  logMessage("info", message);
}
function warn(message) {
  logMessage("warn", message);
}
function logError(message, error) {
  try {
    let fullMessage = message;
    if (error) {
      if (error instanceof Error) {
        fullMessage += `
Error: ${error.message}`;
        if (error.stack) {
          fullMessage += `
Stack: ${error.stack}`;
        }
      } else {
        fullMessage += `
Error details: ${safeStringify(error)}`;
      }
    }
    logMessage("error", fullMessage);
  } catch (e) {
    logMessage("error", `Failed to log error: ${safeStringify(e)}`);
  }
}
var init_logger = __esm({
  "agent/logger.ts"() {
    "use strict";
    init_node_globals();
  }
});

// agent/core/FunctionRegistry.ts
var FunctionRegistry;
var init_FunctionRegistry = __esm({
  "agent/core/FunctionRegistry.ts"() {
    "use strict";
    init_node_globals();
    init_logger();
    FunctionRegistry = class _FunctionRegistry {
      static instance;
      globalFunctions = /* @__PURE__ */ new Map();
      rpcFunctions = /* @__PURE__ */ new Map();
      functionOptions = /* @__PURE__ */ new Map();
      constructor() {
      }
      static getInstance() {
        if (!this.instance) {
          this.instance = new _FunctionRegistry();
        }
        return this.instance;
      }
      /**
       * Register a function to be available globally (via globalThis)
       */
      registerGlobal(name2, fn, options) {
        const wrappedFn = this.wrapFunction(name2, fn, options);
        this.globalFunctions.set(name2, wrappedFn);
        this.functionOptions.set(name2, options || {});
        globalThis[name2] = wrappedFn;
        log(`\u2705 Registered global function: ${name2}`);
      }
      /**
       * Register a function to be available via RPC
       */
      registerRPC(name2, fn, options) {
        const wrappedFn = this.wrapFunction(name2, fn, options);
        this.rpcFunctions.set(name2, wrappedFn);
        this.functionOptions.set(name2, options || {});
        log(`\u2705 Registered RPC function: ${name2}`);
      }
      /**
       * Register a function for both global and RPC access
       */
      registerBoth(name2, fn, options) {
        this.registerGlobal(name2, fn, options);
        this.registerRPC(name2, fn, options);
      }
      /**
       * Wrap a function with error handling, logging, and standardized responses
       */
      wrapFunction(name2, fn, options) {
        const registry = this;
        const opts = options || {};
        const shouldLog = opts.log !== false;
        return function(...args) {
          if (shouldLog) {
            registry.logFunctionCall(name2, args, opts.log);
          }
          try {
            const result2 = fn.apply(this, args);
            if (result2 instanceof Promise) {
              return registry.handleAsyncResult(result2, name2, opts, shouldLog);
            }
            return registry.handleSyncResult(result2, name2, opts, shouldLog);
          } catch (error) {
            return registry.handleError(name2, error, opts);
          }
        };
      }
      /**
       * Optimized function call logging
       */
      logFunctionCall(name2, args, detailedLog) {
        log(`\u{1F50D} ${name2}() called${args.length > 0 ? ` with ${args.length} args` : ""}`);
        if (args.length > 0 && detailedLog) {
          log(`   Args: ${JSON.stringify(args).substring(0, 200)}`);
        }
      }
      /**
       * Handle async function results
       */
      handleAsyncResult(result2, name2, opts, shouldLog) {
        return result2.then((res) => {
          if (shouldLog) {
            log(`\u2705 ${name2}() completed successfully (async)`);
          }
          return this.formatResponse(true, res, void 0, opts);
        }).catch((error) => {
          return this.handleError(name2, error, opts);
        });
      }
      /**
       * Handle sync function results
       */
      handleSyncResult(result2, name2, opts, shouldLog) {
        if (shouldLog) {
          log(`\u2705 ${name2}() completed successfully`);
        }
        return this.formatResponse(true, result2, void 0, opts);
      }
      /**
       * Format a standardized response with performance optimizations
       */
      formatResponse(success, data, error, options) {
        if (success && data !== void 0 && this.isResponseObject(data)) {
          return data;
        }
        const response = { success };
        if (success && data !== void 0) {
          response.data = data;
        } else if (!success && error) {
          response.error = error;
          response.message = error;
        }
        if (options?.includeTimestamp !== false) {
          response.timestamp = (/* @__PURE__ */ new Date()).toISOString();
        }
        return response;
      }
      /**
       * Check if an object is already a response object
       */
      isResponseObject(obj) {
        return obj && typeof obj === "object" && "success" in obj && typeof obj.success === "boolean";
      }
      /**
       * Handle errors consistently
       */
      handleError(functionName, error, options) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logError(`Error in ${functionName}`, error);
        return this.formatResponse(false, void 0, `${functionName} failed: ${errorMsg}`, options);
      }
      /**
       * Get all RPC functions for export
       */
      getRPCExports() {
        return Object.fromEntries(this.rpcFunctions);
      }
      /**
       * Get all global functions
       */
      getGlobalFunctions() {
        return Object.fromEntries(this.globalFunctions);
      }
      /**
       * Check if a function is registered
       */
      hasFunction(name2, type = "both") {
        if (type === "global")
          return this.globalFunctions.has(name2);
        if (type === "rpc")
          return this.rpcFunctions.has(name2);
        return this.globalFunctions.has(name2) || this.rpcFunctions.has(name2);
      }
      /**
       * Get function metadata
       */
      getFunctionInfo(name2) {
        if (!this.hasFunction(name2))
          return null;
        return {
          global: this.globalFunctions.has(name2),
          rpc: this.rpcFunctions.has(name2),
          options: this.functionOptions.get(name2)
        };
      }
    };
  }
});

// agent/core/ModuleRegistry.ts
var ModuleRegistry;
var init_ModuleRegistry = __esm({
  "agent/core/ModuleRegistry.ts"() {
    "use strict";
    init_node_globals();
    init_logger();
    ModuleRegistry = class {
      modules = /* @__PURE__ */ new Map();
      initOrder = [];
      readyModules = /* @__PURE__ */ new Set();
      /**
       * Register a module
       */
      register(module) {
        const name2 = module.metadata.name;
        if (this.modules.has(name2)) {
          throw new Error(`Module ${name2} is already registered`);
        }
        this.modules.set(name2, module);
        log(`\u{1F4E6} Registered module: ${name2} [${module.metadata.platform}/${module.metadata.category}]`);
      }
      /**
       * Unregister a module
       */
      unregister(name2) {
        if (!this.modules.has(name2)) {
          return false;
        }
        if (this.readyModules.has(name2)) {
          const module = this.modules.get(name2);
          module.shutdown().catch((error) => {
            logError(`Error shutting down module ${name2}`, error);
          });
        }
        this.modules.delete(name2);
        this.readyModules.delete(name2);
        this.initOrder = this.initOrder.filter((n) => n !== name2);
        log(`\u{1F4E6} Unregistered module: ${name2}`);
        return true;
      }
      /**
       * Get a module by name
       */
      get(name2) {
        return this.modules.get(name2);
      }
      /**
       * Get all modules
       */
      getAll() {
        return Array.from(this.modules.values());
      }
      /**
       * Get modules by platform
       */
      getByPlatform(platform2) {
        return this.getAll().filter((m2) => m2.metadata.platform === platform2 || m2.metadata.platform === "cross-platform");
      }
      /**
       * Get modules by category
       */
      getByCategory(category) {
        return this.getAll().filter((m2) => m2.metadata.category === category);
      }
      /**
       * Initialize all modules respecting dependencies
       */
      async initializeAll() {
        const modules = this.getAll();
        const initialized = /* @__PURE__ */ new Set();
        const initModule = async (module) => {
          const name2 = module.metadata.name;
          if (initialized.has(name2)) {
            return;
          }
          const deps = module.getDependencies();
          for (const dep of deps) {
            const depModule = this.modules.get(dep);
            if (depModule && !initialized.has(dep)) {
              await initModule(depModule);
            }
          }
          try {
            log(`\u{1F527} Initializing module: ${name2}`);
            await module.initialize();
            initialized.add(name2);
            this.readyModules.add(name2);
            this.initOrder.push(name2);
            log(`\u2705 Module ${name2} initialized`);
          } catch (error) {
            logError(`Failed to initialize module ${name2}`, error);
            throw error;
          }
        };
        for (const module of modules) {
          if (!initialized.has(module.metadata.name)) {
            await initModule(module);
          }
        }
      }
      /**
       * Shutdown all modules in reverse initialization order
       */
      async shutdownAll() {
        for (const name2 of [...this.initOrder].reverse()) {
          const module = this.modules.get(name2);
          if (module && this.readyModules.has(name2)) {
            try {
              log(`\u{1F527} Shutting down module: ${name2}`);
              await module.shutdown();
              this.readyModules.delete(name2);
              log(`\u2705 Module ${name2} shut down`);
            } catch (error) {
              logError(`Error shutting down module ${name2}`, error);
            }
          }
        }
        this.initOrder = [];
      }
      /**
       * Get initialization status
       */
      getStatus() {
        const status = {};
        for (const [name2, module] of this.modules) {
          status[name2] = module.isReady();
        }
        return {
          total: this.modules.size,
          ready: this.readyModules.size,
          modules: status
        };
      }
    };
  }
});

// node_modules/frida-objc-bridge/lib/api.js
function getApi() {
  if (cachedApi !== null) {
    return cachedApi;
  }
  const temporaryApi = {};
  const pending = [
    {
      module: "libsystem_malloc.dylib",
      functions: {
        "free": ["void", ["pointer"]]
      }
    },
    {
      module: "libobjc.A.dylib",
      functions: {
        "objc_msgSend": function(address) {
          this.objc_msgSend = address;
        },
        "objc_msgSend_stret": function(address) {
          this.objc_msgSend_stret = address;
        },
        "objc_msgSend_fpret": function(address) {
          this.objc_msgSend_fpret = address;
        },
        "objc_msgSendSuper": function(address) {
          this.objc_msgSendSuper = address;
        },
        "objc_msgSendSuper_stret": function(address) {
          this.objc_msgSendSuper_stret = address;
        },
        "objc_msgSendSuper_fpret": function(address) {
          this.objc_msgSendSuper_fpret = address;
        },
        "objc_getClassList": ["int", ["pointer", "int"]],
        "objc_lookUpClass": ["pointer", ["pointer"]],
        "objc_allocateClassPair": ["pointer", ["pointer", "pointer", "pointer"]],
        "objc_disposeClassPair": ["void", ["pointer"]],
        "objc_registerClassPair": ["void", ["pointer"]],
        "class_isMetaClass": ["bool", ["pointer"]],
        "class_getName": ["pointer", ["pointer"]],
        "class_getImageName": ["pointer", ["pointer"]],
        "class_copyProtocolList": ["pointer", ["pointer", "pointer"]],
        "class_copyMethodList": ["pointer", ["pointer", "pointer"]],
        "class_getClassMethod": ["pointer", ["pointer", "pointer"]],
        "class_getInstanceMethod": ["pointer", ["pointer", "pointer"]],
        "class_getSuperclass": ["pointer", ["pointer"]],
        "class_addProtocol": ["bool", ["pointer", "pointer"]],
        "class_addMethod": ["bool", ["pointer", "pointer", "pointer", "pointer"]],
        "class_copyIvarList": ["pointer", ["pointer", "pointer"]],
        "objc_getProtocol": ["pointer", ["pointer"]],
        "objc_copyProtocolList": ["pointer", ["pointer"]],
        "objc_allocateProtocol": ["pointer", ["pointer"]],
        "objc_registerProtocol": ["void", ["pointer"]],
        "protocol_getName": ["pointer", ["pointer"]],
        "protocol_copyMethodDescriptionList": ["pointer", ["pointer", "bool", "bool", "pointer"]],
        "protocol_copyPropertyList": ["pointer", ["pointer", "pointer"]],
        "protocol_copyProtocolList": ["pointer", ["pointer", "pointer"]],
        "protocol_addProtocol": ["void", ["pointer", "pointer"]],
        "protocol_addMethodDescription": ["void", ["pointer", "pointer", "pointer", "bool", "bool"]],
        "ivar_getName": ["pointer", ["pointer"]],
        "ivar_getTypeEncoding": ["pointer", ["pointer"]],
        "ivar_getOffset": ["pointer", ["pointer"]],
        "object_isClass": ["bool", ["pointer"]],
        "object_getClass": ["pointer", ["pointer"]],
        "object_getClassName": ["pointer", ["pointer"]],
        "method_getName": ["pointer", ["pointer"]],
        "method_getTypeEncoding": ["pointer", ["pointer"]],
        "method_getImplementation": ["pointer", ["pointer"]],
        "method_setImplementation": ["pointer", ["pointer", "pointer"]],
        "property_getName": ["pointer", ["pointer"]],
        "property_copyAttributeList": ["pointer", ["pointer", "pointer"]],
        "sel_getName": ["pointer", ["pointer"]],
        "sel_registerName": ["pointer", ["pointer"]],
        "class_getInstanceSize": ["pointer", ["pointer"]]
      },
      optionals: {
        "objc_msgSend_stret": "ABI",
        "objc_msgSend_fpret": "ABI",
        "objc_msgSendSuper_stret": "ABI",
        "objc_msgSendSuper_fpret": "ABI",
        "object_isClass": "iOS8"
      }
    },
    {
      module: "libdispatch.dylib",
      functions: {
        "dispatch_async_f": ["void", ["pointer", "pointer", "pointer"]]
      },
      variables: {
        "_dispatch_main_q": function(address) {
          this._dispatch_main_q = address;
        }
      }
    }
  ];
  let remaining = 0;
  pending.forEach(function(api3) {
    const isObjCApi = api3.module === "libobjc.A.dylib";
    const functions = api3.functions || {};
    const variables = api3.variables || {};
    const optionals = api3.optionals || {};
    remaining += Object.keys(functions).length + Object.keys(variables).length;
    const exportByName = (Process.findModuleByName(api3.module)?.enumerateExports() ?? []).reduce(function(result2, exp) {
      result2[exp.name] = exp;
      return result2;
    }, {});
    Object.keys(functions).forEach(function(name2) {
      const exp = exportByName[name2];
      if (exp !== void 0 && exp.type === "function") {
        const signature2 = functions[name2];
        if (typeof signature2 === "function") {
          signature2.call(temporaryApi, exp.address);
          if (isObjCApi)
            signature2.call(temporaryApi, exp.address);
        } else {
          temporaryApi[name2] = new NativeFunction(exp.address, signature2[0], signature2[1], defaultInvocationOptions);
          if (isObjCApi)
            temporaryApi[name2] = temporaryApi[name2];
        }
        remaining--;
      } else {
        const optional = optionals[name2];
        if (optional)
          remaining--;
      }
    });
    Object.keys(variables).forEach(function(name2) {
      const exp = exportByName[name2];
      if (exp !== void 0 && exp.type === "variable") {
        const handler = variables[name2];
        handler.call(temporaryApi, exp.address);
        remaining--;
      }
    });
  });
  if (remaining === 0) {
    if (!temporaryApi.objc_msgSend_stret)
      temporaryApi.objc_msgSend_stret = temporaryApi.objc_msgSend;
    if (!temporaryApi.objc_msgSend_fpret)
      temporaryApi.objc_msgSend_fpret = temporaryApi.objc_msgSend;
    if (!temporaryApi.objc_msgSendSuper_stret)
      temporaryApi.objc_msgSendSuper_stret = temporaryApi.objc_msgSendSuper;
    if (!temporaryApi.objc_msgSendSuper_fpret)
      temporaryApi.objc_msgSendSuper_fpret = temporaryApi.objc_msgSendSuper;
    cachedApi = temporaryApi;
  }
  return cachedApi;
}
var cachedApi, defaultInvocationOptions;
var init_api = __esm({
  "node_modules/frida-objc-bridge/lib/api.js"() {
    "use strict";
    init_node_globals();
    cachedApi = null;
    defaultInvocationOptions = {
      exceptions: "propagate"
    };
  }
});

// node_modules/frida-objc-bridge/lib/fastpaths.js
function get() {
  if (cachedModule === null)
    cachedModule = compileModule();
  return cachedModule;
}
function compileModule() {
  const {
    objc_getClassList,
    class_getSuperclass,
    class_getInstanceSize
  } = getApi();
  const selfTask = Memory.alloc(4);
  selfTask.writeU32(Module.getGlobalExportByName("mach_task_self_").readU32());
  const cm2 = new CModule(code3, {
    objc_getClassList,
    class_getSuperclass,
    class_getInstanceSize,
    malloc_get_all_zones: Process.getModuleByName("/usr/lib/system/libsystem_malloc.dylib").getExportByName("malloc_get_all_zones"),
    selfTask
  });
  const _choose = new NativeFunction(cm2.choose, "pointer", ["pointer", "bool", "pointer"]);
  const _destroy = new NativeFunction(cm2.destroy, "void", ["pointer"]);
  return {
    handle: cm2,
    choose(klass, considerSubclasses) {
      const result2 = [];
      const countPtr = Memory.alloc(4);
      const matches = _choose(klass, considerSubclasses ? 1 : 0, countPtr);
      try {
        const count = countPtr.readU32();
        for (let i = 0; i !== count; i++)
          result2.push(matches.add(i * pointerSize2).readPointer());
      } finally {
        _destroy(matches);
      }
      return result2;
    }
  };
}
var code3, pointerSize2, cachedModule;
var init_fastpaths = __esm({
  "node_modules/frida-objc-bridge/lib/fastpaths.js"() {
    "use strict";
    init_node_globals();
    init_api();
    code3 = `#include <glib.h>
#include <ptrauth.h>

#define KERN_SUCCESS 0
#define MALLOC_PTR_IN_USE_RANGE_TYPE 1
#if defined (HAVE_I386) && GLIB_SIZEOF_VOID_P == 8
# define OBJC_ISA_MASK 0x7ffffffffff8ULL
#elif defined (HAVE_ARM64)
# define OBJC_ISA_MASK 0xffffffff8ULL
#endif

typedef struct _ChooseContext ChooseContext;

typedef struct _malloc_zone_t malloc_zone_t;
typedef struct _malloc_introspection_t malloc_introspection_t;
typedef struct _vm_range_t vm_range_t;

typedef gpointer Class;
typedef int kern_return_t;
typedef guint mach_port_t;
typedef mach_port_t task_t;
typedef guintptr vm_offset_t;
typedef guintptr vm_size_t;
typedef vm_offset_t vm_address_t;

struct _ChooseContext
{
  GHashTable * classes;
  GArray * matches;
};

struct _malloc_zone_t
{
  void * reserved1;
  void * reserved2;
  size_t (* size) (struct _malloc_zone_t * zone, const void * ptr);
  void * (* malloc) (struct _malloc_zone_t * zone, size_t size);
  void * (* calloc) (struct _malloc_zone_t * zone, size_t num_items, size_t size);
  void * (* valloc) (struct _malloc_zone_t * zone, size_t size);
  void (* free) (struct _malloc_zone_t * zone, void * ptr);
  void * (* realloc) (struct _malloc_zone_t * zone, void * ptr, size_t size);
  void (* destroy) (struct _malloc_zone_t * zone);
  const char * zone_name;

  unsigned (* batch_malloc) (struct _malloc_zone_t * zone, size_t size, void ** results, unsigned num_requested);
  void (* batch_free) (struct _malloc_zone_t * zone, void ** to_be_freed, unsigned num_to_be_freed);

  malloc_introspection_t * introspect;
};

typedef kern_return_t (* memory_reader_t) (task_t remote_task, vm_address_t remote_address, vm_size_t size, void ** local_memory);
typedef void (* vm_range_recorder_t) (task_t task, void * user_data, unsigned type, vm_range_t * ranges, unsigned count);
typedef kern_return_t (* enumerator_func) (task_t task, void * user_data, unsigned type_mask, vm_address_t zone_address, memory_reader_t reader,
      vm_range_recorder_t recorder);

struct _malloc_introspection_t
{
  enumerator_func enumerator;
};

struct _vm_range_t
{
  vm_address_t address;
  vm_size_t size;
};

extern int objc_getClassList (Class * buffer, int buffer_count);
extern Class class_getSuperclass (Class cls);
extern size_t class_getInstanceSize (Class cls);
extern kern_return_t malloc_get_all_zones (task_t task, memory_reader_t reader, vm_address_t ** addresses, unsigned * count);

static void collect_subclasses (Class klass, GHashTable * result);
static void collect_matches_in_ranges (task_t task, void * user_data, unsigned type, vm_range_t * ranges, unsigned count);
static kern_return_t read_local_memory (task_t remote_task, vm_address_t remote_address, vm_size_t size, void ** local_memory);

extern mach_port_t selfTask;

gpointer *
choose (Class * klass,
        gboolean consider_subclasses,
        guint * count)
{
  ChooseContext ctx;
  GHashTable * classes;
  vm_address_t * malloc_zone_addresses;
  unsigned malloc_zone_count, i;

  classes = g_hash_table_new_full (NULL, NULL, NULL, NULL);
  ctx.classes = classes;
  ctx.matches = g_array_new (FALSE, FALSE, sizeof (gpointer));
  if (consider_subclasses)
    collect_subclasses (klass, classes);
  else
    g_hash_table_insert (classes, klass, GSIZE_TO_POINTER (class_getInstanceSize (klass)));

  malloc_zone_count = 0;
  malloc_get_all_zones (selfTask, read_local_memory, &malloc_zone_addresses, &malloc_zone_count);

  for (i = 0; i != malloc_zone_count; i++)
  {
    vm_address_t zone_address = malloc_zone_addresses[i];
    malloc_zone_t * zone = (malloc_zone_t *) zone_address;
    enumerator_func enumerator;

    if (zone != NULL && zone->introspect != NULL &&
        (enumerator = (ptrauth_strip (zone->introspect, ptrauth_key_asda))->enumerator) != NULL)
    {
      enumerator = ptrauth_sign_unauthenticated (
          ptrauth_strip (enumerator, ptrauth_key_asia),
          ptrauth_key_asia, 0);

      enumerator (selfTask, &ctx, MALLOC_PTR_IN_USE_RANGE_TYPE, zone_address, read_local_memory,
          collect_matches_in_ranges);
    }
  }

  g_hash_table_unref (classes);

  *count = ctx.matches->len;

  return (gpointer *) g_array_free (ctx.matches, FALSE);
}

void
destroy (gpointer mem)
{
  g_free (mem);
}

static void
collect_subclasses (Class klass,
                    GHashTable * result)
{
  Class * classes;
  int count, i;

  count = objc_getClassList (NULL, 0);
  classes = g_malloc (count * sizeof (gpointer));
  count = objc_getClassList (classes, count);

  for (i = 0; i != count; i++)
  {
    Class candidate = classes[i];
    Class c;

    c = candidate;
    do
    {
      if (c == klass)
      {
        g_hash_table_insert (result, candidate, GSIZE_TO_POINTER (class_getInstanceSize (candidate)));
        break;
      }

      c = class_getSuperclass (c);
    }
    while (c != NULL);
  }

  g_free (classes);
}

static void
collect_matches_in_ranges (task_t task,
                           void * user_data,
                           unsigned type,
                           vm_range_t * ranges,
                           unsigned count)
{
  ChooseContext * ctx = user_data;
  GHashTable * classes = ctx->classes;
  unsigned i;

  for (i = 0; i != count; i++)
  {
    const vm_range_t * range = &ranges[i];
    gconstpointer candidate = GSIZE_TO_POINTER (range->address);
    gconstpointer isa;
    guint instance_size;

    isa = *(gconstpointer *) candidate;
#ifdef OBJC_ISA_MASK
    isa = GSIZE_TO_POINTER (GPOINTER_TO_SIZE (isa) & OBJC_ISA_MASK);
#endif

    instance_size = GPOINTER_TO_UINT (g_hash_table_lookup (classes, isa));
    if (instance_size != 0 && range->size >= instance_size)
    {
      g_array_append_val (ctx->matches, candidate);
    }
  }
}

static kern_return_t
read_local_memory (task_t remote_task,
                   vm_address_t remote_address,
                   vm_size_t size,
                   void ** local_memory)
{
  *local_memory = (void *) remote_address;

  return KERN_SUCCESS;
}
`;
    ({ pointerSize: pointerSize2 } = Process);
    cachedModule = null;
  }
});

// node_modules/frida-objc-bridge/index.js
function Runtime() {
  const pointerSize = Process.pointerSize;
  let api = null;
  let apiError = null;
  const realizedClasses = /* @__PURE__ */ new Set();
  const classRegistry = new ClassRegistry();
  const protocolRegistry = new ProtocolRegistry();
  const replacedMethods = /* @__PURE__ */ new Map();
  const scheduledWork = /* @__PURE__ */ new Map();
  let nextId = 1;
  let workCallback = null;
  let NSAutoreleasePool = null;
  const bindings = /* @__PURE__ */ new Map();
  let readObjectIsa = null;
  const msgSendBySignatureId = /* @__PURE__ */ new Map();
  const msgSendSuperBySignatureId = /* @__PURE__ */ new Map();
  let cachedNSString = null;
  let cachedNSStringCtor = null;
  let cachedNSNumber = null;
  let cachedNSNumberCtor = null;
  let singularTypeById = null;
  let modifiers = null;
  try {
    tryInitialize();
  } catch (e) {
  }
  function tryInitialize() {
    if (api !== null)
      return true;
    if (apiError !== null)
      throw apiError;
    try {
      api = getApi();
    } catch (e) {
      apiError = e;
      throw e;
    }
    return api !== null;
  }
  function dispose() {
    for (const [rawMethodHandle, impls] of replacedMethods.entries()) {
      const methodHandle = ptr(rawMethodHandle);
      const [oldImp, newImp] = impls;
      if (api.method_getImplementation(methodHandle).equals(newImp))
        api.method_setImplementation(methodHandle, oldImp);
    }
    replacedMethods.clear();
  }
  Script.bindWeak(this, dispose);
  Object.defineProperty(this, "available", {
    enumerable: true,
    get() {
      return tryInitialize();
    }
  });
  Object.defineProperty(this, "api", {
    enumerable: true,
    get() {
      return getApi();
    }
  });
  Object.defineProperty(this, "classes", {
    enumerable: true,
    value: classRegistry
  });
  Object.defineProperty(this, "protocols", {
    enumerable: true,
    value: protocolRegistry
  });
  Object.defineProperty(this, "Object", {
    enumerable: true,
    value: ObjCObject
  });
  Object.defineProperty(this, "Protocol", {
    enumerable: true,
    value: ObjCProtocol
  });
  Object.defineProperty(this, "Block", {
    enumerable: true,
    value: Block
  });
  Object.defineProperty(this, "mainQueue", {
    enumerable: true,
    get() {
      return api?._dispatch_main_q ?? null;
    }
  });
  Object.defineProperty(this, "registerProxy", {
    enumerable: true,
    value: registerProxy
  });
  Object.defineProperty(this, "registerClass", {
    enumerable: true,
    value: registerClass
  });
  Object.defineProperty(this, "registerProtocol", {
    enumerable: true,
    value: registerProtocol
  });
  Object.defineProperty(this, "bind", {
    enumerable: true,
    value: bind
  });
  Object.defineProperty(this, "unbind", {
    enumerable: true,
    value: unbind
  });
  Object.defineProperty(this, "getBoundData", {
    enumerable: true,
    value: getBoundData
  });
  Object.defineProperty(this, "enumerateLoadedClasses", {
    enumerable: true,
    value: enumerateLoadedClasses
  });
  Object.defineProperty(this, "enumerateLoadedClassesSync", {
    enumerable: true,
    value: enumerateLoadedClassesSync
  });
  Object.defineProperty(this, "choose", {
    enumerable: true,
    value: choose
  });
  Object.defineProperty(this, "chooseSync", {
    enumerable: true,
    value(specifier) {
      const instances = [];
      choose(specifier, {
        onMatch(i) {
          instances.push(i);
        },
        onComplete() {
        }
      });
      return instances;
    }
  });
  this.schedule = function(queue, work) {
    const id = ptr(nextId++);
    scheduledWork.set(id.toString(), work);
    if (workCallback === null) {
      workCallback = new NativeCallback(performScheduledWorkItem, "void", ["pointer"]);
    }
    Script.pin();
    api.dispatch_async_f(queue, id, workCallback);
  };
  function performScheduledWorkItem(rawId) {
    const id = rawId.toString();
    const work = scheduledWork.get(id);
    scheduledWork.delete(id);
    if (NSAutoreleasePool === null)
      NSAutoreleasePool = classRegistry.NSAutoreleasePool;
    const pool = NSAutoreleasePool.alloc().init();
    let pendingException = null;
    try {
      work();
    } catch (e) {
      pendingException = e;
    }
    pool.release();
    setImmediate(performScheduledWorkCleanup, pendingException);
  }
  function performScheduledWorkCleanup(pendingException) {
    Script.unpin();
    if (pendingException !== null) {
      throw pendingException;
    }
  }
  this.implement = function(method2, fn) {
    return new NativeCallback(fn, method2.returnType, method2.argumentTypes);
  };
  this.selector = selector;
  this.selectorAsString = selectorAsString;
  function selector(name2) {
    return api.sel_registerName(Memory.allocUtf8String(name2));
  }
  function selectorAsString(sel2) {
    return api.sel_getName(sel2).readUtf8String();
  }
  const registryBuiltins = /* @__PURE__ */ new Set([
    "prototype",
    "constructor",
    "hasOwnProperty",
    "toJSON",
    "toString",
    "valueOf"
  ]);
  function ClassRegistry() {
    const cachedClasses = {};
    let numCachedClasses = 0;
    const registry = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
            return toString2;
          case "valueOf":
            return valueOf;
          default:
            const klass = findClass(property);
            return klass !== null ? klass : void 0;
        }
      },
      set(target, property, value, receiver) {
        return false;
      },
      ownKeys(target) {
        if (api === null)
          return [];
        let numClasses = api.objc_getClassList(NULL, 0);
        if (numClasses !== numCachedClasses) {
          const classHandles = Memory.alloc(numClasses * pointerSize);
          numClasses = api.objc_getClassList(classHandles, numClasses);
          for (let i = 0; i !== numClasses; i++) {
            const handle2 = classHandles.add(i * pointerSize).readPointer();
            const name2 = api.class_getName(handle2).readUtf8String();
            cachedClasses[name2] = handle2;
          }
          numCachedClasses = numClasses;
        }
        return Object.keys(cachedClasses);
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    });
    function hasProperty(name2) {
      if (registryBuiltins.has(name2))
        return true;
      return findClass(name2) !== null;
    }
    function getClass(name2) {
      const cls = findClass(name2);
      if (cls === null)
        throw new Error("Unable to find class '" + name2 + "'");
      return cls;
    }
    function findClass(name2) {
      let handle2 = cachedClasses[name2];
      if (handle2 === void 0) {
        handle2 = api.objc_lookUpClass(Memory.allocUtf8String(name2));
        if (handle2.isNull())
          return null;
        cachedClasses[name2] = handle2;
        numCachedClasses++;
      }
      return new ObjCObject(handle2, void 0, true);
    }
    function toJSON2() {
      return Object.keys(registry).reduce(function(r, name2) {
        r[name2] = getClass(name2).toJSON();
        return r;
      }, {});
    }
    function toString2() {
      return "ClassRegistry";
    }
    function valueOf() {
      return "ClassRegistry";
    }
    return registry;
  }
  function ProtocolRegistry() {
    let cachedProtocols = {};
    let numCachedProtocols = 0;
    const registry = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
            return toString2;
          case "valueOf":
            return valueOf;
          default:
            const proto = findProtocol(property);
            return proto !== null ? proto : void 0;
        }
      },
      set(target, property, value, receiver) {
        return false;
      },
      ownKeys(target) {
        if (api === null)
          return [];
        const numProtocolsBuf = Memory.alloc(pointerSize);
        const protocolHandles = api.objc_copyProtocolList(numProtocolsBuf);
        try {
          const numProtocols = numProtocolsBuf.readUInt();
          if (numProtocols !== numCachedProtocols) {
            cachedProtocols = {};
            for (let i = 0; i !== numProtocols; i++) {
              const handle2 = protocolHandles.add(i * pointerSize).readPointer();
              const name2 = api.protocol_getName(handle2).readUtf8String();
              cachedProtocols[name2] = handle2;
            }
            numCachedProtocols = numProtocols;
          }
        } finally {
          api.free(protocolHandles);
        }
        return Object.keys(cachedProtocols);
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    });
    function hasProperty(name2) {
      if (registryBuiltins.has(name2))
        return true;
      return findProtocol(name2) !== null;
    }
    function findProtocol(name2) {
      let handle2 = cachedProtocols[name2];
      if (handle2 === void 0) {
        handle2 = api.objc_getProtocol(Memory.allocUtf8String(name2));
        if (handle2.isNull())
          return null;
        cachedProtocols[name2] = handle2;
        numCachedProtocols++;
      }
      return new ObjCProtocol(handle2);
    }
    function toJSON2() {
      return Object.keys(registry).reduce(function(r, name2) {
        r[name2] = { handle: cachedProtocols[name2] };
        return r;
      }, {});
    }
    function toString2() {
      return "ProtocolRegistry";
    }
    function valueOf() {
      return "ProtocolRegistry";
    }
    return registry;
  }
  const objCObjectBuiltins = /* @__PURE__ */ new Set([
    "prototype",
    "constructor",
    "handle",
    "hasOwnProperty",
    "toJSON",
    "toString",
    "valueOf",
    "equals",
    "$kind",
    "$super",
    "$superClass",
    "$class",
    "$className",
    "$moduleName",
    "$protocols",
    "$methods",
    "$ownMethods",
    "$ivars"
  ]);
  function ObjCObject(handle2, protocol, cachedIsClass, superSpecifier2) {
    let cachedClassHandle = null;
    let cachedKind = null;
    let cachedSuper = null;
    let cachedSuperClass = null;
    let cachedClass = null;
    let cachedClassName = null;
    let cachedModuleName = null;
    let cachedProtocols = null;
    let cachedMethodNames = null;
    let cachedProtocolMethods = null;
    let respondsToSelector = null;
    const cachedMethods2 = {};
    let cachedNativeMethodNames = null;
    let cachedOwnMethodNames = null;
    let cachedIvars = null;
    handle2 = getHandle(handle2);
    if (cachedIsClass === void 0) {
      const klass = api.object_getClass(handle2);
      const key = klass.toString();
      if (!realizedClasses.has(key)) {
        api.objc_lookUpClass(api.class_getName(klass));
        realizedClasses.add(key);
      }
    }
    const self = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "handle":
            return handle2;
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
          case "valueOf":
            const descriptionImpl = receiver.description;
            if (descriptionImpl !== void 0) {
              const description = descriptionImpl.call(receiver);
              if (description !== null)
                return description.UTF8String.bind(description);
            }
            return function() {
              return receiver.$className;
            };
          case "equals":
            return equals2;
          case "$kind":
            if (cachedKind === null) {
              if (isClass())
                cachedKind = api.class_isMetaClass(handle2) ? "meta-class" : "class";
              else
                cachedKind = "instance";
            }
            return cachedKind;
          case "$super":
            if (cachedSuper === null) {
              const superHandle = api.class_getSuperclass(classHandle());
              if (!superHandle.isNull()) {
                const specifier = Memory.alloc(2 * pointerSize);
                specifier.writePointer(handle2);
                specifier.add(pointerSize).writePointer(superHandle);
                cachedSuper = [new ObjCObject(handle2, void 0, cachedIsClass, specifier)];
              } else {
                cachedSuper = [null];
              }
            }
            return cachedSuper[0];
          case "$superClass":
            if (cachedSuperClass === null) {
              const superClassHandle = api.class_getSuperclass(classHandle());
              if (!superClassHandle.isNull()) {
                cachedSuperClass = [new ObjCObject(superClassHandle)];
              } else {
                cachedSuperClass = [null];
              }
            }
            return cachedSuperClass[0];
          case "$class":
            if (cachedClass === null)
              cachedClass = new ObjCObject(api.object_getClass(handle2), void 0, true);
            return cachedClass;
          case "$className":
            if (cachedClassName === null) {
              if (superSpecifier2)
                cachedClassName = api.class_getName(superSpecifier2.add(pointerSize).readPointer()).readUtf8String();
              else if (isClass())
                cachedClassName = api.class_getName(handle2).readUtf8String();
              else
                cachedClassName = api.object_getClassName(handle2).readUtf8String();
            }
            return cachedClassName;
          case "$moduleName":
            if (cachedModuleName === null) {
              cachedModuleName = api.class_getImageName(classHandle()).readUtf8String();
            }
            return cachedModuleName;
          case "$protocols":
            if (cachedProtocols === null) {
              cachedProtocols = {};
              const numProtocolsBuf = Memory.alloc(pointerSize);
              const protocolHandles = api.class_copyProtocolList(classHandle(), numProtocolsBuf);
              if (!protocolHandles.isNull()) {
                try {
                  const numProtocols = numProtocolsBuf.readUInt();
                  for (let i = 0; i !== numProtocols; i++) {
                    const protocolHandle = protocolHandles.add(i * pointerSize).readPointer();
                    const p = new ObjCProtocol(protocolHandle);
                    cachedProtocols[p.name] = p;
                  }
                } finally {
                  api.free(protocolHandles);
                }
              }
            }
            return cachedProtocols;
          case "$methods":
            if (cachedNativeMethodNames === null) {
              const klass = superSpecifier2 ? superSpecifier2.add(pointerSize).readPointer() : classHandle();
              const meta = api.object_getClass(klass);
              const names = /* @__PURE__ */ new Set();
              let cur = meta;
              do {
                for (let methodName of collectMethodNames(cur, "+ "))
                  names.add(methodName);
                cur = api.class_getSuperclass(cur);
              } while (!cur.isNull());
              cur = klass;
              do {
                for (let methodName of collectMethodNames(cur, "- "))
                  names.add(methodName);
                cur = api.class_getSuperclass(cur);
              } while (!cur.isNull());
              cachedNativeMethodNames = Array.from(names);
            }
            return cachedNativeMethodNames;
          case "$ownMethods":
            if (cachedOwnMethodNames === null) {
              const klass = superSpecifier2 ? superSpecifier2.add(pointerSize).readPointer() : classHandle();
              const meta = api.object_getClass(klass);
              const classMethods = collectMethodNames(meta, "+ ");
              const instanceMethods = collectMethodNames(klass, "- ");
              cachedOwnMethodNames = classMethods.concat(instanceMethods);
            }
            return cachedOwnMethodNames;
          case "$ivars":
            if (cachedIvars === null) {
              if (isClass())
                cachedIvars = {};
              else
                cachedIvars = new ObjCIvars(self, classHandle());
            }
            return cachedIvars;
          default:
            if (typeof property === "symbol") {
              return target[property];
            }
            if (protocol) {
              const details = findProtocolMethod(property);
              if (details === null || !details.implemented)
                return void 0;
            }
            const wrapper = findMethodWrapper(property);
            if (wrapper === null)
              return void 0;
            return wrapper;
        }
      },
      set(target, property, value, receiver) {
        return false;
      },
      ownKeys(target) {
        if (cachedMethodNames === null) {
          if (!protocol) {
            const jsNames = {};
            const nativeNames = {};
            let cur = api.object_getClass(handle2);
            do {
              const numMethodsBuf = Memory.alloc(pointerSize);
              const methodHandles = api.class_copyMethodList(cur, numMethodsBuf);
              const fullNamePrefix = isClass() ? "+ " : "- ";
              try {
                const numMethods = numMethodsBuf.readUInt();
                for (let i = 0; i !== numMethods; i++) {
                  const methodHandle = methodHandles.add(i * pointerSize).readPointer();
                  const sel2 = api.method_getName(methodHandle);
                  const nativeName = api.sel_getName(sel2).readUtf8String();
                  if (nativeNames[nativeName] !== void 0)
                    continue;
                  nativeNames[nativeName] = nativeName;
                  const jsName = jsMethodName(nativeName);
                  let serial = 2;
                  let name2 = jsName;
                  while (jsNames[name2] !== void 0) {
                    serial++;
                    name2 = jsName + serial;
                  }
                  jsNames[name2] = true;
                  const fullName = fullNamePrefix + nativeName;
                  if (cachedMethods2[fullName] === void 0) {
                    const details = {
                      sel: sel2,
                      handle: methodHandle,
                      wrapper: null
                    };
                    cachedMethods2[fullName] = details;
                    cachedMethods2[name2] = details;
                  }
                }
              } finally {
                api.free(methodHandles);
              }
              cur = api.class_getSuperclass(cur);
            } while (!cur.isNull());
            cachedMethodNames = Object.keys(jsNames);
          } else {
            const methodNames = [];
            const protocolMethods = allProtocolMethods();
            Object.keys(protocolMethods).forEach(function(methodName) {
              if (methodName[0] !== "+" && methodName[0] !== "-") {
                const details = protocolMethods[methodName];
                if (details.implemented) {
                  methodNames.push(methodName);
                }
              }
            });
            cachedMethodNames = methodNames;
          }
        }
        return ["handle"].concat(cachedMethodNames);
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    });
    if (protocol) {
      respondsToSelector = !isClass() ? findMethodWrapper("- respondsToSelector:") : null;
    }
    return self;
    function hasProperty(name2) {
      if (objCObjectBuiltins.has(name2))
        return true;
      if (protocol) {
        const details = findProtocolMethod(name2);
        return !!(details !== null && details.implemented);
      }
      return findMethod(name2) !== null;
    }
    function classHandle() {
      if (cachedClassHandle === null)
        cachedClassHandle = isClass() ? handle2 : api.object_getClass(handle2);
      return cachedClassHandle;
    }
    function isClass() {
      if (cachedIsClass === void 0) {
        if (api.object_isClass)
          cachedIsClass = !!api.object_isClass(handle2);
        else
          cachedIsClass = !!api.class_isMetaClass(api.object_getClass(handle2));
      }
      return cachedIsClass;
    }
    function findMethod(rawName) {
      let method2 = cachedMethods2[rawName];
      if (method2 !== void 0)
        return method2;
      const tokens = parseMethodName(rawName);
      const fullName = tokens[2];
      method2 = cachedMethods2[fullName];
      if (method2 !== void 0) {
        cachedMethods2[rawName] = method2;
        return method2;
      }
      const kind = tokens[0];
      const name2 = tokens[1];
      const sel2 = selector(name2);
      const defaultKind = isClass() ? "+" : "-";
      if (protocol) {
        const details = findProtocolMethod(fullName);
        if (details !== null) {
          method2 = {
            sel: sel2,
            types: details.types,
            wrapper: null,
            kind
          };
        }
      }
      if (method2 === void 0) {
        const methodHandle = kind === "+" ? api.class_getClassMethod(classHandle(), sel2) : api.class_getInstanceMethod(classHandle(), sel2);
        if (!methodHandle.isNull()) {
          method2 = {
            sel: sel2,
            handle: methodHandle,
            wrapper: null,
            kind
          };
        } else {
          if (isClass() || kind !== "-" || name2 === "forwardingTargetForSelector:" || name2 === "methodSignatureForSelector:") {
            return null;
          }
          let target = self;
          if ("- forwardingTargetForSelector:" in self) {
            const forwardingTarget = self.forwardingTargetForSelector_(sel2);
            if (forwardingTarget !== null && forwardingTarget.$kind === "instance") {
              target = forwardingTarget;
            } else {
              return null;
            }
          } else {
            return null;
          }
          const methodHandle2 = api.class_getInstanceMethod(api.object_getClass(target.handle), sel2);
          if (methodHandle2.isNull()) {
            return null;
          }
          let types2 = api.method_getTypeEncoding(methodHandle2).readUtf8String();
          if (types2 === null || types2 === "") {
            types2 = stealTypesFromProtocols(target, fullName);
            if (types2 === null)
              types2 = stealTypesFromProtocols(self, fullName);
            if (types2 === null)
              return null;
          }
          method2 = {
            sel: sel2,
            types: types2,
            wrapper: null,
            kind
          };
        }
      }
      cachedMethods2[fullName] = method2;
      cachedMethods2[rawName] = method2;
      if (kind === defaultKind)
        cachedMethods2[jsMethodName(name2)] = method2;
      return method2;
    }
    function stealTypesFromProtocols(klass, fullName) {
      const candidates = Object.keys(klass.$protocols).map((protocolName) => flatProtocolMethods({}, klass.$protocols[protocolName])).reduce((allMethods, methods) => {
        Object.assign(allMethods, methods);
        return allMethods;
      }, {});
      const method2 = candidates[fullName];
      if (method2 === void 0) {
        return null;
      }
      return method2.types;
    }
    function flatProtocolMethods(result2, protocol2) {
      if (protocol2.methods !== void 0) {
        Object.assign(result2, protocol2.methods);
      }
      if (protocol2.protocol !== void 0) {
        flatProtocolMethods(result2, protocol2.protocol);
      }
      return result2;
    }
    function findProtocolMethod(rawName) {
      const protocolMethods = allProtocolMethods();
      const details = protocolMethods[rawName];
      return details !== void 0 ? details : null;
    }
    function allProtocolMethods() {
      if (cachedProtocolMethods === null) {
        const methods = {};
        const protocols = collectProtocols(protocol);
        const defaultKind = isClass() ? "+" : "-";
        Object.keys(protocols).forEach(function(name2) {
          const p = protocols[name2];
          const m2 = p.methods;
          Object.keys(m2).forEach(function(fullMethodName) {
            const method2 = m2[fullMethodName];
            const methodName = fullMethodName.substr(2);
            const kind = fullMethodName[0];
            let didCheckImplemented = false;
            let implemented = false;
            const details = {
              types: method2.types
            };
            Object.defineProperty(details, "implemented", {
              get() {
                if (!didCheckImplemented) {
                  if (method2.required) {
                    implemented = true;
                  } else {
                    implemented = respondsToSelector !== null && respondsToSelector.call(self, selector(methodName));
                  }
                  didCheckImplemented = true;
                }
                return implemented;
              }
            });
            methods[fullMethodName] = details;
            if (kind === defaultKind)
              methods[jsMethodName(methodName)] = details;
          });
        });
        cachedProtocolMethods = methods;
      }
      return cachedProtocolMethods;
    }
    function findMethodWrapper(name2) {
      const method2 = findMethod(name2);
      if (method2 === null)
        return null;
      let wrapper = method2.wrapper;
      if (wrapper === null) {
        wrapper = makeMethodInvocationWrapper(method2, self, superSpecifier2, defaultInvocationOptions);
        method2.wrapper = wrapper;
      }
      return wrapper;
    }
    function parseMethodName(rawName) {
      const match = /([+\-])\s(\S+)/.exec(rawName);
      let name2, kind;
      if (match === null) {
        kind = isClass() ? "+" : "-";
        name2 = objcMethodName(rawName);
      } else {
        kind = match[1];
        name2 = match[2];
      }
      const fullName = [kind, name2].join(" ");
      return [kind, name2, fullName];
    }
    function toJSON2() {
      return {
        handle: handle2.toString()
      };
    }
    function equals2(ptr2) {
      return handle2.equals(getHandle(ptr2));
    }
  }
  function getReplacementMethodImplementation(methodHandle) {
    const existingEntry = replacedMethods.get(methodHandle.toString());
    if (existingEntry === void 0)
      return null;
    const [, newImp] = existingEntry;
    return newImp;
  }
  function replaceMethodImplementation(methodHandle, imp) {
    const key = methodHandle.toString();
    let oldImp;
    const existingEntry = replacedMethods.get(key);
    if (existingEntry !== void 0)
      [oldImp] = existingEntry;
    else
      oldImp = api.method_getImplementation(methodHandle);
    if (!imp.equals(oldImp))
      replacedMethods.set(key, [oldImp, imp]);
    else
      replacedMethods.delete(key);
    api.method_setImplementation(methodHandle, imp);
  }
  function collectMethodNames(klass, prefix) {
    const names = [];
    const numMethodsBuf = Memory.alloc(pointerSize);
    const methodHandles = api.class_copyMethodList(klass, numMethodsBuf);
    try {
      const numMethods = numMethodsBuf.readUInt();
      for (let i = 0; i !== numMethods; i++) {
        const methodHandle = methodHandles.add(i * pointerSize).readPointer();
        const sel2 = api.method_getName(methodHandle);
        const nativeName = api.sel_getName(sel2).readUtf8String();
        names.push(prefix + nativeName);
      }
    } finally {
      api.free(methodHandles);
    }
    return names;
  }
  function ObjCProtocol(handle2) {
    let cachedName = null;
    let cachedProtocols = null;
    let cachedProperties = null;
    let cachedMethods2 = null;
    Object.defineProperty(this, "handle", {
      value: handle2,
      enumerable: true
    });
    Object.defineProperty(this, "name", {
      get() {
        if (cachedName === null)
          cachedName = api.protocol_getName(handle2).readUtf8String();
        return cachedName;
      },
      enumerable: true
    });
    Object.defineProperty(this, "protocols", {
      get() {
        if (cachedProtocols === null) {
          cachedProtocols = {};
          const numProtocolsBuf = Memory.alloc(pointerSize);
          const protocolHandles = api.protocol_copyProtocolList(handle2, numProtocolsBuf);
          if (!protocolHandles.isNull()) {
            try {
              const numProtocols = numProtocolsBuf.readUInt();
              for (let i = 0; i !== numProtocols; i++) {
                const protocolHandle = protocolHandles.add(i * pointerSize).readPointer();
                const protocol = new ObjCProtocol(protocolHandle);
                cachedProtocols[protocol.name] = protocol;
              }
            } finally {
              api.free(protocolHandles);
            }
          }
        }
        return cachedProtocols;
      },
      enumerable: true
    });
    Object.defineProperty(this, "properties", {
      get() {
        if (cachedProperties === null) {
          cachedProperties = {};
          const numBuf = Memory.alloc(pointerSize);
          const propertyHandles = api.protocol_copyPropertyList(handle2, numBuf);
          if (!propertyHandles.isNull()) {
            try {
              const numProperties = numBuf.readUInt();
              for (let i = 0; i !== numProperties; i++) {
                const propertyHandle = propertyHandles.add(i * pointerSize).readPointer();
                const propName = api.property_getName(propertyHandle).readUtf8String();
                const attributes = {};
                const attributeEntries = api.property_copyAttributeList(propertyHandle, numBuf);
                if (!attributeEntries.isNull()) {
                  try {
                    const numAttributeValues = numBuf.readUInt();
                    for (let j = 0; j !== numAttributeValues; j++) {
                      const attributeEntry = attributeEntries.add(j * (2 * pointerSize));
                      const name2 = attributeEntry.readPointer().readUtf8String();
                      const value = attributeEntry.add(pointerSize).readPointer().readUtf8String();
                      attributes[name2] = value;
                    }
                  } finally {
                    api.free(attributeEntries);
                  }
                }
                cachedProperties[propName] = attributes;
              }
            } finally {
              api.free(propertyHandles);
            }
          }
        }
        return cachedProperties;
      },
      enumerable: true
    });
    Object.defineProperty(this, "methods", {
      get() {
        if (cachedMethods2 === null) {
          cachedMethods2 = {};
          const numBuf = Memory.alloc(pointerSize);
          collectMethods(cachedMethods2, numBuf, { required: true, instance: false });
          collectMethods(cachedMethods2, numBuf, { required: false, instance: false });
          collectMethods(cachedMethods2, numBuf, { required: true, instance: true });
          collectMethods(cachedMethods2, numBuf, { required: false, instance: true });
        }
        return cachedMethods2;
      },
      enumerable: true
    });
    function collectMethods(methods, numBuf, spec) {
      const methodDescValues = api.protocol_copyMethodDescriptionList(handle2, spec.required ? 1 : 0, spec.instance ? 1 : 0, numBuf);
      if (methodDescValues.isNull())
        return;
      try {
        const numMethodDescValues = numBuf.readUInt();
        for (let i = 0; i !== numMethodDescValues; i++) {
          const methodDesc = methodDescValues.add(i * (2 * pointerSize));
          const name2 = (spec.instance ? "- " : "+ ") + selectorAsString(methodDesc.readPointer());
          const types2 = methodDesc.add(pointerSize).readPointer().readUtf8String();
          methods[name2] = {
            required: spec.required,
            types: types2
          };
        }
      } finally {
        api.free(methodDescValues);
      }
    }
  }
  const objCIvarsBuiltins = /* @__PURE__ */ new Set([
    "prototype",
    "constructor",
    "hasOwnProperty",
    "toJSON",
    "toString",
    "valueOf"
  ]);
  function ObjCIvars(instance, classHandle) {
    const ivars = {};
    let cachedIvarNames = null;
    let classHandles = [];
    let currentClassHandle = classHandle;
    do {
      classHandles.unshift(currentClassHandle);
      currentClassHandle = api.class_getSuperclass(currentClassHandle);
    } while (!currentClassHandle.isNull());
    const numIvarsBuf = Memory.alloc(pointerSize);
    classHandles.forEach((c) => {
      const ivarHandles = api.class_copyIvarList(c, numIvarsBuf);
      try {
        const numIvars = numIvarsBuf.readUInt();
        for (let i = 0; i !== numIvars; i++) {
          const handle2 = ivarHandles.add(i * pointerSize).readPointer();
          const name2 = api.ivar_getName(handle2).readUtf8String();
          ivars[name2] = [handle2, null];
        }
      } finally {
        api.free(ivarHandles);
      }
    });
    const self = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
            return toString2;
          case "valueOf":
            return valueOf;
          default:
            const ivar = findIvar(property);
            if (ivar === null)
              return void 0;
            return ivar.get();
        }
      },
      set(target, property, value, receiver) {
        const ivar = findIvar(property);
        if (ivar === null)
          throw new Error("Unknown ivar");
        ivar.set(value);
        return true;
      },
      ownKeys(target) {
        if (cachedIvarNames === null)
          cachedIvarNames = Object.keys(ivars);
        return cachedIvarNames;
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: true,
          configurable: true,
          enumerable: true
        };
      }
    });
    return self;
    function findIvar(name2) {
      const entry = ivars[name2];
      if (entry === void 0)
        return null;
      let impl = entry[1];
      if (impl === null) {
        const ivar = entry[0];
        const offset = api.ivar_getOffset(ivar).toInt32();
        const address = instance.handle.add(offset);
        const type = parseType(api.ivar_getTypeEncoding(ivar).readUtf8String());
        const fromNative = type.fromNative || identityTransform;
        const toNative = type.toNative || identityTransform;
        let read2, write3;
        if (name2 === "isa") {
          read2 = readObjectIsa;
          write3 = function() {
            throw new Error("Unable to set the isa instance variable");
          };
        } else {
          read2 = type.read;
          write3 = type.write;
        }
        impl = {
          get() {
            return fromNative.call(instance, read2(address));
          },
          set(value) {
            write3(address, toNative.call(instance, value));
          }
        };
        entry[1] = impl;
      }
      return impl;
    }
    function hasProperty(name2) {
      if (objCIvarsBuiltins.has(name2))
        return true;
      return ivars.hasOwnProperty(name2);
    }
    function toJSON2() {
      return Object.keys(self).reduce(function(result2, name2) {
        result2[name2] = self[name2];
        return result2;
      }, {});
    }
    function toString2() {
      return "ObjCIvars";
    }
    function valueOf() {
      return "ObjCIvars";
    }
  }
  let blockDescriptorAllocSize, blockDescriptorDeclaredSize, blockDescriptorOffsets;
  let blockSize, blockOffsets;
  if (pointerSize === 4) {
    blockDescriptorAllocSize = 16;
    blockDescriptorDeclaredSize = 20;
    blockDescriptorOffsets = {
      reserved: 0,
      size: 4,
      rest: 8
    };
    blockSize = 20;
    blockOffsets = {
      isa: 0,
      flags: 4,
      reserved: 8,
      invoke: 12,
      descriptor: 16
    };
  } else {
    blockDescriptorAllocSize = 32;
    blockDescriptorDeclaredSize = 32;
    blockDescriptorOffsets = {
      reserved: 0,
      size: 8,
      rest: 16
    };
    blockSize = 32;
    blockOffsets = {
      isa: 0,
      flags: 8,
      reserved: 12,
      invoke: 16,
      descriptor: 24
    };
  }
  const BLOCK_HAS_COPY_DISPOSE = 1 << 25;
  const BLOCK_HAS_CTOR = 1 << 26;
  const BLOCK_IS_GLOBAL = 1 << 28;
  const BLOCK_HAS_STRET = 1 << 29;
  const BLOCK_HAS_SIGNATURE = 1 << 30;
  function Block(target, options = defaultInvocationOptions) {
    this._options = options;
    if (target instanceof NativePointer) {
      const descriptor = target.add(blockOffsets.descriptor).readPointer();
      this.handle = target;
      const flags = target.add(blockOffsets.flags).readU32();
      if ((flags & BLOCK_HAS_SIGNATURE) !== 0) {
        const signatureOffset = (flags & BLOCK_HAS_COPY_DISPOSE) !== 0 ? 2 : 0;
        this.types = descriptor.add(blockDescriptorOffsets.rest + signatureOffset * pointerSize).readPointer().readCString();
        this._signature = parseSignature(this.types);
      } else {
        this._signature = null;
      }
    } else {
      this.declare(target);
      const descriptor = Memory.alloc(blockDescriptorAllocSize + blockSize);
      const block2 = descriptor.add(blockDescriptorAllocSize);
      const typesStr = Memory.allocUtf8String(this.types);
      descriptor.add(blockDescriptorOffsets.reserved).writeULong(0);
      descriptor.add(blockDescriptorOffsets.size).writeULong(blockDescriptorDeclaredSize);
      descriptor.add(blockDescriptorOffsets.rest).writePointer(typesStr);
      block2.add(blockOffsets.isa).writePointer(classRegistry.__NSGlobalBlock__);
      block2.add(blockOffsets.flags).writeU32(BLOCK_HAS_SIGNATURE | BLOCK_IS_GLOBAL);
      block2.add(blockOffsets.reserved).writeU32(0);
      block2.add(blockOffsets.descriptor).writePointer(descriptor);
      this.handle = block2;
      this._storage = [descriptor, typesStr];
      this.implementation = target.implementation;
    }
  }
  Object.defineProperties(Block.prototype, {
    implementation: {
      enumerable: true,
      get() {
        const address = this.handle.add(blockOffsets.invoke).readPointer().strip();
        const signature2 = this._getSignature();
        return makeBlockInvocationWrapper(this, signature2, new NativeFunction(
          address.sign(),
          signature2.retType.type,
          signature2.argTypes.map(function(arg) {
            return arg.type;
          }),
          this._options
        ));
      },
      set(func) {
        const signature2 = this._getSignature();
        const callback = new NativeCallback(
          makeBlockImplementationWrapper(this, signature2, func),
          signature2.retType.type,
          signature2.argTypes.map(function(arg) {
            return arg.type;
          })
        );
        this._callback = callback;
        const location = this.handle.add(blockOffsets.invoke);
        const prot = Memory.queryProtection(location);
        const writable = prot.includes("w");
        if (!writable)
          Memory.protect(location, Process.pointerSize, "rw-");
        location.writePointer(callback.strip().sign("ia", location));
        if (!writable)
          Memory.protect(location, Process.pointerSize, prot);
      }
    },
    declare: {
      value(signature2) {
        let types2 = signature2.types;
        if (types2 === void 0) {
          types2 = unparseSignature(signature2.retType, ["block"].concat(signature2.argTypes));
        }
        this.types = types2;
        this._signature = parseSignature(types2);
      }
    },
    _getSignature: {
      value() {
        const signature2 = this._signature;
        if (signature2 === null)
          throw new Error("block is missing signature; call declare()");
        return signature2;
      }
    }
  });
  function collectProtocols(p, acc) {
    acc = acc || {};
    acc[p.name] = p;
    const parentProtocols = p.protocols;
    Object.keys(parentProtocols).forEach(function(name2) {
      collectProtocols(parentProtocols[name2], acc);
    });
    return acc;
  }
  function registerProxy(properties) {
    const protocols = properties.protocols || [];
    const methods = properties.methods || {};
    const events = properties.events || {};
    const supportedSelectors = new Set(
      Object.keys(methods).filter((m2) => /([+\-])\s(\S+)/.exec(m2) !== null).map((m2) => m2.split(" ")[1])
    );
    const proxyMethods = {
      "- dealloc": function() {
        const target = this.data.target;
        if ("- release" in target)
          target.release();
        unbind(this.self);
        this.super.dealloc();
        const callback = this.data.events.dealloc;
        if (callback !== void 0)
          callback.call(this);
      },
      "- respondsToSelector:": function(sel2) {
        const selector2 = selectorAsString(sel2);
        if (supportedSelectors.has(selector2))
          return true;
        return this.data.target.respondsToSelector_(sel2);
      },
      "- forwardingTargetForSelector:": function(sel2) {
        const callback = this.data.events.forward;
        if (callback !== void 0)
          callback.call(this, selectorAsString(sel2));
        return this.data.target;
      },
      "- methodSignatureForSelector:": function(sel2) {
        return this.data.target.methodSignatureForSelector_(sel2);
      },
      "- forwardInvocation:": function(invocation) {
        invocation.invokeWithTarget_(this.data.target);
      }
    };
    for (var key in methods) {
      if (methods.hasOwnProperty(key)) {
        if (proxyMethods.hasOwnProperty(key))
          throw new Error("The '" + key + "' method is reserved");
        proxyMethods[key] = methods[key];
      }
    }
    const ProxyClass = registerClass({
      name: properties.name,
      super: classRegistry.NSProxy,
      protocols,
      methods: proxyMethods
    });
    return function(target, data) {
      target = target instanceof NativePointer ? new ObjCObject(target) : target;
      data = data || {};
      const instance = ProxyClass.alloc().autorelease();
      const boundData = getBoundData(instance);
      boundData.target = "- retain" in target ? target.retain() : target;
      boundData.events = events;
      for (var key2 in data) {
        if (data.hasOwnProperty(key2)) {
          if (boundData.hasOwnProperty(key2))
            throw new Error("The '" + key2 + "' property is reserved");
          boundData[key2] = data[key2];
        }
      }
      this.handle = instance.handle;
    };
  }
  function registerClass(properties) {
    let name2 = properties.name;
    if (name2 === void 0)
      name2 = makeClassName();
    const superClass = properties.super !== void 0 ? properties.super : classRegistry.NSObject;
    const protocols = properties.protocols || [];
    const methods = properties.methods || {};
    const methodCallbacks = [];
    const classHandle = api.objc_allocateClassPair(superClass !== null ? superClass.handle : NULL, Memory.allocUtf8String(name2), ptr("0"));
    if (classHandle.isNull())
      throw new Error("Unable to register already registered class '" + name2 + "'");
    const metaClassHandle = api.object_getClass(classHandle);
    try {
      protocols.forEach(function(protocol) {
        api.class_addProtocol(classHandle, protocol.handle);
      });
      Object.keys(methods).forEach(function(rawMethodName) {
        const match = /([+\-])\s(\S+)/.exec(rawMethodName);
        if (match === null)
          throw new Error("Invalid method name");
        const kind = match[1];
        const name3 = match[2];
        let method2;
        const value = methods[rawMethodName];
        if (typeof value === "function") {
          let types3 = null;
          if (rawMethodName in superClass) {
            types3 = superClass[rawMethodName].types;
          } else {
            for (let protocol of protocols) {
              const method3 = protocol.methods[rawMethodName];
              if (method3 !== void 0) {
                types3 = method3.types;
                break;
              }
            }
          }
          if (types3 === null)
            throw new Error("Unable to find '" + rawMethodName + "' in super-class or any of its protocols");
          method2 = {
            types: types3,
            implementation: value
          };
        } else {
          method2 = value;
        }
        const target = kind === "+" ? metaClassHandle : classHandle;
        let types2 = method2.types;
        if (types2 === void 0) {
          types2 = unparseSignature(method2.retType, [kind === "+" ? "class" : "object", "selector"].concat(method2.argTypes));
        }
        const signature2 = parseSignature(types2);
        const implementation2 = new NativeCallback(
          makeMethodImplementationWrapper(signature2, method2.implementation),
          signature2.retType.type,
          signature2.argTypes.map(function(arg) {
            return arg.type;
          })
        );
        methodCallbacks.push(implementation2);
        api.class_addMethod(target, selector(name3), implementation2, Memory.allocUtf8String(types2));
      });
    } catch (e) {
      api.objc_disposeClassPair(classHandle);
      throw e;
    }
    api.objc_registerClassPair(classHandle);
    classHandle._methodCallbacks = methodCallbacks;
    Script.bindWeak(classHandle, makeClassDestructor(ptr(classHandle)));
    return new ObjCObject(classHandle);
  }
  function makeClassDestructor(classHandle) {
    return function() {
      api.objc_disposeClassPair(classHandle);
    };
  }
  function registerProtocol(properties) {
    let name2 = properties.name;
    if (name2 === void 0)
      name2 = makeProtocolName();
    const protocols = properties.protocols || [];
    const methods = properties.methods || {};
    protocols.forEach(function(protocol) {
      if (!(protocol instanceof ObjCProtocol))
        throw new Error("Expected protocol");
    });
    const methodSpecs = Object.keys(methods).map(function(rawMethodName) {
      const method2 = methods[rawMethodName];
      const match = /([+\-])\s(\S+)/.exec(rawMethodName);
      if (match === null)
        throw new Error("Invalid method name");
      const kind = match[1];
      const name3 = match[2];
      let types2 = method2.types;
      if (types2 === void 0) {
        types2 = unparseSignature(method2.retType, [kind === "+" ? "class" : "object", "selector"].concat(method2.argTypes));
      }
      return {
        kind,
        name: name3,
        types: types2,
        optional: method2.optional
      };
    });
    const handle2 = api.objc_allocateProtocol(Memory.allocUtf8String(name2));
    if (handle2.isNull())
      throw new Error("Unable to register already registered protocol '" + name2 + "'");
    protocols.forEach(function(protocol) {
      api.protocol_addProtocol(handle2, protocol.handle);
    });
    methodSpecs.forEach(function(spec) {
      const isRequiredMethod = spec.optional ? 0 : 1;
      const isInstanceMethod = spec.kind === "-" ? 1 : 0;
      api.protocol_addMethodDescription(handle2, selector(spec.name), Memory.allocUtf8String(spec.types), isRequiredMethod, isInstanceMethod);
    });
    api.objc_registerProtocol(handle2);
    return new ObjCProtocol(handle2);
  }
  function getHandle(obj) {
    if (obj instanceof NativePointer)
      return obj;
    else if (typeof obj === "object" && obj.hasOwnProperty("handle"))
      return obj.handle;
    else
      throw new Error("Expected NativePointer or ObjC.Object instance");
  }
  function bind(obj, data) {
    const handle2 = getHandle(obj);
    const self = obj instanceof ObjCObject ? obj : new ObjCObject(handle2);
    bindings.set(handle2.toString(), {
      self,
      super: self.$super,
      data
    });
  }
  function unbind(obj) {
    const handle2 = getHandle(obj);
    bindings.delete(handle2.toString());
  }
  function getBoundData(obj) {
    return getBinding(obj).data;
  }
  function getBinding(obj) {
    const handle2 = getHandle(obj);
    const key = handle2.toString();
    let binding2 = bindings.get(key);
    if (binding2 === void 0) {
      const self = obj instanceof ObjCObject ? obj : new ObjCObject(handle2);
      binding2 = {
        self,
        super: self.$super,
        data: {}
      };
      bindings.set(key, binding2);
    }
    return binding2;
  }
  function enumerateLoadedClasses(...args) {
    const allModules = new ModuleMap();
    let unfiltered = false;
    let callbacks;
    let modules;
    if (args.length === 1) {
      callbacks = args[0];
    } else {
      callbacks = args[1];
      const options = args[0];
      modules = options.ownedBy;
    }
    if (modules === void 0) {
      modules = allModules;
      unfiltered = true;
    }
    const classGetName = api.class_getName;
    const onMatch = callbacks.onMatch.bind(callbacks);
    const swiftNominalTypeDescriptorOffset = (pointerSize === 8 ? 8 : 11) * pointerSize;
    const numClasses = api.objc_getClassList(NULL, 0);
    const classHandles = Memory.alloc(numClasses * pointerSize);
    api.objc_getClassList(classHandles, numClasses);
    for (let i = 0; i !== numClasses; i++) {
      const classHandle = classHandles.add(i * pointerSize).readPointer();
      const rawName = classGetName(classHandle);
      let name2 = null;
      let modulePath = modules.findPath(rawName);
      const possiblySwift = modulePath === null && (unfiltered || allModules.findPath(rawName) === null);
      if (possiblySwift) {
        name2 = rawName.readCString();
        const probablySwift = name2.indexOf(".") !== -1;
        if (probablySwift) {
          const nominalTypeDescriptor = classHandle.add(swiftNominalTypeDescriptorOffset).readPointer();
          modulePath = modules.findPath(nominalTypeDescriptor);
        }
      }
      if (modulePath !== null) {
        if (name2 === null)
          name2 = rawName.readUtf8String();
        onMatch(name2, modulePath);
      }
    }
    callbacks.onComplete();
  }
  function enumerateLoadedClassesSync(options = {}) {
    const result2 = {};
    enumerateLoadedClasses(options, {
      onMatch(name2, owner2) {
        let group = result2[owner2];
        if (group === void 0) {
          group = [];
          result2[owner2] = group;
        }
        group.push(name2);
      },
      onComplete() {
      }
    });
    return result2;
  }
  function choose(specifier, callbacks) {
    let cls = specifier;
    let subclasses = true;
    if (!(specifier instanceof ObjCObject) && typeof specifier === "object") {
      cls = specifier.class;
      if (specifier.hasOwnProperty("subclasses"))
        subclasses = specifier.subclasses;
    }
    if (!(cls instanceof ObjCObject && (cls.$kind === "class" || cls.$kind === "meta-class")))
      throw new Error("Expected an ObjC.Object for a class or meta-class");
    const matches = get().choose(cls, subclasses).map((handle2) => new ObjCObject(handle2));
    for (const match of matches) {
      const result2 = callbacks.onMatch(match);
      if (result2 === "stop")
        break;
    }
    callbacks.onComplete();
  }
  function makeMethodInvocationWrapper(method, owner, superSpecifier, invocationOptions) {
    const sel = method.sel;
    let handle = method.handle;
    let types;
    if (handle === void 0) {
      handle = null;
      types = method.types;
    } else {
      types = api.method_getTypeEncoding(handle).readUtf8String();
    }
    const signature = parseSignature(types);
    const retType = signature.retType;
    const argTypes = signature.argTypes.slice(2);
    const objc_msgSend = superSpecifier ? getMsgSendSuperImpl(signature, invocationOptions) : getMsgSendImpl(signature, invocationOptions);
    const argVariableNames = argTypes.map(function(t, i) {
      return "a" + (i + 1);
    });
    const callArgs = [
      superSpecifier ? "superSpecifier" : "this",
      "sel"
    ].concat(argTypes.map(function(t, i) {
      if (t.toNative) {
        return "argTypes[" + i + "].toNative.call(this, " + argVariableNames[i] + ")";
      }
      return argVariableNames[i];
    }));
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.fromNative) {
      returnCaptureLeft = "return retType.fromNative.call(this, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const m = eval("var m = function (" + argVariableNames.join(", ") + ") { " + returnCaptureLeft + "objc_msgSend(" + callArgs.join(", ") + ")" + returnCaptureRight + "; }; m;");
    Object.defineProperty(m, "handle", {
      enumerable: true,
      get: getMethodHandle
    });
    m.selector = sel;
    Object.defineProperty(m, "implementation", {
      enumerable: true,
      get() {
        const h = getMethodHandle();
        const impl = new NativeFunction(api.method_getImplementation(h), m.returnType, m.argumentTypes, invocationOptions);
        const newImp = getReplacementMethodImplementation(h);
        if (newImp !== null)
          impl._callback = newImp;
        return impl;
      },
      set(imp) {
        replaceMethodImplementation(getMethodHandle(), imp);
      }
    });
    m.returnType = retType.type;
    m.argumentTypes = signature.argTypes.map((t) => t.type);
    m.types = types;
    Object.defineProperty(m, "symbol", {
      enumerable: true,
      get() {
        return `${method.kind}[${owner.$className} ${selectorAsString(sel)}]`;
      }
    });
    m.clone = function(options) {
      return makeMethodInvocationWrapper(method, owner, superSpecifier, options);
    };
    function getMethodHandle() {
      if (handle === null) {
        if (owner.$kind === "instance") {
          let cur = owner;
          do {
            if ("- forwardingTargetForSelector:" in cur) {
              const target = cur.forwardingTargetForSelector_(sel);
              if (target === null)
                break;
              if (target.$kind !== "instance")
                break;
              const h = api.class_getInstanceMethod(target.$class.handle, sel);
              if (!h.isNull())
                handle = h;
              else
                cur = target;
            } else {
              break;
            }
          } while (handle === null);
        }
        if (handle === null)
          throw new Error("Unable to find method handle of proxied function");
      }
      return handle;
    }
    return m;
  }
  function makeMethodImplementationWrapper(signature, implementation) {
    const retType = signature.retType;
    const argTypes = signature.argTypes;
    const argVariableNames = argTypes.map(function(t, i) {
      if (i === 0)
        return "handle";
      else if (i === 1)
        return "sel";
      else
        return "a" + (i - 1);
    });
    const callArgs = argTypes.slice(2).map(function(t, i) {
      const argVariableName = argVariableNames[2 + i];
      if (t.fromNative) {
        return "argTypes[" + (2 + i) + "].fromNative.call(self, " + argVariableName + ")";
      }
      return argVariableName;
    });
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.toNative) {
      returnCaptureLeft = "return retType.toNative.call(self, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const m = eval("var m = function (" + argVariableNames.join(", ") + ") { var binding = getBinding(handle);var self = binding.self;" + returnCaptureLeft + "implementation.call(binding" + (callArgs.length > 0 ? ", " : "") + callArgs.join(", ") + ")" + returnCaptureRight + "; }; m;");
    return m;
  }
  function makeBlockInvocationWrapper(block, signature, implementation) {
    const retType = signature.retType;
    const argTypes = signature.argTypes.slice(1);
    const argVariableNames = argTypes.map(function(t, i) {
      return "a" + (i + 1);
    });
    const callArgs = argTypes.map(function(t, i) {
      if (t.toNative) {
        return "argTypes[" + i + "].toNative.call(this, " + argVariableNames[i] + ")";
      }
      return argVariableNames[i];
    });
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.fromNative) {
      returnCaptureLeft = "return retType.fromNative.call(this, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const f = eval("var f = function (" + argVariableNames.join(", ") + ") { " + returnCaptureLeft + "implementation(this" + (callArgs.length > 0 ? ", " : "") + callArgs.join(", ") + ")" + returnCaptureRight + "; }; f;");
    return f.bind(block);
  }
  function makeBlockImplementationWrapper(block, signature, implementation) {
    const retType = signature.retType;
    const argTypes = signature.argTypes;
    const argVariableNames = argTypes.map(function(t, i) {
      if (i === 0)
        return "handle";
      else
        return "a" + i;
    });
    const callArgs = argTypes.slice(1).map(function(t, i) {
      const argVariableName = argVariableNames[1 + i];
      if (t.fromNative) {
        return "argTypes[" + (1 + i) + "].fromNative.call(this, " + argVariableName + ")";
      }
      return argVariableName;
    });
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.toNative) {
      returnCaptureLeft = "return retType.toNative.call(this, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const f = eval("var f = function (" + argVariableNames.join(", ") + ") { if (!this.handle.equals(handle))this.handle = handle;" + returnCaptureLeft + "implementation.call(block" + (callArgs.length > 0 ? ", " : "") + callArgs.join(", ") + ")" + returnCaptureRight + "; }; f;");
    return f.bind(block);
  }
  function rawFridaType(t) {
    return t === "object" ? "pointer" : t;
  }
  function makeClassName() {
    for (let i = 1; true; i++) {
      const name2 = "FridaAnonymousClass" + i;
      if (!(name2 in classRegistry)) {
        return name2;
      }
    }
  }
  function makeProtocolName() {
    for (let i = 1; true; i++) {
      const name2 = "FridaAnonymousProtocol" + i;
      if (!(name2 in protocolRegistry)) {
        return name2;
      }
    }
  }
  function objcMethodName(name2) {
    return name2.replace(/_/g, ":");
  }
  function jsMethodName(name2) {
    let result2 = name2.replace(/:/g, "_");
    if (objCObjectBuiltins.has(result2))
      result2 += "2";
    return result2;
  }
  const isaMasks = {
    x64: "0x7ffffffffff8",
    arm64: "0xffffffff8"
  };
  const rawMask = isaMasks[Process.arch];
  if (rawMask !== void 0) {
    const mask = ptr(rawMask);
    readObjectIsa = function(p) {
      return p.readPointer().and(mask);
    };
  } else {
    readObjectIsa = function(p) {
      return p.readPointer();
    };
  }
  function getMsgSendImpl(signature2, invocationOptions2) {
    return resolveMsgSendImpl(msgSendBySignatureId, signature2, invocationOptions2, false);
  }
  function getMsgSendSuperImpl(signature2, invocationOptions2) {
    return resolveMsgSendImpl(msgSendSuperBySignatureId, signature2, invocationOptions2, true);
  }
  function resolveMsgSendImpl(cache, signature2, invocationOptions2, isSuper) {
    if (invocationOptions2 !== defaultInvocationOptions)
      return makeMsgSendImpl(signature2, invocationOptions2, isSuper);
    const { id } = signature2;
    let impl = cache.get(id);
    if (impl === void 0) {
      impl = makeMsgSendImpl(signature2, invocationOptions2, isSuper);
      cache.set(id, impl);
    }
    return impl;
  }
  function makeMsgSendImpl(signature2, invocationOptions2, isSuper) {
    const retType2 = signature2.retType.type;
    const argTypes2 = signature2.argTypes.map(function(t) {
      return t.type;
    });
    const components = ["objc_msgSend"];
    if (isSuper)
      components.push("Super");
    const returnsStruct = retType2 instanceof Array;
    if (returnsStruct && !typeFitsInRegisters(retType2))
      components.push("_stret");
    else if (retType2 === "float" || retType2 === "double")
      components.push("_fpret");
    const name2 = components.join("");
    return new NativeFunction(api[name2], retType2, argTypes2, invocationOptions2);
  }
  function typeFitsInRegisters(type) {
    if (Process.arch !== "x64")
      return false;
    const size = sizeOfTypeOnX64(type);
    return size <= 16;
  }
  function sizeOfTypeOnX64(type) {
    if (type instanceof Array)
      return type.reduce((total, field) => total + sizeOfTypeOnX64(field), 0);
    switch (type) {
      case "bool":
      case "char":
      case "uchar":
        return 1;
      case "int16":
      case "uint16":
        return 2;
      case "int":
      case "int32":
      case "uint":
      case "uint32":
      case "float":
        return 4;
      default:
        return 8;
    }
  }
  function unparseSignature(retType2, argTypes2) {
    const retTypeId = typeIdFromAlias(retType2);
    const argTypeIds = argTypes2.map(typeIdFromAlias);
    const argSizes = argTypeIds.map((id) => singularTypeById[id].size);
    const frameSize = argSizes.reduce((total, size) => total + size, 0);
    let frameOffset = 0;
    return retTypeId + frameSize + argTypeIds.map((id, i) => {
      const result2 = id + frameOffset;
      frameOffset += argSizes[i];
      return result2;
    }).join("");
  }
  function parseSignature(sig) {
    const cursor = [sig, 0];
    parseQualifiers(cursor);
    const retType2 = readType(cursor);
    readNumber(cursor);
    const argTypes2 = [];
    let id = JSON.stringify(retType2.type);
    while (dataAvailable(cursor)) {
      parseQualifiers(cursor);
      const argType = readType(cursor);
      readNumber(cursor);
      argTypes2.push(argType);
      id += JSON.stringify(argType.type);
    }
    return {
      id,
      retType: retType2,
      argTypes: argTypes2
    };
  }
  function parseType(type) {
    const cursor = [type, 0];
    return readType(cursor);
  }
  function readType(cursor) {
    let id = readChar(cursor);
    if (id === "@") {
      let next = peekChar(cursor);
      if (next === "?") {
        id += next;
        skipChar(cursor);
        if (peekChar(cursor) === "<")
          skipExtendedBlock(cursor);
      } else if (next === '"') {
        skipChar(cursor);
        readUntil('"', cursor);
      }
    } else if (id === "^") {
      let next = peekChar(cursor);
      if (next === "@") {
        id += next;
        skipChar(cursor);
      }
    }
    const type = singularTypeById[id];
    if (type !== void 0) {
      return type;
    } else if (id === "[") {
      const length = readNumber(cursor);
      const elementType = readType(cursor);
      skipChar(cursor);
      return arrayType(length, elementType);
    } else if (id === "{") {
      if (!tokenExistsAhead("=", "}", cursor)) {
        readUntil("}", cursor);
        return structType([]);
      }
      readUntil("=", cursor);
      const structFields = [];
      let ch;
      while ((ch = peekChar(cursor)) !== "}") {
        if (ch === '"') {
          skipChar(cursor);
          readUntil('"', cursor);
        }
        structFields.push(readType(cursor));
      }
      skipChar(cursor);
      return structType(structFields);
    } else if (id === "(") {
      readUntil("=", cursor);
      const unionFields = [];
      while (peekChar(cursor) !== ")")
        unionFields.push(readType(cursor));
      skipChar(cursor);
      return unionType(unionFields);
    } else if (id === "b") {
      readNumber(cursor);
      return singularTypeById.i;
    } else if (id === "^") {
      readType(cursor);
      return singularTypeById["?"];
    } else if (modifiers.has(id)) {
      return readType(cursor);
    } else {
      throw new Error("Unable to handle type " + id);
    }
  }
  function skipExtendedBlock(cursor) {
    let ch;
    skipChar(cursor);
    while ((ch = peekChar(cursor)) !== ">") {
      if (peekChar(cursor) === "<") {
        skipExtendedBlock(cursor);
      } else {
        skipChar(cursor);
        if (ch === '"')
          readUntil('"', cursor);
      }
    }
    skipChar(cursor);
  }
  function readNumber(cursor) {
    let result2 = "";
    while (dataAvailable(cursor)) {
      const c = peekChar(cursor);
      const v = c.charCodeAt(0);
      const isDigit = v >= 48 && v <= 57;
      if (isDigit) {
        result2 += c;
        skipChar(cursor);
      } else {
        break;
      }
    }
    return parseInt(result2);
  }
  function readUntil(token, cursor) {
    const buffer = cursor[0];
    const offset = cursor[1];
    const index = buffer.indexOf(token, offset);
    if (index === -1)
      throw new Error("Expected token '" + token + "' not found");
    const result2 = buffer.substring(offset, index);
    cursor[1] = index + 1;
    return result2;
  }
  function readChar(cursor) {
    return cursor[0][cursor[1]++];
  }
  function peekChar(cursor) {
    return cursor[0][cursor[1]];
  }
  function tokenExistsAhead(token, terminator, cursor) {
    const [buffer, offset] = cursor;
    const tokenIndex = buffer.indexOf(token, offset);
    if (tokenIndex === -1)
      return false;
    const terminatorIndex = buffer.indexOf(terminator, offset);
    if (terminatorIndex === -1)
      throw new Error("Expected to find terminator: " + terminator);
    return tokenIndex < terminatorIndex;
  }
  function skipChar(cursor) {
    cursor[1]++;
  }
  function dataAvailable(cursor) {
    return cursor[1] !== cursor[0].length;
  }
  const qualifierById = {
    "r": "const",
    "n": "in",
    "N": "inout",
    "o": "out",
    "O": "bycopy",
    "R": "byref",
    "V": "oneway"
  };
  function parseQualifiers(cursor) {
    const qualifiers = [];
    while (true) {
      const q = qualifierById[peekChar(cursor)];
      if (q === void 0)
        break;
      qualifiers.push(q);
      skipChar(cursor);
    }
    return qualifiers;
  }
  const idByAlias = {
    "char": "c",
    "int": "i",
    "int16": "s",
    "int32": "i",
    "int64": "q",
    "uchar": "C",
    "uint": "I",
    "uint16": "S",
    "uint32": "I",
    "uint64": "Q",
    "float": "f",
    "double": "d",
    "bool": "B",
    "void": "v",
    "string": "*",
    "object": "@",
    "block": "@?",
    "class": "#",
    "selector": ":",
    "pointer": "^v"
  };
  function typeIdFromAlias(alias) {
    if (typeof alias === "object" && alias !== null)
      return `@"${alias.type}"`;
    const id = idByAlias[alias];
    if (id === void 0)
      throw new Error("No known encoding for type " + alias);
    return id;
  }
  const fromNativeId = function(h) {
    if (h.isNull()) {
      return null;
    } else if (h.toString(16) === this.handle.toString(16)) {
      return this;
    } else {
      return new ObjCObject(h);
    }
  };
  const toNativeId = function(v) {
    if (v === null)
      return NULL;
    const type = typeof v;
    if (type === "string") {
      if (cachedNSStringCtor === null) {
        cachedNSString = classRegistry.NSString;
        cachedNSStringCtor = cachedNSString.stringWithUTF8String_;
      }
      return cachedNSStringCtor.call(cachedNSString, Memory.allocUtf8String(v));
    } else if (type === "number") {
      if (cachedNSNumberCtor === null) {
        cachedNSNumber = classRegistry.NSNumber;
        cachedNSNumberCtor = cachedNSNumber.numberWithDouble_;
      }
      return cachedNSNumberCtor.call(cachedNSNumber, v);
    }
    return v;
  };
  const fromNativeBlock = function(h) {
    if (h.isNull()) {
      return null;
    } else if (h.toString(16) === this.handle.toString(16)) {
      return this;
    } else {
      return new Block(h);
    }
  };
  const toNativeBlock = function(v) {
    return v !== null ? v : NULL;
  };
  const toNativeObjectArray = function(v) {
    if (v instanceof Array) {
      const length = v.length;
      const array = Memory.alloc(length * pointerSize);
      for (let i = 0; i !== length; i++)
        array.add(i * pointerSize).writePointer(toNativeId(v[i]));
      return array;
    }
    return v;
  };
  function arrayType(length, elementType) {
    return {
      type: "pointer",
      read(address) {
        const result2 = [];
        const elementSize = elementType.size;
        for (let index = 0; index !== length; index++) {
          result2.push(elementType.read(address.add(index * elementSize)));
        }
        return result2;
      },
      write(address, values) {
        const elementSize = elementType.size;
        values.forEach((value, index) => {
          elementType.write(address.add(index * elementSize), value);
        });
      }
    };
  }
  function structType(fieldTypes) {
    let fromNative, toNative;
    if (fieldTypes.some(function(t) {
      return !!t.fromNative;
    })) {
      const fromTransforms = fieldTypes.map(function(t) {
        if (t.fromNative)
          return t.fromNative;
        else
          return identityTransform;
      });
      fromNative = function(v) {
        return v.map(function(e, i) {
          return fromTransforms[i].call(this, e);
        });
      };
    } else {
      fromNative = identityTransform;
    }
    if (fieldTypes.some(function(t) {
      return !!t.toNative;
    })) {
      const toTransforms = fieldTypes.map(function(t) {
        if (t.toNative)
          return t.toNative;
        else
          return identityTransform;
      });
      toNative = function(v) {
        return v.map(function(e, i) {
          return toTransforms[i].call(this, e);
        });
      };
    } else {
      toNative = identityTransform;
    }
    const [totalSize, fieldOffsets] = fieldTypes.reduce(function(result2, t) {
      const [previousOffset, offsets] = result2;
      const { size } = t;
      const offset = align(previousOffset, size);
      offsets.push(offset);
      return [offset + size, offsets];
    }, [0, []]);
    return {
      type: fieldTypes.map((t) => t.type),
      size: totalSize,
      read(address) {
        return fieldTypes.map((type, index) => type.read(address.add(fieldOffsets[index])));
      },
      write(address, values) {
        values.forEach((value, index) => {
          fieldTypes[index].write(address.add(fieldOffsets[index]), value);
        });
      },
      fromNative,
      toNative
    };
  }
  function unionType(fieldTypes) {
    const largestType = fieldTypes.reduce(function(largest, t) {
      if (t.size > largest.size)
        return t;
      else
        return largest;
    }, fieldTypes[0]);
    let fromNative, toNative;
    if (largestType.fromNative) {
      const fromTransform = largestType.fromNative;
      fromNative = function(v) {
        return fromTransform.call(this, v[0]);
      };
    } else {
      fromNative = function(v) {
        return v[0];
      };
    }
    if (largestType.toNative) {
      const toTransform = largestType.toNative;
      toNative = function(v) {
        return [toTransform.call(this, v)];
      };
    } else {
      toNative = function(v) {
        return [v];
      };
    }
    return {
      type: [largestType.type],
      size: largestType.size,
      read: largestType.read,
      write: largestType.write,
      fromNative,
      toNative
    };
  }
  const longBits = pointerSize == 8 && Process.platform !== "windows" ? 64 : 32;
  modifiers = /* @__PURE__ */ new Set([
    "j",
    // complex
    "A",
    // atomic
    "r",
    // const
    "n",
    // in
    "N",
    // inout
    "o",
    // out
    "O",
    // by copy
    "R",
    // by ref
    "V",
    // one way
    "+"
    // GNU register
  ]);
  singularTypeById = {
    "c": {
      type: "char",
      size: 1,
      read: (address) => address.readS8(),
      write: (address, value) => {
        address.writeS8(value);
      },
      toNative(v) {
        if (typeof v === "boolean") {
          return v ? 1 : 0;
        }
        return v;
      }
    },
    "i": {
      type: "int",
      size: 4,
      read: (address) => address.readInt(),
      write: (address, value) => {
        address.writeInt(value);
      }
    },
    "s": {
      type: "int16",
      size: 2,
      read: (address) => address.readS16(),
      write: (address, value) => {
        address.writeS16(value);
      }
    },
    "l": {
      type: "int32",
      size: 4,
      read: (address) => address.readS32(),
      write: (address, value) => {
        address.writeS32(value);
      }
    },
    "q": {
      type: "int64",
      size: 8,
      read: (address) => address.readS64(),
      write: (address, value) => {
        address.writeS64(value);
      }
    },
    "C": {
      type: "uchar",
      size: 1,
      read: (address) => address.readU8(),
      write: (address, value) => {
        address.writeU8(value);
      }
    },
    "I": {
      type: "uint",
      size: 4,
      read: (address) => address.readUInt(),
      write: (address, value) => {
        address.writeUInt(value);
      }
    },
    "S": {
      type: "uint16",
      size: 2,
      read: (address) => address.readU16(),
      write: (address, value) => {
        address.writeU16(value);
      }
    },
    "L": {
      type: "uint" + longBits,
      size: longBits / 8,
      read: (address) => address.readULong(),
      write: (address, value) => {
        address.writeULong(value);
      }
    },
    "Q": {
      type: "uint64",
      size: 8,
      read: (address) => address.readU64(),
      write: (address, value) => {
        address.writeU64(value);
      }
    },
    "f": {
      type: "float",
      size: 4,
      read: (address) => address.readFloat(),
      write: (address, value) => {
        address.writeFloat(value);
      }
    },
    "d": {
      type: "double",
      size: 8,
      read: (address) => address.readDouble(),
      write: (address, value) => {
        address.writeDouble(value);
      }
    },
    "B": {
      type: "bool",
      size: 1,
      read: (address) => address.readU8(),
      write: (address, value) => {
        address.writeU8(value);
      },
      fromNative(v) {
        return v ? true : false;
      },
      toNative(v) {
        return v ? 1 : 0;
      }
    },
    "v": {
      type: "void",
      size: 0
    },
    "*": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative(h) {
        return h.readUtf8String();
      }
    },
    "@": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative: fromNativeId,
      toNative: toNativeId
    },
    "@?": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative: fromNativeBlock,
      toNative: toNativeBlock
    },
    "^@": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      toNative: toNativeObjectArray
    },
    "^v": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      }
    },
    "#": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative: fromNativeId,
      toNative: toNativeId
    },
    ":": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      }
    },
    "?": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      }
    }
  };
  function identityTransform(v) {
    return v;
  }
  function align(value, boundary) {
    const remainder = value % boundary;
    return remainder === 0 ? value : value + (boundary - remainder);
  }
}
var runtime, frida_objc_bridge_default;
var init_frida_objc_bridge = __esm({
  "node_modules/frida-objc-bridge/index.js"() {
    "use strict";
    init_node_globals();
    init_api();
    init_fastpaths();
    runtime = new Runtime();
    frida_objc_bridge_default = runtime;
  }
});

// node_modules/frida-java-bridge/lib/alloc.js
function abs(nptr) {
  const shmt = pointerSize3 === 4 ? 31 : 63;
  const mask = ptr(1).shl(shmt).not();
  return nptr.and(mask);
}
function makeAllocator(sliceSize) {
  return new CodeAllocator(sliceSize);
}
var pageSize, pointerSize3, CodeAllocator;
var init_alloc = __esm({
  "node_modules/frida-java-bridge/lib/alloc.js"() {
    "use strict";
    init_node_globals();
    ({
      pageSize,
      pointerSize: pointerSize3
    } = Process);
    CodeAllocator = class {
      constructor(sliceSize) {
        this.sliceSize = sliceSize;
        this.slicesPerPage = pageSize / sliceSize;
        this.pages = [];
        this.free = [];
      }
      allocateSlice(spec, alignment) {
        const anyLocation = spec.near === void 0;
        const anyAlignment = alignment === 1;
        if (anyLocation && anyAlignment) {
          const slice2 = this.free.pop();
          if (slice2 !== void 0) {
            return slice2;
          }
        } else if (alignment < pageSize) {
          const { free } = this;
          const n = free.length;
          const alignMask = anyAlignment ? null : ptr(alignment - 1);
          for (let i = 0; i !== n; i++) {
            const slice2 = free[i];
            const satisfiesLocation = anyLocation || this._isSliceNear(slice2, spec);
            const satisfiesAlignment = anyAlignment || slice2.and(alignMask).isNull();
            if (satisfiesLocation && satisfiesAlignment) {
              return free.splice(i, 1)[0];
            }
          }
        }
        return this._allocatePage(spec);
      }
      _allocatePage(spec) {
        const page = Memory.alloc(pageSize, spec);
        const { sliceSize, slicesPerPage } = this;
        for (let i = 1; i !== slicesPerPage; i++) {
          const slice2 = page.add(i * sliceSize);
          this.free.push(slice2);
        }
        this.pages.push(page);
        return page;
      }
      _isSliceNear(slice2, spec) {
        const sliceEnd = slice2.add(this.sliceSize);
        const { near, maxDistance } = spec;
        const startDistance = abs(near.sub(slice2));
        const endDistance = abs(near.sub(sliceEnd));
        return startDistance.compare(maxDistance) <= 0 && endDistance.compare(maxDistance) <= 0;
      }
      freeSlice(slice2) {
        this.free.push(slice2);
      }
    };
  }
});

// node_modules/frida-java-bridge/lib/result.js
function checkJniResult(name2, result2) {
  if (result2 !== JNI_OK) {
    throw new Error(name2 + " failed: " + result2);
  }
}
var JNI_OK;
var init_result = __esm({
  "node_modules/frida-java-bridge/lib/result.js"() {
    "use strict";
    init_node_globals();
    JNI_OK = 0;
  }
});

// node_modules/frida-java-bridge/lib/jvmti.js
function EnvJvmti(handle2, vm3) {
  this.handle = handle2;
  this.vm = vm3;
  this.vtable = handle2.readPointer();
}
function proxy(offset, retType2, argTypes2, wrapper) {
  let impl = null;
  return function() {
    if (impl === null) {
      impl = new NativeFunction(this.vtable.add((offset - 1) * pointerSize4).readPointer(), retType2, argTypes2, nativeFunctionOptions);
    }
    let args = [impl];
    args = args.concat.apply(args, arguments);
    return wrapper.apply(this, args);
  };
}
var jvmtiVersion, jvmtiCapabilities, pointerSize4, nativeFunctionOptions;
var init_jvmti = __esm({
  "node_modules/frida-java-bridge/lib/jvmti.js"() {
    "use strict";
    init_node_globals();
    init_result();
    jvmtiVersion = {
      v1_0: 805371904,
      v1_2: 805372416
    };
    jvmtiCapabilities = {
      canTagObjects: 1
    };
    ({ pointerSize: pointerSize4 } = Process);
    nativeFunctionOptions = {
      exceptions: "propagate"
    };
    EnvJvmti.prototype.deallocate = proxy(47, "int32", ["pointer", "pointer"], function(impl, mem) {
      return impl(this.handle, mem);
    });
    EnvJvmti.prototype.getLoadedClasses = proxy(78, "int32", ["pointer", "pointer", "pointer"], function(impl, classCountPtr, classesPtr) {
      const result2 = impl(this.handle, classCountPtr, classesPtr);
      checkJniResult("EnvJvmti::getLoadedClasses", result2);
    });
    EnvJvmti.prototype.iterateOverInstancesOfClass = proxy(112, "int32", ["pointer", "pointer", "int", "pointer", "pointer"], function(impl, klass, objectFilter, heapObjectCallback, userData) {
      const result2 = impl(this.handle, klass, objectFilter, heapObjectCallback, userData);
      checkJniResult("EnvJvmti::iterateOverInstancesOfClass", result2);
    });
    EnvJvmti.prototype.getObjectsWithTags = proxy(114, "int32", ["pointer", "int", "pointer", "pointer", "pointer", "pointer"], function(impl, tagCount, tags, countPtr, objectResultPtr, tagResultPtr) {
      const result2 = impl(this.handle, tagCount, tags, countPtr, objectResultPtr, tagResultPtr);
      checkJniResult("EnvJvmti::getObjectsWithTags", result2);
    });
    EnvJvmti.prototype.addCapabilities = proxy(142, "int32", ["pointer", "pointer"], function(impl, capabilitiesPtr) {
      return impl(this.handle, capabilitiesPtr);
    });
  }
});

// node_modules/frida-java-bridge/lib/machine-code.js
function parseInstructionsAt(address, tryParse, { limit }) {
  let cursor = address;
  let prevInsn = null;
  for (let i = 0; i !== limit; i++) {
    const insn = Instruction.parse(cursor);
    const value = tryParse(insn, prevInsn);
    if (value !== null) {
      return value;
    }
    cursor = insn.next;
    prevInsn = insn;
  }
  return null;
}
var init_machine_code = __esm({
  "node_modules/frida-java-bridge/lib/machine-code.js"() {
    "use strict";
    init_node_globals();
  }
});

// node_modules/frida-java-bridge/lib/memoize.js
function memoize(compute) {
  let value = null;
  let computed = false;
  return function(...args) {
    if (!computed) {
      value = compute(...args);
      computed = true;
    }
    return value;
  };
}
var init_memoize = __esm({
  "node_modules/frida-java-bridge/lib/memoize.js"() {
    "use strict";
    init_node_globals();
  }
});

// node_modules/frida-java-bridge/lib/env.js
function Env(handle2, vm3) {
  this.handle = handle2;
  this.vm = vm3;
}
function register(globalRef) {
  globalRefs.push(globalRef);
  return globalRef;
}
function vtable(instance) {
  if (cachedVtable === null) {
    cachedVtable = instance.handle.readPointer();
  }
  return cachedVtable;
}
function proxy2(offset, retType2, argTypes2, wrapper) {
  let impl = null;
  return function() {
    if (impl === null) {
      impl = new NativeFunction(vtable(this).add(offset * pointerSize5).readPointer(), retType2, argTypes2, nativeFunctionOptions2);
    }
    let args = [impl];
    args = args.concat.apply(args, arguments);
    return wrapper.apply(this, args);
  };
}
function makeErrorHandleDestructor(vm3, handle2) {
  return function() {
    vm3.perform((env2) => {
      env2.deleteGlobalRef(handle2);
    });
  };
}
function plainMethod(offset, retType2, argTypes2, options) {
  return getOrMakeMethod(this, "p", makePlainMethod, offset, retType2, argTypes2, options);
}
function vaMethod(offset, retType2, argTypes2, options) {
  return getOrMakeMethod(this, "v", makeVaMethod, offset, retType2, argTypes2, options);
}
function nonvirtualVaMethod(offset, retType2, argTypes2, options) {
  return getOrMakeMethod(this, "n", makeNonvirtualVaMethod, offset, retType2, argTypes2, options);
}
function getOrMakeMethod(env2, flavor, construct, offset, retType2, argTypes2, options) {
  if (options !== void 0) {
    return construct(env2, offset, retType2, argTypes2, options);
  }
  const key = [offset, flavor, retType2].concat(argTypes2).join("|");
  let m2 = cachedMethods.get(key);
  if (m2 === void 0) {
    m2 = construct(env2, offset, retType2, argTypes2, nativeFunctionOptions2);
    cachedMethods.set(key, m2);
  }
  return m2;
}
function makePlainMethod(env2, offset, retType2, argTypes2, options) {
  return new NativeFunction(
    vtable(env2).add(offset * pointerSize5).readPointer(),
    retType2,
    ["pointer", "pointer", "pointer"].concat(argTypes2),
    options
  );
}
function makeVaMethod(env2, offset, retType2, argTypes2, options) {
  return new NativeFunction(
    vtable(env2).add(offset * pointerSize5).readPointer(),
    retType2,
    ["pointer", "pointer", "pointer", "..."].concat(argTypes2),
    options
  );
}
function makeNonvirtualVaMethod(env2, offset, retType2, argTypes2, options) {
  return new NativeFunction(
    vtable(env2).add(offset * pointerSize5).readPointer(),
    retType2,
    ["pointer", "pointer", "pointer", "pointer", "..."].concat(argTypes2),
    options
  );
}
var pointerSize5, JNI_ABORT, CALL_CONSTRUCTOR_METHOD_OFFSET, CALL_OBJECT_METHOD_OFFSET, CALL_BOOLEAN_METHOD_OFFSET, CALL_BYTE_METHOD_OFFSET, CALL_CHAR_METHOD_OFFSET, CALL_SHORT_METHOD_OFFSET, CALL_INT_METHOD_OFFSET, CALL_LONG_METHOD_OFFSET, CALL_FLOAT_METHOD_OFFSET, CALL_DOUBLE_METHOD_OFFSET, CALL_VOID_METHOD_OFFSET, CALL_NONVIRTUAL_OBJECT_METHOD_OFFSET, CALL_NONVIRTUAL_BOOLEAN_METHOD_OFFSET, CALL_NONVIRTUAL_BYTE_METHOD_OFFSET, CALL_NONVIRTUAL_CHAR_METHOD_OFFSET, CALL_NONVIRTUAL_SHORT_METHOD_OFFSET, CALL_NONVIRTUAL_INT_METHOD_OFFSET, CALL_NONVIRTUAL_LONG_METHOD_OFFSET, CALL_NONVIRTUAL_FLOAT_METHOD_OFFSET, CALL_NONVIRTUAL_DOUBLE_METHOD_OFFSET, CALL_NONVIRTUAL_VOID_METHOD_OFFSET, CALL_STATIC_OBJECT_METHOD_OFFSET, CALL_STATIC_BOOLEAN_METHOD_OFFSET, CALL_STATIC_BYTE_METHOD_OFFSET, CALL_STATIC_CHAR_METHOD_OFFSET, CALL_STATIC_SHORT_METHOD_OFFSET, CALL_STATIC_INT_METHOD_OFFSET, CALL_STATIC_LONG_METHOD_OFFSET, CALL_STATIC_FLOAT_METHOD_OFFSET, CALL_STATIC_DOUBLE_METHOD_OFFSET, CALL_STATIC_VOID_METHOD_OFFSET, GET_OBJECT_FIELD_OFFSET, GET_BOOLEAN_FIELD_OFFSET, GET_BYTE_FIELD_OFFSET, GET_CHAR_FIELD_OFFSET, GET_SHORT_FIELD_OFFSET, GET_INT_FIELD_OFFSET, GET_LONG_FIELD_OFFSET, GET_FLOAT_FIELD_OFFSET, GET_DOUBLE_FIELD_OFFSET, SET_OBJECT_FIELD_OFFSET, SET_BOOLEAN_FIELD_OFFSET, SET_BYTE_FIELD_OFFSET, SET_CHAR_FIELD_OFFSET, SET_SHORT_FIELD_OFFSET, SET_INT_FIELD_OFFSET, SET_LONG_FIELD_OFFSET, SET_FLOAT_FIELD_OFFSET, SET_DOUBLE_FIELD_OFFSET, GET_STATIC_OBJECT_FIELD_OFFSET, GET_STATIC_BOOLEAN_FIELD_OFFSET, GET_STATIC_BYTE_FIELD_OFFSET, GET_STATIC_CHAR_FIELD_OFFSET, GET_STATIC_SHORT_FIELD_OFFSET, GET_STATIC_INT_FIELD_OFFSET, GET_STATIC_LONG_FIELD_OFFSET, GET_STATIC_FLOAT_FIELD_OFFSET, GET_STATIC_DOUBLE_FIELD_OFFSET, SET_STATIC_OBJECT_FIELD_OFFSET, SET_STATIC_BOOLEAN_FIELD_OFFSET, SET_STATIC_BYTE_FIELD_OFFSET, SET_STATIC_CHAR_FIELD_OFFSET, SET_STATIC_SHORT_FIELD_OFFSET, SET_STATIC_INT_FIELD_OFFSET, SET_STATIC_LONG_FIELD_OFFSET, SET_STATIC_FLOAT_FIELD_OFFSET, SET_STATIC_DOUBLE_FIELD_OFFSET, callMethodOffset, callNonvirtualMethodOffset, callStaticMethodOffset, getFieldOffset, setFieldOffset, getStaticFieldOffset, setStaticFieldOffset, nativeFunctionOptions2, cachedVtable, globalRefs, cachedMethods, javaLangClass, javaLangObject, javaLangReflectConstructor, javaLangReflectMethod, javaLangReflectField, javaLangReflectTypeVariable, javaLangReflectWildcardType, javaLangReflectGenericArrayType, javaLangReflectParameterizedType, javaLangString;
var init_env = __esm({
  "node_modules/frida-java-bridge/lib/env.js"() {
    "use strict";
    init_node_globals();
    pointerSize5 = Process.pointerSize;
    JNI_ABORT = 2;
    CALL_CONSTRUCTOR_METHOD_OFFSET = 28;
    CALL_OBJECT_METHOD_OFFSET = 34;
    CALL_BOOLEAN_METHOD_OFFSET = 37;
    CALL_BYTE_METHOD_OFFSET = 40;
    CALL_CHAR_METHOD_OFFSET = 43;
    CALL_SHORT_METHOD_OFFSET = 46;
    CALL_INT_METHOD_OFFSET = 49;
    CALL_LONG_METHOD_OFFSET = 52;
    CALL_FLOAT_METHOD_OFFSET = 55;
    CALL_DOUBLE_METHOD_OFFSET = 58;
    CALL_VOID_METHOD_OFFSET = 61;
    CALL_NONVIRTUAL_OBJECT_METHOD_OFFSET = 64;
    CALL_NONVIRTUAL_BOOLEAN_METHOD_OFFSET = 67;
    CALL_NONVIRTUAL_BYTE_METHOD_OFFSET = 70;
    CALL_NONVIRTUAL_CHAR_METHOD_OFFSET = 73;
    CALL_NONVIRTUAL_SHORT_METHOD_OFFSET = 76;
    CALL_NONVIRTUAL_INT_METHOD_OFFSET = 79;
    CALL_NONVIRTUAL_LONG_METHOD_OFFSET = 82;
    CALL_NONVIRTUAL_FLOAT_METHOD_OFFSET = 85;
    CALL_NONVIRTUAL_DOUBLE_METHOD_OFFSET = 88;
    CALL_NONVIRTUAL_VOID_METHOD_OFFSET = 91;
    CALL_STATIC_OBJECT_METHOD_OFFSET = 114;
    CALL_STATIC_BOOLEAN_METHOD_OFFSET = 117;
    CALL_STATIC_BYTE_METHOD_OFFSET = 120;
    CALL_STATIC_CHAR_METHOD_OFFSET = 123;
    CALL_STATIC_SHORT_METHOD_OFFSET = 126;
    CALL_STATIC_INT_METHOD_OFFSET = 129;
    CALL_STATIC_LONG_METHOD_OFFSET = 132;
    CALL_STATIC_FLOAT_METHOD_OFFSET = 135;
    CALL_STATIC_DOUBLE_METHOD_OFFSET = 138;
    CALL_STATIC_VOID_METHOD_OFFSET = 141;
    GET_OBJECT_FIELD_OFFSET = 95;
    GET_BOOLEAN_FIELD_OFFSET = 96;
    GET_BYTE_FIELD_OFFSET = 97;
    GET_CHAR_FIELD_OFFSET = 98;
    GET_SHORT_FIELD_OFFSET = 99;
    GET_INT_FIELD_OFFSET = 100;
    GET_LONG_FIELD_OFFSET = 101;
    GET_FLOAT_FIELD_OFFSET = 102;
    GET_DOUBLE_FIELD_OFFSET = 103;
    SET_OBJECT_FIELD_OFFSET = 104;
    SET_BOOLEAN_FIELD_OFFSET = 105;
    SET_BYTE_FIELD_OFFSET = 106;
    SET_CHAR_FIELD_OFFSET = 107;
    SET_SHORT_FIELD_OFFSET = 108;
    SET_INT_FIELD_OFFSET = 109;
    SET_LONG_FIELD_OFFSET = 110;
    SET_FLOAT_FIELD_OFFSET = 111;
    SET_DOUBLE_FIELD_OFFSET = 112;
    GET_STATIC_OBJECT_FIELD_OFFSET = 145;
    GET_STATIC_BOOLEAN_FIELD_OFFSET = 146;
    GET_STATIC_BYTE_FIELD_OFFSET = 147;
    GET_STATIC_CHAR_FIELD_OFFSET = 148;
    GET_STATIC_SHORT_FIELD_OFFSET = 149;
    GET_STATIC_INT_FIELD_OFFSET = 150;
    GET_STATIC_LONG_FIELD_OFFSET = 151;
    GET_STATIC_FLOAT_FIELD_OFFSET = 152;
    GET_STATIC_DOUBLE_FIELD_OFFSET = 153;
    SET_STATIC_OBJECT_FIELD_OFFSET = 154;
    SET_STATIC_BOOLEAN_FIELD_OFFSET = 155;
    SET_STATIC_BYTE_FIELD_OFFSET = 156;
    SET_STATIC_CHAR_FIELD_OFFSET = 157;
    SET_STATIC_SHORT_FIELD_OFFSET = 158;
    SET_STATIC_INT_FIELD_OFFSET = 159;
    SET_STATIC_LONG_FIELD_OFFSET = 160;
    SET_STATIC_FLOAT_FIELD_OFFSET = 161;
    SET_STATIC_DOUBLE_FIELD_OFFSET = 162;
    callMethodOffset = {
      pointer: CALL_OBJECT_METHOD_OFFSET,
      uint8: CALL_BOOLEAN_METHOD_OFFSET,
      int8: CALL_BYTE_METHOD_OFFSET,
      uint16: CALL_CHAR_METHOD_OFFSET,
      int16: CALL_SHORT_METHOD_OFFSET,
      int32: CALL_INT_METHOD_OFFSET,
      int64: CALL_LONG_METHOD_OFFSET,
      float: CALL_FLOAT_METHOD_OFFSET,
      double: CALL_DOUBLE_METHOD_OFFSET,
      void: CALL_VOID_METHOD_OFFSET
    };
    callNonvirtualMethodOffset = {
      pointer: CALL_NONVIRTUAL_OBJECT_METHOD_OFFSET,
      uint8: CALL_NONVIRTUAL_BOOLEAN_METHOD_OFFSET,
      int8: CALL_NONVIRTUAL_BYTE_METHOD_OFFSET,
      uint16: CALL_NONVIRTUAL_CHAR_METHOD_OFFSET,
      int16: CALL_NONVIRTUAL_SHORT_METHOD_OFFSET,
      int32: CALL_NONVIRTUAL_INT_METHOD_OFFSET,
      int64: CALL_NONVIRTUAL_LONG_METHOD_OFFSET,
      float: CALL_NONVIRTUAL_FLOAT_METHOD_OFFSET,
      double: CALL_NONVIRTUAL_DOUBLE_METHOD_OFFSET,
      void: CALL_NONVIRTUAL_VOID_METHOD_OFFSET
    };
    callStaticMethodOffset = {
      pointer: CALL_STATIC_OBJECT_METHOD_OFFSET,
      uint8: CALL_STATIC_BOOLEAN_METHOD_OFFSET,
      int8: CALL_STATIC_BYTE_METHOD_OFFSET,
      uint16: CALL_STATIC_CHAR_METHOD_OFFSET,
      int16: CALL_STATIC_SHORT_METHOD_OFFSET,
      int32: CALL_STATIC_INT_METHOD_OFFSET,
      int64: CALL_STATIC_LONG_METHOD_OFFSET,
      float: CALL_STATIC_FLOAT_METHOD_OFFSET,
      double: CALL_STATIC_DOUBLE_METHOD_OFFSET,
      void: CALL_STATIC_VOID_METHOD_OFFSET
    };
    getFieldOffset = {
      pointer: GET_OBJECT_FIELD_OFFSET,
      uint8: GET_BOOLEAN_FIELD_OFFSET,
      int8: GET_BYTE_FIELD_OFFSET,
      uint16: GET_CHAR_FIELD_OFFSET,
      int16: GET_SHORT_FIELD_OFFSET,
      int32: GET_INT_FIELD_OFFSET,
      int64: GET_LONG_FIELD_OFFSET,
      float: GET_FLOAT_FIELD_OFFSET,
      double: GET_DOUBLE_FIELD_OFFSET
    };
    setFieldOffset = {
      pointer: SET_OBJECT_FIELD_OFFSET,
      uint8: SET_BOOLEAN_FIELD_OFFSET,
      int8: SET_BYTE_FIELD_OFFSET,
      uint16: SET_CHAR_FIELD_OFFSET,
      int16: SET_SHORT_FIELD_OFFSET,
      int32: SET_INT_FIELD_OFFSET,
      int64: SET_LONG_FIELD_OFFSET,
      float: SET_FLOAT_FIELD_OFFSET,
      double: SET_DOUBLE_FIELD_OFFSET
    };
    getStaticFieldOffset = {
      pointer: GET_STATIC_OBJECT_FIELD_OFFSET,
      uint8: GET_STATIC_BOOLEAN_FIELD_OFFSET,
      int8: GET_STATIC_BYTE_FIELD_OFFSET,
      uint16: GET_STATIC_CHAR_FIELD_OFFSET,
      int16: GET_STATIC_SHORT_FIELD_OFFSET,
      int32: GET_STATIC_INT_FIELD_OFFSET,
      int64: GET_STATIC_LONG_FIELD_OFFSET,
      float: GET_STATIC_FLOAT_FIELD_OFFSET,
      double: GET_STATIC_DOUBLE_FIELD_OFFSET
    };
    setStaticFieldOffset = {
      pointer: SET_STATIC_OBJECT_FIELD_OFFSET,
      uint8: SET_STATIC_BOOLEAN_FIELD_OFFSET,
      int8: SET_STATIC_BYTE_FIELD_OFFSET,
      uint16: SET_STATIC_CHAR_FIELD_OFFSET,
      int16: SET_STATIC_SHORT_FIELD_OFFSET,
      int32: SET_STATIC_INT_FIELD_OFFSET,
      int64: SET_STATIC_LONG_FIELD_OFFSET,
      float: SET_STATIC_FLOAT_FIELD_OFFSET,
      double: SET_STATIC_DOUBLE_FIELD_OFFSET
    };
    nativeFunctionOptions2 = {
      exceptions: "propagate"
    };
    cachedVtable = null;
    globalRefs = [];
    Env.dispose = function(env2) {
      globalRefs.forEach(env2.deleteGlobalRef, env2);
      globalRefs = [];
    };
    Env.prototype.getVersion = proxy2(4, "int32", ["pointer"], function(impl) {
      return impl(this.handle);
    });
    Env.prototype.findClass = proxy2(6, "pointer", ["pointer", "pointer"], function(impl, name2) {
      const result2 = impl(this.handle, Memory.allocUtf8String(name2));
      this.throwIfExceptionPending();
      return result2;
    });
    Env.prototype.throwIfExceptionPending = function() {
      const throwable = this.exceptionOccurred();
      if (throwable.isNull()) {
        return;
      }
      this.exceptionClear();
      const handle2 = this.newGlobalRef(throwable);
      this.deleteLocalRef(throwable);
      const description = this.vaMethod("pointer", [])(this.handle, handle2, this.javaLangObject().toString);
      const descriptionStr = this.stringFromJni(description);
      this.deleteLocalRef(description);
      const error = new Error(descriptionStr);
      error.$h = handle2;
      Script.bindWeak(error, makeErrorHandleDestructor(this.vm, handle2));
      throw error;
    };
    Env.prototype.fromReflectedMethod = proxy2(7, "pointer", ["pointer", "pointer"], function(impl, method2) {
      return impl(this.handle, method2);
    });
    Env.prototype.fromReflectedField = proxy2(8, "pointer", ["pointer", "pointer"], function(impl, method2) {
      return impl(this.handle, method2);
    });
    Env.prototype.toReflectedMethod = proxy2(9, "pointer", ["pointer", "pointer", "pointer", "uint8"], function(impl, klass, methodId, isStatic) {
      return impl(this.handle, klass, methodId, isStatic);
    });
    Env.prototype.getSuperclass = proxy2(10, "pointer", ["pointer", "pointer"], function(impl, klass) {
      return impl(this.handle, klass);
    });
    Env.prototype.isAssignableFrom = proxy2(11, "uint8", ["pointer", "pointer", "pointer"], function(impl, klass1, klass2) {
      return !!impl(this.handle, klass1, klass2);
    });
    Env.prototype.toReflectedField = proxy2(12, "pointer", ["pointer", "pointer", "pointer", "uint8"], function(impl, klass, fieldId, isStatic) {
      return impl(this.handle, klass, fieldId, isStatic);
    });
    Env.prototype.throw = proxy2(13, "int32", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.exceptionOccurred = proxy2(15, "pointer", ["pointer"], function(impl) {
      return impl(this.handle);
    });
    Env.prototype.exceptionDescribe = proxy2(16, "void", ["pointer"], function(impl) {
      impl(this.handle);
    });
    Env.prototype.exceptionClear = proxy2(17, "void", ["pointer"], function(impl) {
      impl(this.handle);
    });
    Env.prototype.pushLocalFrame = proxy2(19, "int32", ["pointer", "int32"], function(impl, capacity) {
      return impl(this.handle, capacity);
    });
    Env.prototype.popLocalFrame = proxy2(20, "pointer", ["pointer", "pointer"], function(impl, result2) {
      return impl(this.handle, result2);
    });
    Env.prototype.newGlobalRef = proxy2(21, "pointer", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.deleteGlobalRef = proxy2(22, "void", ["pointer", "pointer"], function(impl, globalRef) {
      impl(this.handle, globalRef);
    });
    Env.prototype.deleteLocalRef = proxy2(23, "void", ["pointer", "pointer"], function(impl, localRef) {
      impl(this.handle, localRef);
    });
    Env.prototype.isSameObject = proxy2(24, "uint8", ["pointer", "pointer", "pointer"], function(impl, ref1, ref2) {
      return !!impl(this.handle, ref1, ref2);
    });
    Env.prototype.newLocalRef = proxy2(25, "pointer", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.allocObject = proxy2(27, "pointer", ["pointer", "pointer"], function(impl, clazz) {
      return impl(this.handle, clazz);
    });
    Env.prototype.getObjectClass = proxy2(31, "pointer", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.isInstanceOf = proxy2(32, "uint8", ["pointer", "pointer", "pointer"], function(impl, obj, klass) {
      return !!impl(this.handle, obj, klass);
    });
    Env.prototype.getMethodId = proxy2(33, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name2, sig) {
      return impl(this.handle, klass, Memory.allocUtf8String(name2), Memory.allocUtf8String(sig));
    });
    Env.prototype.getFieldId = proxy2(94, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name2, sig) {
      return impl(this.handle, klass, Memory.allocUtf8String(name2), Memory.allocUtf8String(sig));
    });
    Env.prototype.getIntField = proxy2(100, "int32", ["pointer", "pointer", "pointer"], function(impl, obj, fieldId) {
      return impl(this.handle, obj, fieldId);
    });
    Env.prototype.getStaticMethodId = proxy2(113, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name2, sig) {
      return impl(this.handle, klass, Memory.allocUtf8String(name2), Memory.allocUtf8String(sig));
    });
    Env.prototype.getStaticFieldId = proxy2(144, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name2, sig) {
      return impl(this.handle, klass, Memory.allocUtf8String(name2), Memory.allocUtf8String(sig));
    });
    Env.prototype.getStaticIntField = proxy2(150, "int32", ["pointer", "pointer", "pointer"], function(impl, obj, fieldId) {
      return impl(this.handle, obj, fieldId);
    });
    Env.prototype.getStringLength = proxy2(164, "int32", ["pointer", "pointer"], function(impl, str) {
      return impl(this.handle, str);
    });
    Env.prototype.getStringChars = proxy2(165, "pointer", ["pointer", "pointer", "pointer"], function(impl, str) {
      return impl(this.handle, str, NULL);
    });
    Env.prototype.releaseStringChars = proxy2(166, "void", ["pointer", "pointer", "pointer"], function(impl, str, utf) {
      impl(this.handle, str, utf);
    });
    Env.prototype.newStringUtf = proxy2(167, "pointer", ["pointer", "pointer"], function(impl, str) {
      const utf = Memory.allocUtf8String(str);
      return impl(this.handle, utf);
    });
    Env.prototype.getStringUtfChars = proxy2(169, "pointer", ["pointer", "pointer", "pointer"], function(impl, str) {
      return impl(this.handle, str, NULL);
    });
    Env.prototype.releaseStringUtfChars = proxy2(170, "void", ["pointer", "pointer", "pointer"], function(impl, str, utf) {
      impl(this.handle, str, utf);
    });
    Env.prototype.getArrayLength = proxy2(171, "int32", ["pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array);
    });
    Env.prototype.newObjectArray = proxy2(172, "pointer", ["pointer", "int32", "pointer", "pointer"], function(impl, length, elementClass, initialElement) {
      return impl(this.handle, length, elementClass, initialElement);
    });
    Env.prototype.getObjectArrayElement = proxy2(173, "pointer", ["pointer", "pointer", "int32"], function(impl, array, index) {
      return impl(this.handle, array, index);
    });
    Env.prototype.setObjectArrayElement = proxy2(174, "void", ["pointer", "pointer", "int32", "pointer"], function(impl, array, index, value) {
      impl(this.handle, array, index, value);
    });
    Env.prototype.newBooleanArray = proxy2(175, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newByteArray = proxy2(176, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newCharArray = proxy2(177, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newShortArray = proxy2(178, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newIntArray = proxy2(179, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newLongArray = proxy2(180, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newFloatArray = proxy2(181, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.newDoubleArray = proxy2(182, "pointer", ["pointer", "int32"], function(impl, length) {
      return impl(this.handle, length);
    });
    Env.prototype.getBooleanArrayElements = proxy2(183, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getByteArrayElements = proxy2(184, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getCharArrayElements = proxy2(185, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getShortArrayElements = proxy2(186, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getIntArrayElements = proxy2(187, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getLongArrayElements = proxy2(188, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getFloatArrayElements = proxy2(189, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.getDoubleArrayElements = proxy2(190, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
      return impl(this.handle, array, NULL);
    });
    Env.prototype.releaseBooleanArrayElements = proxy2(191, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseByteArrayElements = proxy2(192, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseCharArrayElements = proxy2(193, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseShortArrayElements = proxy2(194, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseIntArrayElements = proxy2(195, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseLongArrayElements = proxy2(196, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseFloatArrayElements = proxy2(197, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.releaseDoubleArrayElements = proxy2(198, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
      impl(this.handle, array, cArray, JNI_ABORT);
    });
    Env.prototype.getByteArrayRegion = proxy2(200, "void", ["pointer", "pointer", "int", "int", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setBooleanArrayRegion = proxy2(207, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setByteArrayRegion = proxy2(208, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setCharArrayRegion = proxy2(209, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setShortArrayRegion = proxy2(210, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setIntArrayRegion = proxy2(211, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setLongArrayRegion = proxy2(212, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setFloatArrayRegion = proxy2(213, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.setDoubleArrayRegion = proxy2(214, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
      impl(this.handle, array, start, length, cArray);
    });
    Env.prototype.registerNatives = proxy2(215, "int32", ["pointer", "pointer", "pointer", "int32"], function(impl, klass, methods, numMethods) {
      return impl(this.handle, klass, methods, numMethods);
    });
    Env.prototype.monitorEnter = proxy2(217, "int32", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.monitorExit = proxy2(218, "int32", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.getDirectBufferAddress = proxy2(230, "pointer", ["pointer", "pointer"], function(impl, obj) {
      return impl(this.handle, obj);
    });
    Env.prototype.getObjectRefType = proxy2(232, "int32", ["pointer", "pointer"], function(impl, ref) {
      return impl(this.handle, ref);
    });
    cachedMethods = /* @__PURE__ */ new Map();
    Env.prototype.constructor = function(argTypes2, options) {
      return vaMethod.call(this, CALL_CONSTRUCTOR_METHOD_OFFSET, "pointer", argTypes2, options);
    };
    Env.prototype.vaMethod = function(retType2, argTypes2, options) {
      const offset = callMethodOffset[retType2];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + retType2);
      }
      return vaMethod.call(this, offset, retType2, argTypes2, options);
    };
    Env.prototype.nonvirtualVaMethod = function(retType2, argTypes2, options) {
      const offset = callNonvirtualMethodOffset[retType2];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + retType2);
      }
      return nonvirtualVaMethod.call(this, offset, retType2, argTypes2, options);
    };
    Env.prototype.staticVaMethod = function(retType2, argTypes2, options) {
      const offset = callStaticMethodOffset[retType2];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + retType2);
      }
      return vaMethod.call(this, offset, retType2, argTypes2, options);
    };
    Env.prototype.getField = function(fieldType) {
      const offset = getFieldOffset[fieldType];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + fieldType);
      }
      return plainMethod.call(this, offset, fieldType, []);
    };
    Env.prototype.getStaticField = function(fieldType) {
      const offset = getStaticFieldOffset[fieldType];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + fieldType);
      }
      return plainMethod.call(this, offset, fieldType, []);
    };
    Env.prototype.setField = function(fieldType) {
      const offset = setFieldOffset[fieldType];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + fieldType);
      }
      return plainMethod.call(this, offset, "void", [fieldType]);
    };
    Env.prototype.setStaticField = function(fieldType) {
      const offset = setStaticFieldOffset[fieldType];
      if (offset === void 0) {
        throw new Error("Unsupported type: " + fieldType);
      }
      return plainMethod.call(this, offset, "void", [fieldType]);
    };
    javaLangClass = null;
    Env.prototype.javaLangClass = function() {
      if (javaLangClass === null) {
        const handle2 = this.findClass("java/lang/Class");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangClass = {
            handle: register(this.newGlobalRef(handle2)),
            getName: get2("getName", "()Ljava/lang/String;"),
            getSimpleName: get2("getSimpleName", "()Ljava/lang/String;"),
            getGenericSuperclass: get2("getGenericSuperclass", "()Ljava/lang/reflect/Type;"),
            getDeclaredConstructors: get2("getDeclaredConstructors", "()[Ljava/lang/reflect/Constructor;"),
            getDeclaredMethods: get2("getDeclaredMethods", "()[Ljava/lang/reflect/Method;"),
            getDeclaredFields: get2("getDeclaredFields", "()[Ljava/lang/reflect/Field;"),
            isArray: get2("isArray", "()Z"),
            isPrimitive: get2("isPrimitive", "()Z"),
            isInterface: get2("isInterface", "()Z"),
            getComponentType: get2("getComponentType", "()Ljava/lang/Class;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangClass;
    };
    javaLangObject = null;
    Env.prototype.javaLangObject = function() {
      if (javaLangObject === null) {
        const handle2 = this.findClass("java/lang/Object");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangObject = {
            handle: register(this.newGlobalRef(handle2)),
            toString: get2("toString", "()Ljava/lang/String;"),
            getClass: get2("getClass", "()Ljava/lang/Class;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangObject;
    };
    javaLangReflectConstructor = null;
    Env.prototype.javaLangReflectConstructor = function() {
      if (javaLangReflectConstructor === null) {
        const handle2 = this.findClass("java/lang/reflect/Constructor");
        try {
          javaLangReflectConstructor = {
            getGenericParameterTypes: this.getMethodId(handle2, "getGenericParameterTypes", "()[Ljava/lang/reflect/Type;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectConstructor;
    };
    javaLangReflectMethod = null;
    Env.prototype.javaLangReflectMethod = function() {
      if (javaLangReflectMethod === null) {
        const handle2 = this.findClass("java/lang/reflect/Method");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangReflectMethod = {
            getName: get2("getName", "()Ljava/lang/String;"),
            getGenericParameterTypes: get2("getGenericParameterTypes", "()[Ljava/lang/reflect/Type;"),
            getParameterTypes: get2("getParameterTypes", "()[Ljava/lang/Class;"),
            getGenericReturnType: get2("getGenericReturnType", "()Ljava/lang/reflect/Type;"),
            getGenericExceptionTypes: get2("getGenericExceptionTypes", "()[Ljava/lang/reflect/Type;"),
            getModifiers: get2("getModifiers", "()I"),
            isVarArgs: get2("isVarArgs", "()Z")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectMethod;
    };
    javaLangReflectField = null;
    Env.prototype.javaLangReflectField = function() {
      if (javaLangReflectField === null) {
        const handle2 = this.findClass("java/lang/reflect/Field");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangReflectField = {
            getName: get2("getName", "()Ljava/lang/String;"),
            getType: get2("getType", "()Ljava/lang/Class;"),
            getGenericType: get2("getGenericType", "()Ljava/lang/reflect/Type;"),
            getModifiers: get2("getModifiers", "()I"),
            toString: get2("toString", "()Ljava/lang/String;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectField;
    };
    javaLangReflectTypeVariable = null;
    Env.prototype.javaLangReflectTypeVariable = function() {
      if (javaLangReflectTypeVariable === null) {
        const handle2 = this.findClass("java/lang/reflect/TypeVariable");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangReflectTypeVariable = {
            handle: register(this.newGlobalRef(handle2)),
            getName: get2("getName", "()Ljava/lang/String;"),
            getBounds: get2("getBounds", "()[Ljava/lang/reflect/Type;"),
            getGenericDeclaration: get2("getGenericDeclaration", "()Ljava/lang/reflect/GenericDeclaration;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectTypeVariable;
    };
    javaLangReflectWildcardType = null;
    Env.prototype.javaLangReflectWildcardType = function() {
      if (javaLangReflectWildcardType === null) {
        const handle2 = this.findClass("java/lang/reflect/WildcardType");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangReflectWildcardType = {
            handle: register(this.newGlobalRef(handle2)),
            getLowerBounds: get2("getLowerBounds", "()[Ljava/lang/reflect/Type;"),
            getUpperBounds: get2("getUpperBounds", "()[Ljava/lang/reflect/Type;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectWildcardType;
    };
    javaLangReflectGenericArrayType = null;
    Env.prototype.javaLangReflectGenericArrayType = function() {
      if (javaLangReflectGenericArrayType === null) {
        const handle2 = this.findClass("java/lang/reflect/GenericArrayType");
        try {
          javaLangReflectGenericArrayType = {
            handle: register(this.newGlobalRef(handle2)),
            getGenericComponentType: this.getMethodId(handle2, "getGenericComponentType", "()Ljava/lang/reflect/Type;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectGenericArrayType;
    };
    javaLangReflectParameterizedType = null;
    Env.prototype.javaLangReflectParameterizedType = function() {
      if (javaLangReflectParameterizedType === null) {
        const handle2 = this.findClass("java/lang/reflect/ParameterizedType");
        try {
          const get2 = this.getMethodId.bind(this, handle2);
          javaLangReflectParameterizedType = {
            handle: register(this.newGlobalRef(handle2)),
            getActualTypeArguments: get2("getActualTypeArguments", "()[Ljava/lang/reflect/Type;"),
            getRawType: get2("getRawType", "()Ljava/lang/reflect/Type;"),
            getOwnerType: get2("getOwnerType", "()Ljava/lang/reflect/Type;")
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangReflectParameterizedType;
    };
    javaLangString = null;
    Env.prototype.javaLangString = function() {
      if (javaLangString === null) {
        const handle2 = this.findClass("java/lang/String");
        try {
          javaLangString = {
            handle: register(this.newGlobalRef(handle2))
          };
        } finally {
          this.deleteLocalRef(handle2);
        }
      }
      return javaLangString;
    };
    Env.prototype.getClassName = function(classHandle) {
      const name2 = this.vaMethod("pointer", [])(this.handle, classHandle, this.javaLangClass().getName);
      try {
        return this.stringFromJni(name2);
      } finally {
        this.deleteLocalRef(name2);
      }
    };
    Env.prototype.getObjectClassName = function(objHandle) {
      const jklass = this.getObjectClass(objHandle);
      try {
        return this.getClassName(jklass);
      } finally {
        this.deleteLocalRef(jklass);
      }
    };
    Env.prototype.getActualTypeArgument = function(type) {
      const actualTypeArguments = this.vaMethod("pointer", [])(this.handle, type, this.javaLangReflectParameterizedType().getActualTypeArguments);
      this.throwIfExceptionPending();
      if (!actualTypeArguments.isNull()) {
        try {
          return this.getTypeNameFromFirstTypeElement(actualTypeArguments);
        } finally {
          this.deleteLocalRef(actualTypeArguments);
        }
      }
    };
    Env.prototype.getTypeNameFromFirstTypeElement = function(typeArray) {
      const length = this.getArrayLength(typeArray);
      if (length > 0) {
        const typeArgument0 = this.getObjectArrayElement(typeArray, 0);
        try {
          return this.getTypeName(typeArgument0);
        } finally {
          this.deleteLocalRef(typeArgument0);
        }
      } else {
        return "java.lang.Object";
      }
    };
    Env.prototype.getTypeName = function(type, getGenericsInformation) {
      const invokeObjectMethodNoArgs = this.vaMethod("pointer", []);
      if (this.isInstanceOf(type, this.javaLangClass().handle)) {
        return this.getClassName(type);
      } else if (this.isInstanceOf(type, this.javaLangReflectGenericArrayType().handle)) {
        return this.getArrayTypeName(type);
      } else if (this.isInstanceOf(type, this.javaLangReflectParameterizedType().handle)) {
        const rawType = invokeObjectMethodNoArgs(this.handle, type, this.javaLangReflectParameterizedType().getRawType);
        this.throwIfExceptionPending();
        let result2;
        try {
          result2 = this.getTypeName(rawType);
        } finally {
          this.deleteLocalRef(rawType);
        }
        if (getGenericsInformation) {
          result2 += "<" + this.getActualTypeArgument(type) + ">";
        }
        return result2;
      } else if (this.isInstanceOf(type, this.javaLangReflectTypeVariable().handle)) {
        return "java.lang.Object";
      } else if (this.isInstanceOf(type, this.javaLangReflectWildcardType().handle)) {
        return "java.lang.Object";
      } else {
        return "java.lang.Object";
      }
    };
    Env.prototype.getArrayTypeName = function(type) {
      const invokeObjectMethodNoArgs = this.vaMethod("pointer", []);
      if (this.isInstanceOf(type, this.javaLangClass().handle)) {
        return this.getClassName(type);
      } else if (this.isInstanceOf(type, this.javaLangReflectGenericArrayType().handle)) {
        const componentType = invokeObjectMethodNoArgs(this.handle, type, this.javaLangReflectGenericArrayType().getGenericComponentType);
        this.throwIfExceptionPending();
        try {
          return "[L" + this.getTypeName(componentType) + ";";
        } finally {
          this.deleteLocalRef(componentType);
        }
      } else {
        return "[Ljava.lang.Object;";
      }
    };
    Env.prototype.stringFromJni = function(str) {
      const utf = this.getStringChars(str);
      if (utf.isNull()) {
        throw new Error("Unable to access string");
      }
      try {
        const length = this.getStringLength(str);
        return utf.readUtf16String(length);
      } finally {
        this.releaseStringChars(str, utf);
      }
    };
  }
});

// node_modules/frida-java-bridge/lib/vm.js
function VM(api3) {
  const handle2 = api3.vm;
  let attachCurrentThread = null;
  let detachCurrentThread = null;
  let getEnv = null;
  function initialize2() {
    const vtable2 = handle2.readPointer();
    const options = {
      exceptions: "propagate"
    };
    attachCurrentThread = new NativeFunction(vtable2.add(4 * pointerSize6).readPointer(), "int32", ["pointer", "pointer", "pointer"], options);
    detachCurrentThread = new NativeFunction(vtable2.add(5 * pointerSize6).readPointer(), "int32", ["pointer"], options);
    getEnv = new NativeFunction(vtable2.add(6 * pointerSize6).readPointer(), "int32", ["pointer", "pointer", "int32"], options);
  }
  this.handle = handle2;
  this.perform = function(fn) {
    const threadId = Process.getCurrentThreadId();
    const cachedEnv = tryGetCachedEnv(threadId);
    if (cachedEnv !== null) {
      return fn(cachedEnv);
    }
    let env2 = this._tryGetEnv();
    const alreadyAttached = env2 !== null;
    if (!alreadyAttached) {
      env2 = this.attachCurrentThread();
      attachedThreads.set(threadId, true);
    }
    this.link(threadId, env2);
    try {
      return fn(env2);
    } finally {
      const isJsThread = threadId === jsThreadID;
      if (!isJsThread) {
        this.unlink(threadId);
      }
      if (!alreadyAttached && !isJsThread) {
        const allowedToDetach = attachedThreads.get(threadId);
        attachedThreads.delete(threadId);
        if (allowedToDetach) {
          this.detachCurrentThread();
        }
      }
    }
  };
  this.attachCurrentThread = function() {
    const envBuf = Memory.alloc(pointerSize6);
    checkJniResult("VM::AttachCurrentThread", attachCurrentThread(handle2, envBuf, NULL));
    return new Env(envBuf.readPointer(), this);
  };
  this.detachCurrentThread = function() {
    checkJniResult("VM::DetachCurrentThread", detachCurrentThread(handle2));
  };
  this.preventDetachDueToClassLoader = function() {
    const threadId = Process.getCurrentThreadId();
    if (attachedThreads.has(threadId)) {
      attachedThreads.set(threadId, false);
    }
  };
  this.getEnv = function() {
    const cachedEnv = tryGetCachedEnv(Process.getCurrentThreadId());
    if (cachedEnv !== null) {
      return cachedEnv;
    }
    const envBuf = Memory.alloc(pointerSize6);
    const result2 = getEnv(handle2, envBuf, JNI_VERSION_1_6);
    if (result2 === -2) {
      throw new Error("Current thread is not attached to the Java VM; please move this code inside a Java.perform() callback");
    }
    checkJniResult("VM::GetEnv", result2);
    return new Env(envBuf.readPointer(), this);
  };
  this.tryGetEnv = function() {
    const cachedEnv = tryGetCachedEnv(Process.getCurrentThreadId());
    if (cachedEnv !== null) {
      return cachedEnv;
    }
    return this._tryGetEnv();
  };
  this._tryGetEnv = function() {
    const h = this.tryGetEnvHandle(JNI_VERSION_1_6);
    if (h === null) {
      return null;
    }
    return new Env(h, this);
  };
  this.tryGetEnvHandle = function(version2) {
    const envBuf = Memory.alloc(pointerSize6);
    const result2 = getEnv(handle2, envBuf, version2);
    if (result2 !== JNI_OK) {
      return null;
    }
    return envBuf.readPointer();
  };
  this.makeHandleDestructor = function(handle3) {
    return () => {
      this.perform((env2) => {
        env2.deleteGlobalRef(handle3);
      });
    };
  };
  this.link = function(tid, env2) {
    const entry = activeEnvs.get(tid);
    if (entry === void 0) {
      activeEnvs.set(tid, [env2, 1]);
    } else {
      entry[1]++;
    }
  };
  this.unlink = function(tid) {
    const entry = activeEnvs.get(tid);
    if (entry[1] === 1) {
      activeEnvs.delete(tid);
    } else {
      entry[1]--;
    }
  };
  function tryGetCachedEnv(threadId) {
    const entry = activeEnvs.get(threadId);
    if (entry === void 0) {
      return null;
    }
    return entry[0];
  }
  initialize2.call(this);
}
var JNI_VERSION_1_6, pointerSize6, jsThreadID, attachedThreads, activeEnvs;
var init_vm = __esm({
  "node_modules/frida-java-bridge/lib/vm.js"() {
    "use strict";
    init_node_globals();
    init_env();
    init_result();
    JNI_VERSION_1_6 = 65542;
    pointerSize6 = Process.pointerSize;
    jsThreadID = Process.getCurrentThreadId();
    attachedThreads = /* @__PURE__ */ new Map();
    activeEnvs = /* @__PURE__ */ new Map();
    VM.dispose = function(vm3) {
      if (attachedThreads.get(jsThreadID) === true) {
        attachedThreads.delete(jsThreadID);
        vm3.detachCurrentThread();
      }
    };
  }
});

// node_modules/frida-java-bridge/lib/android.js
var android_exports = {};
__export(android_exports, {
  ArtMethod: () => ArtMethod,
  ArtStackVisitor: () => ArtStackVisitor,
  DVM_JNI_ENV_OFFSET_SELF: () => DVM_JNI_ENV_OFFSET_SELF,
  HandleVector: () => HandleVector,
  VariableSizedHandleScope: () => VariableSizedHandleScope,
  backtrace: () => backtrace,
  deoptimizeBootImage: () => deoptimizeBootImage,
  deoptimizeEverything: () => deoptimizeEverything,
  deoptimizeMethod: () => deoptimizeMethod,
  ensureClassInitialized: () => ensureClassInitialized,
  getAndroidApiLevel: () => getAndroidApiLevel,
  getAndroidVersion: () => getAndroidVersion,
  getApi: () => getApi2,
  getArtApexVersion: () => getArtApexVersion,
  getArtClassSpec: () => getArtClassSpec,
  getArtFieldSpec: () => getArtFieldSpec,
  getArtMethodSpec: () => getArtMethodSpec,
  getArtThreadFromEnv: () => getArtThreadFromEnv,
  getArtThreadSpec: () => getArtThreadSpec,
  makeArtClassLoaderVisitor: () => makeArtClassLoaderVisitor,
  makeArtClassVisitor: () => makeArtClassVisitor,
  makeMethodMangler: () => makeMethodMangler,
  makeObjectVisitorPredicate: () => makeObjectVisitorPredicate,
  revertGlobalPatches: () => revertGlobalPatches,
  translateMethod: () => translateMethod,
  withAllArtThreadsSuspended: () => withAllArtThreadsSuspended,
  withRunnableArtThread: () => withRunnableArtThread
});
function getApi2() {
  if (cachedApi2 === null) {
    cachedApi2 = _getApi();
  }
  return cachedApi2;
}
function _getApi() {
  const vmModules = Process.enumerateModules().filter((m2) => /^lib(art|dvm).so$/.test(m2.name)).filter((m2) => !/\/system\/fake-libs/.test(m2.path));
  if (vmModules.length === 0) {
    return null;
  }
  const vmModule = vmModules[0];
  const flavor = vmModule.name.indexOf("art") !== -1 ? "art" : "dalvik";
  const isArt = flavor === "art";
  const temporaryApi = {
    module: vmModule,
    find(name2) {
      const { module } = this;
      let address = module.findExportByName(name2);
      if (address === null) {
        address = module.findSymbolByName(name2);
      }
      return address;
    },
    flavor,
    addLocalReference: null
  };
  temporaryApi.isApiLevel34OrApexEquivalent = isArt && (temporaryApi.find("_ZN3art7AppInfo29GetPrimaryApkReferenceProfileEv") !== null || temporaryApi.find("_ZN3art6Thread15RunFlipFunctionEPS0_") !== null);
  const pending = isArt ? {
    functions: {
      JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]],
      // Android < 7
      artInterpreterToCompiledCodeBridge: function(address) {
        this.artInterpreterToCompiledCodeBridge = address;
      },
      // Android >= 8
      _ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadENS_6ObjPtrINS_6mirror6ObjectEEE: ["art::JavaVMExt::AddGlobalRef", "pointer", ["pointer", "pointer", "pointer"]],
      // Android >= 6
      _ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadEPNS_6mirror6ObjectE: ["art::JavaVMExt::AddGlobalRef", "pointer", ["pointer", "pointer", "pointer"]],
      // Android < 6: makeAddGlobalRefFallbackForAndroid5() needs these:
      _ZN3art17ReaderWriterMutex13ExclusiveLockEPNS_6ThreadE: ["art::ReaderWriterMutex::ExclusiveLock", "void", ["pointer", "pointer"]],
      _ZN3art17ReaderWriterMutex15ExclusiveUnlockEPNS_6ThreadE: ["art::ReaderWriterMutex::ExclusiveUnlock", "void", ["pointer", "pointer"]],
      // Android <= 7
      _ZN3art22IndirectReferenceTable3AddEjPNS_6mirror6ObjectE: function(address) {
        this["art::IndirectReferenceTable::Add"] = new NativeFunction(address, "pointer", ["pointer", "uint", "pointer"], nativeFunctionOptions3);
      },
      // Android > 7
      _ZN3art22IndirectReferenceTable3AddENS_15IRTSegmentStateENS_6ObjPtrINS_6mirror6ObjectEEE: function(address) {
        this["art::IndirectReferenceTable::Add"] = new NativeFunction(address, "pointer", ["pointer", "uint", "pointer"], nativeFunctionOptions3);
      },
      // Android >= 7
      _ZN3art9JavaVMExt12DecodeGlobalEPv: function(address) {
        let decodeGlobal;
        if (getAndroidApiLevel() >= 26) {
          decodeGlobal = makeCxxMethodWrapperReturningPointerByValue(address, ["pointer", "pointer"]);
        } else {
          decodeGlobal = new NativeFunction(address, "pointer", ["pointer", "pointer"], nativeFunctionOptions3);
        }
        this["art::JavaVMExt::DecodeGlobal"] = function(vm3, thread, ref) {
          return decodeGlobal(vm3, ref);
        };
      },
      // Android >= 6
      _ZN3art9JavaVMExt12DecodeGlobalEPNS_6ThreadEPv: ["art::JavaVMExt::DecodeGlobal", "pointer", ["pointer", "pointer", "pointer"]],
      // makeDecodeGlobalFallback() uses:
      // Android >= 15
      _ZNK3art6Thread19DecodeGlobalJObjectEP8_jobject: ["art::Thread::DecodeJObject", "pointer", ["pointer", "pointer"]],
      // Android < 6
      _ZNK3art6Thread13DecodeJObjectEP8_jobject: ["art::Thread::DecodeJObject", "pointer", ["pointer", "pointer"]],
      // Android >= 6
      _ZN3art10ThreadList10SuspendAllEPKcb: ["art::ThreadList::SuspendAll", "void", ["pointer", "pointer", "bool"]],
      // or fallback:
      _ZN3art10ThreadList10SuspendAllEv: function(address) {
        const suspendAll = new NativeFunction(address, "void", ["pointer"], nativeFunctionOptions3);
        this["art::ThreadList::SuspendAll"] = function(threadList, cause, longSuspend) {
          return suspendAll(threadList);
        };
      },
      _ZN3art10ThreadList9ResumeAllEv: ["art::ThreadList::ResumeAll", "void", ["pointer"]],
      // Android >= 7
      _ZN3art11ClassLinker12VisitClassesEPNS_12ClassVisitorE: ["art::ClassLinker::VisitClasses", "void", ["pointer", "pointer"]],
      // Android < 7
      _ZN3art11ClassLinker12VisitClassesEPFbPNS_6mirror5ClassEPvES4_: function(address) {
        const visitClasses = new NativeFunction(address, "void", ["pointer", "pointer", "pointer"], nativeFunctionOptions3);
        this["art::ClassLinker::VisitClasses"] = function(classLinker, visitor) {
          visitClasses(classLinker, visitor, NULL);
        };
      },
      _ZNK3art11ClassLinker17VisitClassLoadersEPNS_18ClassLoaderVisitorE: ["art::ClassLinker::VisitClassLoaders", "void", ["pointer", "pointer"]],
      _ZN3art2gc4Heap12VisitObjectsEPFvPNS_6mirror6ObjectEPvES5_: ["art::gc::Heap::VisitObjects", "void", ["pointer", "pointer", "pointer"]],
      _ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE: ["art::gc::Heap::GetInstances", "void", ["pointer", "pointer", "pointer", "int", "pointer"]],
      // Android >= 9
      _ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEbiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE: function(address) {
        const getInstances = new NativeFunction(address, "void", ["pointer", "pointer", "pointer", "bool", "int", "pointer"], nativeFunctionOptions3);
        this["art::gc::Heap::GetInstances"] = function(instance, scope, hClass, maxCount, instances) {
          const useIsAssignableFrom = 0;
          getInstances(instance, scope, hClass, useIsAssignableFrom, maxCount, instances);
        };
      },
      _ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEjb: ["art::StackVisitor::StackVisitor", "void", ["pointer", "pointer", "pointer", "uint", "uint", "bool"]],
      _ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEmb: ["art::StackVisitor::StackVisitor", "void", ["pointer", "pointer", "pointer", "uint", "size_t", "bool"]],
      _ZN3art12StackVisitor9WalkStackILNS0_16CountTransitionsE0EEEvb: ["art::StackVisitor::WalkStack", "void", ["pointer", "bool"]],
      _ZNK3art12StackVisitor9GetMethodEv: ["art::StackVisitor::GetMethod", "pointer", ["pointer"]],
      _ZNK3art12StackVisitor16DescribeLocationEv: function(address) {
        this["art::StackVisitor::DescribeLocation"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer"]);
      },
      _ZNK3art12StackVisitor24GetCurrentQuickFrameInfoEv: function(address) {
        this["art::StackVisitor::GetCurrentQuickFrameInfo"] = makeArtQuickFrameInfoGetter(address);
      },
      _ZN3art7Context6CreateEv: ["art::Context::Create", "pointer", []],
      _ZN3art6Thread18GetLongJumpContextEv: ["art::Thread::GetLongJumpContext", "pointer", ["pointer"]],
      _ZN3art6mirror5Class13GetDescriptorEPNSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEE: function(address) {
        this["art::mirror::Class::GetDescriptor"] = address;
      },
      _ZN3art6mirror5Class11GetLocationEv: function(address) {
        this["art::mirror::Class::GetLocation"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer"]);
      },
      _ZN3art9ArtMethod12PrettyMethodEb: function(address) {
        this["art::ArtMethod::PrettyMethod"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer", "bool"]);
      },
      _ZN3art12PrettyMethodEPNS_9ArtMethodEb: function(address) {
        this["art::ArtMethod::PrettyMethodNullSafe"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer", "bool"]);
      },
      // Android < 6 for cloneArtMethod()
      _ZN3art6Thread14CurrentFromGdbEv: ["art::Thread::CurrentFromGdb", "pointer", []],
      _ZN3art6mirror6Object5CloneEPNS_6ThreadE: function(address) {
        this["art::mirror::Object::Clone"] = new NativeFunction(address, "pointer", ["pointer", "pointer"], nativeFunctionOptions3);
      },
      _ZN3art6mirror6Object5CloneEPNS_6ThreadEm: function(address) {
        const clone = new NativeFunction(address, "pointer", ["pointer", "pointer", "pointer"], nativeFunctionOptions3);
        this["art::mirror::Object::Clone"] = function(thisPtr, threadPtr) {
          const numTargetBytes = NULL;
          return clone(thisPtr, threadPtr, numTargetBytes);
        };
      },
      _ZN3art6mirror6Object5CloneEPNS_6ThreadEj: function(address) {
        const clone = new NativeFunction(address, "pointer", ["pointer", "pointer", "uint"], nativeFunctionOptions3);
        this["art::mirror::Object::Clone"] = function(thisPtr, threadPtr) {
          const numTargetBytes = 0;
          return clone(thisPtr, threadPtr, numTargetBytes);
        };
      },
      _ZN3art3Dbg14SetJdwpAllowedEb: ["art::Dbg::SetJdwpAllowed", "void", ["bool"]],
      _ZN3art3Dbg13ConfigureJdwpERKNS_4JDWP11JdwpOptionsE: ["art::Dbg::ConfigureJdwp", "void", ["pointer"]],
      _ZN3art31InternalDebuggerControlCallback13StartDebuggerEv: ["art::InternalDebuggerControlCallback::StartDebugger", "void", ["pointer"]],
      _ZN3art3Dbg9StartJdwpEv: ["art::Dbg::StartJdwp", "void", []],
      _ZN3art3Dbg8GoActiveEv: ["art::Dbg::GoActive", "void", []],
      _ZN3art3Dbg21RequestDeoptimizationERKNS_21DeoptimizationRequestE: ["art::Dbg::RequestDeoptimization", "void", ["pointer"]],
      _ZN3art3Dbg20ManageDeoptimizationEv: ["art::Dbg::ManageDeoptimization", "void", []],
      _ZN3art15instrumentation15Instrumentation20EnableDeoptimizationEv: ["art::Instrumentation::EnableDeoptimization", "void", ["pointer"]],
      // Android >= 6
      _ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEPKc: ["art::Instrumentation::DeoptimizeEverything", "void", ["pointer", "pointer"]],
      // Android < 6
      _ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEv: function(address) {
        const deoptimize = new NativeFunction(address, "void", ["pointer"], nativeFunctionOptions3);
        this["art::Instrumentation::DeoptimizeEverything"] = function(instrumentation, key) {
          deoptimize(instrumentation);
        };
      },
      _ZN3art7Runtime19DeoptimizeBootImageEv: ["art::Runtime::DeoptimizeBootImage", "void", ["pointer"]],
      _ZN3art15instrumentation15Instrumentation10DeoptimizeEPNS_9ArtMethodE: ["art::Instrumentation::Deoptimize", "void", ["pointer", "pointer"]],
      // Android >= 11
      _ZN3art3jni12JniIdManager14DecodeMethodIdEP10_jmethodID: ["art::jni::JniIdManager::DecodeMethodId", "pointer", ["pointer", "pointer"]],
      _ZN3art3jni12JniIdManager13DecodeFieldIdEP9_jfieldID: ["art::jni::JniIdManager::DecodeFieldId", "pointer", ["pointer", "pointer"]],
      _ZN3art11interpreter18GetNterpEntryPointEv: ["art::interpreter::GetNterpEntryPoint", "pointer", []],
      _ZN3art7Monitor17TranslateLocationEPNS_9ArtMethodEjPPKcPi: ["art::Monitor::TranslateLocation", "void", ["pointer", "uint32", "pointer", "pointer"]]
    },
    variables: {
      _ZN3art3Dbg9gRegistryE: function(address) {
        this.isJdwpStarted = () => !address.readPointer().isNull();
      },
      _ZN3art3Dbg15gDebuggerActiveE: function(address) {
        this.isDebuggerActive = () => !!address.readU8();
      }
    },
    optionals: /* @__PURE__ */ new Set([
      "artInterpreterToCompiledCodeBridge",
      "_ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadENS_6ObjPtrINS_6mirror6ObjectEEE",
      "_ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadEPNS_6mirror6ObjectE",
      "_ZN3art9JavaVMExt12DecodeGlobalEPv",
      "_ZN3art9JavaVMExt12DecodeGlobalEPNS_6ThreadEPv",
      "_ZNK3art6Thread19DecodeGlobalJObjectEP8_jobject",
      "_ZNK3art6Thread13DecodeJObjectEP8_jobject",
      "_ZN3art10ThreadList10SuspendAllEPKcb",
      "_ZN3art10ThreadList10SuspendAllEv",
      "_ZN3art11ClassLinker12VisitClassesEPNS_12ClassVisitorE",
      "_ZN3art11ClassLinker12VisitClassesEPFbPNS_6mirror5ClassEPvES4_",
      "_ZNK3art11ClassLinker17VisitClassLoadersEPNS_18ClassLoaderVisitorE",
      "_ZN3art6mirror6Object5CloneEPNS_6ThreadE",
      "_ZN3art6mirror6Object5CloneEPNS_6ThreadEm",
      "_ZN3art6mirror6Object5CloneEPNS_6ThreadEj",
      "_ZN3art22IndirectReferenceTable3AddEjPNS_6mirror6ObjectE",
      "_ZN3art22IndirectReferenceTable3AddENS_15IRTSegmentStateENS_6ObjPtrINS_6mirror6ObjectEEE",
      "_ZN3art2gc4Heap12VisitObjectsEPFvPNS_6mirror6ObjectEPvES5_",
      "_ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE",
      "_ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEbiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE",
      "_ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEjb",
      "_ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEmb",
      "_ZN3art12StackVisitor9WalkStackILNS0_16CountTransitionsE0EEEvb",
      "_ZNK3art12StackVisitor9GetMethodEv",
      "_ZNK3art12StackVisitor16DescribeLocationEv",
      "_ZNK3art12StackVisitor24GetCurrentQuickFrameInfoEv",
      "_ZN3art7Context6CreateEv",
      "_ZN3art6Thread18GetLongJumpContextEv",
      "_ZN3art6mirror5Class13GetDescriptorEPNSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEE",
      "_ZN3art6mirror5Class11GetLocationEv",
      "_ZN3art9ArtMethod12PrettyMethodEb",
      "_ZN3art12PrettyMethodEPNS_9ArtMethodEb",
      "_ZN3art3Dbg13ConfigureJdwpERKNS_4JDWP11JdwpOptionsE",
      "_ZN3art31InternalDebuggerControlCallback13StartDebuggerEv",
      "_ZN3art3Dbg15gDebuggerActiveE",
      "_ZN3art15instrumentation15Instrumentation20EnableDeoptimizationEv",
      "_ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEPKc",
      "_ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEv",
      "_ZN3art7Runtime19DeoptimizeBootImageEv",
      "_ZN3art15instrumentation15Instrumentation10DeoptimizeEPNS_9ArtMethodE",
      "_ZN3art3Dbg9StartJdwpEv",
      "_ZN3art3Dbg8GoActiveEv",
      "_ZN3art3Dbg21RequestDeoptimizationERKNS_21DeoptimizationRequestE",
      "_ZN3art3Dbg20ManageDeoptimizationEv",
      "_ZN3art3Dbg9gRegistryE",
      "_ZN3art3jni12JniIdManager14DecodeMethodIdEP10_jmethodID",
      "_ZN3art3jni12JniIdManager13DecodeFieldIdEP9_jfieldID",
      "_ZN3art11interpreter18GetNterpEntryPointEv",
      "_ZN3art7Monitor17TranslateLocationEPNS_9ArtMethodEjPPKcPi"
    ])
  } : {
    functions: {
      _Z20dvmDecodeIndirectRefP6ThreadP8_jobject: ["dvmDecodeIndirectRef", "pointer", ["pointer", "pointer"]],
      _Z15dvmUseJNIBridgeP6MethodPv: ["dvmUseJNIBridge", "void", ["pointer", "pointer"]],
      _Z20dvmHeapSourceGetBasev: ["dvmHeapSourceGetBase", "pointer", []],
      _Z21dvmHeapSourceGetLimitv: ["dvmHeapSourceGetLimit", "pointer", []],
      _Z16dvmIsValidObjectPK6Object: ["dvmIsValidObject", "uint8", ["pointer"]],
      JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]]
    },
    variables: {
      gDvmJni: function(address) {
        this.gDvmJni = address;
      },
      gDvm: function(address) {
        this.gDvm = address;
      }
    }
  };
  const {
    functions = {},
    variables = {},
    optionals = /* @__PURE__ */ new Set()
  } = pending;
  const missing = [];
  for (const [name2, signature2] of Object.entries(functions)) {
    const address = temporaryApi.find(name2);
    if (address !== null) {
      if (typeof signature2 === "function") {
        signature2.call(temporaryApi, address);
      } else {
        temporaryApi[signature2[0]] = new NativeFunction(address, signature2[1], signature2[2], nativeFunctionOptions3);
      }
    } else {
      if (!optionals.has(name2)) {
        missing.push(name2);
      }
    }
  }
  for (const [name2, handler] of Object.entries(variables)) {
    const address = temporaryApi.find(name2);
    if (address !== null) {
      handler.call(temporaryApi, address);
    } else {
      if (!optionals.has(name2)) {
        missing.push(name2);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error("Java API only partially available; please file a bug. Missing: " + missing.join(", "));
  }
  const vms = Memory.alloc(pointerSize7);
  const vmCount = Memory.alloc(jsizeSize);
  checkJniResult("JNI_GetCreatedJavaVMs", temporaryApi.JNI_GetCreatedJavaVMs(vms, 1, vmCount));
  if (vmCount.readInt() === 0) {
    return null;
  }
  temporaryApi.vm = vms.readPointer();
  if (isArt) {
    const apiLevel = getAndroidApiLevel();
    let kAccCompileDontBother;
    if (apiLevel >= 27) {
      kAccCompileDontBother = 33554432;
    } else if (apiLevel >= 24) {
      kAccCompileDontBother = 16777216;
    } else {
      kAccCompileDontBother = 0;
    }
    temporaryApi.kAccCompileDontBother = kAccCompileDontBother;
    const artRuntime = temporaryApi.vm.add(pointerSize7).readPointer();
    temporaryApi.artRuntime = artRuntime;
    const runtimeSpec = getArtRuntimeSpec(temporaryApi);
    const runtimeOffset = runtimeSpec.offset;
    const instrumentationOffset = runtimeOffset.instrumentation;
    temporaryApi.artInstrumentation = instrumentationOffset !== null ? artRuntime.add(instrumentationOffset) : null;
    const instrumentationIsPointer = getArtApexVersion() >= 36e7;
    if (instrumentationIsPointer && temporaryApi.artInstrumentation != null) {
      temporaryApi.artInstrumentation = temporaryApi.artInstrumentation.readPointer();
    }
    temporaryApi.artHeap = artRuntime.add(runtimeOffset.heap).readPointer();
    temporaryApi.artThreadList = artRuntime.add(runtimeOffset.threadList).readPointer();
    const classLinker = artRuntime.add(runtimeOffset.classLinker).readPointer();
    const classLinkerOffsets = getArtClassLinkerSpec(artRuntime, runtimeSpec).offset;
    const quickResolutionTrampoline = classLinker.add(classLinkerOffsets.quickResolutionTrampoline).readPointer();
    const quickImtConflictTrampoline = classLinker.add(classLinkerOffsets.quickImtConflictTrampoline).readPointer();
    const quickGenericJniTrampoline = classLinker.add(classLinkerOffsets.quickGenericJniTrampoline).readPointer();
    const quickToInterpreterBridgeTrampoline = classLinker.add(classLinkerOffsets.quickToInterpreterBridgeTrampoline).readPointer();
    temporaryApi.artClassLinker = {
      address: classLinker,
      quickResolutionTrampoline,
      quickImtConflictTrampoline,
      quickGenericJniTrampoline,
      quickToInterpreterBridgeTrampoline
    };
    const vm3 = new VM(temporaryApi);
    temporaryApi.artQuickGenericJniTrampoline = getArtQuickEntrypointFromTrampoline(quickGenericJniTrampoline, vm3);
    temporaryApi.artQuickToInterpreterBridge = getArtQuickEntrypointFromTrampoline(quickToInterpreterBridgeTrampoline, vm3);
    temporaryApi.artQuickResolutionTrampoline = getArtQuickEntrypointFromTrampoline(quickResolutionTrampoline, vm3);
    if (temporaryApi["art::JavaVMExt::AddGlobalRef"] === void 0) {
      temporaryApi["art::JavaVMExt::AddGlobalRef"] = makeAddGlobalRefFallbackForAndroid5(temporaryApi);
    }
    if (temporaryApi["art::JavaVMExt::DecodeGlobal"] === void 0) {
      temporaryApi["art::JavaVMExt::DecodeGlobal"] = makeDecodeGlobalFallback(temporaryApi);
    }
    if (temporaryApi["art::ArtMethod::PrettyMethod"] === void 0) {
      temporaryApi["art::ArtMethod::PrettyMethod"] = temporaryApi["art::ArtMethod::PrettyMethodNullSafe"];
    }
    if (temporaryApi["art::interpreter::GetNterpEntryPoint"] !== void 0) {
      temporaryApi.artNterpEntryPoint = temporaryApi["art::interpreter::GetNterpEntryPoint"]();
    } else {
      temporaryApi.artNterpEntryPoint = temporaryApi.find("ExecuteNterpImpl");
    }
    artController = makeArtController(temporaryApi, vm3);
    fixupArtQuickDeliverExceptionBug(temporaryApi);
    let cachedJvmti = null;
    Object.defineProperty(temporaryApi, "jvmti", {
      get() {
        if (cachedJvmti === null) {
          cachedJvmti = [tryGetEnvJvmti(vm3, this.artRuntime)];
        }
        return cachedJvmti[0];
      }
    });
  }
  const cxxImports = vmModule.enumerateImports().filter((imp) => imp.name.indexOf("_Z") === 0).reduce((result2, imp) => {
    result2[imp.name] = imp.address;
    return result2;
  }, {});
  temporaryApi.$new = new NativeFunction(cxxImports._Znwm || cxxImports._Znwj, "pointer", ["ulong"], nativeFunctionOptions3);
  temporaryApi.$delete = new NativeFunction(cxxImports._ZdlPv, "void", ["pointer"], nativeFunctionOptions3);
  MethodMangler = isArt ? ArtMethodMangler : DalvikMethodMangler;
  return temporaryApi;
}
function tryGetEnvJvmti(vm3, runtime3) {
  let env2 = null;
  vm3.perform(() => {
    const ensurePluginLoadedAddr = getApi2().find("_ZN3art7Runtime18EnsurePluginLoadedEPKcPNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEE");
    if (ensurePluginLoadedAddr === null) {
      return;
    }
    const ensurePluginLoaded = new NativeFunction(
      ensurePluginLoadedAddr,
      "bool",
      ["pointer", "pointer", "pointer"]
    );
    const errorPtr = Memory.alloc(pointerSize7);
    const success = ensurePluginLoaded(runtime3, Memory.allocUtf8String("libopenjdkjvmti.so"), errorPtr);
    if (!success) {
      return;
    }
    const kArtTiVersion = jvmtiVersion.v1_2 | 1073741824;
    const handle2 = vm3.tryGetEnvHandle(kArtTiVersion);
    if (handle2 === null) {
      return;
    }
    env2 = new EnvJvmti(handle2, vm3);
    const capaBuf = Memory.alloc(8);
    capaBuf.writeU64(jvmtiCapabilities.canTagObjects);
    const result2 = env2.addCapabilities(capaBuf);
    if (result2 !== JNI_OK) {
      env2 = null;
    }
  });
  return env2;
}
function ensureClassInitialized(env2, classRef) {
  const api3 = getApi2();
  if (api3.flavor !== "art") {
    return;
  }
  env2.getClassName(classRef);
}
function getArtVMSpec(api3) {
  return {
    offset: pointerSize7 === 4 ? {
      globalsLock: 32,
      globals: 72
    } : {
      globalsLock: 64,
      globals: 112
    }
  };
}
function _getArtRuntimeSpec(api3) {
  const vm3 = api3.vm;
  const runtime3 = api3.artRuntime;
  const startOffset = pointerSize7 === 4 ? 200 : 384;
  const endOffset = startOffset + 100 * pointerSize7;
  const apiLevel = getAndroidApiLevel();
  const codename = getAndroidCodename();
  const { isApiLevel34OrApexEquivalent } = api3;
  let spec = null;
  for (let offset = startOffset; offset !== endOffset; offset += pointerSize7) {
    const value = runtime3.add(offset).readPointer();
    if (value.equals(vm3)) {
      let classLinkerOffsets;
      let jniIdManagerOffset = null;
      if (apiLevel >= 33 || codename === "Tiramisu" || isApiLevel34OrApexEquivalent) {
        classLinkerOffsets = [offset - 4 * pointerSize7];
        jniIdManagerOffset = offset - pointerSize7;
      } else if (apiLevel >= 30 || codename === "R") {
        classLinkerOffsets = [offset - 3 * pointerSize7, offset - 4 * pointerSize7];
        jniIdManagerOffset = offset - pointerSize7;
      } else if (apiLevel >= 29) {
        classLinkerOffsets = [offset - 2 * pointerSize7];
      } else if (apiLevel >= 27) {
        classLinkerOffsets = [offset - STD_STRING_SIZE - 3 * pointerSize7];
      } else {
        classLinkerOffsets = [offset - STD_STRING_SIZE - 2 * pointerSize7];
      }
      for (const classLinkerOffset of classLinkerOffsets) {
        const internTableOffset = classLinkerOffset - pointerSize7;
        const threadListOffset = internTableOffset - pointerSize7;
        let heapOffset;
        if (isApiLevel34OrApexEquivalent) {
          heapOffset = threadListOffset - 9 * pointerSize7;
        } else if (apiLevel >= 24) {
          heapOffset = threadListOffset - 8 * pointerSize7;
        } else if (apiLevel >= 23) {
          heapOffset = threadListOffset - 7 * pointerSize7;
        } else {
          heapOffset = threadListOffset - 4 * pointerSize7;
        }
        const candidate = {
          offset: {
            heap: heapOffset,
            threadList: threadListOffset,
            internTable: internTableOffset,
            classLinker: classLinkerOffset,
            jniIdManager: jniIdManagerOffset
          }
        };
        if (tryGetArtClassLinkerSpec(runtime3, candidate) !== null) {
          spec = candidate;
          break;
        }
      }
      break;
    }
  }
  if (spec === null) {
    throw new Error("Unable to determine Runtime field offsets");
  }
  const instrumentationIsPointer = getArtApexVersion() >= 36e7;
  spec.offset.instrumentation = instrumentationIsPointer ? tryDetectInstrumentationPointer(api3) : tryDetectInstrumentationOffset(api3);
  spec.offset.jniIdsIndirection = tryDetectJniIdsIndirectionOffset(api3);
  return spec;
}
function tryDetectInstrumentationOffset(api3) {
  const impl = api3["art::Runtime::DeoptimizeBootImage"];
  if (impl === void 0) {
    return null;
  }
  return parseInstructionsAt(impl, instrumentationOffsetParsers[Process.arch], { limit: 30 });
}
function parsex86InstrumentationOffset(insn) {
  if (insn.mnemonic !== "lea") {
    return null;
  }
  const offset = insn.operands[1].value.disp;
  if (offset < 256 || offset > 1024) {
    return null;
  }
  return offset;
}
function parseArmInstrumentationOffset(insn) {
  if (insn.mnemonic !== "add.w") {
    return null;
  }
  const ops = insn.operands;
  if (ops.length !== 3) {
    return null;
  }
  const op2 = ops[2];
  if (op2.type !== "imm") {
    return null;
  }
  return op2.value;
}
function parseArm64InstrumentationOffset(insn) {
  if (insn.mnemonic !== "add") {
    return null;
  }
  const ops = insn.operands;
  if (ops.length !== 3) {
    return null;
  }
  if (ops[0].value === "sp" || ops[1].value === "sp") {
    return null;
  }
  const op2 = ops[2];
  if (op2.type !== "imm") {
    return null;
  }
  const offset = op2.value.valueOf();
  if (offset < 256 || offset > 1024) {
    return null;
  }
  return offset;
}
function tryDetectInstrumentationPointer(api3) {
  const impl = api3["art::Runtime::DeoptimizeBootImage"];
  if (impl === void 0) {
    return null;
  }
  return parseInstructionsAt(impl, instrumentationPointerParser[Process.arch], { limit: 30 });
}
function parsex86InstrumentationPointer(insn) {
  if (insn.mnemonic !== "mov") {
    return null;
  }
  const ops = insn.operands;
  const dst = ops[0];
  if (dst.value !== "rax") {
    return null;
  }
  const src = ops[1];
  if (src.type !== "mem") {
    return null;
  }
  const mem = src.value;
  if (mem.base !== "rdi") {
    return null;
  }
  const offset = mem.disp;
  if (offset < 256 || offset > 1024) {
    return null;
  }
  return offset;
}
function parseArmInstrumentationPointer(insn) {
  return null;
}
function parseArm64InstrumentationPointer(insn) {
  if (insn.mnemonic !== "ldr") {
    return null;
  }
  const ops = insn.operands;
  if (ops[0].value === "x0") {
    return null;
  }
  const mem = ops[1].value;
  if (mem.base !== "x0") {
    return null;
  }
  const offset = mem.disp;
  if (offset < 256 || offset > 1024) {
    return null;
  }
  return offset;
}
function tryDetectJniIdsIndirectionOffset(api3) {
  const impl = api3.find("_ZN3art7Runtime12SetJniIdTypeENS_9JniIdTypeE");
  if (impl === null) {
    return null;
  }
  const offset = parseInstructionsAt(impl, jniIdsIndirectionOffsetParsers[Process.arch], { limit: 20 });
  if (offset === null) {
    throw new Error("Unable to determine Runtime.jni_ids_indirection_ offset");
  }
  return offset;
}
function parsex86JniIdsIndirectionOffset(insn) {
  if (insn.mnemonic === "cmp") {
    return insn.operands[0].value.disp;
  }
  return null;
}
function parseArmJniIdsIndirectionOffset(insn) {
  if (insn.mnemonic === "ldr.w") {
    return insn.operands[1].value.disp;
  }
  return null;
}
function parseArm64JniIdsIndirectionOffset(insn, prevInsn) {
  if (prevInsn === null) {
    return null;
  }
  const { mnemonic } = insn;
  const { mnemonic: prevMnemonic } = prevInsn;
  if (mnemonic === "cmp" && prevMnemonic === "ldr" || mnemonic === "bl" && prevMnemonic === "str") {
    return prevInsn.operands[1].value.disp;
  }
  return null;
}
function _getArtInstrumentationSpec() {
  const deoptimizationEnabledOffsets = {
    "4-21": 136,
    "4-22": 136,
    "4-23": 172,
    "4-24": 196,
    "4-25": 196,
    "4-26": 196,
    "4-27": 196,
    "4-28": 212,
    "4-29": 172,
    "4-30": 180,
    "4-31": 180,
    "8-21": 224,
    "8-22": 224,
    "8-23": 296,
    "8-24": 344,
    "8-25": 344,
    "8-26": 352,
    "8-27": 352,
    "8-28": 392,
    "8-29": 328,
    "8-30": 336,
    "8-31": 336
  };
  const deoptEnabledOffset = deoptimizationEnabledOffsets[`${pointerSize7}-${getAndroidApiLevel()}`];
  if (deoptEnabledOffset === void 0) {
    throw new Error("Unable to determine Instrumentation field offsets");
  }
  return {
    offset: {
      forcedInterpretOnly: 4,
      deoptimizationEnabled: deoptEnabledOffset
    }
  };
}
function getArtClassLinkerSpec(runtime3, runtimeSpec) {
  const spec = tryGetArtClassLinkerSpec(runtime3, runtimeSpec);
  if (spec === null) {
    throw new Error("Unable to determine ClassLinker field offsets");
  }
  return spec;
}
function tryGetArtClassLinkerSpec(runtime3, runtimeSpec) {
  if (cachedArtClassLinkerSpec !== null) {
    return cachedArtClassLinkerSpec;
  }
  const { classLinker: classLinkerOffset, internTable: internTableOffset } = runtimeSpec.offset;
  const classLinker = runtime3.add(classLinkerOffset).readPointer();
  const internTable = runtime3.add(internTableOffset).readPointer();
  const startOffset = pointerSize7 === 4 ? 100 : 200;
  const endOffset = startOffset + 100 * pointerSize7;
  const apiLevel = getAndroidApiLevel();
  let spec = null;
  for (let offset = startOffset; offset !== endOffset; offset += pointerSize7) {
    const value = classLinker.add(offset).readPointer();
    if (value.equals(internTable)) {
      let delta;
      if (apiLevel >= 30 || getAndroidCodename() === "R") {
        delta = 6;
      } else if (apiLevel >= 29) {
        delta = 4;
      } else if (apiLevel >= 23) {
        delta = 3;
      } else {
        delta = 5;
      }
      const quickGenericJniTrampolineOffset = offset + delta * pointerSize7;
      let quickResolutionTrampolineOffset;
      if (apiLevel >= 23) {
        quickResolutionTrampolineOffset = quickGenericJniTrampolineOffset - 2 * pointerSize7;
      } else {
        quickResolutionTrampolineOffset = quickGenericJniTrampolineOffset - 3 * pointerSize7;
      }
      spec = {
        offset: {
          quickResolutionTrampoline: quickResolutionTrampolineOffset,
          quickImtConflictTrampoline: quickGenericJniTrampolineOffset - pointerSize7,
          quickGenericJniTrampoline: quickGenericJniTrampolineOffset,
          quickToInterpreterBridgeTrampoline: quickGenericJniTrampolineOffset + pointerSize7
        }
      };
      break;
    }
  }
  if (spec !== null) {
    cachedArtClassLinkerSpec = spec;
  }
  return spec;
}
function getArtClassSpec(vm3) {
  const MAX_OFFSET = 256;
  let spec = null;
  vm3.perform((env2) => {
    const fieldSpec = getArtFieldSpec(vm3);
    const methodSpec = getArtMethodSpec(vm3);
    const fInfo = {
      artArrayLengthSize: 4,
      artArrayEntrySize: fieldSpec.size,
      // java/lang/Thread has 36 fields on Android 16.
      artArrayMax: 50
    };
    const mInfo = {
      artArrayLengthSize: pointerSize7,
      artArrayEntrySize: methodSpec.size,
      // java/lang/Thread has 79 methods on Android 16.
      artArrayMax: 100
    };
    const readArtArray = (objectBase, fieldOffset, lengthSize) => {
      const header = objectBase.add(fieldOffset).readPointer();
      if (header.isNull()) {
        return null;
      }
      const length = lengthSize === 4 ? header.readU32() : header.readU64().valueOf();
      if (length <= 0) {
        return null;
      }
      return {
        length,
        data: header.add(lengthSize)
      };
    };
    const hasEntry = (objectBase, offset, needle, info) => {
      try {
        const artArray = readArtArray(objectBase, offset, info.artArrayLengthSize);
        if (artArray === null) {
          return false;
        }
        const artArrayEnd = Math.min(artArray.length, info.artArrayMax);
        for (let i = 0; i !== artArrayEnd; i++) {
          const fieldPtr = artArray.data.add(i * info.artArrayEntrySize);
          if (fieldPtr.equals(needle)) {
            return true;
          }
        }
      } catch {
      }
      return false;
    };
    const clazz = env2.findClass("java/lang/Thread");
    const clazzRef = env2.newGlobalRef(clazz);
    try {
      let object;
      withRunnableArtThread(vm3, env2, (thread) => {
        object = getApi2()["art::JavaVMExt::DecodeGlobal"](vm3, thread, clazzRef);
      });
      const fieldInstance = unwrapFieldId(env2.getFieldId(clazzRef, "name", "Ljava/lang/String;"));
      const fieldStatic = unwrapFieldId(env2.getStaticFieldId(clazzRef, "MAX_PRIORITY", "I"));
      let offsetStatic = -1;
      let offsetInstance = -1;
      for (let offset = 0; offset !== MAX_OFFSET; offset += 4) {
        if (offsetStatic === -1 && hasEntry(object, offset, fieldStatic, fInfo)) {
          offsetStatic = offset;
        }
        if (offsetInstance === -1 && hasEntry(object, offset, fieldInstance, fInfo)) {
          offsetInstance = offset;
        }
      }
      if (offsetInstance === -1 || offsetStatic === -1) {
        throw new Error("Unable to find fields in java/lang/Thread; please file a bug");
      }
      const sfieldOffset = offsetInstance !== offsetStatic ? offsetStatic : 0;
      const ifieldOffset = offsetInstance;
      let offsetMethods = -1;
      const methodInstance = unwrapMethodId(env2.getMethodId(clazzRef, "getName", "()Ljava/lang/String;"));
      for (let offset = 0; offset !== MAX_OFFSET; offset += 4) {
        if (offsetMethods === -1 && hasEntry(object, offset, methodInstance, mInfo)) {
          offsetMethods = offset;
        }
      }
      if (offsetMethods === -1) {
        throw new Error("Unable to find methods in java/lang/Thread; please file a bug");
      }
      let offsetCopiedMethods = -1;
      const methodsArray = readArtArray(object, offsetMethods, mInfo.artArrayLengthSize);
      const methodsArraySize = methodsArray.length;
      for (let offset = offsetMethods; offset !== MAX_OFFSET; offset += 4) {
        if (object.add(offset).readU16() === methodsArraySize) {
          offsetCopiedMethods = offset;
          break;
        }
      }
      if (offsetCopiedMethods === -1) {
        throw new Error("Unable to find copied methods in java/lang/Thread; please file a bug");
      }
      spec = {
        offset: {
          ifields: ifieldOffset,
          methods: offsetMethods,
          sfields: sfieldOffset,
          copiedMethodsOffset: offsetCopiedMethods
        }
      };
    } finally {
      env2.deleteLocalRef(clazz);
      env2.deleteGlobalRef(clazzRef);
    }
  });
  return spec;
}
function _getArtMethodSpec(vm3) {
  const api3 = getApi2();
  let spec;
  vm3.perform((env2) => {
    const process = env2.findClass("android/os/Process");
    const getElapsedCpuTime = unwrapMethodId(env2.getStaticMethodId(process, "getElapsedCpuTime", "()J"));
    env2.deleteLocalRef(process);
    const runtimeModule = Process.getModuleByName("libandroid_runtime.so");
    const runtimeStart = runtimeModule.base;
    const runtimeEnd = runtimeStart.add(runtimeModule.size);
    const apiLevel = getAndroidApiLevel();
    const entrypointFieldSize = apiLevel <= 21 ? 8 : pointerSize7;
    const expectedAccessFlags = kAccPublic | kAccStatic | kAccFinal | kAccNative;
    const relevantAccessFlagsMask = ~(kAccFastInterpreterToInterpreterInvoke | kAccPublicApi | kAccNterpInvokeFastPathFlag) >>> 0;
    let jniCodeOffset = null;
    let accessFlagsOffset = null;
    let remaining = 2;
    for (let offset = 0; offset !== 64 && remaining !== 0; offset += 4) {
      const field = getElapsedCpuTime.add(offset);
      if (jniCodeOffset === null) {
        const address = field.readPointer();
        if (address.compare(runtimeStart) >= 0 && address.compare(runtimeEnd) < 0) {
          jniCodeOffset = offset;
          remaining--;
        }
      }
      if (accessFlagsOffset === null) {
        const flags = field.readU32();
        if ((flags & relevantAccessFlagsMask) === expectedAccessFlags) {
          accessFlagsOffset = offset;
          remaining--;
        }
      }
    }
    if (remaining !== 0) {
      throw new Error("Unable to determine ArtMethod field offsets");
    }
    const quickCodeOffset = jniCodeOffset + entrypointFieldSize;
    const size = apiLevel <= 21 ? quickCodeOffset + 32 : quickCodeOffset + pointerSize7;
    spec = {
      size,
      offset: {
        jniCode: jniCodeOffset,
        quickCode: quickCodeOffset,
        accessFlags: accessFlagsOffset
      }
    };
    if ("artInterpreterToCompiledCodeBridge" in api3) {
      spec.offset.interpreterCode = jniCodeOffset - entrypointFieldSize;
    }
  });
  return spec;
}
function getArtFieldSpec(vm3) {
  const apiLevel = getAndroidApiLevel();
  if (apiLevel >= 23) {
    return {
      size: 16,
      offset: {
        accessFlags: 4
      }
    };
  }
  if (apiLevel >= 21) {
    return {
      size: 24,
      offset: {
        accessFlags: 12
      }
    };
  }
  return null;
}
function _getArtThreadSpec(vm3) {
  const apiLevel = getAndroidApiLevel();
  let spec;
  vm3.perform((env2) => {
    const threadHandle = getArtThreadFromEnv(env2);
    const envHandle = env2.handle;
    let isExceptionReportedOffset = null;
    let exceptionOffset = null;
    let throwLocationOffset = null;
    let topHandleScopeOffset = null;
    let managedStackOffset = null;
    let selfOffset = null;
    for (let offset = 144; offset !== 256; offset += pointerSize7) {
      const field = threadHandle.add(offset);
      const value = field.readPointer();
      if (value.equals(envHandle)) {
        exceptionOffset = offset - 6 * pointerSize7;
        managedStackOffset = offset - 4 * pointerSize7;
        selfOffset = offset + 2 * pointerSize7;
        if (apiLevel <= 22) {
          exceptionOffset -= pointerSize7;
          isExceptionReportedOffset = exceptionOffset - pointerSize7 - 9 * 8 - 3 * 4;
          throwLocationOffset = offset + 6 * pointerSize7;
          managedStackOffset -= pointerSize7;
          selfOffset -= pointerSize7;
        }
        topHandleScopeOffset = offset + 9 * pointerSize7;
        if (apiLevel <= 22) {
          topHandleScopeOffset += 2 * pointerSize7 + 4;
          if (pointerSize7 === 8) {
            topHandleScopeOffset += 4;
          }
        }
        if (apiLevel >= 23) {
          topHandleScopeOffset += pointerSize7;
        }
        break;
      }
    }
    if (topHandleScopeOffset === null) {
      throw new Error("Unable to determine ArtThread field offsets");
    }
    spec = {
      offset: {
        isExceptionReportedToInstrumentation: isExceptionReportedOffset,
        exception: exceptionOffset,
        throwLocation: throwLocationOffset,
        topHandleScope: topHandleScopeOffset,
        managedStack: managedStackOffset,
        self: selfOffset
      }
    };
  });
  return spec;
}
function _getArtManagedStackSpec() {
  const apiLevel = getAndroidApiLevel();
  if (apiLevel >= 23) {
    return {
      offset: {
        topQuickFrame: 0,
        link: pointerSize7
      }
    };
  } else {
    return {
      offset: {
        topQuickFrame: 2 * pointerSize7,
        link: 0
      }
    };
  }
}
function getArtQuickEntrypointFromTrampoline(trampoline, vm3) {
  let address;
  vm3.perform((env2) => {
    const thread = getArtThreadFromEnv(env2);
    const tryParse = artQuickTrampolineParsers[Process.arch];
    const insn = Instruction.parse(trampoline);
    const offset = tryParse(insn);
    if (offset !== null) {
      address = thread.add(offset).readPointer();
    } else {
      address = trampoline;
    }
  });
  return address;
}
function parseArtQuickTrampolineX86(insn) {
  if (insn.mnemonic === "jmp") {
    return insn.operands[0].value.disp;
  }
  return null;
}
function parseArtQuickTrampolineArm(insn) {
  if (insn.mnemonic === "ldr.w") {
    return insn.operands[1].value.disp;
  }
  return null;
}
function parseArtQuickTrampolineArm64(insn) {
  if (insn.mnemonic === "ldr") {
    return insn.operands[1].value.disp;
  }
  return null;
}
function getArtThreadFromEnv(env2) {
  return env2.handle.add(pointerSize7).readPointer();
}
function _getAndroidVersion() {
  return getAndroidSystemProperty("ro.build.version.release");
}
function _getAndroidCodename() {
  return getAndroidSystemProperty("ro.build.version.codename");
}
function _getAndroidApiLevel() {
  return parseInt(getAndroidSystemProperty("ro.build.version.sdk"), 10);
}
function _getArtApexVersion() {
  try {
    const mountInfo = File.readAllText("/proc/self/mountinfo");
    let artSource = null;
    const sourceVersions = /* @__PURE__ */ new Map();
    for (const line of mountInfo.trimEnd().split("\n")) {
      const elements = line.split(" ");
      const mountRoot = elements[4];
      if (!mountRoot.startsWith("/apex/com.android.art")) {
        continue;
      }
      const mountSource = elements[10];
      if (mountRoot.includes("@")) {
        sourceVersions.set(mountSource, mountRoot.split("@")[1]);
      } else {
        artSource = mountSource;
      }
    }
    const strVersion = sourceVersions.get(artSource);
    return strVersion !== void 0 ? parseInt(strVersion) : computeArtApexVersionFromApiLevel();
  } catch {
    return computeArtApexVersionFromApiLevel();
  }
}
function computeArtApexVersionFromApiLevel() {
  return getAndroidApiLevel() * 1e7;
}
function getAndroidSystemProperty(name2) {
  if (systemPropertyGet === null) {
    systemPropertyGet = new NativeFunction(
      Process.getModuleByName("libc.so").getExportByName("__system_property_get"),
      "int",
      ["pointer", "pointer"],
      nativeFunctionOptions3
    );
  }
  const buf = Memory.alloc(PROP_VALUE_MAX);
  systemPropertyGet(Memory.allocUtf8String(name2), buf);
  return buf.readUtf8String();
}
function withRunnableArtThread(vm3, env2, fn) {
  const perform = getArtThreadStateTransitionImpl(vm3, env2);
  const id = getArtThreadFromEnv(env2).toString();
  artThreadStateTransitions[id] = fn;
  perform(env2.handle);
  if (artThreadStateTransitions[id] !== void 0) {
    delete artThreadStateTransitions[id];
    throw new Error("Unable to perform state transition; please file a bug");
  }
}
function _getArtThreadStateTransitionImpl(vm3, env2) {
  const callback = new NativeCallback(onThreadStateTransitionComplete, "void", ["pointer"]);
  return makeArtThreadStateTransitionImpl(vm3, env2, callback);
}
function onThreadStateTransitionComplete(thread) {
  const id = thread.toString();
  const fn = artThreadStateTransitions[id];
  delete artThreadStateTransitions[id];
  fn(thread);
}
function withAllArtThreadsSuspended(fn) {
  const api3 = getApi2();
  const threadList = api3.artThreadList;
  const longSuspend = false;
  api3["art::ThreadList::SuspendAll"](threadList, Memory.allocUtf8String("frida"), longSuspend ? 1 : 0);
  try {
    fn();
  } finally {
    api3["art::ThreadList::ResumeAll"](threadList);
  }
}
function makeArtClassVisitor(visit) {
  const api3 = getApi2();
  if (api3["art::ClassLinker::VisitClasses"] instanceof NativeFunction) {
    return new ArtClassVisitor(visit);
  }
  return new NativeCallback((klass) => {
    return visit(klass) === true ? 1 : 0;
  }, "bool", ["pointer", "pointer"]);
}
function makeArtClassLoaderVisitor(visit) {
  return new ArtClassLoaderVisitor(visit);
}
function makeArtQuickFrameInfoGetter(impl) {
  return function(self) {
    const result2 = Memory.alloc(12);
    getArtQuickFrameInfoGetterThunk(impl)(result2, self);
    return {
      frameSizeInBytes: result2.readU32(),
      coreSpillMask: result2.add(4).readU32(),
      fpSpillMask: result2.add(8).readU32()
    };
  };
}
function _getArtQuickFrameInfoGetterThunk(impl) {
  let thunk = NULL;
  switch (Process.arch) {
    case "ia32":
      thunk = makeThunk(32, (writer) => {
        writer.putMovRegRegOffsetPtr("ecx", "esp", 4);
        writer.putMovRegRegOffsetPtr("edx", "esp", 8);
        writer.putCallAddressWithArguments(impl, ["ecx", "edx"]);
        writer.putMovRegReg("esp", "ebp");
        writer.putPopReg("ebp");
        writer.putRet();
      });
      break;
    case "x64":
      thunk = makeThunk(32, (writer) => {
        writer.putPushReg("rdi");
        writer.putCallAddressWithArguments(impl, ["rsi"]);
        writer.putPopReg("rdi");
        writer.putMovRegPtrReg("rdi", "rax");
        writer.putMovRegOffsetPtrReg("rdi", 8, "edx");
        writer.putRet();
      });
      break;
    case "arm":
      thunk = makeThunk(16, (writer) => {
        writer.putCallAddressWithArguments(impl, ["r0", "r1"]);
        writer.putPopRegs(["r0", "lr"]);
        writer.putMovRegReg("pc", "lr");
      });
      break;
    case "arm64":
      thunk = makeThunk(64, (writer) => {
        writer.putPushRegReg("x0", "lr");
        writer.putCallAddressWithArguments(impl, ["x1"]);
        writer.putPopRegReg("x2", "lr");
        writer.putStrRegRegOffset("x0", "x2", 0);
        writer.putStrRegRegOffset("w1", "x2", 8);
        writer.putRet();
      });
      break;
  }
  return new NativeFunction(thunk, "void", ["pointer", "pointer"], nativeFunctionOptions3);
}
function makeThunk(size, write3) {
  if (thunkPage === null) {
    thunkPage = Memory.alloc(Process.pageSize);
  }
  const thunk = thunkPage.add(thunkOffset);
  const arch = Process.arch;
  const Writer = thunkWriters[arch];
  Memory.patchCode(thunk, size, (code5) => {
    const writer = new Writer(code5, { pc: thunk });
    write3(writer);
    writer.flush();
    if (writer.offset > size) {
      throw new Error(`Wrote ${writer.offset}, exceeding maximum of ${size}`);
    }
  });
  thunkOffset += size;
  return arch === "arm" ? thunk.or(1) : thunk;
}
function notifyArtMethodHooked(method2, vm3) {
  ensureArtKnowsHowToHandleMethodInstrumentation(vm3);
  ensureArtKnowsHowToHandleReplacementMethods(vm3);
}
function makeArtController(api3, vm3) {
  const threadOffsets = getArtThreadSpec(vm3).offset;
  const managedStackOffsets = getArtManagedStackSpec().offset;
  const code5 = `
#include <gum/guminterceptor.h>

extern GMutex lock;
extern GHashTable * methods;
extern GHashTable * replacements;
extern gpointer last_seen_art_method;

extern gpointer get_oat_quick_method_header_impl (gpointer method, gpointer pc);

void
init (void)
{
  g_mutex_init (&lock);
  methods = g_hash_table_new_full (NULL, NULL, NULL, NULL);
  replacements = g_hash_table_new_full (NULL, NULL, NULL, NULL);
}

void
finalize (void)
{
  g_hash_table_unref (replacements);
  g_hash_table_unref (methods);
  g_mutex_clear (&lock);
}

gboolean
is_replacement_method (gpointer method)
{
  gboolean is_replacement;

  g_mutex_lock (&lock);

  is_replacement = g_hash_table_contains (replacements, method);

  g_mutex_unlock (&lock);

  return is_replacement;
}

gpointer
get_replacement_method (gpointer original_method)
{
  gpointer replacement_method;

  g_mutex_lock (&lock);

  replacement_method = g_hash_table_lookup (methods, original_method);

  g_mutex_unlock (&lock);

  return replacement_method;
}

void
set_replacement_method (gpointer original_method,
                        gpointer replacement_method)
{
  g_mutex_lock (&lock);

  g_hash_table_insert (methods, original_method, replacement_method);
  g_hash_table_insert (replacements, replacement_method, original_method);

  g_mutex_unlock (&lock);
}

void
synchronize_replacement_methods (guint quick_code_offset,
                                 void * nterp_entrypoint,
                                 void * quick_to_interpreter_bridge)
{
  GHashTableIter iter;
  gpointer hooked_method, replacement_method;

  g_mutex_lock (&lock);

  g_hash_table_iter_init (&iter, methods);
  while (g_hash_table_iter_next (&iter, &hooked_method, &replacement_method))
  {
    void ** quick_code;

    *((uint32_t *) replacement_method) = *((uint32_t *) hooked_method);

    quick_code = hooked_method + quick_code_offset;
    if (*quick_code == nterp_entrypoint)
      *quick_code = quick_to_interpreter_bridge;
  }

  g_mutex_unlock (&lock);
}

void
delete_replacement_method (gpointer original_method)
{
  gpointer replacement_method;

  g_mutex_lock (&lock);

  replacement_method = g_hash_table_lookup (methods, original_method);
  if (replacement_method != NULL)
  {
    g_hash_table_remove (methods, original_method);
    g_hash_table_remove (replacements, replacement_method);
  }

  g_mutex_unlock (&lock);
}

gpointer
translate_method (gpointer method)
{
  gpointer translated_method;

  g_mutex_lock (&lock);

  translated_method = g_hash_table_lookup (replacements, method);

  g_mutex_unlock (&lock);

  return (translated_method != NULL) ? translated_method : method;
}

gpointer
find_replacement_method_from_quick_code (gpointer method,
                                         gpointer thread)
{
  gpointer replacement_method;
  gpointer managed_stack;
  gpointer top_quick_frame;
  gpointer link_managed_stack;
  gpointer * link_top_quick_frame;

  replacement_method = get_replacement_method (method);
  if (replacement_method == NULL)
    return NULL;

  /*
   * Stack check.
   *
   * Return NULL to indicate that the original method should be invoked, otherwise
   * return a pointer to the replacement ArtMethod.
   *
   * If the caller is our own JNI replacement stub, then a stack transition must
   * have been pushed onto the current thread's linked list.
   *
   * Therefore, we invoke the original method if the following conditions are met:
   *   1- The current managed stack is empty.
   *   2- The ArtMethod * inside the linked managed stack's top quick frame is the
   *      same as our replacement.
   */
  managed_stack = thread + ${threadOffsets.managedStack};
  top_quick_frame = *((gpointer *) (managed_stack + ${managedStackOffsets.topQuickFrame}));
  if (top_quick_frame != NULL)
    return replacement_method;

  link_managed_stack = *((gpointer *) (managed_stack + ${managedStackOffsets.link}));
  if (link_managed_stack == NULL)
    return replacement_method;

  link_top_quick_frame = GSIZE_TO_POINTER (*((gsize *) (link_managed_stack + ${managedStackOffsets.topQuickFrame})) & ~((gsize) 1));
  if (link_top_quick_frame == NULL || *link_top_quick_frame != replacement_method)
    return replacement_method;

  return NULL;
}

void
on_interpreter_do_call (GumInvocationContext * ic)
{
  gpointer method, replacement_method;

  method = gum_invocation_context_get_nth_argument (ic, 0);

  replacement_method = get_replacement_method (method);
  if (replacement_method != NULL)
    gum_invocation_context_replace_nth_argument (ic, 0, replacement_method);
}

gpointer
on_art_method_get_oat_quick_method_header (gpointer method,
                                           gpointer pc)
{
  if (is_replacement_method (method))
    return NULL;

  return get_oat_quick_method_header_impl (method, pc);
}

void
on_art_method_pretty_method (GumInvocationContext * ic)
{
  const guint this_arg_index = ${Process.arch === "arm64" ? 0 : 1};
  gpointer method;

  method = gum_invocation_context_get_nth_argument (ic, this_arg_index);
  if (method == NULL)
    gum_invocation_context_replace_nth_argument (ic, this_arg_index, last_seen_art_method);
  else
    last_seen_art_method = method;
}

void
on_leave_gc_concurrent_copying_copying_phase (GumInvocationContext * ic)
{
  GHashTableIter iter;
  gpointer hooked_method, replacement_method;

  g_mutex_lock (&lock);

  g_hash_table_iter_init (&iter, methods);
  while (g_hash_table_iter_next (&iter, &hooked_method, &replacement_method))
    *((uint32_t *) replacement_method) = *((uint32_t *) hooked_method);

  g_mutex_unlock (&lock);
}
`;
  const lockSize = 8;
  const methodsSize = pointerSize7;
  const replacementsSize = pointerSize7;
  const lastSeenArtMethodSize = pointerSize7;
  const data = Memory.alloc(lockSize + methodsSize + replacementsSize + lastSeenArtMethodSize);
  const lock = data;
  const methods = lock.add(lockSize);
  const replacements = methods.add(methodsSize);
  const lastSeenArtMethod = replacements.add(replacementsSize);
  const getOatQuickMethodHeaderImpl = api3.find(pointerSize7 === 4 ? "_ZN3art9ArtMethod23GetOatQuickMethodHeaderEj" : "_ZN3art9ArtMethod23GetOatQuickMethodHeaderEm");
  const cm2 = new CModule(code5, {
    lock,
    methods,
    replacements,
    last_seen_art_method: lastSeenArtMethod,
    get_oat_quick_method_header_impl: getOatQuickMethodHeaderImpl ?? ptr("0xdeadbeef")
  });
  const fastOptions = { exceptions: "propagate", scheduling: "exclusive" };
  return {
    handle: cm2,
    replacedMethods: {
      isReplacement: new NativeFunction(cm2.is_replacement_method, "bool", ["pointer"], fastOptions),
      get: new NativeFunction(cm2.get_replacement_method, "pointer", ["pointer"], fastOptions),
      set: new NativeFunction(cm2.set_replacement_method, "void", ["pointer", "pointer"], fastOptions),
      synchronize: new NativeFunction(cm2.synchronize_replacement_methods, "void", ["uint", "pointer", "pointer"], fastOptions),
      delete: new NativeFunction(cm2.delete_replacement_method, "void", ["pointer"], fastOptions),
      translate: new NativeFunction(cm2.translate_method, "pointer", ["pointer"], fastOptions),
      findReplacementFromQuickCode: cm2.find_replacement_method_from_quick_code
    },
    getOatQuickMethodHeaderImpl,
    hooks: {
      Interpreter: {
        doCall: cm2.on_interpreter_do_call
      },
      ArtMethod: {
        getOatQuickMethodHeader: cm2.on_art_method_get_oat_quick_method_header,
        prettyMethod: cm2.on_art_method_pretty_method
      },
      Gc: {
        copyingPhase: {
          onLeave: cm2.on_leave_gc_concurrent_copying_copying_phase
        },
        runFlip: {
          onEnter: cm2.on_leave_gc_concurrent_copying_copying_phase
        }
      }
    }
  };
}
function ensureArtKnowsHowToHandleMethodInstrumentation(vm3) {
  if (taughtArtAboutMethodInstrumentation) {
    return;
  }
  taughtArtAboutMethodInstrumentation = true;
  instrumentArtQuickEntrypoints(vm3);
  instrumentArtMethodInvocationFromInterpreter();
  instrumentArtGarbageCollection();
  instrumentArtFixupStaticTrampolines();
}
function instrumentArtQuickEntrypoints(vm3) {
  const api3 = getApi2();
  const quickEntrypoints = [
    api3.artQuickGenericJniTrampoline,
    api3.artQuickToInterpreterBridge,
    api3.artQuickResolutionTrampoline
  ];
  quickEntrypoints.forEach((entrypoint) => {
    Memory.protect(entrypoint, 32, "rwx");
    const interceptor = new ArtQuickCodeInterceptor(entrypoint);
    interceptor.activate(vm3);
    artQuickInterceptors.push(interceptor);
  });
}
function instrumentArtMethodInvocationFromInterpreter() {
  const api3 = getApi2();
  const apiLevel = getAndroidApiLevel();
  const { isApiLevel34OrApexEquivalent } = api3;
  let artInterpreterDoCallExportRegex;
  if (apiLevel <= 22) {
    artInterpreterDoCallExportRegex = /^_ZN3art11interpreter6DoCallILb[0-1]ELb[0-1]EEEbPNS_6mirror9ArtMethodEPNS_6ThreadERNS_11ShadowFrameEPKNS_11InstructionEtPNS_6JValueE$/;
  } else if (apiLevel <= 33 && !isApiLevel34OrApexEquivalent) {
    artInterpreterDoCallExportRegex = /^_ZN3art11interpreter6DoCallILb[0-1]ELb[0-1]EEEbPNS_9ArtMethodEPNS_6ThreadERNS_11ShadowFrameEPKNS_11InstructionEtPNS_6JValueE$/;
  } else if (isApiLevel34OrApexEquivalent) {
    artInterpreterDoCallExportRegex = /^_ZN3art11interpreter6DoCallILb[0-1]EEEbPNS_9ArtMethodEPNS_6ThreadERNS_11ShadowFrameEPKNS_11InstructionEtbPNS_6JValueE$/;
  } else {
    throw new Error("Unable to find method invocation in ART; please file a bug");
  }
  const art = api3.module;
  const entries = [...art.enumerateExports(), ...art.enumerateSymbols()].filter((entry) => artInterpreterDoCallExportRegex.test(entry.name));
  if (entries.length === 0) {
    throw new Error("Unable to find method invocation in ART; please file a bug");
  }
  for (const entry of entries) {
    Interceptor.attach(entry.address, artController.hooks.Interpreter.doCall);
  }
}
function instrumentArtGarbageCollection() {
  const api3 = getApi2();
  const art = api3.module;
  const gc = art.findSymbolByName("_ZN3art2gc4Heap22CollectGarbageInternalENS0_9collector6GcTypeENS0_7GcCauseEbj");
  if (gc === null) {
    return;
  }
  const { artNterpEntryPoint, artQuickToInterpreterBridge } = api3;
  const quickCodeOffset = getArtMethodSpec(api3.vm).offset.quickCode;
  Interceptor.attach(gc, {
    onLeave() {
      artController.replacedMethods.synchronize(quickCodeOffset, artNterpEntryPoint, artQuickToInterpreterBridge);
    }
  });
}
function instrumentArtFixupStaticTrampolines() {
  const patterns = [
    ["_ZN3art11ClassLinker26VisiblyInitializedCallback22MarkVisiblyInitializedEPNS_6ThreadE", "e90340f8 : ff0ff0ff"],
    ["_ZN3art11ClassLinker26VisiblyInitializedCallback29AdjustThreadVisibilityCounterEPNS_6ThreadEl", "7f0f00f9 : 1ffcffff"]
  ];
  const api3 = getApi2();
  const art = api3.module;
  for (const [name2, pattern] of patterns) {
    const base = art.findSymbolByName(name2);
    if (base === null) {
      continue;
    }
    const matches = Memory.scanSync(base, 8192, pattern);
    if (matches.length === 0) {
      return;
    }
    const { artNterpEntryPoint, artQuickToInterpreterBridge } = api3;
    const quickCodeOffset = getArtMethodSpec(api3.vm).offset.quickCode;
    Interceptor.attach(matches[0].address, function() {
      artController.replacedMethods.synchronize(quickCodeOffset, artNterpEntryPoint, artQuickToInterpreterBridge);
    });
    return;
  }
}
function ensureArtKnowsHowToHandleReplacementMethods(vm3) {
  if (taughtArtAboutReplacementMethods) {
    return;
  }
  taughtArtAboutReplacementMethods = true;
  if (!maybeInstrumentGetOatQuickMethodHeaderInlineCopies()) {
    const { getOatQuickMethodHeaderImpl } = artController;
    if (getOatQuickMethodHeaderImpl === null) {
      return;
    }
    try {
      Interceptor.replace(getOatQuickMethodHeaderImpl, artController.hooks.ArtMethod.getOatQuickMethodHeader);
    } catch (e) {
    }
  }
  const apiLevel = getAndroidApiLevel();
  let copyingPhase = null;
  const api3 = getApi2();
  if (apiLevel > 28) {
    copyingPhase = api3.find("_ZN3art2gc9collector17ConcurrentCopying12CopyingPhaseEv");
  } else if (apiLevel > 22) {
    copyingPhase = api3.find("_ZN3art2gc9collector17ConcurrentCopying12MarkingPhaseEv");
  }
  if (copyingPhase !== null) {
    Interceptor.attach(copyingPhase, artController.hooks.Gc.copyingPhase);
  }
  let runFlip = null;
  runFlip = api3.find("_ZN3art6Thread15RunFlipFunctionEPS0_");
  if (runFlip === null) {
    runFlip = api3.find("_ZN3art6Thread15RunFlipFunctionEPS0_b");
  }
  if (runFlip !== null) {
    Interceptor.attach(runFlip, artController.hooks.Gc.runFlip);
  }
}
function validateGetOatQuickMethodHeaderInlinedMatchArm({ address, size }) {
  const ldr = Instruction.parse(address.or(1));
  const [ldrDst, ldrSrc] = ldr.operands;
  const methodReg = ldrSrc.value.base;
  const scratchReg = ldrDst.value;
  const branch = Instruction.parse(ldr.next.add(2));
  const targetWhenTrue = ptr(branch.operands[0].value);
  const targetWhenFalse = branch.address.add(branch.size);
  let targetWhenRegularMethod, targetWhenRuntimeMethod;
  if (branch.mnemonic === "beq") {
    targetWhenRegularMethod = targetWhenFalse;
    targetWhenRuntimeMethod = targetWhenTrue;
  } else {
    targetWhenRegularMethod = targetWhenTrue;
    targetWhenRuntimeMethod = targetWhenFalse;
  }
  return parseInstructionsAt(targetWhenRegularMethod.or(1), tryParse, { limit: 3 });
  function tryParse(insn) {
    const { mnemonic } = insn;
    if (!(mnemonic === "ldr" || mnemonic === "ldr.w")) {
      return null;
    }
    const { base, disp } = insn.operands[1].value;
    if (!(base === methodReg && disp === 20)) {
      return null;
    }
    return {
      methodReg,
      scratchReg,
      target: {
        whenTrue: targetWhenTrue,
        whenRegularMethod: targetWhenRegularMethod,
        whenRuntimeMethod: targetWhenRuntimeMethod
      }
    };
  }
}
function validateGetOatQuickMethodHeaderInlinedMatchArm64({ address, size }) {
  const [ldrDst, ldrSrc] = Instruction.parse(address).operands;
  const methodReg = ldrSrc.value.base;
  const scratchReg = "x" + ldrDst.value.substring(1);
  const branch = Instruction.parse(address.add(8));
  const targetWhenTrue = ptr(branch.operands[0].value);
  const targetWhenFalse = address.add(12);
  let targetWhenRegularMethod, targetWhenRuntimeMethod;
  if (branch.mnemonic === "b.eq") {
    targetWhenRegularMethod = targetWhenFalse;
    targetWhenRuntimeMethod = targetWhenTrue;
  } else {
    targetWhenRegularMethod = targetWhenTrue;
    targetWhenRuntimeMethod = targetWhenFalse;
  }
  return parseInstructionsAt(targetWhenRegularMethod, tryParse, { limit: 3 });
  function tryParse(insn) {
    if (insn.mnemonic !== "ldr") {
      return null;
    }
    const { base, disp } = insn.operands[1].value;
    if (!(base === methodReg && disp === 24)) {
      return null;
    }
    return {
      methodReg,
      scratchReg,
      target: {
        whenTrue: targetWhenTrue,
        whenRegularMethod: targetWhenRegularMethod,
        whenRuntimeMethod: targetWhenRuntimeMethod
      }
    };
  }
}
function maybeInstrumentGetOatQuickMethodHeaderInlineCopies() {
  if (getAndroidApiLevel() < 31) {
    return false;
  }
  const handler = artGetOatQuickMethodHeaderInlinedCopyHandler[Process.arch];
  if (handler === void 0) {
    return false;
  }
  const signatures = handler.signatures.map(({ pattern, offset = 0, validateMatch = returnEmptyObject }) => {
    return {
      pattern: new MatchPattern(pattern.join("")),
      offset,
      validateMatch
    };
  });
  const impls = [];
  for (const { base, size } of getApi2().module.enumerateRanges("--x")) {
    for (const { pattern, offset, validateMatch } of signatures) {
      const matches = Memory.scanSync(base, size, pattern).map(({ address, size: size2 }) => {
        return { address: address.sub(offset), size: size2 + offset };
      }).filter((match) => {
        const validationResult = validateMatch(match);
        if (validationResult === null) {
          return false;
        }
        match.validationResult = validationResult;
        return true;
      });
      impls.push(...matches);
    }
  }
  if (impls.length === 0) {
    return false;
  }
  impls.forEach(handler.instrument);
  return true;
}
function returnEmptyObject() {
  return {};
}
function instrumentGetOatQuickMethodHeaderInlinedCopyArm({ address, size, validationResult }) {
  const { methodReg, target } = validationResult;
  const trampoline = Memory.alloc(Process.pageSize);
  let redirectCapacity = size;
  Memory.patchCode(trampoline, 256, (code5) => {
    const writer = new ThumbWriter(code5, { pc: trampoline });
    const relocator = new ThumbRelocator(address, writer);
    for (let i = 0; i !== 2; i++) {
      relocator.readOne();
    }
    relocator.writeAll();
    relocator.readOne();
    relocator.skipOne();
    writer.putBCondLabel("eq", "runtime_or_replacement_method");
    const vpushFpRegs = [45, 237, 16, 10];
    writer.putBytes(vpushFpRegs);
    const savedRegs = ["r0", "r1", "r2", "r3"];
    writer.putPushRegs(savedRegs);
    writer.putCallAddressWithArguments(artController.replacedMethods.isReplacement, [methodReg]);
    writer.putCmpRegImm("r0", 0);
    writer.putPopRegs(savedRegs);
    const vpopFpRegs = [189, 236, 16, 10];
    writer.putBytes(vpopFpRegs);
    writer.putBCondLabel("ne", "runtime_or_replacement_method");
    writer.putBLabel("regular_method");
    relocator.readOne();
    const tailIsRegular = relocator.input.address.equals(target.whenRegularMethod);
    writer.putLabel(tailIsRegular ? "regular_method" : "runtime_or_replacement_method");
    relocator.writeOne();
    while (redirectCapacity < 10) {
      const offset = relocator.readOne();
      if (offset === 0) {
        redirectCapacity = 10;
        break;
      }
      redirectCapacity = offset;
    }
    relocator.writeAll();
    writer.putBranchAddress(address.add(redirectCapacity + 1));
    writer.putLabel(tailIsRegular ? "runtime_or_replacement_method" : "regular_method");
    writer.putBranchAddress(target.whenTrue);
    writer.flush();
  });
  inlineHooks.push(new InlineHook(address, redirectCapacity, trampoline));
  Memory.patchCode(address, redirectCapacity, (code5) => {
    const writer = new ThumbWriter(code5, { pc: address });
    writer.putLdrRegAddress("pc", trampoline.or(1));
    writer.flush();
  });
}
function instrumentGetOatQuickMethodHeaderInlinedCopyArm64({ address, size, validationResult }) {
  const { methodReg, scratchReg, target } = validationResult;
  const trampoline = Memory.alloc(Process.pageSize);
  Memory.patchCode(trampoline, 256, (code5) => {
    const writer = new Arm64Writer(code5, { pc: trampoline });
    const relocator = new Arm64Relocator(address, writer);
    for (let i = 0; i !== 2; i++) {
      relocator.readOne();
    }
    relocator.writeAll();
    relocator.readOne();
    relocator.skipOne();
    writer.putBCondLabel("eq", "runtime_or_replacement_method");
    const savedRegs = [
      "d0",
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      "d6",
      "d7",
      "x0",
      "x1",
      "x2",
      "x3",
      "x4",
      "x5",
      "x6",
      "x7",
      "x8",
      "x9",
      "x10",
      "x11",
      "x12",
      "x13",
      "x14",
      "x15",
      "x16",
      "x17"
    ];
    const numSavedRegs = savedRegs.length;
    for (let i = 0; i !== numSavedRegs; i += 2) {
      writer.putPushRegReg(savedRegs[i], savedRegs[i + 1]);
    }
    writer.putCallAddressWithArguments(artController.replacedMethods.isReplacement, [methodReg]);
    writer.putCmpRegReg("x0", "xzr");
    for (let i = numSavedRegs - 2; i >= 0; i -= 2) {
      writer.putPopRegReg(savedRegs[i], savedRegs[i + 1]);
    }
    writer.putBCondLabel("ne", "runtime_or_replacement_method");
    writer.putBLabel("regular_method");
    relocator.readOne();
    const tailInstruction = relocator.input;
    const tailIsRegular = tailInstruction.address.equals(target.whenRegularMethod);
    writer.putLabel(tailIsRegular ? "regular_method" : "runtime_or_replacement_method");
    relocator.writeOne();
    writer.putBranchAddress(tailInstruction.next);
    writer.putLabel(tailIsRegular ? "runtime_or_replacement_method" : "regular_method");
    writer.putBranchAddress(target.whenTrue);
    writer.flush();
  });
  inlineHooks.push(new InlineHook(address, size, trampoline));
  Memory.patchCode(address, size, (code5) => {
    const writer = new Arm64Writer(code5, { pc: address });
    writer.putLdrRegAddress(scratchReg, trampoline);
    writer.putBrReg(scratchReg);
    writer.flush();
  });
}
function makeMethodMangler(methodId) {
  return new MethodMangler(methodId);
}
function translateMethod(methodId) {
  return artController.replacedMethods.translate(methodId);
}
function backtrace(vm3, options = {}) {
  const { limit = 16 } = options;
  const env2 = vm3.getEnv();
  if (backtraceModule === null) {
    backtraceModule = makeBacktraceModule(vm3, env2);
  }
  return backtraceModule.backtrace(env2, limit);
}
function makeBacktraceModule(vm3, env2) {
  const api3 = getApi2();
  const performImpl = Memory.alloc(Process.pointerSize);
  const cm2 = new CModule(`
#include <glib.h>
#include <stdbool.h>
#include <string.h>
#include <gum/gumtls.h>
#include <json-glib/json-glib.h>

typedef struct _ArtBacktrace ArtBacktrace;
typedef struct _ArtStackFrame ArtStackFrame;

typedef struct _ArtStackVisitor ArtStackVisitor;
typedef struct _ArtStackVisitorVTable ArtStackVisitorVTable;

typedef struct _ArtClass ArtClass;
typedef struct _ArtMethod ArtMethod;
typedef struct _ArtThread ArtThread;
typedef struct _ArtContext ArtContext;

typedef struct _JNIEnv JNIEnv;

typedef struct _StdString StdString;
typedef struct _StdTinyString StdTinyString;
typedef struct _StdLargeString StdLargeString;

typedef enum {
  STACK_WALK_INCLUDE_INLINED_FRAMES,
  STACK_WALK_SKIP_INLINED_FRAMES,
} StackWalkKind;

struct _StdTinyString
{
  guint8 unused;
  gchar data[(3 * sizeof (gpointer)) - 1];
};

struct _StdLargeString
{
  gsize capacity;
  gsize size;
  gchar * data;
};

struct _StdString
{
  union
  {
    guint8 flags;
    StdTinyString tiny;
    StdLargeString large;
  };
};

struct _ArtBacktrace
{
  GChecksum * id;
  GArray * frames;
  gchar * frames_json;
};

struct _ArtStackFrame
{
  ArtMethod * method;
  gsize dexpc;
  StdString description;
};

struct _ArtStackVisitorVTable
{
  void (* unused1) (void);
  void (* unused2) (void);
  bool (* visit) (ArtStackVisitor * visitor);
};

struct _ArtStackVisitor
{
  ArtStackVisitorVTable * vtable;

  guint8 padding[512];

  ArtStackVisitorVTable vtable_storage;

  ArtBacktrace * backtrace;
};

struct _ArtMethod
{
  guint32 declaring_class;
  guint32 access_flags;
};

extern GumTlsKey current_backtrace;

extern void (* perform_art_thread_state_transition) (JNIEnv * env);

extern ArtContext * art_make_context (ArtThread * thread);

extern void art_stack_visitor_init (ArtStackVisitor * visitor, ArtThread * thread, void * context, StackWalkKind walk_kind,
    size_t num_frames, bool check_suspended);
extern void art_stack_visitor_walk_stack (ArtStackVisitor * visitor, bool include_transitions);
extern ArtMethod * art_stack_visitor_get_method (ArtStackVisitor * visitor);
extern void art_stack_visitor_describe_location (StdString * description, ArtStackVisitor * visitor);
extern ArtMethod * translate_method (ArtMethod * method);
extern void translate_location (ArtMethod * method, guint32 pc, const gchar ** source_file, gint32 * line_number);
extern void get_class_location (StdString * result, ArtClass * klass);
extern void cxx_delete (void * mem);
extern unsigned long strtoul (const char * str, char ** endptr, int base);

static bool visit_frame (ArtStackVisitor * visitor);
static void art_stack_frame_destroy (ArtStackFrame * frame);

static void append_jni_type_name (GString * s, const gchar * name, gsize length);

static void std_string_destroy (StdString * str);
static gchar * std_string_get_data (StdString * str);

void
init (void)
{
  current_backtrace = gum_tls_key_new ();
}

void
finalize (void)
{
  gum_tls_key_free (current_backtrace);
}

ArtBacktrace *
_create (JNIEnv * env,
         guint limit)
{
  ArtBacktrace * bt;

  bt = g_new (ArtBacktrace, 1);
  bt->id = g_checksum_new (G_CHECKSUM_SHA1);
  bt->frames = (limit != 0)
      ? g_array_sized_new (FALSE, FALSE, sizeof (ArtStackFrame), limit)
      : g_array_new (FALSE, FALSE, sizeof (ArtStackFrame));
  g_array_set_clear_func (bt->frames, (GDestroyNotify) art_stack_frame_destroy);
  bt->frames_json = NULL;

  gum_tls_key_set_value (current_backtrace, bt);

  perform_art_thread_state_transition (env);

  gum_tls_key_set_value (current_backtrace, NULL);

  return bt;
}

void
_on_thread_state_transition_complete (ArtThread * thread)
{
  ArtContext * context;
  ArtStackVisitor visitor = {
    .vtable_storage = {
      .visit = visit_frame,
    },
  };

  context = art_make_context (thread);

  art_stack_visitor_init (&visitor, thread, context, STACK_WALK_SKIP_INLINED_FRAMES, 0, true);
  visitor.vtable = &visitor.vtable_storage;
  visitor.backtrace = gum_tls_key_get_value (current_backtrace);

  art_stack_visitor_walk_stack (&visitor, false);

  cxx_delete (context);
}

static bool
visit_frame (ArtStackVisitor * visitor)
{
  ArtBacktrace * bt = visitor->backtrace;
  ArtStackFrame frame;
  const gchar * description, * dexpc_part;

  frame.method = art_stack_visitor_get_method (visitor);

  art_stack_visitor_describe_location (&frame.description, visitor);

  description = std_string_get_data (&frame.description);
  if (strstr (description, " '<") != NULL)
    goto skip;

  dexpc_part = strstr (description, " at dex PC 0x");
  if (dexpc_part == NULL)
    goto skip;
  frame.dexpc = strtoul (dexpc_part + 13, NULL, 16);

  g_array_append_val (bt->frames, frame);

  g_checksum_update (bt->id, (guchar *) &frame.method, sizeof (frame.method));
  g_checksum_update (bt->id, (guchar *) &frame.dexpc, sizeof (frame.dexpc));

  return true;

skip:
  std_string_destroy (&frame.description);
  return true;
}

static void
art_stack_frame_destroy (ArtStackFrame * frame)
{
  std_string_destroy (&frame->description);
}

void
_destroy (ArtBacktrace * backtrace)
{
  g_free (backtrace->frames_json);
  g_array_free (backtrace->frames, TRUE);
  g_checksum_free (backtrace->id);
  g_free (backtrace);
}

const gchar *
_get_id (ArtBacktrace * backtrace)
{
  return g_checksum_get_string (backtrace->id);
}

const gchar *
_get_frames (ArtBacktrace * backtrace)
{
  GArray * frames = backtrace->frames;
  JsonBuilder * b;
  guint i;
  JsonNode * root;

  if (backtrace->frames_json != NULL)
    return backtrace->frames_json;

  b = json_builder_new_immutable ();

  json_builder_begin_array (b);

  for (i = 0; i != frames->len; i++)
  {
    ArtStackFrame * frame = &g_array_index (frames, ArtStackFrame, i);
    gchar * description, * ret_type, * paren_open, * paren_close, * arg_types, * token, * method_name, * class_name;
    GString * signature;
    gchar * cursor;
    ArtMethod * translated_method;
    StdString location;
    gsize dexpc;
    const gchar * source_file;
    gint32 line_number;

    description = std_string_get_data (&frame->description);

    ret_type = strchr (description, '\\'') + 1;

    paren_open = strchr (ret_type, '(');
    paren_close = strchr (paren_open, ')');
    *paren_open = '\\0';
    *paren_close = '\\0';

    arg_types = paren_open + 1;

    token = strrchr (ret_type, '.');
    *token = '\\0';

    method_name = token + 1;

    token = strrchr (ret_type, ' ');
    *token = '\\0';

    class_name = token + 1;

    signature = g_string_sized_new (128);

    append_jni_type_name (signature, class_name, method_name - class_name - 1);
    g_string_append_c (signature, ',');
    g_string_append (signature, method_name);
    g_string_append (signature, ",(");

    if (arg_types != paren_close)
    {
      for (cursor = arg_types; cursor != NULL;)
      {
        gsize length;
        gchar * next;

        token = strstr (cursor, ", ");
        if (token != NULL)
        {
          length = token - cursor;
          next = token + 2;
        }
        else
        {
          length = paren_close - cursor;
          next = NULL;
        }

        append_jni_type_name (signature, cursor, length);

        cursor = next;
      }
    }

    g_string_append_c (signature, ')');

    append_jni_type_name (signature, ret_type, class_name - ret_type - 1);

    translated_method = translate_method (frame->method);
    dexpc = (translated_method == frame->method) ? frame->dexpc : 0;

    get_class_location (&location, GSIZE_TO_POINTER (translated_method->declaring_class));

    translate_location (translated_method, dexpc, &source_file, &line_number);

    json_builder_begin_object (b);

    json_builder_set_member_name (b, "signature");
    json_builder_add_string_value (b, signature->str);

    json_builder_set_member_name (b, "origin");
    json_builder_add_string_value (b, std_string_get_data (&location));

    json_builder_set_member_name (b, "className");
    json_builder_add_string_value (b, class_name);

    json_builder_set_member_name (b, "methodName");
    json_builder_add_string_value (b, method_name);

    json_builder_set_member_name (b, "methodFlags");
    json_builder_add_int_value (b, translated_method->access_flags);

    json_builder_set_member_name (b, "fileName");
    json_builder_add_string_value (b, source_file);

    json_builder_set_member_name (b, "lineNumber");
    json_builder_add_int_value (b, line_number);

    json_builder_end_object (b);

    std_string_destroy (&location);
    g_string_free (signature, TRUE);
  }

  json_builder_end_array (b);

  root = json_builder_get_root (b);
  backtrace->frames_json = json_to_string (root, FALSE);
  json_node_unref (root);

  return backtrace->frames_json;
}

static void
append_jni_type_name (GString * s,
                      const gchar * name,
                      gsize length)
{
  gchar shorty = '\\0';
  gsize i;

  switch (name[0])
  {
    case 'b':
      if (strncmp (name, "boolean", length) == 0)
        shorty = 'Z';
      else if (strncmp (name, "byte", length) == 0)
        shorty = 'B';
      break;
    case 'c':
      if (strncmp (name, "char", length) == 0)
        shorty = 'C';
      break;
    case 'd':
      if (strncmp (name, "double", length) == 0)
        shorty = 'D';
      break;
    case 'f':
      if (strncmp (name, "float", length) == 0)
        shorty = 'F';
      break;
    case 'i':
      if (strncmp (name, "int", length) == 0)
        shorty = 'I';
      break;
    case 'l':
      if (strncmp (name, "long", length) == 0)
        shorty = 'J';
      break;
    case 's':
      if (strncmp (name, "short", length) == 0)
        shorty = 'S';
      break;
    case 'v':
      if (strncmp (name, "void", length) == 0)
        shorty = 'V';
      break;
  }

  if (shorty != '\\0')
  {
    g_string_append_c (s, shorty);

    return;
  }

  if (length > 2 && name[length - 2] == '[' && name[length - 1] == ']')
  {
    g_string_append_c (s, '[');
    append_jni_type_name (s, name, length - 2);

    return;
  }

  g_string_append_c (s, 'L');

  for (i = 0; i != length; i++)
  {
    gchar ch = name[i];
    if (ch != '.')
      g_string_append_c (s, ch);
    else
      g_string_append_c (s, '/');
  }

  g_string_append_c (s, ';');
}

static void
std_string_destroy (StdString * str)
{
  bool is_large = (str->flags & 1) != 0;
  if (is_large)
    cxx_delete (str->large.data);
}

static gchar *
std_string_get_data (StdString * str)
{
  bool is_large = (str->flags & 1) != 0;
  return is_large ? str->large.data : str->tiny.data;
}
`, {
    current_backtrace: Memory.alloc(Process.pointerSize),
    perform_art_thread_state_transition: performImpl,
    art_make_context: api3["art::Thread::GetLongJumpContext"] ?? api3["art::Context::Create"],
    art_stack_visitor_init: api3["art::StackVisitor::StackVisitor"],
    art_stack_visitor_walk_stack: api3["art::StackVisitor::WalkStack"],
    art_stack_visitor_get_method: api3["art::StackVisitor::GetMethod"],
    art_stack_visitor_describe_location: api3["art::StackVisitor::DescribeLocation"],
    translate_method: artController.replacedMethods.translate,
    translate_location: api3["art::Monitor::TranslateLocation"],
    get_class_location: api3["art::mirror::Class::GetLocation"],
    cxx_delete: api3.$delete,
    strtoul: Process.getModuleByName("libc.so").getExportByName("strtoul")
  });
  const _create = new NativeFunction(cm2._create, "pointer", ["pointer", "uint"], nativeFunctionOptions3);
  const _destroy = new NativeFunction(cm2._destroy, "void", ["pointer"], nativeFunctionOptions3);
  const fastOptions = { exceptions: "propagate", scheduling: "exclusive" };
  const _getId = new NativeFunction(cm2._get_id, "pointer", ["pointer"], fastOptions);
  const _getFrames = new NativeFunction(cm2._get_frames, "pointer", ["pointer"], fastOptions);
  const performThreadStateTransition = makeArtThreadStateTransitionImpl(vm3, env2, cm2._on_thread_state_transition_complete);
  cm2._performData = performThreadStateTransition;
  performImpl.writePointer(performThreadStateTransition);
  cm2.backtrace = (env3, limit) => {
    const handle2 = _create(env3, limit);
    const bt = new Backtrace(handle2);
    Script.bindWeak(bt, destroy.bind(null, handle2));
    return bt;
  };
  function destroy(handle2) {
    _destroy(handle2);
  }
  cm2.getId = (handle2) => {
    return _getId(handle2).readUtf8String();
  };
  cm2.getFrames = (handle2) => {
    return JSON.parse(_getFrames(handle2).readUtf8String());
  };
  return cm2;
}
function revertGlobalPatches() {
  patchedClasses.forEach((entry) => {
    entry.vtablePtr.writePointer(entry.vtable);
    entry.vtableCountPtr.writeS32(entry.vtableCount);
  });
  patchedClasses.clear();
  for (const interceptor of artQuickInterceptors.splice(0)) {
    interceptor.deactivate();
  }
  for (const hook of inlineHooks.splice(0)) {
    hook.revert();
  }
}
function unwrapMethodId(methodId) {
  return unwrapGenericId(methodId, "art::jni::JniIdManager::DecodeMethodId");
}
function unwrapFieldId(fieldId) {
  return unwrapGenericId(fieldId, "art::jni::JniIdManager::DecodeFieldId");
}
function unwrapGenericId(genericId, apiMethod) {
  const api3 = getApi2();
  const runtimeOffset = getArtRuntimeSpec(api3).offset;
  const jniIdManagerOffset = runtimeOffset.jniIdManager;
  const jniIdsIndirectionOffset = runtimeOffset.jniIdsIndirection;
  if (jniIdManagerOffset !== null && jniIdsIndirectionOffset !== null) {
    const runtime3 = api3.artRuntime;
    const jniIdsIndirection = runtime3.add(jniIdsIndirectionOffset).readInt();
    if (jniIdsIndirection !== kPointer) {
      const jniIdManager = runtime3.add(jniIdManagerOffset).readPointer();
      return api3[apiMethod](jniIdManager, genericId);
    }
  }
  return genericId;
}
function writeArtQuickCodeReplacementTrampolineIA32(trampoline, target, redirectSize, constraints, vm3) {
  const threadOffsets = getArtThreadSpec(vm3).offset;
  const artMethodOffsets = getArtMethodSpec(vm3).offset;
  let offset;
  Memory.patchCode(trampoline, 128, (code5) => {
    const writer = new X86Writer(code5, { pc: trampoline });
    const relocator = new X86Relocator(target, writer);
    const fxsave = [15, 174, 4, 36];
    const fxrstor = [15, 174, 12, 36];
    writer.putPushax();
    writer.putMovRegReg("ebp", "esp");
    writer.putAndRegU32("esp", 4294967280);
    writer.putSubRegImm("esp", 512);
    writer.putBytes(fxsave);
    writer.putMovRegFsU32Ptr("ebx", threadOffsets.self);
    writer.putCallAddressWithAlignedArguments(artController.replacedMethods.findReplacementFromQuickCode, ["eax", "ebx"]);
    writer.putTestRegReg("eax", "eax");
    writer.putJccShortLabel("je", "restore_registers", "no-hint");
    writer.putMovRegOffsetPtrReg("ebp", 7 * 4, "eax");
    writer.putLabel("restore_registers");
    writer.putBytes(fxrstor);
    writer.putMovRegReg("esp", "ebp");
    writer.putPopax();
    writer.putJccShortLabel("jne", "invoke_replacement", "no-hint");
    do {
      offset = relocator.readOne();
    } while (offset < redirectSize && !relocator.eoi);
    relocator.writeAll();
    if (!relocator.eoi) {
      writer.putJmpAddress(target.add(offset));
    }
    writer.putLabel("invoke_replacement");
    writer.putJmpRegOffsetPtr("eax", artMethodOffsets.quickCode);
    writer.flush();
  });
  return offset;
}
function writeArtQuickCodeReplacementTrampolineX64(trampoline, target, redirectSize, constraints, vm3) {
  const threadOffsets = getArtThreadSpec(vm3).offset;
  const artMethodOffsets = getArtMethodSpec(vm3).offset;
  let offset;
  Memory.patchCode(trampoline, 256, (code5) => {
    const writer = new X86Writer(code5, { pc: trampoline });
    const relocator = new X86Relocator(target, writer);
    const fxsave = [15, 174, 4, 36];
    const fxrstor = [15, 174, 12, 36];
    writer.putPushax();
    writer.putMovRegReg("rbp", "rsp");
    writer.putAndRegU32("rsp", 4294967280);
    writer.putSubRegImm("rsp", 512);
    writer.putBytes(fxsave);
    writer.putMovRegGsU32Ptr("rbx", threadOffsets.self);
    writer.putCallAddressWithAlignedArguments(artController.replacedMethods.findReplacementFromQuickCode, ["rdi", "rbx"]);
    writer.putTestRegReg("rax", "rax");
    writer.putJccShortLabel("je", "restore_registers", "no-hint");
    writer.putMovRegOffsetPtrReg("rbp", 8 * 8, "rax");
    writer.putLabel("restore_registers");
    writer.putBytes(fxrstor);
    writer.putMovRegReg("rsp", "rbp");
    writer.putPopax();
    writer.putJccShortLabel("jne", "invoke_replacement", "no-hint");
    do {
      offset = relocator.readOne();
    } while (offset < redirectSize && !relocator.eoi);
    relocator.writeAll();
    if (!relocator.eoi) {
      writer.putJmpAddress(target.add(offset));
    }
    writer.putLabel("invoke_replacement");
    writer.putJmpRegOffsetPtr("rdi", artMethodOffsets.quickCode);
    writer.flush();
  });
  return offset;
}
function writeArtQuickCodeReplacementTrampolineArm(trampoline, target, redirectSize, constraints, vm3) {
  const artMethodOffsets = getArtMethodSpec(vm3).offset;
  const targetAddress = target.and(THUMB_BIT_REMOVAL_MASK);
  let offset;
  Memory.patchCode(trampoline, 128, (code5) => {
    const writer = new ThumbWriter(code5, { pc: trampoline });
    const relocator = new ThumbRelocator(targetAddress, writer);
    const vpushFpRegs = [45, 237, 16, 10];
    const vpopFpRegs = [189, 236, 16, 10];
    writer.putPushRegs([
      "r1",
      "r2",
      "r3",
      "r5",
      "r6",
      "r7",
      "r8",
      "r10",
      "r11",
      "lr"
    ]);
    writer.putBytes(vpushFpRegs);
    writer.putSubRegRegImm("sp", "sp", 8);
    writer.putStrRegRegOffset("r0", "sp", 0);
    writer.putCallAddressWithArguments(artController.replacedMethods.findReplacementFromQuickCode, ["r0", "r9"]);
    writer.putCmpRegImm("r0", 0);
    writer.putBCondLabel("eq", "restore_registers");
    writer.putStrRegRegOffset("r0", "sp", 0);
    writer.putLabel("restore_registers");
    writer.putLdrRegRegOffset("r0", "sp", 0);
    writer.putAddRegRegImm("sp", "sp", 8);
    writer.putBytes(vpopFpRegs);
    writer.putPopRegs([
      "lr",
      "r11",
      "r10",
      "r8",
      "r7",
      "r6",
      "r5",
      "r3",
      "r2",
      "r1"
    ]);
    writer.putBCondLabel("ne", "invoke_replacement");
    do {
      offset = relocator.readOne();
    } while (offset < redirectSize && !relocator.eoi);
    relocator.writeAll();
    if (!relocator.eoi) {
      writer.putLdrRegAddress("pc", target.add(offset));
    }
    writer.putLabel("invoke_replacement");
    writer.putLdrRegRegOffset("pc", "r0", artMethodOffsets.quickCode);
    writer.flush();
  });
  return offset;
}
function writeArtQuickCodeReplacementTrampolineArm64(trampoline, target, redirectSize, { availableScratchRegs }, vm3) {
  const artMethodOffsets = getArtMethodSpec(vm3).offset;
  let offset;
  Memory.patchCode(trampoline, 256, (code5) => {
    const writer = new Arm64Writer(code5, { pc: trampoline });
    const relocator = new Arm64Relocator(target, writer);
    writer.putPushRegReg("d0", "d1");
    writer.putPushRegReg("d2", "d3");
    writer.putPushRegReg("d4", "d5");
    writer.putPushRegReg("d6", "d7");
    writer.putPushRegReg("x1", "x2");
    writer.putPushRegReg("x3", "x4");
    writer.putPushRegReg("x5", "x6");
    writer.putPushRegReg("x7", "x20");
    writer.putPushRegReg("x21", "x22");
    writer.putPushRegReg("x23", "x24");
    writer.putPushRegReg("x25", "x26");
    writer.putPushRegReg("x27", "x28");
    writer.putPushRegReg("x29", "lr");
    writer.putSubRegRegImm("sp", "sp", 16);
    writer.putStrRegRegOffset("x0", "sp", 0);
    writer.putCallAddressWithArguments(artController.replacedMethods.findReplacementFromQuickCode, ["x0", "x19"]);
    writer.putCmpRegReg("x0", "xzr");
    writer.putBCondLabel("eq", "restore_registers");
    writer.putStrRegRegOffset("x0", "sp", 0);
    writer.putLabel("restore_registers");
    writer.putLdrRegRegOffset("x0", "sp", 0);
    writer.putAddRegRegImm("sp", "sp", 16);
    writer.putPopRegReg("x29", "lr");
    writer.putPopRegReg("x27", "x28");
    writer.putPopRegReg("x25", "x26");
    writer.putPopRegReg("x23", "x24");
    writer.putPopRegReg("x21", "x22");
    writer.putPopRegReg("x7", "x20");
    writer.putPopRegReg("x5", "x6");
    writer.putPopRegReg("x3", "x4");
    writer.putPopRegReg("x1", "x2");
    writer.putPopRegReg("d6", "d7");
    writer.putPopRegReg("d4", "d5");
    writer.putPopRegReg("d2", "d3");
    writer.putPopRegReg("d0", "d1");
    writer.putBCondLabel("ne", "invoke_replacement");
    do {
      offset = relocator.readOne();
    } while (offset < redirectSize && !relocator.eoi);
    relocator.writeAll();
    if (!relocator.eoi) {
      const scratchReg = Array.from(availableScratchRegs)[0];
      writer.putLdrRegAddress(scratchReg, target.add(offset));
      writer.putBrReg(scratchReg);
    }
    writer.putLabel("invoke_replacement");
    writer.putLdrRegRegOffset("x16", "x0", artMethodOffsets.quickCode);
    writer.putBrReg("x16");
    writer.flush();
  });
  return offset;
}
function writeArtQuickCodePrologueX86(target, trampoline, redirectSize) {
  Memory.patchCode(target, 16, (code5) => {
    const writer = new X86Writer(code5, { pc: target });
    writer.putJmpAddress(trampoline);
    writer.flush();
  });
}
function writeArtQuickCodePrologueArm(target, trampoline, redirectSize) {
  const targetAddress = target.and(THUMB_BIT_REMOVAL_MASK);
  Memory.patchCode(targetAddress, 16, (code5) => {
    const writer = new ThumbWriter(code5, { pc: targetAddress });
    writer.putLdrRegAddress("pc", trampoline.or(1));
    writer.flush();
  });
}
function writeArtQuickCodePrologueArm64(target, trampoline, redirectSize) {
  Memory.patchCode(target, 16, (code5) => {
    const writer = new Arm64Writer(code5, { pc: target });
    if (redirectSize === 16) {
      writer.putLdrRegAddress("x16", trampoline);
    } else {
      writer.putAdrpRegAddress("x16", trampoline);
    }
    writer.putBrReg("x16");
    writer.flush();
  });
}
function isArtQuickEntrypoint(address) {
  const api3 = getApi2();
  const { module: m2, artClassLinker } = api3;
  return address.equals(artClassLinker.quickGenericJniTrampoline) || address.equals(artClassLinker.quickToInterpreterBridgeTrampoline) || address.equals(artClassLinker.quickResolutionTrampoline) || address.equals(artClassLinker.quickImtConflictTrampoline) || address.compare(m2.base) >= 0 && address.compare(m2.base.add(m2.size)) < 0;
}
function xposedIsSupported() {
  return getAndroidApiLevel() < 28;
}
function fetchArtMethod(methodId, vm3) {
  const artMethodSpec = getArtMethodSpec(vm3);
  const artMethodOffset = artMethodSpec.offset;
  return ["jniCode", "accessFlags", "quickCode", "interpreterCode"].reduce((original, name2) => {
    const offset = artMethodOffset[name2];
    if (offset === void 0) {
      return original;
    }
    const address = methodId.add(offset);
    const read2 = name2 === "accessFlags" ? readU32 : readPointer;
    original[name2] = read2.call(address);
    return original;
  }, {});
}
function patchArtMethod(methodId, patches, vm3) {
  const artMethodSpec = getArtMethodSpec(vm3);
  const artMethodOffset = artMethodSpec.offset;
  Object.keys(patches).forEach((name2) => {
    const offset = artMethodOffset[name2];
    if (offset === void 0) {
      return;
    }
    const address = methodId.add(offset);
    const write3 = name2 === "accessFlags" ? writeU32 : writePointer;
    write3.call(address, patches[name2]);
  });
}
function computeDalvikJniArgInfo(methodId) {
  if (Process.arch !== "ia32") {
    return DALVIK_JNI_NO_ARG_INFO;
  }
  const shorty = methodId.add(DVM_METHOD_OFFSET_SHORTY).readPointer().readCString();
  if (shorty === null || shorty.length === 0 || shorty.length > 65535) {
    return DALVIK_JNI_NO_ARG_INFO;
  }
  let returnType;
  switch (shorty[0]) {
    case "V":
      returnType = DALVIK_JNI_RETURN_VOID;
      break;
    case "F":
      returnType = DALVIK_JNI_RETURN_FLOAT;
      break;
    case "D":
      returnType = DALVIK_JNI_RETURN_DOUBLE;
      break;
    case "J":
      returnType = DALVIK_JNI_RETURN_S8;
      break;
    case "Z":
    case "B":
      returnType = DALVIK_JNI_RETURN_S1;
      break;
    case "C":
      returnType = DALVIK_JNI_RETURN_U2;
      break;
    case "S":
      returnType = DALVIK_JNI_RETURN_S2;
      break;
    default:
      returnType = DALVIK_JNI_RETURN_S4;
      break;
  }
  let hints = 0;
  for (let i = shorty.length - 1; i > 0; i--) {
    const ch = shorty[i];
    hints += ch === "D" || ch === "J" ? 2 : 1;
  }
  return returnType << DALVIK_JNI_RETURN_SHIFT | hints;
}
function cloneArtMethod(method2, vm3) {
  const api3 = getApi2();
  if (getAndroidApiLevel() < 23) {
    const thread = api3["art::Thread::CurrentFromGdb"]();
    return api3["art::mirror::Object::Clone"](method2, thread);
  }
  return Memory.dup(method2, getArtMethodSpec(vm3).size);
}
function deoptimizeMethod(vm3, env2, method2) {
  requestDeoptimization(vm3, env2, kSelectiveDeoptimization, method2);
}
function deoptimizeEverything(vm3, env2) {
  requestDeoptimization(vm3, env2, kFullDeoptimization);
}
function deoptimizeBootImage(vm3, env2) {
  const api3 = getApi2();
  if (getAndroidApiLevel() < 26) {
    throw new Error("This API is only available on Android >= 8.0");
  }
  withRunnableArtThread(vm3, env2, (thread) => {
    api3["art::Runtime::DeoptimizeBootImage"](api3.artRuntime);
  });
}
function requestDeoptimization(vm3, env2, kind, method2) {
  const api3 = getApi2();
  if (getAndroidApiLevel() < 24) {
    throw new Error("This API is only available on Android >= 7.0");
  }
  withRunnableArtThread(vm3, env2, (thread) => {
    if (getAndroidApiLevel() < 30) {
      if (!api3.isJdwpStarted()) {
        const session = startJdwp(api3);
        jdwpSessions.push(session);
      }
      if (!api3.isDebuggerActive()) {
        api3["art::Dbg::GoActive"]();
      }
      const request = Memory.alloc(8 + pointerSize7);
      request.writeU32(kind);
      switch (kind) {
        case kFullDeoptimization:
          break;
        case kSelectiveDeoptimization:
          request.add(8).writePointer(method2);
          break;
        default:
          throw new Error("Unsupported deoptimization kind");
      }
      api3["art::Dbg::RequestDeoptimization"](request);
      api3["art::Dbg::ManageDeoptimization"]();
    } else {
      const instrumentation = api3.artInstrumentation;
      if (instrumentation === null) {
        throw new Error("Unable to find Instrumentation class in ART; please file a bug");
      }
      const enableDeopt = api3["art::Instrumentation::EnableDeoptimization"];
      if (enableDeopt !== void 0) {
        const deoptimizationEnabled = !!instrumentation.add(getArtInstrumentationSpec().offset.deoptimizationEnabled).readU8();
        if (!deoptimizationEnabled) {
          enableDeopt(instrumentation);
        }
      }
      switch (kind) {
        case kFullDeoptimization:
          api3["art::Instrumentation::DeoptimizeEverything"](instrumentation, Memory.allocUtf8String("frida"));
          break;
        case kSelectiveDeoptimization:
          api3["art::Instrumentation::Deoptimize"](instrumentation, method2);
          break;
        default:
          throw new Error("Unsupported deoptimization kind");
      }
    }
  });
}
function startJdwp(api3) {
  const session = new JdwpSession();
  api3["art::Dbg::SetJdwpAllowed"](1);
  const options = makeJdwpOptions();
  api3["art::Dbg::ConfigureJdwp"](options);
  const startDebugger = api3["art::InternalDebuggerControlCallback::StartDebugger"];
  if (startDebugger !== void 0) {
    startDebugger(NULL);
  } else {
    api3["art::Dbg::StartJdwp"]();
  }
  return session;
}
function makeJdwpOptions() {
  const kJdwpTransportAndroidAdb = getAndroidApiLevel() < 28 ? 2 : 3;
  const kJdwpPortFirstAvailable = 0;
  const transport = kJdwpTransportAndroidAdb;
  const server = true;
  const suspend = false;
  const port = kJdwpPortFirstAvailable;
  const size = 8 + STD_STRING_SIZE + 2;
  const result2 = Memory.alloc(size);
  result2.writeU32(transport).add(4).writeU8(server ? 1 : 0).add(1).writeU8(suspend ? 1 : 0).add(1).add(STD_STRING_SIZE).writeU16(port);
  return result2;
}
function makeSocketPair() {
  if (socketpair === null) {
    socketpair = new NativeFunction(
      Process.getModuleByName("libc.so").getExportByName("socketpair"),
      "int",
      ["int", "int", "int", "pointer"]
    );
  }
  const buf = Memory.alloc(8);
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, buf) === -1) {
    throw new Error("Unable to create socketpair for JDWP");
  }
  return [
    buf.readS32(),
    buf.add(4).readS32()
  ];
}
function makeAddGlobalRefFallbackForAndroid5(api3) {
  const offset = getArtVMSpec().offset;
  const lock = api3.vm.add(offset.globalsLock);
  const table = api3.vm.add(offset.globals);
  const add = api3["art::IndirectReferenceTable::Add"];
  const acquire = api3["art::ReaderWriterMutex::ExclusiveLock"];
  const release = api3["art::ReaderWriterMutex::ExclusiveUnlock"];
  const IRT_FIRST_SEGMENT = 0;
  return function(vm3, thread, obj) {
    acquire(lock, thread);
    try {
      return add(table, IRT_FIRST_SEGMENT, obj);
    } finally {
      release(lock, thread);
    }
  };
}
function makeDecodeGlobalFallback(api3) {
  const decode = api3["art::Thread::DecodeJObject"];
  if (decode === void 0) {
    throw new Error("art::Thread::DecodeJObject is not available; please file a bug");
  }
  return function(vm3, thread, ref) {
    return decode(thread, ref);
  };
}
function makeArtThreadStateTransitionImpl(vm3, env2, callback) {
  const api3 = getApi2();
  const envVtable = env2.handle.readPointer();
  let exceptionClearImpl;
  const innerExceptionClearImpl = api3.find("_ZN3art3JNIILb1EE14ExceptionClearEP7_JNIEnv");
  if (innerExceptionClearImpl !== null) {
    exceptionClearImpl = innerExceptionClearImpl;
  } else {
    exceptionClearImpl = envVtable.add(ENV_VTABLE_OFFSET_EXCEPTION_CLEAR).readPointer();
  }
  let nextFuncImpl;
  const innerNextFuncImpl = api3.find("_ZN3art3JNIILb1EE10FatalErrorEP7_JNIEnvPKc");
  if (innerNextFuncImpl !== null) {
    nextFuncImpl = innerNextFuncImpl;
  } else {
    nextFuncImpl = envVtable.add(ENV_VTABLE_OFFSET_FATAL_ERROR).readPointer();
  }
  const recompile = threadStateTransitionRecompilers[Process.arch];
  if (recompile === void 0) {
    throw new Error("Not yet implemented for " + Process.arch);
  }
  let perform = null;
  const threadOffsets = getArtThreadSpec(vm3).offset;
  const exceptionOffset = threadOffsets.exception;
  const neuteredOffsets = /* @__PURE__ */ new Set();
  const isReportedOffset = threadOffsets.isExceptionReportedToInstrumentation;
  if (isReportedOffset !== null) {
    neuteredOffsets.add(isReportedOffset);
  }
  const throwLocationStartOffset = threadOffsets.throwLocation;
  if (throwLocationStartOffset !== null) {
    neuteredOffsets.add(throwLocationStartOffset);
    neuteredOffsets.add(throwLocationStartOffset + pointerSize7);
    neuteredOffsets.add(throwLocationStartOffset + 2 * pointerSize7);
  }
  const codeSize = 65536;
  const code5 = Memory.alloc(codeSize);
  Memory.patchCode(code5, codeSize, (buffer) => {
    perform = recompile(buffer, code5, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback);
  });
  perform._code = code5;
  perform._callback = callback;
  return perform;
}
function recompileExceptionClearForX86(buffer, pc, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback) {
  const blocks = {};
  const branchTargets = /* @__PURE__ */ new Set();
  const pending = [exceptionClearImpl];
  while (pending.length > 0) {
    let current = pending.shift();
    const alreadyCovered = Object.values(blocks).some(({ begin, end }) => current.compare(begin) >= 0 && current.compare(end) < 0);
    if (alreadyCovered) {
      continue;
    }
    const blockAddressKey = current.toString();
    let block2 = {
      begin: current
    };
    let lastInsn = null;
    let reachedEndOfBlock = false;
    do {
      if (current.equals(nextFuncImpl)) {
        reachedEndOfBlock = true;
        break;
      }
      const insn = Instruction.parse(current);
      lastInsn = insn;
      const existingBlock = blocks[insn.address.toString()];
      if (existingBlock !== void 0) {
        delete blocks[existingBlock.begin.toString()];
        blocks[blockAddressKey] = existingBlock;
        existingBlock.begin = block2.begin;
        block2 = null;
        break;
      }
      let branchTarget = null;
      switch (insn.mnemonic) {
        case "jmp":
          branchTarget = ptr(insn.operands[0].value);
          reachedEndOfBlock = true;
          break;
        case "je":
        case "jg":
        case "jle":
        case "jne":
        case "js":
          branchTarget = ptr(insn.operands[0].value);
          break;
        case "ret":
          reachedEndOfBlock = true;
          break;
      }
      if (branchTarget !== null) {
        branchTargets.add(branchTarget.toString());
        pending.push(branchTarget);
        pending.sort((a, b) => a.compare(b));
      }
      current = insn.next;
    } while (!reachedEndOfBlock);
    if (block2 !== null) {
      block2.end = lastInsn.address.add(lastInsn.size);
      blocks[blockAddressKey] = block2;
    }
  }
  const blocksOrdered = Object.keys(blocks).map((key) => blocks[key]);
  blocksOrdered.sort((a, b) => a.begin.compare(b.begin));
  const entryBlock = blocks[exceptionClearImpl.toString()];
  blocksOrdered.splice(blocksOrdered.indexOf(entryBlock), 1);
  blocksOrdered.unshift(entryBlock);
  const writer = new X86Writer(buffer, { pc });
  let foundCore = false;
  let threadReg = null;
  blocksOrdered.forEach((block2) => {
    const size = block2.end.sub(block2.begin).toInt32();
    const relocator = new X86Relocator(block2.begin, writer);
    let offset;
    while ((offset = relocator.readOne()) !== 0) {
      const insn = relocator.input;
      const { mnemonic } = insn;
      const insnAddressId = insn.address.toString();
      if (branchTargets.has(insnAddressId)) {
        writer.putLabel(insnAddressId);
      }
      let keep = true;
      switch (mnemonic) {
        case "jmp":
          writer.putJmpNearLabel(branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "je":
        case "jg":
        case "jle":
        case "jne":
        case "js":
          writer.putJccNearLabel(mnemonic, branchLabelFromOperand(insn.operands[0]), "no-hint");
          keep = false;
          break;
        /*
         * JNI::ExceptionClear(), when checked JNI is off.
         */
        case "mov": {
          const [dst, src] = insn.operands;
          if (dst.type === "mem" && src.type === "imm") {
            const dstValue = dst.value;
            const dstOffset = dstValue.disp;
            if (dstOffset === exceptionOffset && src.value.valueOf() === 0) {
              threadReg = dstValue.base;
              writer.putPushfx();
              writer.putPushax();
              writer.putMovRegReg("xbp", "xsp");
              if (pointerSize7 === 4) {
                writer.putAndRegU32("esp", 4294967280);
              } else {
                const scratchReg = threadReg !== "rdi" ? "rdi" : "rsi";
                writer.putMovRegU64(scratchReg, uint64("0xfffffffffffffff0"));
                writer.putAndRegReg("rsp", scratchReg);
              }
              writer.putCallAddressWithAlignedArguments(callback, [threadReg]);
              writer.putMovRegReg("xsp", "xbp");
              writer.putPopax();
              writer.putPopfx();
              foundCore = true;
              keep = false;
            } else if (neuteredOffsets.has(dstOffset) && dstValue.base === threadReg) {
              keep = false;
            }
          }
          break;
        }
        /*
         * CheckJNI::ExceptionClear, when checked JNI is on. Wrapper that calls JNI::ExceptionClear().
         */
        case "call": {
          const target = insn.operands[0];
          if (target.type === "mem" && target.value.disp === ENV_VTABLE_OFFSET_EXCEPTION_CLEAR) {
            if (pointerSize7 === 4) {
              writer.putPopReg("eax");
              writer.putMovRegRegOffsetPtr("eax", "eax", 4);
              writer.putPushReg("eax");
            } else {
              writer.putMovRegRegOffsetPtr("rdi", "rdi", 8);
            }
            writer.putCallAddressWithArguments(callback, []);
            foundCore = true;
            keep = false;
          }
          break;
        }
      }
      if (keep) {
        relocator.writeAll();
      } else {
        relocator.skipOne();
      }
      if (offset === size) {
        break;
      }
    }
    relocator.dispose();
  });
  writer.dispose();
  if (!foundCore) {
    throwThreadStateTransitionParseError();
  }
  return new NativeFunction(pc, "void", ["pointer"], nativeFunctionOptions3);
}
function recompileExceptionClearForArm(buffer, pc, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback) {
  const blocks = {};
  const branchTargets = /* @__PURE__ */ new Set();
  const thumbBitRemovalMask = ptr(1).not();
  const pending = [exceptionClearImpl];
  while (pending.length > 0) {
    let current = pending.shift();
    const alreadyCovered = Object.values(blocks).some(({ begin: begin2, end }) => current.compare(begin2) >= 0 && current.compare(end) < 0);
    if (alreadyCovered) {
      continue;
    }
    const begin = current.and(thumbBitRemovalMask);
    const blockId = begin.toString();
    const thumbBit = current.and(1);
    let block2 = {
      begin
    };
    let lastInsn = null;
    let reachedEndOfBlock = false;
    let ifThenBlockRemaining = 0;
    do {
      if (current.equals(nextFuncImpl)) {
        reachedEndOfBlock = true;
        break;
      }
      const insn = Instruction.parse(current);
      const { mnemonic } = insn;
      lastInsn = insn;
      const currentAddress = current.and(thumbBitRemovalMask);
      const insnId = currentAddress.toString();
      const existingBlock = blocks[insnId];
      if (existingBlock !== void 0) {
        delete blocks[existingBlock.begin.toString()];
        blocks[blockId] = existingBlock;
        existingBlock.begin = block2.begin;
        block2 = null;
        break;
      }
      const isOutsideIfThenBlock = ifThenBlockRemaining === 0;
      let branchTarget = null;
      switch (mnemonic) {
        case "b":
          branchTarget = ptr(insn.operands[0].value);
          reachedEndOfBlock = isOutsideIfThenBlock;
          break;
        case "beq.w":
        case "beq":
        case "bne":
        case "bne.w":
        case "bgt":
          branchTarget = ptr(insn.operands[0].value);
          break;
        case "cbz":
        case "cbnz":
          branchTarget = ptr(insn.operands[1].value);
          break;
        case "pop.w":
          if (isOutsideIfThenBlock) {
            reachedEndOfBlock = insn.operands.filter((op) => op.value === "pc").length === 1;
          }
          break;
      }
      switch (mnemonic) {
        case "it":
          ifThenBlockRemaining = 1;
          break;
        case "itt":
          ifThenBlockRemaining = 2;
          break;
        case "ittt":
          ifThenBlockRemaining = 3;
          break;
        case "itttt":
          ifThenBlockRemaining = 4;
          break;
        default:
          if (ifThenBlockRemaining > 0) {
            ifThenBlockRemaining--;
          }
          break;
      }
      if (branchTarget !== null) {
        branchTargets.add(branchTarget.toString());
        pending.push(branchTarget.or(thumbBit));
        pending.sort((a, b) => a.compare(b));
      }
      current = insn.next;
    } while (!reachedEndOfBlock);
    if (block2 !== null) {
      block2.end = lastInsn.address.add(lastInsn.size);
      blocks[blockId] = block2;
    }
  }
  const blocksOrdered = Object.keys(blocks).map((key) => blocks[key]);
  blocksOrdered.sort((a, b) => a.begin.compare(b.begin));
  const entryBlock = blocks[exceptionClearImpl.and(thumbBitRemovalMask).toString()];
  blocksOrdered.splice(blocksOrdered.indexOf(entryBlock), 1);
  blocksOrdered.unshift(entryBlock);
  const writer = new ThumbWriter(buffer, { pc });
  let foundCore = false;
  let threadReg = null;
  let realImplReg = null;
  blocksOrdered.forEach((block2) => {
    const relocator = new ThumbRelocator(block2.begin, writer);
    let address = block2.begin;
    const end = block2.end;
    let size = 0;
    do {
      const offset = relocator.readOne();
      if (offset === 0) {
        throw new Error("Unexpected end of block");
      }
      const insn = relocator.input;
      address = insn.address;
      size = insn.size;
      const { mnemonic } = insn;
      const insnAddressId = address.toString();
      if (branchTargets.has(insnAddressId)) {
        writer.putLabel(insnAddressId);
      }
      let keep = true;
      switch (mnemonic) {
        case "b":
          writer.putBLabel(branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "beq.w":
          writer.putBCondLabelWide("eq", branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "bne.w":
          writer.putBCondLabelWide("ne", branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "beq":
        case "bne":
        case "bgt":
          writer.putBCondLabelWide(mnemonic.substr(1), branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "cbz": {
          const ops = insn.operands;
          writer.putCbzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
          keep = false;
          break;
        }
        case "cbnz": {
          const ops = insn.operands;
          writer.putCbnzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
          keep = false;
          break;
        }
        /*
         * JNI::ExceptionClear(), when checked JNI is off.
         */
        case "str":
        case "str.w": {
          const dstValue = insn.operands[1].value;
          const dstOffset = dstValue.disp;
          if (dstOffset === exceptionOffset) {
            threadReg = dstValue.base;
            const nzcvqReg = threadReg !== "r4" ? "r4" : "r5";
            const clobberedRegs = ["r0", "r1", "r2", "r3", nzcvqReg, "r9", "r12", "lr"];
            writer.putPushRegs(clobberedRegs);
            writer.putMrsRegReg(nzcvqReg, "apsr-nzcvq");
            writer.putCallAddressWithArguments(callback, [threadReg]);
            writer.putMsrRegReg("apsr-nzcvq", nzcvqReg);
            writer.putPopRegs(clobberedRegs);
            foundCore = true;
            keep = false;
          } else if (neuteredOffsets.has(dstOffset) && dstValue.base === threadReg) {
            keep = false;
          }
          break;
        }
        /*
         * CheckJNI::ExceptionClear, when checked JNI is on. Wrapper that calls JNI::ExceptionClear().
         */
        case "ldr": {
          const [dstOp, srcOp] = insn.operands;
          if (srcOp.type === "mem") {
            const src = srcOp.value;
            if (src.base[0] === "r" && src.disp === ENV_VTABLE_OFFSET_EXCEPTION_CLEAR) {
              realImplReg = dstOp.value;
            }
          }
          break;
        }
        case "blx":
          if (insn.operands[0].value === realImplReg) {
            writer.putLdrRegRegOffset("r0", "r0", 4);
            writer.putCallAddressWithArguments(callback, ["r0"]);
            foundCore = true;
            realImplReg = null;
            keep = false;
          }
          break;
      }
      if (keep) {
        relocator.writeAll();
      } else {
        relocator.skipOne();
      }
    } while (!address.add(size).equals(end));
    relocator.dispose();
  });
  writer.dispose();
  if (!foundCore) {
    throwThreadStateTransitionParseError();
  }
  return new NativeFunction(pc.or(1), "void", ["pointer"], nativeFunctionOptions3);
}
function recompileExceptionClearForArm64(buffer, pc, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback) {
  const blocks = {};
  const branchTargets = /* @__PURE__ */ new Set();
  const pending = [exceptionClearImpl];
  while (pending.length > 0) {
    let current = pending.shift();
    const alreadyCovered = Object.values(blocks).some(({ begin, end }) => current.compare(begin) >= 0 && current.compare(end) < 0);
    if (alreadyCovered) {
      continue;
    }
    const blockAddressKey = current.toString();
    let block2 = {
      begin: current
    };
    let lastInsn = null;
    let reachedEndOfBlock = false;
    do {
      if (current.equals(nextFuncImpl)) {
        reachedEndOfBlock = true;
        break;
      }
      let insn;
      try {
        insn = Instruction.parse(current);
      } catch (e) {
        if (current.readU32() === 0) {
          reachedEndOfBlock = true;
          break;
        } else {
          throw e;
        }
      }
      lastInsn = insn;
      const existingBlock = blocks[insn.address.toString()];
      if (existingBlock !== void 0) {
        delete blocks[existingBlock.begin.toString()];
        blocks[blockAddressKey] = existingBlock;
        existingBlock.begin = block2.begin;
        block2 = null;
        break;
      }
      let branchTarget = null;
      switch (insn.mnemonic) {
        case "b":
          branchTarget = ptr(insn.operands[0].value);
          reachedEndOfBlock = true;
          break;
        case "b.eq":
        case "b.ne":
        case "b.le":
        case "b.gt":
          branchTarget = ptr(insn.operands[0].value);
          break;
        case "cbz":
        case "cbnz":
          branchTarget = ptr(insn.operands[1].value);
          break;
        case "tbz":
        case "tbnz":
          branchTarget = ptr(insn.operands[2].value);
          break;
        case "ret":
          reachedEndOfBlock = true;
          break;
      }
      if (branchTarget !== null) {
        branchTargets.add(branchTarget.toString());
        pending.push(branchTarget);
        pending.sort((a, b) => a.compare(b));
      }
      current = insn.next;
    } while (!reachedEndOfBlock);
    if (block2 !== null) {
      block2.end = lastInsn.address.add(lastInsn.size);
      blocks[blockAddressKey] = block2;
    }
  }
  const blocksOrdered = Object.keys(blocks).map((key) => blocks[key]);
  blocksOrdered.sort((a, b) => a.begin.compare(b.begin));
  const entryBlock = blocks[exceptionClearImpl.toString()];
  blocksOrdered.splice(blocksOrdered.indexOf(entryBlock), 1);
  blocksOrdered.unshift(entryBlock);
  const writer = new Arm64Writer(buffer, { pc });
  writer.putBLabel("performTransition");
  const invokeCallback = pc.add(writer.offset);
  writer.putPushAllXRegisters();
  writer.putCallAddressWithArguments(callback, ["x0"]);
  writer.putPopAllXRegisters();
  writer.putRet();
  writer.putLabel("performTransition");
  let foundCore = false;
  let threadReg = null;
  let realImplReg = null;
  blocksOrdered.forEach((block2) => {
    const size = block2.end.sub(block2.begin).toInt32();
    const relocator = new Arm64Relocator(block2.begin, writer);
    let offset;
    while ((offset = relocator.readOne()) !== 0) {
      const insn = relocator.input;
      const { mnemonic } = insn;
      const insnAddressId = insn.address.toString();
      if (branchTargets.has(insnAddressId)) {
        writer.putLabel(insnAddressId);
      }
      let keep = true;
      switch (mnemonic) {
        case "b":
          writer.putBLabel(branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "b.eq":
        case "b.ne":
        case "b.le":
        case "b.gt":
          writer.putBCondLabel(mnemonic.substr(2), branchLabelFromOperand(insn.operands[0]));
          keep = false;
          break;
        case "cbz": {
          const ops = insn.operands;
          writer.putCbzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
          keep = false;
          break;
        }
        case "cbnz": {
          const ops = insn.operands;
          writer.putCbnzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
          keep = false;
          break;
        }
        case "tbz": {
          const ops = insn.operands;
          writer.putTbzRegImmLabel(ops[0].value, ops[1].value.valueOf(), branchLabelFromOperand(ops[2]));
          keep = false;
          break;
        }
        case "tbnz": {
          const ops = insn.operands;
          writer.putTbnzRegImmLabel(ops[0].value, ops[1].value.valueOf(), branchLabelFromOperand(ops[2]));
          keep = false;
          break;
        }
        /*
         * JNI::ExceptionClear(), when checked JNI is off.
         */
        case "str": {
          const ops = insn.operands;
          const srcReg = ops[0].value;
          const dstValue = ops[1].value;
          const dstOffset = dstValue.disp;
          if (srcReg === "xzr" && dstOffset === exceptionOffset) {
            threadReg = dstValue.base;
            writer.putPushRegReg("x0", "lr");
            writer.putMovRegReg("x0", threadReg);
            writer.putBlImm(invokeCallback);
            writer.putPopRegReg("x0", "lr");
            foundCore = true;
            keep = false;
          } else if (neuteredOffsets.has(dstOffset) && dstValue.base === threadReg) {
            keep = false;
          }
          break;
        }
        /*
         * CheckJNI::ExceptionClear, when checked JNI is on. Wrapper that calls JNI::ExceptionClear().
         */
        case "ldr": {
          const ops = insn.operands;
          const src = ops[1].value;
          if (src.base[0] === "x" && src.disp === ENV_VTABLE_OFFSET_EXCEPTION_CLEAR) {
            realImplReg = ops[0].value;
          }
          break;
        }
        case "blr":
          if (insn.operands[0].value === realImplReg) {
            writer.putLdrRegRegOffset("x0", "x0", 8);
            writer.putCallAddressWithArguments(callback, ["x0"]);
            foundCore = true;
            realImplReg = null;
            keep = false;
          }
          break;
      }
      if (keep) {
        relocator.writeAll();
      } else {
        relocator.skipOne();
      }
      if (offset === size) {
        break;
      }
    }
    relocator.dispose();
  });
  writer.dispose();
  if (!foundCore) {
    throwThreadStateTransitionParseError();
  }
  return new NativeFunction(pc, "void", ["pointer"], nativeFunctionOptions3);
}
function throwThreadStateTransitionParseError() {
  throw new Error("Unable to parse ART internals; please file a bug");
}
function fixupArtQuickDeliverExceptionBug(api3) {
  const prettyMethod = api3["art::ArtMethod::PrettyMethod"];
  if (prettyMethod === void 0) {
    return;
  }
  Interceptor.attach(prettyMethod.impl, artController.hooks.ArtMethod.prettyMethod);
  Interceptor.flush();
}
function branchLabelFromOperand(op) {
  return ptr(op.value).toString();
}
function makeCxxMethodWrapperReturningPointerByValueGeneric(address, argTypes2) {
  return new NativeFunction(address, "pointer", argTypes2, nativeFunctionOptions3);
}
function makeCxxMethodWrapperReturningPointerByValueInFirstArg(address, argTypes2) {
  const impl = new NativeFunction(address, "void", ["pointer"].concat(argTypes2), nativeFunctionOptions3);
  return function() {
    const resultPtr = Memory.alloc(pointerSize7);
    impl(resultPtr, ...arguments);
    return resultPtr.readPointer();
  };
}
function makeCxxMethodWrapperReturningStdStringByValue(impl, argTypes2) {
  const { arch } = Process;
  switch (arch) {
    case "ia32":
    case "arm64": {
      let thunk;
      if (arch === "ia32") {
        thunk = makeThunk(64, (writer) => {
          const argCount = 1 + argTypes2.length;
          const argvSize = argCount * 4;
          writer.putSubRegImm("esp", argvSize);
          for (let i = 0; i !== argCount; i++) {
            const offset = i * 4;
            writer.putMovRegRegOffsetPtr("eax", "esp", argvSize + 4 + offset);
            writer.putMovRegOffsetPtrReg("esp", offset, "eax");
          }
          writer.putCallAddress(impl);
          writer.putAddRegImm("esp", argvSize - 4);
          writer.putRet();
        });
      } else {
        thunk = makeThunk(32, (writer) => {
          writer.putMovRegReg("x8", "x0");
          argTypes2.forEach((t, i) => {
            writer.putMovRegReg("x" + i, "x" + (i + 1));
          });
          writer.putLdrRegAddress("x7", impl);
          writer.putBrReg("x7");
        });
      }
      const invokeThunk = new NativeFunction(thunk, "void", ["pointer"].concat(argTypes2), nativeFunctionOptions3);
      const wrapper = function(...args) {
        invokeThunk(...args);
      };
      wrapper.handle = thunk;
      wrapper.impl = impl;
      return wrapper;
    }
    default: {
      const result2 = new NativeFunction(impl, "void", ["pointer"].concat(argTypes2), nativeFunctionOptions3);
      result2.impl = impl;
      return result2;
    }
  }
}
function makeObjectVisitorPredicate(needle, onMatch) {
  const factory = objectVisitorPredicateFactories[Process.arch] || makeGenericObjectVisitorPredicate;
  return factory(needle, onMatch);
}
function makeGenericObjectVisitorPredicate(needle, onMatch) {
  return new NativeCallback((object) => {
    const klass = object.readS32();
    if (klass === needle) {
      onMatch(object);
    }
  }, "void", ["pointer", "pointer"]);
}
function alignPointerOffset(offset) {
  const remainder = offset % pointerSize7;
  if (remainder !== 0) {
    return offset + pointerSize7 - remainder;
  }
  return offset;
}
var jsizeSize, pointerSize7, readU32, readPointer, writeU32, writePointer, kAccPublic, kAccStatic, kAccFinal, kAccNative, kAccFastNative, kAccCriticalNative, kAccFastInterpreterToInterpreterInvoke, kAccSkipAccessChecks, kAccSingleImplementation, kAccNterpEntryPointFastPathFlag, kAccNterpInvokeFastPathFlag, kAccPublicApi, kAccXposedHookedMethod, kPointer, kFullDeoptimization, kSelectiveDeoptimization, THUMB_BIT_REMOVAL_MASK, X86_JMP_MAX_DISTANCE, ARM64_ADRP_MAX_DISTANCE, ENV_VTABLE_OFFSET_EXCEPTION_CLEAR, ENV_VTABLE_OFFSET_FATAL_ERROR, DVM_JNI_ENV_OFFSET_SELF, DVM_CLASS_OBJECT_OFFSET_VTABLE_COUNT, DVM_CLASS_OBJECT_OFFSET_VTABLE, DVM_OBJECT_OFFSET_CLAZZ, DVM_METHOD_SIZE, DVM_METHOD_OFFSET_ACCESS_FLAGS, DVM_METHOD_OFFSET_METHOD_INDEX, DVM_METHOD_OFFSET_REGISTERS_SIZE, DVM_METHOD_OFFSET_OUTS_SIZE, DVM_METHOD_OFFSET_INS_SIZE, DVM_METHOD_OFFSET_SHORTY, DVM_METHOD_OFFSET_JNI_ARG_INFO, DALVIK_JNI_RETURN_VOID, DALVIK_JNI_RETURN_FLOAT, DALVIK_JNI_RETURN_DOUBLE, DALVIK_JNI_RETURN_S8, DALVIK_JNI_RETURN_S4, DALVIK_JNI_RETURN_S2, DALVIK_JNI_RETURN_U2, DALVIK_JNI_RETURN_S1, DALVIK_JNI_NO_ARG_INFO, DALVIK_JNI_RETURN_SHIFT, STD_STRING_SIZE, STD_VECTOR_SIZE, AF_UNIX, SOCK_STREAM, getArtRuntimeSpec, getArtInstrumentationSpec, getArtMethodSpec, getArtThreadSpec, getArtManagedStackSpec, getArtThreadStateTransitionImpl, getAndroidVersion, getAndroidCodename, getAndroidApiLevel, getArtApexVersion, getArtQuickFrameInfoGetterThunk, makeCxxMethodWrapperReturningPointerByValue, nativeFunctionOptions3, artThreadStateTransitions, cachedApi2, cachedArtClassLinkerSpec, MethodMangler, artController, inlineHooks, patchedClasses, artQuickInterceptors, thunkPage, thunkOffset, taughtArtAboutReplacementMethods, taughtArtAboutMethodInstrumentation, backtraceModule, jdwpSessions, socketpair, trampolineAllocator, instrumentationOffsetParsers, instrumentationPointerParser, jniIdsIndirectionOffsetParsers, artQuickTrampolineParsers, systemPropertyGet, PROP_VALUE_MAX, ArtClassVisitor, ArtClassLoaderVisitor, WalkKind, ArtStackVisitor, ArtMethod, thunkRelocators, thunkWriters, artGetOatQuickMethodHeaderInlinedCopyHandler, InlineHook, Backtrace, artQuickCodeReplacementTrampolineWriters, artQuickCodePrologueWriters, artQuickCodeHookRedirectSize, ArtQuickCodeInterceptor, ArtMethodMangler, DalvikMethodMangler, JdwpSession, threadStateTransitionRecompilers, StdString, StdVector, HandleVector, BHS_OFFSET_LINK, BHS_OFFSET_NUM_REFS, BHS_SIZE, kNumReferencesVariableSized, BaseHandleScope, VSHS_OFFSET_SELF, VSHS_OFFSET_CURRENT_SCOPE, VSHS_SIZE, VariableSizedHandleScope, FixedSizeHandleScope, objectVisitorPredicateFactories;
var init_android = __esm({
  "node_modules/frida-java-bridge/lib/android.js"() {
    "use strict";
    init_node_globals();
    init_alloc();
    init_jvmti();
    init_machine_code();
    init_memoize();
    init_result();
    init_vm();
    jsizeSize = 4;
    pointerSize7 = Process.pointerSize;
    ({
      readU32,
      readPointer,
      writeU32,
      writePointer
    } = NativePointer.prototype);
    kAccPublic = 1;
    kAccStatic = 8;
    kAccFinal = 16;
    kAccNative = 256;
    kAccFastNative = 524288;
    kAccCriticalNative = 2097152;
    kAccFastInterpreterToInterpreterInvoke = 1073741824;
    kAccSkipAccessChecks = 524288;
    kAccSingleImplementation = 134217728;
    kAccNterpEntryPointFastPathFlag = 1048576;
    kAccNterpInvokeFastPathFlag = 2097152;
    kAccPublicApi = 268435456;
    kAccXposedHookedMethod = 268435456;
    kPointer = 0;
    kFullDeoptimization = 3;
    kSelectiveDeoptimization = 5;
    THUMB_BIT_REMOVAL_MASK = ptr(1).not();
    X86_JMP_MAX_DISTANCE = 2147467263;
    ARM64_ADRP_MAX_DISTANCE = 4294963200;
    ENV_VTABLE_OFFSET_EXCEPTION_CLEAR = 17 * pointerSize7;
    ENV_VTABLE_OFFSET_FATAL_ERROR = 18 * pointerSize7;
    DVM_JNI_ENV_OFFSET_SELF = 12;
    DVM_CLASS_OBJECT_OFFSET_VTABLE_COUNT = 112;
    DVM_CLASS_OBJECT_OFFSET_VTABLE = 116;
    DVM_OBJECT_OFFSET_CLAZZ = 0;
    DVM_METHOD_SIZE = 56;
    DVM_METHOD_OFFSET_ACCESS_FLAGS = 4;
    DVM_METHOD_OFFSET_METHOD_INDEX = 8;
    DVM_METHOD_OFFSET_REGISTERS_SIZE = 10;
    DVM_METHOD_OFFSET_OUTS_SIZE = 12;
    DVM_METHOD_OFFSET_INS_SIZE = 14;
    DVM_METHOD_OFFSET_SHORTY = 28;
    DVM_METHOD_OFFSET_JNI_ARG_INFO = 36;
    DALVIK_JNI_RETURN_VOID = 0;
    DALVIK_JNI_RETURN_FLOAT = 1;
    DALVIK_JNI_RETURN_DOUBLE = 2;
    DALVIK_JNI_RETURN_S8 = 3;
    DALVIK_JNI_RETURN_S4 = 4;
    DALVIK_JNI_RETURN_S2 = 5;
    DALVIK_JNI_RETURN_U2 = 6;
    DALVIK_JNI_RETURN_S1 = 7;
    DALVIK_JNI_NO_ARG_INFO = 2147483648;
    DALVIK_JNI_RETURN_SHIFT = 28;
    STD_STRING_SIZE = 3 * pointerSize7;
    STD_VECTOR_SIZE = 3 * pointerSize7;
    AF_UNIX = 1;
    SOCK_STREAM = 1;
    getArtRuntimeSpec = memoize(_getArtRuntimeSpec);
    getArtInstrumentationSpec = memoize(_getArtInstrumentationSpec);
    getArtMethodSpec = memoize(_getArtMethodSpec);
    getArtThreadSpec = memoize(_getArtThreadSpec);
    getArtManagedStackSpec = memoize(_getArtManagedStackSpec);
    getArtThreadStateTransitionImpl = memoize(_getArtThreadStateTransitionImpl);
    getAndroidVersion = memoize(_getAndroidVersion);
    getAndroidCodename = memoize(_getAndroidCodename);
    getAndroidApiLevel = memoize(_getAndroidApiLevel);
    getArtApexVersion = memoize(_getArtApexVersion);
    getArtQuickFrameInfoGetterThunk = memoize(_getArtQuickFrameInfoGetterThunk);
    makeCxxMethodWrapperReturningPointerByValue = Process.arch === "ia32" ? makeCxxMethodWrapperReturningPointerByValueInFirstArg : makeCxxMethodWrapperReturningPointerByValueGeneric;
    nativeFunctionOptions3 = {
      exceptions: "propagate"
    };
    artThreadStateTransitions = {};
    cachedApi2 = null;
    cachedArtClassLinkerSpec = null;
    MethodMangler = null;
    artController = null;
    inlineHooks = [];
    patchedClasses = /* @__PURE__ */ new Map();
    artQuickInterceptors = [];
    thunkPage = null;
    thunkOffset = 0;
    taughtArtAboutReplacementMethods = false;
    taughtArtAboutMethodInstrumentation = false;
    backtraceModule = null;
    jdwpSessions = [];
    socketpair = null;
    trampolineAllocator = null;
    instrumentationOffsetParsers = {
      ia32: parsex86InstrumentationOffset,
      x64: parsex86InstrumentationOffset,
      arm: parseArmInstrumentationOffset,
      arm64: parseArm64InstrumentationOffset
    };
    instrumentationPointerParser = {
      ia32: parsex86InstrumentationPointer,
      x64: parsex86InstrumentationPointer,
      arm: parseArmInstrumentationPointer,
      arm64: parseArm64InstrumentationPointer
    };
    jniIdsIndirectionOffsetParsers = {
      ia32: parsex86JniIdsIndirectionOffset,
      x64: parsex86JniIdsIndirectionOffset,
      arm: parseArmJniIdsIndirectionOffset,
      arm64: parseArm64JniIdsIndirectionOffset
    };
    artQuickTrampolineParsers = {
      ia32: parseArtQuickTrampolineX86,
      x64: parseArtQuickTrampolineX86,
      arm: parseArtQuickTrampolineArm,
      arm64: parseArtQuickTrampolineArm64
    };
    systemPropertyGet = null;
    PROP_VALUE_MAX = 92;
    ArtClassVisitor = class {
      constructor(visit) {
        const visitor = Memory.alloc(4 * pointerSize7);
        const vtable2 = visitor.add(pointerSize7);
        visitor.writePointer(vtable2);
        const onVisit = new NativeCallback((self, klass) => {
          return visit(klass) === true ? 1 : 0;
        }, "bool", ["pointer", "pointer"]);
        vtable2.add(2 * pointerSize7).writePointer(onVisit);
        this.handle = visitor;
        this._onVisit = onVisit;
      }
    };
    ArtClassLoaderVisitor = class {
      constructor(visit) {
        const visitor = Memory.alloc(4 * pointerSize7);
        const vtable2 = visitor.add(pointerSize7);
        visitor.writePointer(vtable2);
        const onVisit = new NativeCallback((self, klass) => {
          visit(klass);
        }, "void", ["pointer", "pointer"]);
        vtable2.add(2 * pointerSize7).writePointer(onVisit);
        this.handle = visitor;
        this._onVisit = onVisit;
      }
    };
    WalkKind = {
      "include-inlined-frames": 0,
      "skip-inlined-frames": 1
    };
    ArtStackVisitor = class {
      constructor(thread, context, walkKind, numFrames = 0, checkSuspended = true) {
        const api3 = getApi2();
        const baseSize = 512;
        const vtableSize = 3 * pointerSize7;
        const visitor = Memory.alloc(baseSize + vtableSize);
        api3["art::StackVisitor::StackVisitor"](
          visitor,
          thread,
          context,
          WalkKind[walkKind],
          numFrames,
          checkSuspended ? 1 : 0
        );
        const vtable2 = visitor.add(baseSize);
        visitor.writePointer(vtable2);
        const onVisitFrame = new NativeCallback(this._visitFrame.bind(this), "bool", ["pointer"]);
        vtable2.add(2 * pointerSize7).writePointer(onVisitFrame);
        this.handle = visitor;
        this._onVisitFrame = onVisitFrame;
        const curShadowFrame = visitor.add(pointerSize7 === 4 ? 12 : 24);
        this._curShadowFrame = curShadowFrame;
        this._curQuickFrame = curShadowFrame.add(pointerSize7);
        this._curQuickFramePc = curShadowFrame.add(2 * pointerSize7);
        this._curOatQuickMethodHeader = curShadowFrame.add(3 * pointerSize7);
        this._getMethodImpl = api3["art::StackVisitor::GetMethod"];
        this._descLocImpl = api3["art::StackVisitor::DescribeLocation"];
        this._getCQFIImpl = api3["art::StackVisitor::GetCurrentQuickFrameInfo"];
      }
      walkStack(includeTransitions = false) {
        getApi2()["art::StackVisitor::WalkStack"](this.handle, includeTransitions ? 1 : 0);
      }
      _visitFrame() {
        return this.visitFrame() ? 1 : 0;
      }
      visitFrame() {
        throw new Error("Subclass must implement visitFrame");
      }
      getMethod() {
        const methodHandle = this._getMethodImpl(this.handle);
        if (methodHandle.isNull()) {
          return null;
        }
        return new ArtMethod(methodHandle);
      }
      getCurrentQuickFramePc() {
        return this._curQuickFramePc.readPointer();
      }
      getCurrentQuickFrame() {
        return this._curQuickFrame.readPointer();
      }
      getCurrentShadowFrame() {
        return this._curShadowFrame.readPointer();
      }
      describeLocation() {
        const result2 = new StdString();
        this._descLocImpl(result2, this.handle);
        return result2.disposeToString();
      }
      getCurrentOatQuickMethodHeader() {
        return this._curOatQuickMethodHeader.readPointer();
      }
      getCurrentQuickFrameInfo() {
        return this._getCQFIImpl(this.handle);
      }
    };
    ArtMethod = class {
      constructor(handle2) {
        this.handle = handle2;
      }
      prettyMethod(withSignature = true) {
        const result2 = new StdString();
        getApi2()["art::ArtMethod::PrettyMethod"](result2, this.handle, withSignature ? 1 : 0);
        return result2.disposeToString();
      }
      toString() {
        return `ArtMethod(handle=${this.handle})`;
      }
    };
    thunkRelocators = {
      ia32: globalThis.X86Relocator,
      x64: globalThis.X86Relocator,
      arm: globalThis.ThumbRelocator,
      arm64: globalThis.Arm64Relocator
    };
    thunkWriters = {
      ia32: globalThis.X86Writer,
      x64: globalThis.X86Writer,
      arm: globalThis.ThumbWriter,
      arm64: globalThis.Arm64Writer
    };
    artGetOatQuickMethodHeaderInlinedCopyHandler = {
      arm: {
        signatures: [
          {
            pattern: [
              "b0 68",
              // ldr r0, [r6, #8]
              "01 30",
              // adds r0, #1
              "0c d0",
              // beq #0x16fcd4
              "1b 98",
              // ldr r0, [sp, #0x6c]
              ":",
              "c0 ff",
              "c0 ff",
              "00 ff",
              "00 2f"
            ],
            validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm
          },
          {
            pattern: [
              "d8 f8 08 00",
              // ldr r0, [r8, #8]
              "01 30",
              // adds r0, #1
              "0c d0",
              // beq #0x16fcd4
              "1b 98",
              // ldr r0, [sp, #0x6c]
              ":",
              "f0 ff ff 0f",
              "ff ff",
              "00 ff",
              "00 2f"
            ],
            validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm
          },
          {
            pattern: [
              "b0 68",
              // ldr r0, [r6, #8]
              "01 30",
              // adds r0, #1
              "40 f0 c3 80",
              // bne #0x203bf0
              "00 25",
              // movs r5, #0
              ":",
              "c0 ff",
              "c0 ff",
              "c0 fb 00 d0",
              "ff f8"
            ],
            validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm
          }
        ],
        instrument: instrumentGetOatQuickMethodHeaderInlinedCopyArm
      },
      arm64: {
        signatures: [
          {
            pattern: [
              /* e8 */
              "0a 40 b9",
              // ldr w8, [x23, #0x8]
              "1f 05 00 31",
              // cmn w8, #0x1
              "40 01 00 54",
              // b.eq 0x2e4204
              "88 39 00 f0",
              // adrp x8, 0xa17000
              ":",
              /* 00 */
              "fc ff ff",
              "1f fc ff ff",
              "1f 00 00 ff",
              "00 00 00 9f"
            ],
            offset: 1,
            validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm64
          },
          {
            pattern: [
              /* e8 */
              "0a 40 b9",
              // ldr w8, [x?, #0x8]
              "1f 05 00 31",
              // cmn w8, #0x1
              "40 01 00 54",
              // b.eq <target>
              "00 0e 40 f9",
              // ldr x?, [x?, #0x18]
              ":",
              /* 00 */
              "fc ff ff",
              "1f fc ff ff",
              "1f 00 00 ff",
              "00 fc ff ff"
            ],
            offset: 1,
            validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm64
          },
          {
            pattern: [
              /* e8 */
              "0a 40 b9",
              // ldr w8, [x23, #0x8]
              "1f 05 00 31",
              // cmn w8, #0x1
              "01 34 00 54",
              // b.ne 0x3d8e50
              "e0 03 1f aa",
              // mov x0, xzr
              ":",
              /* 00 */
              "fc ff ff",
              "1f fc ff ff",
              "1f 00 00 ff",
              "e0 ff ff ff"
            ],
            offset: 1,
            validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm64
          }
        ],
        instrument: instrumentGetOatQuickMethodHeaderInlinedCopyArm64
      }
    };
    InlineHook = class {
      constructor(address, size, trampoline) {
        this.address = address;
        this.size = size;
        this.originalCode = address.readByteArray(size);
        this.trampoline = trampoline;
      }
      revert() {
        Memory.patchCode(this.address, this.size, (code5) => {
          code5.writeByteArray(this.originalCode);
        });
      }
    };
    Backtrace = class {
      constructor(handle2) {
        this.handle = handle2;
      }
      get id() {
        return backtraceModule.getId(this.handle);
      }
      get frames() {
        return backtraceModule.getFrames(this.handle);
      }
    };
    artQuickCodeReplacementTrampolineWriters = {
      ia32: writeArtQuickCodeReplacementTrampolineIA32,
      x64: writeArtQuickCodeReplacementTrampolineX64,
      arm: writeArtQuickCodeReplacementTrampolineArm,
      arm64: writeArtQuickCodeReplacementTrampolineArm64
    };
    artQuickCodePrologueWriters = {
      ia32: writeArtQuickCodePrologueX86,
      x64: writeArtQuickCodePrologueX86,
      arm: writeArtQuickCodePrologueArm,
      arm64: writeArtQuickCodePrologueArm64
    };
    artQuickCodeHookRedirectSize = {
      ia32: 5,
      x64: 16,
      arm: 8,
      arm64: 16
    };
    ArtQuickCodeInterceptor = class {
      constructor(quickCode) {
        this.quickCode = quickCode;
        this.quickCodeAddress = Process.arch === "arm" ? quickCode.and(THUMB_BIT_REMOVAL_MASK) : quickCode;
        this.redirectSize = 0;
        this.trampoline = null;
        this.overwrittenPrologue = null;
        this.overwrittenPrologueLength = 0;
      }
      _canRelocateCode(relocationSize, constraints) {
        const Writer = thunkWriters[Process.arch];
        const Relocator = thunkRelocators[Process.arch];
        const { quickCodeAddress } = this;
        const writer = new Writer(quickCodeAddress);
        const relocator = new Relocator(quickCodeAddress, writer);
        let offset;
        if (Process.arch === "arm64") {
          let availableScratchRegs = /* @__PURE__ */ new Set(["x16", "x17"]);
          do {
            const nextOffset = relocator.readOne();
            const nextScratchRegs = new Set(availableScratchRegs);
            const { read: read2, written } = relocator.input.regsAccessed;
            for (const regs of [read2, written]) {
              for (const reg of regs) {
                let name2;
                if (reg.startsWith("w")) {
                  name2 = "x" + reg.substring(1);
                } else {
                  name2 = reg;
                }
                nextScratchRegs.delete(name2);
              }
            }
            if (nextScratchRegs.size === 0) {
              break;
            }
            offset = nextOffset;
            availableScratchRegs = nextScratchRegs;
          } while (offset < relocationSize && !relocator.eoi);
          constraints.availableScratchRegs = availableScratchRegs;
        } else {
          do {
            offset = relocator.readOne();
          } while (offset < relocationSize && !relocator.eoi);
        }
        return offset >= relocationSize;
      }
      _allocateTrampoline() {
        if (trampolineAllocator === null) {
          const trampolineSize = pointerSize7 === 4 ? 128 : 256;
          trampolineAllocator = makeAllocator(trampolineSize);
        }
        const maxRedirectSize = artQuickCodeHookRedirectSize[Process.arch];
        let redirectSize, spec;
        let alignment = 1;
        const constraints = {};
        if (pointerSize7 === 4 || this._canRelocateCode(maxRedirectSize, constraints)) {
          redirectSize = maxRedirectSize;
          spec = {};
        } else {
          let maxDistance;
          if (Process.arch === "x64") {
            redirectSize = 5;
            maxDistance = X86_JMP_MAX_DISTANCE;
          } else if (Process.arch === "arm64") {
            redirectSize = 8;
            maxDistance = ARM64_ADRP_MAX_DISTANCE;
            alignment = 4096;
          }
          spec = { near: this.quickCodeAddress, maxDistance };
        }
        this.redirectSize = redirectSize;
        this.trampoline = trampolineAllocator.allocateSlice(spec, alignment);
        return constraints;
      }
      _destroyTrampoline() {
        trampolineAllocator.freeSlice(this.trampoline);
      }
      activate(vm3) {
        const constraints = this._allocateTrampoline();
        const { trampoline, quickCode, redirectSize } = this;
        const writeTrampoline = artQuickCodeReplacementTrampolineWriters[Process.arch];
        const prologueLength = writeTrampoline(trampoline, quickCode, redirectSize, constraints, vm3);
        this.overwrittenPrologueLength = prologueLength;
        this.overwrittenPrologue = Memory.dup(this.quickCodeAddress, prologueLength);
        const writePrologue = artQuickCodePrologueWriters[Process.arch];
        writePrologue(quickCode, trampoline, redirectSize);
      }
      deactivate() {
        const { quickCodeAddress, overwrittenPrologueLength: prologueLength } = this;
        const Writer = thunkWriters[Process.arch];
        Memory.patchCode(quickCodeAddress, prologueLength, (code5) => {
          const writer = new Writer(code5, { pc: quickCodeAddress });
          const { overwrittenPrologue } = this;
          writer.putBytes(overwrittenPrologue.readByteArray(prologueLength));
          writer.flush();
        });
        this._destroyTrampoline();
      }
    };
    ArtMethodMangler = class {
      constructor(opaqueMethodId) {
        const methodId = unwrapMethodId(opaqueMethodId);
        this.methodId = methodId;
        this.originalMethod = null;
        this.hookedMethodId = methodId;
        this.replacementMethodId = null;
        this.interceptor = null;
      }
      replace(impl, isInstanceMethod, argTypes2, vm3, api3) {
        const { kAccCompileDontBother, artNterpEntryPoint } = api3;
        this.originalMethod = fetchArtMethod(this.methodId, vm3);
        const originalFlags = this.originalMethod.accessFlags;
        if ((originalFlags & kAccXposedHookedMethod) !== 0 && xposedIsSupported()) {
          const hookInfo = this.originalMethod.jniCode;
          this.hookedMethodId = hookInfo.add(2 * pointerSize7).readPointer();
          this.originalMethod = fetchArtMethod(this.hookedMethodId, vm3);
        }
        const { hookedMethodId } = this;
        const replacementMethodId = cloneArtMethod(hookedMethodId, vm3);
        this.replacementMethodId = replacementMethodId;
        patchArtMethod(replacementMethodId, {
          jniCode: impl,
          accessFlags: (originalFlags & ~(kAccCriticalNative | kAccFastNative | kAccNterpEntryPointFastPathFlag) | kAccNative | kAccCompileDontBother) >>> 0,
          quickCode: api3.artClassLinker.quickGenericJniTrampoline,
          interpreterCode: api3.artInterpreterToCompiledCodeBridge
        }, vm3);
        let hookedMethodRemovedFlags = kAccFastInterpreterToInterpreterInvoke | kAccSingleImplementation | kAccNterpEntryPointFastPathFlag;
        if ((originalFlags & kAccNative) === 0) {
          hookedMethodRemovedFlags |= kAccSkipAccessChecks;
        }
        patchArtMethod(hookedMethodId, {
          accessFlags: (originalFlags & ~hookedMethodRemovedFlags | kAccCompileDontBother) >>> 0
        }, vm3);
        const quickCode = this.originalMethod.quickCode;
        if (artNterpEntryPoint !== null && quickCode.equals(artNterpEntryPoint)) {
          patchArtMethod(hookedMethodId, {
            quickCode: api3.artQuickToInterpreterBridge
          }, vm3);
        }
        if (!isArtQuickEntrypoint(quickCode)) {
          const interceptor = new ArtQuickCodeInterceptor(quickCode);
          interceptor.activate(vm3);
          this.interceptor = interceptor;
        }
        artController.replacedMethods.set(hookedMethodId, replacementMethodId);
        notifyArtMethodHooked(hookedMethodId, vm3);
      }
      revert(vm3) {
        const { hookedMethodId, interceptor } = this;
        patchArtMethod(hookedMethodId, this.originalMethod, vm3);
        artController.replacedMethods.delete(hookedMethodId);
        if (interceptor !== null) {
          interceptor.deactivate();
          this.interceptor = null;
        }
      }
      resolveTarget(wrapper, isInstanceMethod, env2, api3) {
        return this.hookedMethodId;
      }
    };
    DalvikMethodMangler = class {
      constructor(methodId) {
        this.methodId = methodId;
        this.originalMethod = null;
      }
      replace(impl, isInstanceMethod, argTypes2, vm3, api3) {
        const { methodId } = this;
        this.originalMethod = Memory.dup(methodId, DVM_METHOD_SIZE);
        let argsSize = argTypes2.reduce((acc, t) => acc + t.size, 0);
        if (isInstanceMethod) {
          argsSize++;
        }
        const accessFlags = (methodId.add(DVM_METHOD_OFFSET_ACCESS_FLAGS).readU32() | kAccNative) >>> 0;
        const registersSize = argsSize;
        const outsSize = 0;
        const insSize = argsSize;
        methodId.add(DVM_METHOD_OFFSET_ACCESS_FLAGS).writeU32(accessFlags);
        methodId.add(DVM_METHOD_OFFSET_REGISTERS_SIZE).writeU16(registersSize);
        methodId.add(DVM_METHOD_OFFSET_OUTS_SIZE).writeU16(outsSize);
        methodId.add(DVM_METHOD_OFFSET_INS_SIZE).writeU16(insSize);
        methodId.add(DVM_METHOD_OFFSET_JNI_ARG_INFO).writeU32(computeDalvikJniArgInfo(methodId));
        api3.dvmUseJNIBridge(methodId, impl);
      }
      revert(vm3) {
        Memory.copy(this.methodId, this.originalMethod, DVM_METHOD_SIZE);
      }
      resolveTarget(wrapper, isInstanceMethod, env2, api3) {
        const thread = env2.handle.add(DVM_JNI_ENV_OFFSET_SELF).readPointer();
        let objectPtr;
        if (isInstanceMethod) {
          objectPtr = api3.dvmDecodeIndirectRef(thread, wrapper.$h);
        } else {
          const h = wrapper.$borrowClassHandle(env2);
          objectPtr = api3.dvmDecodeIndirectRef(thread, h.value);
          h.unref(env2);
        }
        let classObject;
        if (isInstanceMethod) {
          classObject = objectPtr.add(DVM_OBJECT_OFFSET_CLAZZ).readPointer();
        } else {
          classObject = objectPtr;
        }
        const classKey = classObject.toString(16);
        let entry = patchedClasses.get(classKey);
        if (entry === void 0) {
          const vtablePtr = classObject.add(DVM_CLASS_OBJECT_OFFSET_VTABLE);
          const vtableCountPtr = classObject.add(DVM_CLASS_OBJECT_OFFSET_VTABLE_COUNT);
          const vtable2 = vtablePtr.readPointer();
          const vtableCount = vtableCountPtr.readS32();
          const vtableSize = vtableCount * pointerSize7;
          const shadowVtable = Memory.alloc(2 * vtableSize);
          Memory.copy(shadowVtable, vtable2, vtableSize);
          vtablePtr.writePointer(shadowVtable);
          entry = {
            classObject,
            vtablePtr,
            vtableCountPtr,
            vtable: vtable2,
            vtableCount,
            shadowVtable,
            shadowVtableCount: vtableCount,
            targetMethods: /* @__PURE__ */ new Map()
          };
          patchedClasses.set(classKey, entry);
        }
        const methodKey = this.methodId.toString(16);
        let targetMethod = entry.targetMethods.get(methodKey);
        if (targetMethod === void 0) {
          targetMethod = Memory.dup(this.originalMethod, DVM_METHOD_SIZE);
          const methodIndex = entry.shadowVtableCount++;
          entry.shadowVtable.add(methodIndex * pointerSize7).writePointer(targetMethod);
          targetMethod.add(DVM_METHOD_OFFSET_METHOD_INDEX).writeU16(methodIndex);
          entry.vtableCountPtr.writeS32(entry.shadowVtableCount);
          entry.targetMethods.set(methodKey, targetMethod);
        }
        return targetMethod;
      }
    };
    JdwpSession = class {
      constructor() {
        const libart = Process.getModuleByName("libart.so");
        const acceptImpl = libart.getExportByName("_ZN3art4JDWP12JdwpAdbState6AcceptEv");
        const receiveClientFdImpl = libart.getExportByName("_ZN3art4JDWP12JdwpAdbState15ReceiveClientFdEv");
        const controlPair = makeSocketPair();
        const clientPair = makeSocketPair();
        this._controlFd = controlPair[0];
        this._clientFd = clientPair[0];
        let acceptListener = null;
        acceptListener = Interceptor.attach(acceptImpl, function(args) {
          const state = args[0];
          const controlSockPtr = Memory.scanSync(state.add(8252), 256, "00 ff ff ff ff 00")[0].address.add(1);
          controlSockPtr.writeS32(controlPair[1]);
          acceptListener.detach();
        });
        Interceptor.replace(receiveClientFdImpl, new NativeCallback(function(state) {
          Interceptor.revert(receiveClientFdImpl);
          return clientPair[1];
        }, "int", ["pointer"]));
        Interceptor.flush();
        this._handshakeRequest = this._performHandshake();
      }
      async _performHandshake() {
        const input = new UnixInputStream(this._clientFd, { autoClose: false });
        const output = new UnixOutputStream(this._clientFd, { autoClose: false });
        const handshakePacket = [74, 68, 87, 80, 45, 72, 97, 110, 100, 115, 104, 97, 107, 101];
        try {
          await output.writeAll(handshakePacket);
          await input.readAll(handshakePacket.length);
        } catch (e) {
        }
      }
    };
    threadStateTransitionRecompilers = {
      ia32: recompileExceptionClearForX86,
      x64: recompileExceptionClearForX86,
      arm: recompileExceptionClearForArm,
      arm64: recompileExceptionClearForArm64
    };
    StdString = class {
      constructor() {
        this.handle = Memory.alloc(STD_STRING_SIZE);
      }
      dispose() {
        const [data, isTiny] = this._getData();
        if (!isTiny) {
          getApi2().$delete(data);
        }
      }
      disposeToString() {
        const result2 = this.toString();
        this.dispose();
        return result2;
      }
      toString() {
        const [data] = this._getData();
        return data.readUtf8String();
      }
      _getData() {
        const str = this.handle;
        const isTiny = (str.readU8() & 1) === 0;
        const data = isTiny ? str.add(1) : str.add(2 * pointerSize7).readPointer();
        return [data, isTiny];
      }
    };
    StdVector = class {
      $delete() {
        this.dispose();
        getApi2().$delete(this);
      }
      constructor(storage, elementSize) {
        this.handle = storage;
        this._begin = storage;
        this._end = storage.add(pointerSize7);
        this._storage = storage.add(2 * pointerSize7);
        this._elementSize = elementSize;
      }
      init() {
        this.begin = NULL;
        this.end = NULL;
        this.storage = NULL;
      }
      dispose() {
        getApi2().$delete(this.begin);
      }
      get begin() {
        return this._begin.readPointer();
      }
      set begin(value) {
        this._begin.writePointer(value);
      }
      get end() {
        return this._end.readPointer();
      }
      set end(value) {
        this._end.writePointer(value);
      }
      get storage() {
        return this._storage.readPointer();
      }
      set storage(value) {
        this._storage.writePointer(value);
      }
      get size() {
        return this.end.sub(this.begin).toInt32() / this._elementSize;
      }
    };
    HandleVector = class _HandleVector extends StdVector {
      static $new() {
        const vector = new _HandleVector(getApi2().$new(STD_VECTOR_SIZE));
        vector.init();
        return vector;
      }
      constructor(storage) {
        super(storage, pointerSize7);
      }
      get handles() {
        const result2 = [];
        let cur = this.begin;
        const end = this.end;
        while (!cur.equals(end)) {
          result2.push(cur.readPointer());
          cur = cur.add(pointerSize7);
        }
        return result2;
      }
    };
    BHS_OFFSET_LINK = 0;
    BHS_OFFSET_NUM_REFS = pointerSize7;
    BHS_SIZE = BHS_OFFSET_NUM_REFS + 4;
    kNumReferencesVariableSized = -1;
    BaseHandleScope = class _BaseHandleScope {
      $delete() {
        this.dispose();
        getApi2().$delete(this);
      }
      constructor(storage) {
        this.handle = storage;
        this._link = storage.add(BHS_OFFSET_LINK);
        this._numberOfReferences = storage.add(BHS_OFFSET_NUM_REFS);
      }
      init(link, numberOfReferences) {
        this.link = link;
        this.numberOfReferences = numberOfReferences;
      }
      dispose() {
      }
      get link() {
        return new _BaseHandleScope(this._link.readPointer());
      }
      set link(value) {
        this._link.writePointer(value);
      }
      get numberOfReferences() {
        return this._numberOfReferences.readS32();
      }
      set numberOfReferences(value) {
        this._numberOfReferences.writeS32(value);
      }
    };
    VSHS_OFFSET_SELF = alignPointerOffset(BHS_SIZE);
    VSHS_OFFSET_CURRENT_SCOPE = VSHS_OFFSET_SELF + pointerSize7;
    VSHS_SIZE = VSHS_OFFSET_CURRENT_SCOPE + pointerSize7;
    VariableSizedHandleScope = class _VariableSizedHandleScope extends BaseHandleScope {
      static $new(thread, vm3) {
        const scope = new _VariableSizedHandleScope(getApi2().$new(VSHS_SIZE));
        scope.init(thread, vm3);
        return scope;
      }
      constructor(storage) {
        super(storage);
        this._self = storage.add(VSHS_OFFSET_SELF);
        this._currentScope = storage.add(VSHS_OFFSET_CURRENT_SCOPE);
        const kLocalScopeSize = 64;
        const kSizeOfReferencesPerScope = kLocalScopeSize - pointerSize7 - 4 - 4;
        const kNumReferencesPerScope = kSizeOfReferencesPerScope / 4;
        this._scopeLayout = FixedSizeHandleScope.layoutForCapacity(kNumReferencesPerScope);
        this._topHandleScopePtr = null;
      }
      init(thread, vm3) {
        const topHandleScopePtr = thread.add(getArtThreadSpec(vm3).offset.topHandleScope);
        this._topHandleScopePtr = topHandleScopePtr;
        super.init(topHandleScopePtr.readPointer(), kNumReferencesVariableSized);
        this.self = thread;
        this.currentScope = FixedSizeHandleScope.$new(this._scopeLayout);
        topHandleScopePtr.writePointer(this);
      }
      dispose() {
        this._topHandleScopePtr.writePointer(this.link);
        let scope;
        while ((scope = this.currentScope) !== null) {
          const next = scope.link;
          scope.$delete();
          this.currentScope = next;
        }
      }
      get self() {
        return this._self.readPointer();
      }
      set self(value) {
        this._self.writePointer(value);
      }
      get currentScope() {
        const storage = this._currentScope.readPointer();
        if (storage.isNull()) {
          return null;
        }
        return new FixedSizeHandleScope(storage, this._scopeLayout);
      }
      set currentScope(value) {
        this._currentScope.writePointer(value);
      }
      newHandle(object) {
        return this.currentScope.newHandle(object);
      }
    };
    FixedSizeHandleScope = class _FixedSizeHandleScope extends BaseHandleScope {
      static $new(layout) {
        const scope = new _FixedSizeHandleScope(getApi2().$new(layout.size), layout);
        scope.init();
        return scope;
      }
      constructor(storage, layout) {
        super(storage);
        const { offset } = layout;
        this._refsStorage = storage.add(offset.refsStorage);
        this._pos = storage.add(offset.pos);
        this._layout = layout;
      }
      init() {
        super.init(NULL, this._layout.numberOfReferences);
        this.pos = 0;
      }
      get pos() {
        return this._pos.readU32();
      }
      set pos(value) {
        this._pos.writeU32(value);
      }
      newHandle(object) {
        const pos = this.pos;
        const handle2 = this._refsStorage.add(pos * 4);
        handle2.writeS32(object.toInt32());
        this.pos = pos + 1;
        return handle2;
      }
      static layoutForCapacity(numRefs) {
        const refsStorage = BHS_SIZE;
        const pos = refsStorage + numRefs * 4;
        return {
          size: pos + 4,
          numberOfReferences: numRefs,
          offset: {
            refsStorage,
            pos
          }
        };
      }
    };
    objectVisitorPredicateFactories = {
      arm: function(needle, onMatch) {
        const size = Process.pageSize;
        const predicate = Memory.alloc(size);
        Memory.protect(predicate, size, "rwx");
        const onMatchCallback = new NativeCallback(onMatch, "void", ["pointer"]);
        predicate._onMatchCallback = onMatchCallback;
        const instructions = [
          26625,
          // ldr r1, [r0]
          18947,
          // ldr r2, =needle
          17041,
          // cmp r1, r2
          53505,
          // bne mismatch
          19202,
          // ldr r3, =onMatch
          18200,
          // bx r3
          18288,
          // bx lr
          48896
          // nop
        ];
        const needleOffset = instructions.length * 2;
        const onMatchOffset = needleOffset + 4;
        const codeSize = onMatchOffset + 4;
        Memory.patchCode(predicate, codeSize, function(address) {
          instructions.forEach((instruction, index) => {
            address.add(index * 2).writeU16(instruction);
          });
          address.add(needleOffset).writeS32(needle);
          address.add(onMatchOffset).writePointer(onMatchCallback);
        });
        return predicate.or(1);
      },
      arm64: function(needle, onMatch) {
        const size = Process.pageSize;
        const predicate = Memory.alloc(size);
        Memory.protect(predicate, size, "rwx");
        const onMatchCallback = new NativeCallback(onMatch, "void", ["pointer"]);
        predicate._onMatchCallback = onMatchCallback;
        const instructions = [
          3107979265,
          // ldr w1, [x0]
          402653378,
          // ldr w2, =needle
          1795293247,
          // cmp w1, w2
          1409286241,
          // b.ne mismatch
          1476395139,
          // ldr x3, =onMatch
          3592355936,
          // br x3
          3596551104
          // ret
        ];
        const needleOffset = instructions.length * 4;
        const onMatchOffset = needleOffset + 4;
        const codeSize = onMatchOffset + 8;
        Memory.patchCode(predicate, codeSize, function(address) {
          instructions.forEach((instruction, index) => {
            address.add(index * 4).writeU32(instruction);
          });
          address.add(needleOffset).writeS32(needle);
          address.add(onMatchOffset).writePointer(onMatchCallback);
        });
        return predicate;
      }
    };
  }
});

// node_modules/frida-java-bridge/lib/jvm.js
function getApi3() {
  if (cachedApi3 === null) {
    cachedApi3 = _getApi2();
  }
  return cachedApi3;
}
function _getApi2() {
  const vmModules = Process.enumerateModules().filter((m2) => /jvm.(dll|dylib|so)$/.test(m2.name));
  if (vmModules.length === 0) {
    return null;
  }
  const vmModule = vmModules[0];
  const temporaryApi = {
    flavor: "jvm"
  };
  const pending = Process.platform === "windows" ? [{
    module: vmModule,
    functions: {
      JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]],
      JVM_Sleep: ["JVM_Sleep", "void", ["pointer", "pointer", "long"]],
      "VMThread::execute": ["VMThread::execute", "void", ["pointer"]],
      "Method::size": ["Method::size", "int", ["int"]],
      "Method::set_native_function": ["Method::set_native_function", "void", ["pointer", "pointer", "int"]],
      "Method::clear_native_function": ["Method::clear_native_function", "void", ["pointer"]],
      "Method::jmethod_id": ["Method::jmethod_id", "pointer", ["pointer"]],
      "ClassLoaderDataGraph::classes_do": ["ClassLoaderDataGraph::classes_do", "void", ["pointer"]],
      "NMethodSweeper::sweep_code_cache": ["NMethodSweeper::sweep_code_cache", "void", []],
      "OopMapCache::flush_obsolete_entries": ["OopMapCache::flush_obsolete_entries", "void", ["pointer"]]
    },
    variables: {
      "VM_RedefineClasses::`vftable'": function(address) {
        this.vtableRedefineClasses = address;
      },
      "VM_RedefineClasses::doit": function(address) {
        this.redefineClassesDoIt = address;
      },
      "VM_RedefineClasses::doit_prologue": function(address) {
        this.redefineClassesDoItPrologue = address;
      },
      "VM_RedefineClasses::doit_epilogue": function(address) {
        this.redefineClassesDoItEpilogue = address;
      },
      "VM_RedefineClasses::allow_nested_vm_operations": function(address) {
        this.redefineClassesAllow = address;
      },
      "NMethodSweeper::_traversals": function(address) {
        this.traversals = address;
      },
      "NMethodSweeper::_should_sweep": function(address) {
        this.shouldSweep = address;
      }
    },
    optionals: []
  }] : [{
    module: vmModule,
    functions: {
      JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]],
      _ZN6Method4sizeEb: ["Method::size", "int", ["int"]],
      _ZN6Method19set_native_functionEPhb: ["Method::set_native_function", "void", ["pointer", "pointer", "int"]],
      _ZN6Method21clear_native_functionEv: ["Method::clear_native_function", "void", ["pointer"]],
      // JDK >= 17
      _ZN6Method24restore_unshareable_infoEP10JavaThread: ["Method::restore_unshareable_info", "void", ["pointer", "pointer"]],
      // JDK < 17
      _ZN6Method24restore_unshareable_infoEP6Thread: ["Method::restore_unshareable_info", "void", ["pointer", "pointer"]],
      _ZN6Method11link_methodERK12methodHandleP10JavaThread: ["Method::link_method", "void", ["pointer", "pointer", "pointer"]],
      _ZN6Method10jmethod_idEv: ["Method::jmethod_id", "pointer", ["pointer"]],
      _ZN6Method10clear_codeEv: function(address) {
        const clearCode = new NativeFunction(address, "void", ["pointer"], nativeFunctionOptions4);
        this["Method::clear_code"] = function(thisPtr) {
          clearCode(thisPtr);
        };
      },
      _ZN6Method10clear_codeEb: function(address) {
        const clearCode = new NativeFunction(address, "void", ["pointer", "int"], nativeFunctionOptions4);
        const lock = 0;
        this["Method::clear_code"] = function(thisPtr) {
          clearCode(thisPtr, lock);
        };
      },
      // JDK >= 13
      _ZN18VM_RedefineClasses19mark_dependent_codeEP13InstanceKlass: ["VM_RedefineClasses::mark_dependent_code", "void", ["pointer", "pointer"]],
      _ZN18VM_RedefineClasses20flush_dependent_codeEv: ["VM_RedefineClasses::flush_dependent_code", "void", []],
      // JDK < 13
      _ZN18VM_RedefineClasses20flush_dependent_codeEP13InstanceKlassP6Thread: ["VM_RedefineClasses::flush_dependent_code", "void", ["pointer", "pointer", "pointer"]],
      // JDK < 10
      _ZN18VM_RedefineClasses20flush_dependent_codeE19instanceKlassHandleP6Thread: ["VM_RedefineClasses::flush_dependent_code", "void", ["pointer", "pointer", "pointer"]],
      _ZN19ResolvedMethodTable21adjust_method_entriesEPb: ["ResolvedMethodTable::adjust_method_entries", "void", ["pointer"]],
      // JDK < 10
      _ZN15MemberNameTable21adjust_method_entriesEP13InstanceKlassPb: ["MemberNameTable::adjust_method_entries", "void", ["pointer", "pointer", "pointer"]],
      _ZN17ConstantPoolCache21adjust_method_entriesEPb: function(address) {
        const adjustMethod = new NativeFunction(address, "void", ["pointer", "pointer"], nativeFunctionOptions4);
        this["ConstantPoolCache::adjust_method_entries"] = function(thisPtr, holderPtr, tracePtr) {
          adjustMethod(thisPtr, tracePtr);
        };
      },
      // JDK < 13
      _ZN17ConstantPoolCache21adjust_method_entriesEP13InstanceKlassPb: function(address) {
        const adjustMethod = new NativeFunction(address, "void", ["pointer", "pointer", "pointer"], nativeFunctionOptions4);
        this["ConstantPoolCache::adjust_method_entries"] = function(thisPtr, holderPtr, tracePtr) {
          adjustMethod(thisPtr, holderPtr, tracePtr);
        };
      },
      _ZN20ClassLoaderDataGraph10classes_doEP12KlassClosure: ["ClassLoaderDataGraph::classes_do", "void", ["pointer"]],
      _ZN20ClassLoaderDataGraph22clean_deallocate_listsEb: ["ClassLoaderDataGraph::clean_deallocate_lists", "void", ["int"]],
      _ZN10JavaThread27thread_from_jni_environmentEP7JNIEnv_: ["JavaThread::thread_from_jni_environment", "pointer", ["pointer"]],
      _ZN8VMThread7executeEP12VM_Operation: ["VMThread::execute", "void", ["pointer"]],
      _ZN11OopMapCache22flush_obsolete_entriesEv: ["OopMapCache::flush_obsolete_entries", "void", ["pointer"]],
      _ZN14NMethodSweeper11force_sweepEv: ["NMethodSweeper::force_sweep", "void", []],
      _ZN14NMethodSweeper16sweep_code_cacheEv: ["NMethodSweeper::sweep_code_cache", "void", []],
      _ZN14NMethodSweeper17sweep_in_progressEv: ["NMethodSweeper::sweep_in_progress", "bool", []],
      JVM_Sleep: ["JVM_Sleep", "void", ["pointer", "pointer", "long"]]
    },
    variables: {
      // JDK <= 9
      _ZN18VM_RedefineClasses14_the_class_oopE: function(address) {
        this.redefineClass = address;
      },
      // 9 < JDK < 13
      _ZN18VM_RedefineClasses10_the_classE: function(address) {
        this.redefineClass = address;
      },
      // JDK < 13
      _ZN18VM_RedefineClasses25AdjustCpoolCacheAndVtable8do_klassEP5Klass: function(address) {
        this.doKlass = address;
      },
      // JDK >= 13
      _ZN18VM_RedefineClasses22AdjustAndCleanMetadata8do_klassEP5Klass: function(address) {
        this.doKlass = address;
      },
      _ZTV18VM_RedefineClasses: function(address) {
        this.vtableRedefineClasses = address;
      },
      _ZN18VM_RedefineClasses4doitEv: function(address) {
        this.redefineClassesDoIt = address;
      },
      _ZN18VM_RedefineClasses13doit_prologueEv: function(address) {
        this.redefineClassesDoItPrologue = address;
      },
      _ZN18VM_RedefineClasses13doit_epilogueEv: function(address) {
        this.redefineClassesDoItEpilogue = address;
      },
      _ZN18VM_RedefineClassesD0Ev: function(address) {
        this.redefineClassesDispose0 = address;
      },
      _ZN18VM_RedefineClassesD1Ev: function(address) {
        this.redefineClassesDispose1 = address;
      },
      _ZNK18VM_RedefineClasses26allow_nested_vm_operationsEv: function(address) {
        this.redefineClassesAllow = address;
      },
      _ZNK18VM_RedefineClasses14print_on_errorEP12outputStream: function(address) {
        this.redefineClassesOnError = address;
      },
      // JDK >= 17
      _ZN13InstanceKlass33create_new_default_vtable_indicesEiP10JavaThread: function(address) {
        this.createNewDefaultVtableIndices = address;
      },
      // JDK < 17
      _ZN13InstanceKlass33create_new_default_vtable_indicesEiP6Thread: function(address) {
        this.createNewDefaultVtableIndices = address;
      },
      _ZN19Abstract_VM_Version19jre_release_versionEv: function(address) {
        const getVersion = new NativeFunction(address, "pointer", [], nativeFunctionOptions4);
        const versionS = getVersion().readCString();
        this.version = versionS.startsWith("1.8") ? 8 : versionS.startsWith("9.") ? 9 : parseInt(versionS.slice(0, 2), 10);
        this.versionS = versionS;
      },
      _ZN14NMethodSweeper11_traversalsE: function(address) {
        this.traversals = address;
      },
      _ZN14NMethodSweeper21_sweep_fractions_leftE: function(address) {
        this.fractions = address;
      },
      _ZN14NMethodSweeper13_should_sweepE: function(address) {
        this.shouldSweep = address;
      }
    },
    optionals: [
      "_ZN6Method24restore_unshareable_infoEP10JavaThread",
      "_ZN6Method24restore_unshareable_infoEP6Thread",
      "_ZN6Method11link_methodERK12methodHandleP10JavaThread",
      "_ZN6Method10clear_codeEv",
      "_ZN6Method10clear_codeEb",
      "_ZN18VM_RedefineClasses19mark_dependent_codeEP13InstanceKlass",
      "_ZN18VM_RedefineClasses20flush_dependent_codeEv",
      "_ZN18VM_RedefineClasses20flush_dependent_codeEP13InstanceKlassP6Thread",
      "_ZN18VM_RedefineClasses20flush_dependent_codeE19instanceKlassHandleP6Thread",
      "_ZN19ResolvedMethodTable21adjust_method_entriesEPb",
      "_ZN15MemberNameTable21adjust_method_entriesEP13InstanceKlassPb",
      "_ZN17ConstantPoolCache21adjust_method_entriesEPb",
      "_ZN17ConstantPoolCache21adjust_method_entriesEP13InstanceKlassPb",
      "_ZN20ClassLoaderDataGraph22clean_deallocate_listsEb",
      "_ZN10JavaThread27thread_from_jni_environmentEP7JNIEnv_",
      "_ZN14NMethodSweeper11force_sweepEv",
      "_ZN14NMethodSweeper17sweep_in_progressEv",
      "_ZN18VM_RedefineClasses14_the_class_oopE",
      "_ZN18VM_RedefineClasses10_the_classE",
      "_ZN18VM_RedefineClasses25AdjustCpoolCacheAndVtable8do_klassEP5Klass",
      "_ZN18VM_RedefineClasses22AdjustAndCleanMetadata8do_klassEP5Klass",
      "_ZN18VM_RedefineClassesD0Ev",
      "_ZN18VM_RedefineClassesD1Ev",
      "_ZNK18VM_RedefineClasses14print_on_errorEP12outputStream",
      "_ZN13InstanceKlass33create_new_default_vtable_indicesEiP10JavaThread",
      "_ZN13InstanceKlass33create_new_default_vtable_indicesEiP6Thread",
      "_ZN14NMethodSweeper21_sweep_fractions_leftE"
    ]
  }];
  const missing = [];
  pending.forEach(function(api3) {
    const module = api3.module;
    const functions = api3.functions || {};
    const variables = api3.variables || {};
    const optionals = new Set(api3.optionals || []);
    const tmp = module.enumerateExports().reduce(function(result2, exp) {
      result2[exp.name] = exp;
      return result2;
    }, {});
    const exportByName = module.enumerateSymbols().reduce(function(result2, exp) {
      result2[exp.name] = exp;
      return result2;
    }, tmp);
    Object.keys(functions).forEach(function(name2) {
      const exp = exportByName[name2];
      if (exp !== void 0) {
        const signature2 = functions[name2];
        if (typeof signature2 === "function") {
          signature2.call(temporaryApi, exp.address);
        } else {
          temporaryApi[signature2[0]] = new NativeFunction(exp.address, signature2[1], signature2[2], nativeFunctionOptions4);
        }
      } else {
        if (!optionals.has(name2)) {
          missing.push(name2);
        }
      }
    });
    Object.keys(variables).forEach(function(name2) {
      const exp = exportByName[name2];
      if (exp !== void 0) {
        const handler = variables[name2];
        handler.call(temporaryApi, exp.address);
      } else {
        if (!optionals.has(name2)) {
          missing.push(name2);
        }
      }
    });
  });
  if (missing.length > 0) {
    throw new Error("Java API only partially available; please file a bug. Missing: " + missing.join(", "));
  }
  const vms = Memory.alloc(pointerSize8);
  const vmCount = Memory.alloc(jsizeSize2);
  checkJniResult("JNI_GetCreatedJavaVMs", temporaryApi.JNI_GetCreatedJavaVMs(vms, 1, vmCount));
  if (vmCount.readInt() === 0) {
    return null;
  }
  temporaryApi.vm = vms.readPointer();
  const allocatorFunctions = Process.platform === "windows" ? {
    $new: ["??2@YAPEAX_K@Z", "pointer", ["ulong"]],
    $delete: ["??3@YAXPEAX@Z", "void", ["pointer"]]
  } : {
    $new: ["_Znwm", "pointer", ["ulong"]],
    $delete: ["_ZdlPv", "void", ["pointer"]]
  };
  for (const [name2, [rawName, retType2, argTypes2]] of Object.entries(allocatorFunctions)) {
    let address = Module.findGlobalExportByName(rawName);
    if (address === null) {
      address = DebugSymbol.fromName(rawName).address;
      if (address.isNull()) {
        throw new Error(`unable to find C++ allocator API, missing: '${rawName}'`);
      }
    }
    temporaryApi[name2] = new NativeFunction(address, retType2, argTypes2, nativeFunctionOptions4);
  }
  temporaryApi.jvmti = getEnvJvmti(temporaryApi);
  if (temporaryApi["JavaThread::thread_from_jni_environment"] === void 0) {
    temporaryApi["JavaThread::thread_from_jni_environment"] = makeThreadFromJniHelper(temporaryApi);
  }
  return temporaryApi;
}
function getEnvJvmti(api3) {
  const vm3 = new VM(api3);
  let env2;
  vm3.perform(() => {
    const handle2 = vm3.tryGetEnvHandle(jvmtiVersion.v1_0);
    if (handle2 === null) {
      throw new Error("JVMTI not available");
    }
    env2 = new EnvJvmti(handle2, vm3);
    const capaBuf = Memory.alloc(8);
    capaBuf.writeU64(jvmtiCapabilities.canTagObjects);
    const result2 = env2.addCapabilities(capaBuf);
    checkJniResult("getEnvJvmti::AddCapabilities", result2);
  });
  return env2;
}
function makeThreadFromJniHelper(api3) {
  let offset = null;
  const tryParse = threadOffsetParsers[Process.arch];
  if (tryParse !== void 0) {
    const vm3 = new VM(api3);
    const findClassImpl = vm3.perform((env2) => env2.handle.readPointer().add(6 * pointerSize8).readPointer());
    offset = parseInstructionsAt(findClassImpl, tryParse, { limit: 11 });
  }
  if (offset === null) {
    return () => {
      throw new Error("Unable to make thread_from_jni_environment() helper for the current architecture");
    };
  }
  return (env2) => {
    return env2.add(offset);
  };
}
function parseX64ThreadOffset(insn) {
  if (insn.mnemonic !== "lea") {
    return null;
  }
  const { base, disp } = insn.operands[1].value;
  if (!(base === "rdi" && disp < 0)) {
    return null;
  }
  return disp;
}
function ensureClassInitialized2(env2, classRef) {
}
function ensureManglersScheduled(vm3) {
  if (!manglersScheduled) {
    manglersScheduled = true;
    Script.nextTick(doManglers, vm3);
  }
}
function doManglers(vm3) {
  const localReplaceManglers = new Map(replaceManglers);
  const localRevertManglers = new Map(revertManglers);
  replaceManglers.clear();
  revertManglers.clear();
  manglersScheduled = false;
  vm3.perform((env2) => {
    const api3 = getApi3();
    const thread = api3["JavaThread::thread_from_jni_environment"](env2.handle);
    let force = false;
    withJvmThread(() => {
      localReplaceManglers.forEach((mangler) => {
        const { method: method2, originalMethod, impl, methodId, newMethod } = mangler;
        if (originalMethod === null) {
          mangler.originalMethod = fetchJvmMethod(method2);
          mangler.newMethod = nativeJvmMethod(method2, impl, thread);
          installJvmMethod(mangler.newMethod, methodId, thread);
        } else {
          api3["Method::set_native_function"](newMethod.method, impl, 0);
        }
      });
      localRevertManglers.forEach((mangler) => {
        const { originalMethod, methodId, newMethod } = mangler;
        if (originalMethod !== null) {
          revertJvmMethod(originalMethod);
          const revert = originalMethod.oldMethod;
          revert.oldMethod = newMethod;
          installJvmMethod(revert, methodId, thread);
          force = true;
        }
      });
    });
    if (force) {
      forceSweep(env2.handle);
    }
  });
}
function forceSweep(env2) {
  const {
    fractions,
    shouldSweep,
    traversals,
    "NMethodSweeper::sweep_code_cache": sweep,
    "NMethodSweeper::sweep_in_progress": inProgress,
    "NMethodSweeper::force_sweep": force,
    JVM_Sleep: sleep
  } = getApi3();
  if (force !== void 0) {
    Thread.sleep(0.05);
    force();
    Thread.sleep(0.05);
    force();
  } else {
    let trav = traversals.readS64();
    const endTrav = trav + 2;
    while (endTrav > trav) {
      fractions.writeS32(1);
      sleep(env2, NULL, 50);
      if (!inProgress()) {
        withJvmThread(() => {
          Thread.sleep(0.05);
        });
      }
      const sweepNotAlreadyInProgress = shouldSweep.readU8() === 0;
      if (sweepNotAlreadyInProgress) {
        fractions.writeS32(1);
        sweep();
      }
      trav = traversals.readS64();
    }
  }
}
function withJvmThread(fn, fnPrologue, fnEpilogue) {
  const {
    execute,
    vtable: vtable2,
    vtableSize,
    doItOffset,
    prologueOffset,
    epilogueOffset
  } = getJvmThreadSpec();
  const vtableDup = Memory.dup(vtable2, vtableSize);
  const vmOperation = Memory.alloc(pointerSize8 * 25);
  vmOperation.writePointer(vtableDup);
  const doIt = new NativeCallback(fn, "void", ["pointer"]);
  vtableDup.add(doItOffset).writePointer(doIt);
  let prologue = null;
  if (fnPrologue !== void 0) {
    prologue = new NativeCallback(fnPrologue, "int", ["pointer"]);
    vtableDup.add(prologueOffset).writePointer(prologue);
  }
  let epilogue = null;
  if (fnEpilogue !== void 0) {
    epilogue = new NativeCallback(fnEpilogue, "void", ["pointer"]);
    vtableDup.add(epilogueOffset).writePointer(epilogue);
  }
  execute(vmOperation);
}
function _getJvmThreadSpec() {
  const {
    vtableRedefineClasses,
    redefineClassesDoIt,
    redefineClassesDoItPrologue,
    redefineClassesDoItEpilogue,
    redefineClassesOnError,
    redefineClassesAllow,
    redefineClassesDispose0,
    redefineClassesDispose1,
    "VMThread::execute": execute
  } = getApi3();
  const vtablePtr = vtableRedefineClasses.add(2 * pointerSize8);
  const vtableSize = 15 * pointerSize8;
  const vtable2 = Memory.dup(vtablePtr, vtableSize);
  const emptyCallback = new NativeCallback(() => {
  }, "void", ["pointer"]);
  let doItOffset, prologueOffset, epilogueOffset;
  for (let offset = 0; offset !== vtableSize; offset += pointerSize8) {
    const element = vtable2.add(offset);
    const value = element.readPointer();
    if (redefineClassesOnError !== void 0 && value.equals(redefineClassesOnError) || redefineClassesDispose0 !== void 0 && value.equals(redefineClassesDispose0) || redefineClassesDispose1 !== void 0 && value.equals(redefineClassesDispose1)) {
      element.writePointer(emptyCallback);
    } else if (value.equals(redefineClassesDoIt)) {
      doItOffset = offset;
    } else if (value.equals(redefineClassesDoItPrologue)) {
      prologueOffset = offset;
      element.writePointer(redefineClassesAllow);
    } else if (value.equals(redefineClassesDoItEpilogue)) {
      epilogueOffset = offset;
      element.writePointer(emptyCallback);
    }
  }
  return {
    execute,
    emptyCallback,
    vtable: vtable2,
    vtableSize,
    doItOffset,
    prologueOffset,
    epilogueOffset
  };
}
function makeMethodMangler2(methodId) {
  return new JvmMethodMangler(methodId);
}
function installJvmMethod(method2, methodId, thread) {
  const { method: handle2, oldMethod: old } = method2;
  const api3 = getApi3();
  method2.methodsArray.add(method2.methodIndex * pointerSize8).writePointer(handle2);
  if (method2.vtableIndex >= 0) {
    method2.vtable.add(method2.vtableIndex * pointerSize8).writePointer(handle2);
  }
  methodId.writePointer(handle2);
  old.accessFlagsPtr.writeU32((old.accessFlags | JVM_ACC_IS_OLD | JVM_ACC_IS_OBSOLETE) >>> 0);
  const flushObs = api3["OopMapCache::flush_obsolete_entries"];
  if (flushObs !== void 0) {
    const { oopMapCache } = method2;
    if (!oopMapCache.isNull()) {
      flushObs(oopMapCache);
    }
  }
  const mark = api3["VM_RedefineClasses::mark_dependent_code"];
  const flush = api3["VM_RedefineClasses::flush_dependent_code"];
  if (mark !== void 0) {
    mark(NULL, method2.instanceKlass);
    flush();
  } else {
    flush(NULL, method2.instanceKlass, thread);
  }
  const traceNamePrinted = Memory.alloc(1);
  traceNamePrinted.writeU8(1);
  api3["ConstantPoolCache::adjust_method_entries"](method2.cache, method2.instanceKlass, traceNamePrinted);
  const klassClosure = Memory.alloc(3 * pointerSize8);
  const doKlassPtr = Memory.alloc(pointerSize8);
  doKlassPtr.writePointer(api3.doKlass);
  klassClosure.writePointer(doKlassPtr);
  klassClosure.add(pointerSize8).writePointer(thread);
  klassClosure.add(2 * pointerSize8).writePointer(thread);
  if (api3.redefineClass !== void 0) {
    api3.redefineClass.writePointer(method2.instanceKlass);
  }
  api3["ClassLoaderDataGraph::classes_do"](klassClosure);
  const rmtAdjustMethodEntries = api3["ResolvedMethodTable::adjust_method_entries"];
  if (rmtAdjustMethodEntries !== void 0) {
    rmtAdjustMethodEntries(traceNamePrinted);
  } else {
    const { memberNames } = method2;
    if (!memberNames.isNull()) {
      const mntAdjustMethodEntries = api3["MemberNameTable::adjust_method_entries"];
      if (mntAdjustMethodEntries !== void 0) {
        mntAdjustMethodEntries(memberNames, method2.instanceKlass, traceNamePrinted);
      }
    }
  }
  const clean = api3["ClassLoaderDataGraph::clean_deallocate_lists"];
  if (clean !== void 0) {
    clean(0);
  }
}
function nativeJvmMethod(method2, impl, thread) {
  const api3 = getApi3();
  const newMethod = fetchJvmMethod(method2);
  newMethod.constPtr.writePointer(newMethod.const);
  const flags = (newMethod.accessFlags | JVM_ACC_NATIVE | JVM_ACC_NOT_C2_COMPILABLE | JVM_ACC_NOT_C1_COMPILABLE | JVM_ACC_NOT_C2_OSR_COMPILABLE) >>> 0;
  newMethod.accessFlagsPtr.writeU32(flags);
  newMethod.signatureHandler.writePointer(NULL);
  newMethod.adapter.writePointer(NULL);
  newMethod.i2iEntry.writePointer(NULL);
  api3["Method::clear_code"](newMethod.method);
  newMethod.dataPtr.writePointer(NULL);
  newMethod.countersPtr.writePointer(NULL);
  newMethod.stackmapPtr.writePointer(NULL);
  api3["Method::clear_native_function"](newMethod.method);
  api3["Method::set_native_function"](newMethod.method, impl, 0);
  api3["Method::restore_unshareable_info"](newMethod.method, thread);
  if (api3.version >= 17) {
    const methodHandle = Memory.alloc(2 * pointerSize8);
    methodHandle.writePointer(newMethod.method);
    methodHandle.add(pointerSize8).writePointer(thread);
    api3["Method::link_method"](newMethod.method, methodHandle, thread);
  }
  return newMethod;
}
function fetchJvmMethod(method2) {
  const spec = getJvmMethodSpec();
  const constMethod = method2.add(spec.method.constMethodOffset).readPointer();
  const constMethodSize = constMethod.add(spec.constMethod.sizeOffset).readS32() * pointerSize8;
  const newConstMethod = Memory.alloc(constMethodSize + spec.method.size);
  Memory.copy(newConstMethod, constMethod, constMethodSize);
  const newMethod = newConstMethod.add(constMethodSize);
  Memory.copy(newMethod, method2, spec.method.size);
  const result2 = readJvmMethod(newMethod, newConstMethod, constMethodSize);
  const oldMethod = readJvmMethod(method2, constMethod, constMethodSize);
  result2.oldMethod = oldMethod;
  return result2;
}
function readJvmMethod(method2, constMethod, constMethodSize) {
  const api3 = getApi3();
  const spec = getJvmMethodSpec();
  const constPtr = method2.add(spec.method.constMethodOffset);
  const dataPtr = method2.add(spec.method.methodDataOffset);
  const countersPtr = method2.add(spec.method.methodCountersOffset);
  const accessFlagsPtr = method2.add(spec.method.accessFlagsOffset);
  const accessFlags = accessFlagsPtr.readU32();
  const adapter = spec.getAdapterPointer(method2, constMethod);
  const i2iEntry = method2.add(spec.method.i2iEntryOffset);
  const signatureHandler = method2.add(spec.method.signatureHandlerOffset);
  const constantPool = constMethod.add(spec.constMethod.constantPoolOffset).readPointer();
  const stackmapPtr = constMethod.add(spec.constMethod.stackmapDataOffset);
  const instanceKlass = constantPool.add(spec.constantPool.instanceKlassOffset).readPointer();
  const cache = constantPool.add(spec.constantPool.cacheOffset).readPointer();
  const instanceKlassSpec = getJvmInstanceKlassSpec();
  const methods = instanceKlass.add(instanceKlassSpec.methodsOffset).readPointer();
  const methodsCount = methods.readS32();
  const methodsArray = methods.add(pointerSize8);
  const methodIndex = constMethod.add(spec.constMethod.methodIdnumOffset).readU16();
  const vtableIndexPtr = method2.add(spec.method.vtableIndexOffset);
  const vtableIndex = vtableIndexPtr.readS32();
  const vtable2 = instanceKlass.add(instanceKlassSpec.vtableOffset);
  const oopMapCache = instanceKlass.add(instanceKlassSpec.oopMapCacheOffset).readPointer();
  const memberNames = api3.version >= 10 ? instanceKlass.add(instanceKlassSpec.memberNamesOffset).readPointer() : NULL;
  return {
    method: method2,
    methodSize: spec.method.size,
    const: constMethod,
    constSize: constMethodSize,
    constPtr,
    dataPtr,
    countersPtr,
    stackmapPtr,
    instanceKlass,
    methodsArray,
    methodsCount,
    methodIndex,
    vtableIndex,
    vtableIndexPtr,
    vtable: vtable2,
    accessFlags,
    accessFlagsPtr,
    adapter,
    i2iEntry,
    signatureHandler,
    memberNames,
    cache,
    oopMapCache
  };
}
function revertJvmMethod(method2) {
  const { oldMethod: old } = method2;
  old.accessFlagsPtr.writeU32(old.accessFlags);
  old.vtableIndexPtr.writeS32(old.vtableIndex);
}
function _getJvmMethodSpec() {
  const api3 = getApi3();
  const { version: version2 } = api3;
  let adapterHandlerLocation;
  if (version2 >= 17) {
    adapterHandlerLocation = "method:early";
  } else if (version2 >= 9 && version2 <= 16) {
    adapterHandlerLocation = "const-method";
  } else {
    adapterHandlerLocation = "method:late";
  }
  const isNative = 1;
  const methodSize = api3["Method::size"](isNative) * pointerSize8;
  const constMethodOffset = pointerSize8;
  const methodDataOffset = 2 * pointerSize8;
  const methodCountersOffset = 3 * pointerSize8;
  const adapterInMethodEarlyOffset = 4 * pointerSize8;
  const adapterInMethodEarlySize = adapterHandlerLocation === "method:early" ? pointerSize8 : 0;
  const accessFlagsOffset = adapterInMethodEarlyOffset + adapterInMethodEarlySize;
  const vtableIndexOffset = accessFlagsOffset + 4;
  const i2iEntryOffset = vtableIndexOffset + 4 + 8;
  const adapterInMethodLateOffset = i2iEntryOffset + pointerSize8;
  const adapterInMethodOffset = adapterInMethodEarlySize !== 0 ? adapterInMethodEarlyOffset : adapterInMethodLateOffset;
  const nativeFunctionOffset = methodSize - 2 * pointerSize8;
  const signatureHandlerOffset = methodSize - pointerSize8;
  const constantPoolOffset = 8;
  const stackmapDataOffset = constantPoolOffset + pointerSize8;
  const adapterInConstMethodOffset = stackmapDataOffset + pointerSize8;
  const adapterInConstMethodSize = adapterHandlerLocation === "const-method" ? pointerSize8 : 0;
  const constMethodSizeOffset = adapterInConstMethodOffset + adapterInConstMethodSize;
  const methodIdnumOffset = constMethodSizeOffset + 14;
  const cacheOffset = 2 * pointerSize8;
  const instanceKlassOffset = 3 * pointerSize8;
  const getAdapterPointer = adapterInConstMethodSize !== 0 ? function(method2, constMethod) {
    return constMethod.add(adapterInConstMethodOffset);
  } : function(method2, constMethod) {
    return method2.add(adapterInMethodOffset);
  };
  return {
    getAdapterPointer,
    method: {
      size: methodSize,
      constMethodOffset,
      methodDataOffset,
      methodCountersOffset,
      accessFlagsOffset,
      vtableIndexOffset,
      i2iEntryOffset,
      nativeFunctionOffset,
      signatureHandlerOffset
    },
    constMethod: {
      constantPoolOffset,
      stackmapDataOffset,
      sizeOffset: constMethodSizeOffset,
      methodIdnumOffset
    },
    constantPool: {
      cacheOffset,
      instanceKlassOffset
    }
  };
}
function _getJvmInstanceKlassSpec() {
  const { version: jvmVersion, createNewDefaultVtableIndices } = getApi3();
  const tryParse = vtableOffsetParsers[Process.arch];
  if (tryParse === void 0) {
    throw new Error(`Missing vtable offset parser for ${Process.arch}`);
  }
  const vtableOffset = parseInstructionsAt(createNewDefaultVtableIndices, tryParse, { limit: 32 });
  if (vtableOffset === null) {
    throw new Error("Unable to deduce vtable offset");
  }
  const oopMultiplier = jvmVersion >= 10 && jvmVersion <= 11 || jvmVersion >= 15 ? 17 : 18;
  const methodsOffset = vtableOffset - 7 * pointerSize8;
  const memberNamesOffset = vtableOffset - 17 * pointerSize8;
  const oopMapCacheOffset = vtableOffset - oopMultiplier * pointerSize8;
  return {
    vtableOffset,
    methodsOffset,
    memberNamesOffset,
    oopMapCacheOffset
  };
}
function parseX64VTableOffset(insn) {
  if (insn.mnemonic !== "mov") {
    return null;
  }
  const dst = insn.operands[0];
  if (dst.type !== "mem") {
    return null;
  }
  const { value: dstValue } = dst;
  if (dstValue.scale !== 1) {
    return null;
  }
  const { disp } = dstValue;
  if (disp < 256) {
    return null;
  }
  const defaultVtableIndicesOffset = disp;
  return defaultVtableIndicesOffset + 16;
}
var jsizeSize2, pointerSize8, JVM_ACC_NATIVE, JVM_ACC_IS_OLD, JVM_ACC_IS_OBSOLETE, JVM_ACC_NOT_C2_COMPILABLE, JVM_ACC_NOT_C1_COMPILABLE, JVM_ACC_NOT_C2_OSR_COMPILABLE, nativeFunctionOptions4, getJvmMethodSpec, getJvmInstanceKlassSpec, getJvmThreadSpec, cachedApi3, manglersScheduled, replaceManglers, revertManglers, threadOffsetParsers, JvmMethodMangler, vtableOffsetParsers;
var init_jvm = __esm({
  "node_modules/frida-java-bridge/lib/jvm.js"() {
    "use strict";
    init_node_globals();
    init_jvmti();
    init_machine_code();
    init_memoize();
    init_result();
    init_vm();
    jsizeSize2 = 4;
    ({ pointerSize: pointerSize8 } = Process);
    JVM_ACC_NATIVE = 256;
    JVM_ACC_IS_OLD = 65536;
    JVM_ACC_IS_OBSOLETE = 131072;
    JVM_ACC_NOT_C2_COMPILABLE = 33554432;
    JVM_ACC_NOT_C1_COMPILABLE = 67108864;
    JVM_ACC_NOT_C2_OSR_COMPILABLE = 134217728;
    nativeFunctionOptions4 = {
      exceptions: "propagate"
    };
    getJvmMethodSpec = memoize(_getJvmMethodSpec);
    getJvmInstanceKlassSpec = memoize(_getJvmInstanceKlassSpec);
    getJvmThreadSpec = memoize(_getJvmThreadSpec);
    cachedApi3 = null;
    manglersScheduled = false;
    replaceManglers = /* @__PURE__ */ new Map();
    revertManglers = /* @__PURE__ */ new Map();
    threadOffsetParsers = {
      x64: parseX64ThreadOffset
    };
    JvmMethodMangler = class {
      constructor(methodId) {
        this.methodId = methodId;
        this.method = methodId.readPointer();
        this.originalMethod = null;
        this.newMethod = null;
        this.resolved = null;
        this.impl = null;
        this.key = methodId.toString(16);
      }
      replace(impl, isInstanceMethod, argTypes2, vm3, api3) {
        const { key } = this;
        const mangler = revertManglers.get(key);
        if (mangler !== void 0) {
          revertManglers.delete(key);
          this.method = mangler.method;
          this.originalMethod = mangler.originalMethod;
          this.newMethod = mangler.newMethod;
          this.resolved = mangler.resolved;
        }
        this.impl = impl;
        replaceManglers.set(key, this);
        ensureManglersScheduled(vm3);
      }
      revert(vm3) {
        const { key } = this;
        replaceManglers.delete(key);
        revertManglers.set(key, this);
        ensureManglersScheduled(vm3);
      }
      resolveTarget(wrapper, isInstanceMethod, env2, api3) {
        const { resolved, originalMethod, methodId } = this;
        if (resolved !== null) {
          return resolved;
        }
        if (originalMethod === null) {
          return methodId;
        }
        const vip = originalMethod.oldMethod.vtableIndexPtr;
        vip.writeS32(-2);
        const jmethodID = Memory.alloc(pointerSize8);
        jmethodID.writePointer(this.method);
        this.resolved = jmethodID;
        return jmethodID;
      }
    };
    vtableOffsetParsers = {
      x64: parseX64VTableOffset
    };
  }
});

// node_modules/frida-java-bridge/lib/api.js
var getApi4, api_default;
var init_api2 = __esm({
  "node_modules/frida-java-bridge/lib/api.js"() {
    "use strict";
    init_node_globals();
    init_android();
    init_jvm();
    getApi4 = getApi2;
    try {
      getAndroidVersion();
    } catch (e) {
      getApi4 = getApi3;
    }
    api_default = getApi4;
  }
});

// node_modules/frida-java-bridge/lib/class-model.js
function ensureInitialized(env2) {
  if (cm === null) {
    cm = compileModule2(env2);
    unwrap = makeHandleUnwrapper(cm, env2.vm);
  }
}
function compileModule2(env2) {
  const api3 = getApi2();
  const { jvmti = null } = api3;
  const { pointerSize: pointerSize11 } = Process;
  const lockSize = 8;
  const modelsSize = pointerSize11;
  const javaApiSize = 7 * pointerSize11;
  const artApiSize = 10 * 4 + 5 * pointerSize11;
  const dataSize = lockSize + modelsSize + javaApiSize + artApiSize;
  const data = Memory.alloc(dataSize);
  const lock = data;
  const models = lock.add(lockSize);
  const javaApi = models.add(modelsSize);
  const { getDeclaredMethods, getDeclaredFields } = env2.javaLangClass();
  const method2 = env2.javaLangReflectMethod();
  const field = env2.javaLangReflectField();
  let j = javaApi;
  [
    jvmti !== null ? jvmti : NULL,
    getDeclaredMethods,
    getDeclaredFields,
    method2.getName,
    method2.getModifiers,
    field.getName,
    field.getModifiers
  ].forEach((value) => {
    j = j.writePointer(value).add(pointerSize11);
  });
  const artApi = javaApi.add(javaApiSize);
  const { vm: vm3 } = env2;
  if (api3.flavor === "art") {
    let artClassOffsets;
    if (jvmti !== null) {
      artClassOffsets = [0, 0, 0, 0];
    } else {
      const c = getArtClassSpec(vm3).offset;
      artClassOffsets = [c.ifields, c.methods, c.sfields, c.copiedMethodsOffset];
    }
    const m2 = getArtMethodSpec(vm3);
    const f2 = getArtFieldSpec(vm3);
    let s = artApi;
    [
      1,
      ...artClassOffsets,
      m2.size,
      m2.offset.accessFlags,
      f2.size,
      f2.offset.accessFlags,
      4294967295
    ].forEach((value) => {
      s = s.writeUInt(value).add(4);
    });
    [
      api3.artClassLinker.address,
      api3["art::ClassLinker::VisitClasses"],
      api3["art::mirror::Class::GetDescriptor"],
      api3["art::ArtMethod::PrettyMethod"],
      Process.getModuleByName("libc.so").getExportByName("free")
    ].forEach((value, i) => {
      if (value === void 0) {
        value = NULL;
      }
      s = s.writePointer(value).add(pointerSize11);
    });
  }
  const cm2 = new CModule(code4, {
    lock,
    models,
    java_api: javaApi,
    art_api: artApi
  });
  const reentrantOptions = { exceptions: "propagate" };
  const fastOptions = { exceptions: "propagate", scheduling: "exclusive" };
  return {
    handle: cm2,
    new: new NativeFunction(cm2.model_new, "pointer", ["pointer", "pointer", "pointer"], reentrantOptions),
    has: new NativeFunction(cm2.model_has, "bool", ["pointer", "pointer"], fastOptions),
    find: new NativeFunction(cm2.model_find, "pointer", ["pointer", "pointer"], fastOptions),
    list: new NativeFunction(cm2.model_list, "pointer", ["pointer"], fastOptions),
    enumerateMethodsArt: new NativeFunction(
      cm2.enumerate_methods_art,
      "pointer",
      ["pointer", "pointer", "bool", "bool", "bool"],
      reentrantOptions
    ),
    enumerateMethodsJvm: new NativeFunction(cm2.enumerate_methods_jvm, "pointer", [
      "pointer",
      "pointer",
      "bool",
      "bool",
      "bool",
      "pointer"
    ], reentrantOptions),
    dealloc: new NativeFunction(cm2.dealloc, "void", ["pointer"], fastOptions)
  };
}
function makeHandleUnwrapper(cm2, vm3) {
  const api3 = getApi2();
  if (api3.flavor !== "art") {
    return nullUnwrap;
  }
  const decodeGlobal = api3["art::JavaVMExt::DecodeGlobal"];
  return function(handle2, env2, fn) {
    let result2;
    withRunnableArtThread(vm3, env2, (thread) => {
      const object = decodeGlobal(vm3, thread, handle2);
      result2 = fn(object);
    });
    return result2;
  };
}
function nullUnwrap(handle2, env2, fn) {
  return fn(NULL);
}
function boolToNative(val) {
  return val ? 1 : 0;
}
var code4, methodQueryPattern, cm, unwrap, Model;
var init_class_model = __esm({
  "node_modules/frida-java-bridge/lib/class-model.js"() {
    "use strict";
    init_node_globals();
    init_android();
    code4 = `#include <json-glib/json-glib.h>
#include <string.h>

#define kAccStatic 0x0008
#define kAccConstructor 0x00010000

typedef struct _Model Model;
typedef struct _EnumerateMethodsContext EnumerateMethodsContext;

typedef struct _JavaApi JavaApi;
typedef struct _JavaClassApi JavaClassApi;
typedef struct _JavaMethodApi JavaMethodApi;
typedef struct _JavaFieldApi JavaFieldApi;

typedef struct _JNIEnv JNIEnv;
typedef guint8 jboolean;
typedef gint32 jint;
typedef jint jsize;
typedef gpointer jobject;
typedef jobject jclass;
typedef jobject jstring;
typedef jobject jarray;
typedef jarray jobjectArray;
typedef gpointer jfieldID;
typedef gpointer jmethodID;

typedef struct _jvmtiEnv jvmtiEnv;
typedef enum
{
  JVMTI_ERROR_NONE = 0
} jvmtiError;

typedef struct _ArtApi ArtApi;
typedef guint32 ArtHeapReference;
typedef struct _ArtObject ArtObject;
typedef struct _ArtClass ArtClass;
typedef struct _ArtClassLinker ArtClassLinker;
typedef struct _ArtClassVisitor ArtClassVisitor;
typedef struct _ArtClassVisitorVTable ArtClassVisitorVTable;
typedef struct _ArtMethod ArtMethod;
typedef struct _ArtString ArtString;

typedef union _StdString StdString;
typedef struct _StdStringShort StdStringShort;
typedef struct _StdStringLong StdStringLong;

typedef void (* ArtVisitClassesFunc) (ArtClassLinker * linker, ArtClassVisitor * visitor);
typedef const char * (* ArtGetClassDescriptorFunc) (ArtClass * klass, StdString * storage);
typedef void (* ArtPrettyMethodFunc) (StdString * result, ArtMethod * method, jboolean with_signature);

struct _Model
{
  GHashTable * members;
};

struct _EnumerateMethodsContext
{
  GPatternSpec * class_query;
  GPatternSpec * method_query;
  jboolean include_signature;
  jboolean ignore_case;
  jboolean skip_system_classes;
  GHashTable * groups;
};

struct _JavaClassApi
{
  jmethodID get_declared_methods;
  jmethodID get_declared_fields;
};

struct _JavaMethodApi
{
  jmethodID get_name;
  jmethodID get_modifiers;
};

struct _JavaFieldApi
{
  jmethodID get_name;
  jmethodID get_modifiers;
};

struct _JavaApi
{
  jvmtiEnv * jvmti;
  JavaClassApi clazz;
  JavaMethodApi method;
  JavaFieldApi field;
};

struct _JNIEnv
{
  gpointer * functions;
};

struct _jvmtiEnv
{
  gpointer * functions;
};

struct _ArtApi
{
  gboolean available;

  guint class_offset_ifields;
  guint class_offset_methods;
  guint class_offset_sfields;
  guint class_offset_copied_methods_offset;

  guint method_size;
  guint method_offset_access_flags;

  guint field_size;
  guint field_offset_access_flags;

  guint alignment_padding;

  ArtClassLinker * linker;
  ArtVisitClassesFunc visit_classes;
  ArtGetClassDescriptorFunc get_class_descriptor;
  ArtPrettyMethodFunc pretty_method;

  void (* free) (gpointer mem);
};

struct _ArtObject
{
  ArtHeapReference klass;
  ArtHeapReference monitor;
};

struct _ArtClass
{
  ArtObject parent;

  ArtHeapReference class_loader;
};

struct _ArtClassVisitor
{
  ArtClassVisitorVTable * vtable;
  gpointer user_data;
};

struct _ArtClassVisitorVTable
{
  void (* reserved1) (ArtClassVisitor * self);
  void (* reserved2) (ArtClassVisitor * self);
  jboolean (* visit) (ArtClassVisitor * self, ArtClass * klass);
};

struct _ArtString
{
  ArtObject parent;

  gint32 count;
  guint32 hash_code;

  union
  {
    guint16 value[0];
    guint8 value_compressed[0];
  };
};

struct _StdStringShort
{
  guint8 size;
  gchar data[(3 * sizeof (gpointer)) - sizeof (guint8)];
};

struct _StdStringLong
{
  gsize capacity;
  gsize size;
  gchar * data;
};

union _StdString
{
  StdStringShort s;
  StdStringLong l;
};

static void model_add_method (Model * self, const gchar * name, jmethodID id, jint modifiers);
static void model_add_field (Model * self, const gchar * name, jfieldID id, jint modifiers);
static void model_free (Model * model);

static jboolean collect_matching_class_methods (ArtClassVisitor * self, ArtClass * klass);
static gchar * finalize_method_groups_to_json (GHashTable * groups);
static GPatternSpec * make_pattern_spec (const gchar * pattern, jboolean ignore_case);
static gchar * class_name_from_signature (const gchar * signature);
static gchar * format_method_signature (const gchar * name, const gchar * signature);
static void append_type (GString * output, const gchar ** type);

static gpointer read_art_array (gpointer object_base, guint field_offset, guint length_size, guint * length);

static void std_string_destroy (StdString * str);
static gchar * std_string_c_str (StdString * self);

extern GMutex lock;
extern GArray * models;
extern JavaApi java_api;
extern ArtApi art_api;

void
init (void)
{
  g_mutex_init (&lock);
  models = g_array_new (FALSE, FALSE, sizeof (Model *));
}

void
finalize (void)
{
  guint n, i;

  n = models->len;
  for (i = 0; i != n; i++)
  {
    Model * model = g_array_index (models, Model *, i);
    model_free (model);
  }

  g_array_unref (models);
  g_mutex_clear (&lock);
}

Model *
model_new (jclass class_handle,
           gpointer class_object,
           JNIEnv * env)
{
  Model * model;
  GHashTable * members;
  jvmtiEnv * jvmti = java_api.jvmti;
  gpointer * funcs = env->functions;
  jmethodID (* from_reflected_method) (JNIEnv *, jobject) = funcs[7];
  jfieldID (* from_reflected_field) (JNIEnv *, jobject) = funcs[8];
  jobject (* to_reflected_method) (JNIEnv *, jclass, jmethodID, jboolean) = funcs[9];
  jobject (* to_reflected_field) (JNIEnv *, jclass, jfieldID, jboolean) = funcs[12];
  void (* delete_local_ref) (JNIEnv *, jobject) = funcs[23];
  jobject (* call_object_method) (JNIEnv *, jobject, jmethodID, ...) = funcs[34];
  jint (* call_int_method) (JNIEnv *, jobject, jmethodID, ...) = funcs[49];
  const char * (* get_string_utf_chars) (JNIEnv *, jstring, jboolean *) = funcs[169];
  void (* release_string_utf_chars) (JNIEnv *, jstring, const char *) = funcs[170];
  jsize (* get_array_length) (JNIEnv *, jarray) = funcs[171];
  jobject (* get_object_array_element) (JNIEnv *, jobjectArray, jsize) = funcs[173];
  jsize n, i;

  model = g_new (Model, 1);

  members = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
  model->members = members;

  if (jvmti != NULL)
  {
    gpointer * jf = jvmti->functions - 1;
    jvmtiError (* deallocate) (jvmtiEnv *, void * mem) = jf[47];
    jvmtiError (* get_class_methods) (jvmtiEnv *, jclass, jint *, jmethodID **) = jf[52];
    jvmtiError (* get_class_fields) (jvmtiEnv *, jclass, jint *, jfieldID **) = jf[53];
    jvmtiError (* get_field_name) (jvmtiEnv *, jclass, jfieldID, char **, char **, char **) = jf[60];
    jvmtiError (* get_field_modifiers) (jvmtiEnv *, jclass, jfieldID, jint *) = jf[62];
    jvmtiError (* get_method_name) (jvmtiEnv *, jmethodID, char **, char **, char **) = jf[64];
    jvmtiError (* get_method_modifiers) (jvmtiEnv *, jmethodID, jint *) = jf[66];
    jint method_count;
    jmethodID * methods;
    jint field_count;
    jfieldID * fields;
    char * name;
    jint modifiers;

    get_class_methods (jvmti, class_handle, &method_count, &methods);
    for (i = 0; i != method_count; i++)
    {
      jmethodID method = methods[i];

      get_method_name (jvmti, method, &name, NULL, NULL);
      get_method_modifiers (jvmti, method, &modifiers);

      model_add_method (model, name, method, modifiers);

      deallocate (jvmti, name);
    }
    deallocate (jvmti, methods);

    get_class_fields (jvmti, class_handle, &field_count, &fields);
    for (i = 0; i != field_count; i++)
    {
      jfieldID field = fields[i];

      get_field_name (jvmti, class_handle, field, &name, NULL, NULL);
      get_field_modifiers (jvmti, class_handle, field, &modifiers);

      model_add_field (model, name, field, modifiers);

      deallocate (jvmti, name);
    }
    deallocate (jvmti, fields);
  }
  else if (art_api.available)
  {
    gpointer elements;
    guint n, i;
    const guint field_arrays[] = {
      art_api.class_offset_ifields,
      art_api.class_offset_sfields
    };
    guint field_array_cursor;
    gboolean merged_fields = art_api.class_offset_sfields == 0;

    elements = read_art_array (class_object, art_api.class_offset_methods, sizeof (gsize), NULL);
    n = *(guint16 *) (class_object + art_api.class_offset_copied_methods_offset);
    for (i = 0; i != n; i++)
    {
      jmethodID id;
      guint32 access_flags;
      jboolean is_static;
      jobject method, name;
      const char * name_str;
      jint modifiers;

      id = elements + (i * art_api.method_size);

      access_flags = *(guint32 *) (id + art_api.method_offset_access_flags);
      if ((access_flags & kAccConstructor) != 0)
        continue;
      is_static = (access_flags & kAccStatic) != 0;
      method = to_reflected_method (env, class_handle, id, is_static);
      name = call_object_method (env, method, java_api.method.get_name);
      name_str = get_string_utf_chars (env, name, NULL);
      modifiers = access_flags & 0xffff;

      model_add_method (model, name_str, id, modifiers);

      release_string_utf_chars (env, name, name_str);
      delete_local_ref (env, name);
      delete_local_ref (env, method);
    }

    for (field_array_cursor = 0; field_array_cursor != G_N_ELEMENTS (field_arrays); field_array_cursor++)
    {
      jboolean is_static;

      if (field_arrays[field_array_cursor] == 0)
        continue;

      if (!merged_fields)
        is_static = field_array_cursor == 1;

      elements = read_art_array (class_object, field_arrays[field_array_cursor], sizeof (guint32), &n);
      for (i = 0; i != n; i++)
      {
        jfieldID id;
        guint32 access_flags;
        jobject field, name;
        const char * name_str;
        jint modifiers;

        id = elements + (i * art_api.field_size);

        access_flags = *(guint32 *) (id + art_api.field_offset_access_flags);
        if (merged_fields)
          is_static = (access_flags & kAccStatic) != 0;
        field = to_reflected_field (env, class_handle, id, is_static);
        name = call_object_method (env, field, java_api.field.get_name);
        name_str = get_string_utf_chars (env, name, NULL);
        modifiers = access_flags & 0xffff;

        model_add_field (model, name_str, id, modifiers);

        release_string_utf_chars (env, name, name_str);
        delete_local_ref (env, name);
        delete_local_ref (env, field);
      }
    }
  }
  else
  {
    jobject elements;

    elements = call_object_method (env, class_handle, java_api.clazz.get_declared_methods);
    n = get_array_length (env, elements);
    for (i = 0; i != n; i++)
    {
      jobject method, name;
      const char * name_str;
      jmethodID id;
      jint modifiers;

      method = get_object_array_element (env, elements, i);
      name = call_object_method (env, method, java_api.method.get_name);
      name_str = get_string_utf_chars (env, name, NULL);
      id = from_reflected_method (env, method);
      modifiers = call_int_method (env, method, java_api.method.get_modifiers);

      model_add_method (model, name_str, id, modifiers);

      release_string_utf_chars (env, name, name_str);
      delete_local_ref (env, name);
      delete_local_ref (env, method);
    }
    delete_local_ref (env, elements);

    elements = call_object_method (env, class_handle, java_api.clazz.get_declared_fields);
    n = get_array_length (env, elements);
    for (i = 0; i != n; i++)
    {
      jobject field, name;
      const char * name_str;
      jfieldID id;
      jint modifiers;

      field = get_object_array_element (env, elements, i);
      name = call_object_method (env, field, java_api.field.get_name);
      name_str = get_string_utf_chars (env, name, NULL);
      id = from_reflected_field (env, field);
      modifiers = call_int_method (env, field, java_api.field.get_modifiers);

      model_add_field (model, name_str, id, modifiers);

      release_string_utf_chars (env, name, name_str);
      delete_local_ref (env, name);
      delete_local_ref (env, field);
    }
    delete_local_ref (env, elements);
  }

  g_mutex_lock (&lock);
  g_array_append_val (models, model);
  g_mutex_unlock (&lock);

  return model;
}

static void
model_add_method (Model * self,
                  const gchar * name,
                  jmethodID id,
                  jint modifiers)
{
  GHashTable * members = self->members;
  gchar * key, type;
  const gchar * value;

  if (name[0] == '$')
    key = g_strdup_printf ("_%s", name);
  else
    key = g_strdup (name);

  type = (modifiers & kAccStatic) != 0 ? 's' : 'i';

  value = g_hash_table_lookup (members, key);
  if (value == NULL)
    g_hash_table_insert (members, key, g_strdup_printf ("m:%c0x%zx", type, id));
  else
    g_hash_table_insert (members, key, g_strdup_printf ("%s:%c0x%zx", value, type, id));
}

static void
model_add_field (Model * self,
                 const gchar * name,
                 jfieldID id,
                 jint modifiers)
{
  GHashTable * members = self->members;
  gchar * key, type;

  if (name[0] == '$')
    key = g_strdup_printf ("_%s", name);
  else
    key = g_strdup (name);
  while (g_hash_table_contains (members, key))
  {
    gchar * new_key = g_strdup_printf ("_%s", key);
    g_free (key);
    key = new_key;
  }

  type = (modifiers & kAccStatic) != 0 ? 's' : 'i';

  g_hash_table_insert (members, key, g_strdup_printf ("f:%c0x%zx", type, id));
}

static void
model_free (Model * model)
{
  g_hash_table_unref (model->members);

  g_free (model);
}

gboolean
model_has (Model * self,
           const gchar * member)
{
  return g_hash_table_contains (self->members, member);
}

const gchar *
model_find (Model * self,
            const gchar * member)
{
  return g_hash_table_lookup (self->members, member);
}

gchar *
model_list (Model * self)
{
  GString * result;
  GHashTableIter iter;
  guint i;
  const gchar * name;

  result = g_string_sized_new (128);

  g_string_append_c (result, '[');

  g_hash_table_iter_init (&iter, self->members);
  for (i = 0; g_hash_table_iter_next (&iter, (gpointer *) &name, NULL); i++)
  {
    if (i > 0)
      g_string_append_c (result, ',');

    g_string_append_c (result, '"');
    g_string_append (result, name);
    g_string_append_c (result, '"');
  }

  g_string_append_c (result, ']');

  return g_string_free (result, FALSE);
}

gchar *
enumerate_methods_art (const gchar * class_query,
                       const gchar * method_query,
                       jboolean include_signature,
                       jboolean ignore_case,
                       jboolean skip_system_classes)
{
  gchar * result;
  EnumerateMethodsContext ctx;
  ArtClassVisitor visitor;
  ArtClassVisitorVTable visitor_vtable = { NULL, };

  ctx.class_query = make_pattern_spec (class_query, ignore_case);
  ctx.method_query = make_pattern_spec (method_query, ignore_case);
  ctx.include_signature = include_signature;
  ctx.ignore_case = ignore_case;
  ctx.skip_system_classes = skip_system_classes;
  ctx.groups = g_hash_table_new_full (NULL, NULL, NULL, NULL);

  visitor.vtable = &visitor_vtable;
  visitor.user_data = &ctx;

  visitor_vtable.visit = collect_matching_class_methods;

  art_api.visit_classes (art_api.linker, &visitor);

  result = finalize_method_groups_to_json (ctx.groups);

  g_hash_table_unref (ctx.groups);
  g_pattern_spec_free (ctx.method_query);
  g_pattern_spec_free (ctx.class_query);

  return result;
}

static jboolean
collect_matching_class_methods (ArtClassVisitor * self,
                                ArtClass * klass)
{
  EnumerateMethodsContext * ctx = self->user_data;
  const char * descriptor;
  StdString descriptor_storage = { 0, };
  gchar * class_name = NULL;
  gchar * class_name_copy = NULL;
  const gchar * normalized_class_name;
  JsonBuilder * group;
  size_t class_name_length;
  GHashTable * seen_method_names;
  gpointer elements;
  guint n, i;

  if (ctx->skip_system_classes && klass->class_loader == 0)
    goto skip_class;

  descriptor = art_api.get_class_descriptor (klass, &descriptor_storage);
  if (descriptor[0] != 'L')
    goto skip_class;

  class_name = class_name_from_signature (descriptor);

  if (ctx->ignore_case)
  {
    class_name_copy = g_utf8_strdown (class_name, -1);
    normalized_class_name = class_name_copy;
  }
  else
  {
    normalized_class_name = class_name;
  }

  if (!g_pattern_match_string (ctx->class_query, normalized_class_name))
    goto skip_class;

  group = NULL;
  class_name_length = strlen (class_name);
  seen_method_names = ctx->include_signature ? NULL : g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);

  elements = read_art_array (klass, art_api.class_offset_methods, sizeof (gsize), NULL);
  n = *(guint16 *) ((gpointer) klass + art_api.class_offset_copied_methods_offset);
  for (i = 0; i != n; i++)
  {
    ArtMethod * method;
    guint32 access_flags;
    jboolean is_constructor;
    StdString method_name = { 0, };
    const gchar * bare_method_name;
    gchar * bare_method_name_copy = NULL;
    const gchar * normalized_method_name;
    gchar * normalized_method_name_copy = NULL;

    method = elements + (i * art_api.method_size);

    access_flags = *(guint32 *) ((gpointer) method + art_api.method_offset_access_flags);
    is_constructor = (access_flags & kAccConstructor) != 0;

    art_api.pretty_method (&method_name, method, ctx->include_signature);
    bare_method_name = std_string_c_str (&method_name);
    if (ctx->include_signature)
    {
      const gchar * return_type_end, * name_begin;
      GString * name;

      return_type_end = strchr (bare_method_name, ' ');
      name_begin = return_type_end + 1 + class_name_length + 1;
      if (is_constructor && g_str_has_prefix (name_begin, "<clinit>"))
        goto skip_method;

      name = g_string_sized_new (64);

      if (is_constructor)
      {
        g_string_append (name, "$init");
        g_string_append (name, strchr (name_begin, '>') + 1);
      }
      else
      {
        g_string_append (name, name_begin);
      }
      g_string_append (name, ": ");
      g_string_append_len (name, bare_method_name, return_type_end - bare_method_name);

      bare_method_name_copy = g_string_free (name, FALSE);
      bare_method_name = bare_method_name_copy;
    }
    else
    {
      const gchar * name_begin;

      name_begin = bare_method_name + class_name_length + 1;
      if (is_constructor && strcmp (name_begin, "<clinit>") == 0)
        goto skip_method;

      if (is_constructor)
        bare_method_name = "$init";
      else
        bare_method_name += class_name_length + 1;
    }

    if (seen_method_names != NULL && g_hash_table_contains (seen_method_names, bare_method_name))
      goto skip_method;

    if (ctx->ignore_case)
    {
      normalized_method_name_copy = g_utf8_strdown (bare_method_name, -1);
      normalized_method_name = normalized_method_name_copy;
    }
    else
    {
      normalized_method_name = bare_method_name;
    }

    if (!g_pattern_match_string (ctx->method_query, normalized_method_name))
      goto skip_method;

    if (group == NULL)
    {
      group = g_hash_table_lookup (ctx->groups, GUINT_TO_POINTER (klass->class_loader));
      if (group == NULL)
      {
        group = json_builder_new_immutable ();
        g_hash_table_insert (ctx->groups, GUINT_TO_POINTER (klass->class_loader), group);

        json_builder_begin_object (group);

        json_builder_set_member_name (group, "loader");
        json_builder_add_int_value (group, klass->class_loader);

        json_builder_set_member_name (group, "classes");
        json_builder_begin_array (group);
      }

      json_builder_begin_object (group);

      json_builder_set_member_name (group, "name");
      json_builder_add_string_value (group, class_name);

      json_builder_set_member_name (group, "methods");
      json_builder_begin_array (group);
    }

    json_builder_add_string_value (group, bare_method_name);

    if (seen_method_names != NULL)
      g_hash_table_add (seen_method_names, g_strdup (bare_method_name));

skip_method:
    g_free (normalized_method_name_copy);
    g_free (bare_method_name_copy);
    std_string_destroy (&method_name);
  }

  if (seen_method_names != NULL)
    g_hash_table_unref (seen_method_names);

  if (group == NULL)
    goto skip_class;

  json_builder_end_array (group);
  json_builder_end_object (group);

skip_class:
  g_free (class_name_copy);
  g_free (class_name);
  std_string_destroy (&descriptor_storage);

  return TRUE;
}

gchar *
enumerate_methods_jvm (const gchar * class_query,
                       const gchar * method_query,
                       jboolean include_signature,
                       jboolean ignore_case,
                       jboolean skip_system_classes,
                       JNIEnv * env)
{
  gchar * result;
  GPatternSpec * class_pattern, * method_pattern;
  GHashTable * groups;
  gpointer * ef = env->functions;
  jobject (* new_global_ref) (JNIEnv *, jobject) = ef[21];
  void (* delete_local_ref) (JNIEnv *, jobject) = ef[23];
  jboolean (* is_same_object) (JNIEnv *, jobject, jobject) = ef[24];
  jvmtiEnv * jvmti = java_api.jvmti;
  gpointer * jf = jvmti->functions - 1;
  jvmtiError (* deallocate) (jvmtiEnv *, void * mem) = jf[47];
  jvmtiError (* get_class_signature) (jvmtiEnv *, jclass, char **, char **) = jf[48];
  jvmtiError (* get_class_methods) (jvmtiEnv *, jclass, jint *, jmethodID **) = jf[52];
  jvmtiError (* get_class_loader) (jvmtiEnv *, jclass, jobject *) = jf[57];
  jvmtiError (* get_method_name) (jvmtiEnv *, jmethodID, char **, char **, char **) = jf[64];
  jvmtiError (* get_loaded_classes) (jvmtiEnv *, jint *, jclass **) = jf[78];
  jint class_count, class_index;
  jclass * classes;

  class_pattern = make_pattern_spec (class_query, ignore_case);
  method_pattern = make_pattern_spec (method_query, ignore_case);
  groups = g_hash_table_new_full (NULL, NULL, NULL, NULL);

  if (get_loaded_classes (jvmti, &class_count, &classes) != JVMTI_ERROR_NONE)
    goto emit_results;

  for (class_index = 0; class_index != class_count; class_index++)
  {
    jclass klass = classes[class_index];
    jobject loader = NULL;
    gboolean have_loader = FALSE;
    char * signature = NULL;
    gchar * class_name = NULL;
    gchar * class_name_copy = NULL;
    const gchar * normalized_class_name;
    jint method_count, method_index;
    jmethodID * methods = NULL;
    JsonBuilder * group = NULL;
    GHashTable * seen_method_names = NULL;

    if (skip_system_classes)
    {
      if (get_class_loader (jvmti, klass, &loader) != JVMTI_ERROR_NONE)
        goto skip_class;
      have_loader = TRUE;

      if (loader == NULL)
        goto skip_class;
    }

    if (get_class_signature (jvmti, klass, &signature, NULL) != JVMTI_ERROR_NONE)
      goto skip_class;

    class_name = class_name_from_signature (signature);

    if (ignore_case)
    {
      class_name_copy = g_utf8_strdown (class_name, -1);
      normalized_class_name = class_name_copy;
    }
    else
    {
      normalized_class_name = class_name;
    }

    if (!g_pattern_match_string (class_pattern, normalized_class_name))
      goto skip_class;

    if (get_class_methods (jvmti, klass, &method_count, &methods) != JVMTI_ERROR_NONE)
      goto skip_class;

    if (!include_signature)
      seen_method_names = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);

    for (method_index = 0; method_index != method_count; method_index++)
    {
      jmethodID method = methods[method_index];
      const gchar * method_name;
      char * method_name_value = NULL;
      char * method_signature_value = NULL;
      gchar * method_name_copy = NULL;
      const gchar * normalized_method_name;
      gchar * normalized_method_name_copy = NULL;

      if (get_method_name (jvmti, method, &method_name_value, include_signature ? &method_signature_value : NULL, NULL) != JVMTI_ERROR_NONE)
        goto skip_method;
      method_name = method_name_value;

      if (method_name[0] == '<')
      {
        if (strcmp (method_name, "<init>") == 0)
          method_name = "$init";
        else if (strcmp (method_name, "<clinit>") == 0)
          goto skip_method;
      }

      if (include_signature)
      {
        method_name_copy = format_method_signature (method_name, method_signature_value);
        method_name = method_name_copy;
      }

      if (seen_method_names != NULL && g_hash_table_contains (seen_method_names, method_name))
        goto skip_method;

      if (ignore_case)
      {
        normalized_method_name_copy = g_utf8_strdown (method_name, -1);
        normalized_method_name = normalized_method_name_copy;
      }
      else
      {
        normalized_method_name = method_name;
      }

      if (!g_pattern_match_string (method_pattern, normalized_method_name))
        goto skip_method;

      if (group == NULL)
      {
        if (!have_loader && get_class_loader (jvmti, klass, &loader) != JVMTI_ERROR_NONE)
          goto skip_method;

        if (loader == NULL)
        {
          group = g_hash_table_lookup (groups, NULL);
        }
        else
        {
          GHashTableIter iter;
          jobject cur_loader;
          JsonBuilder * cur_group;

          g_hash_table_iter_init (&iter, groups);
          while (g_hash_table_iter_next (&iter, (gpointer *) &cur_loader, (gpointer *) &cur_group))
          {
            if (cur_loader != NULL && is_same_object (env, cur_loader, loader))
            {
              group = cur_group;
              break;
            }
          }
        }

        if (group == NULL)
        {
          jobject l;
          gchar * str;

          l = (loader != NULL) ? new_global_ref (env, loader) : NULL;

          group = json_builder_new_immutable ();
          g_hash_table_insert (groups, l, group);

          json_builder_begin_object (group);

          json_builder_set_member_name (group, "loader");
          str = g_strdup_printf ("0x%" G_GSIZE_MODIFIER "x", GPOINTER_TO_SIZE (l));
          json_builder_add_string_value (group, str);
          g_free (str);

          json_builder_set_member_name (group, "classes");
          json_builder_begin_array (group);
        }

        json_builder_begin_object (group);

        json_builder_set_member_name (group, "name");
        json_builder_add_string_value (group, class_name);

        json_builder_set_member_name (group, "methods");
        json_builder_begin_array (group);
      }

      json_builder_add_string_value (group, method_name);

      if (seen_method_names != NULL)
        g_hash_table_add (seen_method_names, g_strdup (method_name));

skip_method:
      g_free (normalized_method_name_copy);
      g_free (method_name_copy);
      deallocate (jvmti, method_signature_value);
      deallocate (jvmti, method_name_value);
    }

skip_class:
    if (group != NULL)
    {
      json_builder_end_array (group);
      json_builder_end_object (group);
    }

    if (seen_method_names != NULL)
      g_hash_table_unref (seen_method_names);

    deallocate (jvmti, methods);

    g_free (class_name_copy);
    g_free (class_name);
    deallocate (jvmti, signature);

    if (loader != NULL)
      delete_local_ref (env, loader);

    delete_local_ref (env, klass);
  }

  deallocate (jvmti, classes);

emit_results:
  result = finalize_method_groups_to_json (groups);

  g_hash_table_unref (groups);
  g_pattern_spec_free (method_pattern);
  g_pattern_spec_free (class_pattern);

  return result;
}

static gchar *
finalize_method_groups_to_json (GHashTable * groups)
{
  GString * result;
  GHashTableIter iter;
  guint i;
  JsonBuilder * group;

  result = g_string_sized_new (1024);

  g_string_append_c (result, '[');

  g_hash_table_iter_init (&iter, groups);
  for (i = 0; g_hash_table_iter_next (&iter, NULL, (gpointer *) &group); i++)
  {
    JsonNode * root;
    gchar * json;

    if (i > 0)
      g_string_append_c (result, ',');

    json_builder_end_array (group);
    json_builder_end_object (group);

    root = json_builder_get_root (group);
    json = json_to_string (root, FALSE);
    g_string_append (result, json);
    g_free (json);
    json_node_unref (root);

    g_object_unref (group);
  }

  g_string_append_c (result, ']');

  return g_string_free (result, FALSE);
}

static GPatternSpec *
make_pattern_spec (const gchar * pattern,
                   jboolean ignore_case)
{
  GPatternSpec * spec;

  if (ignore_case)
  {
    gchar * str = g_utf8_strdown (pattern, -1);
    spec = g_pattern_spec_new (str);
    g_free (str);
  }
  else
  {
    spec = g_pattern_spec_new (pattern);
  }

  return spec;
}

static gchar *
class_name_from_signature (const gchar * descriptor)
{
  gchar * result, * c;

  result = g_strdup (descriptor + 1);

  for (c = result; *c != '\\0'; c++)
  {
    if (*c == '/')
      *c = '.';
  }

  c[-1] = '\\0';

  return result;
}

static gchar *
format_method_signature (const gchar * name,
                         const gchar * signature)
{
  GString * sig;
  const gchar * cursor;
  gint arg_index;

  sig = g_string_sized_new (128);

  g_string_append (sig, name);

  cursor = signature;
  arg_index = -1;
  while (TRUE)
  {
    const gchar c = *cursor;

    if (c == '(')
    {
      g_string_append_c (sig, c);
      cursor++;
      arg_index = 0;
    }
    else if (c == ')')
    {
      g_string_append_c (sig, c);
      cursor++;
      break;
    }
    else
    {
      if (arg_index >= 1)
        g_string_append (sig, ", ");

      append_type (sig, &cursor);

      if (arg_index != -1)
        arg_index++;
    }
  }

  g_string_append (sig, ": ");
  append_type (sig, &cursor);

  return g_string_free (sig, FALSE);
}

static void
append_type (GString * output,
             const gchar ** type)
{
  const gchar * cursor = *type;

  switch (*cursor)
  {
    case 'Z':
      g_string_append (output, "boolean");
      cursor++;
      break;
    case 'B':
      g_string_append (output, "byte");
      cursor++;
      break;
    case 'C':
      g_string_append (output, "char");
      cursor++;
      break;
    case 'S':
      g_string_append (output, "short");
      cursor++;
      break;
    case 'I':
      g_string_append (output, "int");
      cursor++;
      break;
    case 'J':
      g_string_append (output, "long");
      cursor++;
      break;
    case 'F':
      g_string_append (output, "float");
      cursor++;
      break;
    case 'D':
      g_string_append (output, "double");
      cursor++;
      break;
    case 'V':
      g_string_append (output, "void");
      cursor++;
      break;
    case 'L':
    {
      gchar ch;

      cursor++;
      for (; (ch = *cursor) != ';'; cursor++)
      {
        g_string_append_c (output, (ch != '/') ? ch : '.');
      }
      cursor++;

      break;
    }
    case '[':
      *type = cursor + 1;
      append_type (output, type);
      g_string_append (output, "[]");
      return;
    default:
      g_string_append (output, "BUG");
      cursor++;
  }

  *type = cursor;
}

void
dealloc (gpointer mem)
{
  g_free (mem);
}

static gpointer
read_art_array (gpointer object_base,
                guint field_offset,
                guint length_size,
                guint * length)
{
  gpointer result, header;
  guint n;

  header = GSIZE_TO_POINTER (*(guint64 *) (object_base + field_offset));
  if (header != NULL)
  {
    result = header + length_size;
    if (length_size == sizeof (guint32))
      n = *(guint32 *) header;
    else
      n = *(guint64 *) header;
  }
  else
  {
    result = NULL;
    n = 0;
  }

  if (length != NULL)
    *length = n;

  return result;
}

static void
std_string_destroy (StdString * str)
{
  if ((str->l.capacity & 1) != 0)
    art_api.free (str->l.data);
}

static gchar *
std_string_c_str (StdString * self)
{
  if ((self->l.capacity & 1) != 0)
    return self->l.data;

  return self->s.data;
}
`;
    methodQueryPattern = /(.+)!([^/]+)\/?([isu]+)?/;
    cm = null;
    unwrap = null;
    Model = class _Model {
      static build(handle2, env2) {
        ensureInitialized(env2);
        return unwrap(handle2, env2, (object) => {
          return new _Model(cm.new(handle2, object, env2));
        });
      }
      static enumerateMethods(query, api3, env2) {
        ensureInitialized(env2);
        const params = query.match(methodQueryPattern);
        if (params === null) {
          throw new Error("Invalid query; format is: class!method -- see documentation of Java.enumerateMethods(query) for details");
        }
        const classQuery = Memory.allocUtf8String(params[1]);
        const methodQuery = Memory.allocUtf8String(params[2]);
        let includeSignature = false;
        let ignoreCase = false;
        let skipSystemClasses = false;
        const modifiers2 = params[3];
        if (modifiers2 !== void 0) {
          includeSignature = modifiers2.indexOf("s") !== -1;
          ignoreCase = modifiers2.indexOf("i") !== -1;
          skipSystemClasses = modifiers2.indexOf("u") !== -1;
        }
        let result2;
        if (api3.jvmti !== null) {
          const json = cm.enumerateMethodsJvm(
            classQuery,
            methodQuery,
            boolToNative(includeSignature),
            boolToNative(ignoreCase),
            boolToNative(skipSystemClasses),
            env2
          );
          try {
            result2 = JSON.parse(json.readUtf8String()).map((group) => {
              const loaderRef = ptr(group.loader);
              group.loader = !loaderRef.isNull() ? loaderRef : null;
              return group;
            });
          } finally {
            cm.dealloc(json);
          }
        } else {
          withRunnableArtThread(env2.vm, env2, (thread) => {
            const json = cm.enumerateMethodsArt(
              classQuery,
              methodQuery,
              boolToNative(includeSignature),
              boolToNative(ignoreCase),
              boolToNative(skipSystemClasses)
            );
            try {
              const addGlobalReference = api3["art::JavaVMExt::AddGlobalRef"];
              const { vm: vmHandle } = api3;
              result2 = JSON.parse(json.readUtf8String()).map((group) => {
                const loaderObj = group.loader;
                group.loader = loaderObj !== 0 ? addGlobalReference(vmHandle, thread, ptr(loaderObj)) : null;
                return group;
              });
            } finally {
              cm.dealloc(json);
            }
          });
        }
        return result2;
      }
      constructor(handle2) {
        this.handle = handle2;
      }
      has(member) {
        return cm.has(this.handle, Memory.allocUtf8String(member)) !== 0;
      }
      find(member) {
        return cm.find(this.handle, Memory.allocUtf8String(member)).readUtf8String();
      }
      list() {
        const str = cm.list(this.handle);
        try {
          return JSON.parse(str.readUtf8String());
        } finally {
          cm.dealloc(str);
        }
      }
    };
  }
});

// node_modules/frida-java-bridge/lib/lru.js
var LRU;
var init_lru = __esm({
  "node_modules/frida-java-bridge/lib/lru.js"() {
    "use strict";
    init_node_globals();
    LRU = class {
      constructor(capacity, destroy) {
        this.items = /* @__PURE__ */ new Map();
        this.capacity = capacity;
        this.destroy = destroy;
      }
      dispose(env2) {
        const { items, destroy } = this;
        items.forEach((val) => {
          destroy(val, env2);
        });
        items.clear();
      }
      get(key) {
        const { items } = this;
        const item = items.get(key);
        if (item !== void 0) {
          items.delete(key);
          items.set(key, item);
        }
        return item;
      }
      set(key, val, env2) {
        const { items } = this;
        const existingVal = items.get(key);
        if (existingVal !== void 0) {
          items.delete(key);
          this.destroy(existingVal, env2);
        } else if (items.size === this.capacity) {
          const oldestKey = items.keys().next().value;
          const oldestVal = items.get(oldestKey);
          items.delete(oldestKey);
          this.destroy(oldestVal, env2);
        }
        items.set(key, val);
      }
    };
  }
});

// node_modules/frida-java-bridge/lib/mkdex.js
function mkdex(spec) {
  const builder = new DexBuilder();
  const fullSpec = Object.assign({}, spec);
  builder.addClass(fullSpec);
  return builder.build();
}
function makeClassData(klass) {
  const { instanceFields, constructorMethods, virtualMethods } = klass.classData;
  const staticFieldsSize = 0;
  return Buffer2.from([
    staticFieldsSize
  ].concat(createUleb128(instanceFields.length)).concat(createUleb128(constructorMethods.length)).concat(createUleb128(virtualMethods.length)).concat(instanceFields.reduce((result2, [indexDiff, accessFlags]) => {
    return result2.concat(createUleb128(indexDiff)).concat(createUleb128(accessFlags));
  }, [])).concat(constructorMethods.reduce((result2, [indexDiff, accessFlags, , codeOffset]) => {
    return result2.concat(createUleb128(indexDiff)).concat(createUleb128(accessFlags)).concat(createUleb128(codeOffset || 0));
  }, [])).concat(virtualMethods.reduce((result2, [indexDiff, accessFlags]) => {
    const codeOffset = 0;
    return result2.concat(createUleb128(indexDiff)).concat(createUleb128(accessFlags)).concat([codeOffset]);
  }, [])));
}
function makeThrowsAnnotation(annotation) {
  const { thrownTypes } = annotation;
  return Buffer2.from(
    [
      VISIBILITY_SYSTEM
    ].concat(createUleb128(annotation.type)).concat([1]).concat(createUleb128(annotation.value)).concat([VALUE_ARRAY, thrownTypes.length]).concat(thrownTypes.reduce((result2, type) => {
      result2.push(VALUE_TYPE, type);
      return result2;
    }, []))
  );
}
function computeModel(classes) {
  const strings = /* @__PURE__ */ new Set();
  const types2 = /* @__PURE__ */ new Set();
  const protos = {};
  const fields = [];
  const methods = [];
  const throwsAnnotations = {};
  const javaConstructors = /* @__PURE__ */ new Set();
  const superConstructors = /* @__PURE__ */ new Set();
  classes.forEach((klass) => {
    const { name: name2, superClass, sourceFileName } = klass;
    strings.add("this");
    strings.add(name2);
    types2.add(name2);
    strings.add(superClass);
    types2.add(superClass);
    strings.add(sourceFileName);
    klass.interfaces.forEach((iface) => {
      strings.add(iface);
      types2.add(iface);
    });
    klass.fields.forEach((field) => {
      const [fieldName, fieldType] = field;
      strings.add(fieldName);
      strings.add(fieldType);
      types2.add(fieldType);
      fields.push([klass.name, fieldType, fieldName]);
    });
    if (!klass.methods.some(([methodName]) => methodName === "<init>")) {
      klass.methods.unshift(["<init>", "V", []]);
      javaConstructors.add(name2);
    }
    klass.methods.forEach((method2) => {
      const [methodName, retType2, argTypes2, thrownTypes = [], accessFlags] = method2;
      strings.add(methodName);
      const protoId = addProto(retType2, argTypes2);
      let throwsAnnotationId = null;
      if (thrownTypes.length > 0) {
        const typesNormalized = thrownTypes.slice();
        typesNormalized.sort();
        throwsAnnotationId = typesNormalized.join("|");
        let throwsAnnotation = throwsAnnotations[throwsAnnotationId];
        if (throwsAnnotation === void 0) {
          throwsAnnotation = {
            id: throwsAnnotationId,
            types: typesNormalized
          };
          throwsAnnotations[throwsAnnotationId] = throwsAnnotation;
        }
        strings.add(kDalvikAnnotationTypeThrows);
        types2.add(kDalvikAnnotationTypeThrows);
        thrownTypes.forEach((type) => {
          strings.add(type);
          types2.add(type);
        });
        strings.add("value");
      }
      methods.push([klass.name, protoId, methodName, throwsAnnotationId, accessFlags]);
      if (methodName === "<init>") {
        superConstructors.add(name2 + "|" + protoId);
        const superConstructorId = superClass + "|" + protoId;
        if (javaConstructors.has(name2) && !superConstructors.has(superConstructorId)) {
          methods.push([superClass, protoId, methodName, null, 0]);
          superConstructors.add(superConstructorId);
        }
      }
    });
  });
  function addProto(retType2, argTypes2) {
    const signature2 = [retType2].concat(argTypes2);
    const id = signature2.join("|");
    if (protos[id] !== void 0) {
      return id;
    }
    strings.add(retType2);
    types2.add(retType2);
    argTypes2.forEach((argType) => {
      strings.add(argType);
      types2.add(argType);
    });
    const shorty = signature2.map(typeToShorty).join("");
    strings.add(shorty);
    protos[id] = [id, shorty, retType2, argTypes2];
    return id;
  }
  const stringItems = Array.from(strings);
  stringItems.sort();
  const stringToIndex = stringItems.reduce((result2, string, index) => {
    result2[string] = index;
    return result2;
  }, {});
  const typeItems = Array.from(types2).map((name2) => stringToIndex[name2]);
  typeItems.sort(compareNumbers);
  const typeToIndex = typeItems.reduce((result2, stringIndex, typeIndex) => {
    result2[stringItems[stringIndex]] = typeIndex;
    return result2;
  }, {});
  const literalProtoItems = Object.keys(protos).map((id) => protos[id]);
  literalProtoItems.sort(compareProtoItems);
  const parameters = {};
  const protoItems = literalProtoItems.map((item) => {
    const [, shorty, retType2, argTypes2] = item;
    let params;
    if (argTypes2.length > 0) {
      const argTypesSig = argTypes2.join("|");
      params = parameters[argTypesSig];
      if (params === void 0) {
        params = {
          types: argTypes2.map((type) => typeToIndex[type]),
          offset: -1
        };
        parameters[argTypesSig] = params;
      }
    } else {
      params = null;
    }
    return [
      stringToIndex[shorty],
      typeToIndex[retType2],
      params
    ];
  });
  const protoToIndex = literalProtoItems.reduce((result2, item, index) => {
    const [id] = item;
    result2[id] = index;
    return result2;
  }, {});
  const parameterItems = Object.keys(parameters).map((id) => parameters[id]);
  const fieldItems = fields.map((field) => {
    const [klass, fieldType, fieldName] = field;
    return [
      typeToIndex[klass],
      typeToIndex[fieldType],
      stringToIndex[fieldName]
    ];
  });
  fieldItems.sort(compareFieldItems);
  const methodItems = methods.map((method2) => {
    const [klass, protoId, name2, annotationsId, accessFlags] = method2;
    return [
      typeToIndex[klass],
      protoToIndex[protoId],
      stringToIndex[name2],
      annotationsId,
      accessFlags
    ];
  });
  methodItems.sort(compareMethodItems);
  const throwsAnnotationItems = Object.keys(throwsAnnotations).map((id) => throwsAnnotations[id]).map((item) => {
    return {
      id: item.id,
      type: typeToIndex[kDalvikAnnotationTypeThrows],
      value: stringToIndex.value,
      thrownTypes: item.types.map((type) => typeToIndex[type]),
      offset: -1
    };
  });
  const annotationSetItems = throwsAnnotationItems.map((item) => {
    return {
      id: item.id,
      items: [item],
      offset: -1
    };
  });
  const annotationSetIdToIndex = annotationSetItems.reduce((result2, item, index) => {
    result2[item.id] = index;
    return result2;
  }, {});
  const interfaceLists = {};
  const annotationDirectories = [];
  const classItems = classes.map((klass) => {
    const classIndex = typeToIndex[klass.name];
    const accessFlags = kAccPublic2;
    const superClassIndex = typeToIndex[klass.superClass];
    let ifaceList;
    const ifaces = klass.interfaces.map((type) => typeToIndex[type]);
    if (ifaces.length > 0) {
      ifaces.sort(compareNumbers);
      const ifacesId = ifaces.join("|");
      ifaceList = interfaceLists[ifacesId];
      if (ifaceList === void 0) {
        ifaceList = {
          types: ifaces,
          offset: -1
        };
        interfaceLists[ifacesId] = ifaceList;
      }
    } else {
      ifaceList = null;
    }
    const sourceFileIndex = stringToIndex[klass.sourceFileName];
    const classMethods = methodItems.reduce((result2, method2, index) => {
      const [holder, protoIndex, name2, annotationsId, accessFlags2] = method2;
      if (holder === classIndex) {
        result2.push([index, name2, annotationsId, protoIndex, accessFlags2]);
      }
      return result2;
    }, []);
    let annotationsDirectory = null;
    const methodAnnotations = classMethods.filter(([, , annotationsId]) => {
      return annotationsId !== null;
    }).map(([index, , annotationsId]) => {
      return [index, annotationSetItems[annotationSetIdToIndex[annotationsId]]];
    });
    if (methodAnnotations.length > 0) {
      annotationsDirectory = {
        methods: methodAnnotations,
        offset: -1
      };
      annotationDirectories.push(annotationsDirectory);
    }
    const instanceFields = fieldItems.reduce((result2, field, index) => {
      const [holder] = field;
      if (holder === classIndex) {
        result2.push([index > 0 ? 1 : 0, kAccPublic2]);
      }
      return result2;
    }, []);
    const constructorNameIndex = stringToIndex["<init>"];
    const constructorMethods = classMethods.filter(([, name2]) => name2 === constructorNameIndex).map(([index, , , protoIndex]) => {
      if (javaConstructors.has(klass.name)) {
        let superConstructor = -1;
        const numMethodItems = methodItems.length;
        for (let i = 0; i !== numMethodItems; i++) {
          const [methodClass, methodProto, methodName] = methodItems[i];
          if (methodClass === superClassIndex && methodName === constructorNameIndex && methodProto === protoIndex) {
            superConstructor = i;
            break;
          }
        }
        return [index, kAccPublic2 | kAccConstructor, superConstructor];
      } else {
        return [index, kAccPublic2 | kAccConstructor | kAccNative2, -1];
      }
    });
    const virtualMethods = compressClassMethodIndexes(classMethods.filter(([, name2]) => name2 !== constructorNameIndex).map(([index, , , , accessFlags2]) => {
      return [index, accessFlags2 | kAccPublic2 | kAccNative2];
    }));
    const classData = {
      instanceFields,
      constructorMethods,
      virtualMethods,
      offset: -1
    };
    return {
      index: classIndex,
      accessFlags,
      superClassIndex,
      interfaces: ifaceList,
      sourceFileIndex,
      annotationsDirectory,
      classData
    };
  });
  const interfaceItems = Object.keys(interfaceLists).map((id) => interfaceLists[id]);
  return {
    classes: classItems,
    interfaces: interfaceItems,
    fields: fieldItems,
    methods: methodItems,
    protos: protoItems,
    parameters: parameterItems,
    annotationDirectories,
    annotationSets: annotationSetItems,
    throwsAnnotations: throwsAnnotationItems,
    types: typeItems,
    strings: stringItems
  };
}
function compressClassMethodIndexes(items) {
  let previousIndex = 0;
  return items.map(([index, accessFlags], elementIndex) => {
    let result2;
    if (elementIndex === 0) {
      result2 = [index, accessFlags];
    } else {
      result2 = [index - previousIndex, accessFlags];
    }
    previousIndex = index;
    return result2;
  });
}
function compareNumbers(a, b) {
  return a - b;
}
function compareProtoItems(a, b) {
  const [, , aRetType, aArgTypes] = a;
  const [, , bRetType, bArgTypes] = b;
  if (aRetType < bRetType) {
    return -1;
  }
  if (aRetType > bRetType) {
    return 1;
  }
  const aArgTypesSig = aArgTypes.join("|");
  const bArgTypesSig = bArgTypes.join("|");
  if (aArgTypesSig < bArgTypesSig) {
    return -1;
  }
  if (aArgTypesSig > bArgTypesSig) {
    return 1;
  }
  return 0;
}
function compareFieldItems(a, b) {
  const [aClass, aType, aName] = a;
  const [bClass, bType, bName] = b;
  if (aClass !== bClass) {
    return aClass - bClass;
  }
  if (aName !== bName) {
    return aName - bName;
  }
  return aType - bType;
}
function compareMethodItems(a, b) {
  const [aClass, aProto, aName] = a;
  const [bClass, bProto, bName] = b;
  if (aClass !== bClass) {
    return aClass - bClass;
  }
  if (aName !== bName) {
    return aName - bName;
  }
  return aProto - bProto;
}
function typeToShorty(type) {
  const firstCharacter = type[0];
  return firstCharacter === "L" || firstCharacter === "[" ? "L" : type;
}
function createUleb128(value) {
  if (value <= 127) {
    return [value];
  }
  const result2 = [];
  let moreSlicesNeeded = false;
  do {
    let slice2 = value & 127;
    value >>= 7;
    moreSlicesNeeded = value !== 0;
    if (moreSlicesNeeded) {
      slice2 |= 128;
    }
    result2.push(slice2);
  } while (moreSlicesNeeded);
  return result2;
}
function align2(value, alignment) {
  const alignmentDelta = value % alignment;
  if (alignmentDelta === 0) {
    return value;
  }
  return value + alignment - alignmentDelta;
}
function adler32(buffer, offset) {
  let a = 1;
  let b = 0;
  const length = buffer.length;
  for (let i = offset; i < length; i++) {
    a = (a + buffer[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16 | a) >>> 0;
}
var kAccPublic2, kAccNative2, kAccConstructor, kEndianTag, kClassDefSize, kProtoIdSize, kFieldIdSize, kMethodIdSize, kTypeIdSize, kStringIdSize, kMapItemSize, TYPE_HEADER_ITEM, TYPE_STRING_ID_ITEM, TYPE_TYPE_ID_ITEM, TYPE_PROTO_ID_ITEM, TYPE_FIELD_ID_ITEM, TYPE_METHOD_ID_ITEM, TYPE_CLASS_DEF_ITEM, TYPE_MAP_LIST, TYPE_TYPE_LIST, TYPE_ANNOTATION_SET_ITEM, TYPE_CLASS_DATA_ITEM, TYPE_CODE_ITEM, TYPE_STRING_DATA_ITEM, TYPE_DEBUG_INFO_ITEM, TYPE_ANNOTATION_ITEM, TYPE_ANNOTATIONS_DIRECTORY_ITEM, VALUE_TYPE, VALUE_ARRAY, VISIBILITY_SYSTEM, kDefaultConstructorSize, kDefaultConstructorDebugInfo, kDalvikAnnotationTypeThrows, kNullTerminator, DexBuilder, mkdex_default;
var init_mkdex = __esm({
  "node_modules/frida-java-bridge/lib/mkdex.js"() {
    "use strict";
    init_node_globals();
    init_buffer();
    kAccPublic2 = 1;
    kAccNative2 = 256;
    kAccConstructor = 65536;
    kEndianTag = 305419896;
    kClassDefSize = 32;
    kProtoIdSize = 12;
    kFieldIdSize = 8;
    kMethodIdSize = 8;
    kTypeIdSize = 4;
    kStringIdSize = 4;
    kMapItemSize = 12;
    TYPE_HEADER_ITEM = 0;
    TYPE_STRING_ID_ITEM = 1;
    TYPE_TYPE_ID_ITEM = 2;
    TYPE_PROTO_ID_ITEM = 3;
    TYPE_FIELD_ID_ITEM = 4;
    TYPE_METHOD_ID_ITEM = 5;
    TYPE_CLASS_DEF_ITEM = 6;
    TYPE_MAP_LIST = 4096;
    TYPE_TYPE_LIST = 4097;
    TYPE_ANNOTATION_SET_ITEM = 4099;
    TYPE_CLASS_DATA_ITEM = 8192;
    TYPE_CODE_ITEM = 8193;
    TYPE_STRING_DATA_ITEM = 8194;
    TYPE_DEBUG_INFO_ITEM = 8195;
    TYPE_ANNOTATION_ITEM = 8196;
    TYPE_ANNOTATIONS_DIRECTORY_ITEM = 8198;
    VALUE_TYPE = 24;
    VALUE_ARRAY = 28;
    VISIBILITY_SYSTEM = 2;
    kDefaultConstructorSize = 24;
    kDefaultConstructorDebugInfo = Buffer2.from([3, 0, 7, 14, 0]);
    kDalvikAnnotationTypeThrows = "Ldalvik/annotation/Throws;";
    kNullTerminator = Buffer2.from([0]);
    DexBuilder = class {
      constructor() {
        this.classes = [];
      }
      addClass(spec) {
        this.classes.push(spec);
      }
      build() {
        const model = computeModel(this.classes);
        const {
          classes,
          interfaces,
          fields,
          methods,
          protos,
          parameters,
          annotationDirectories,
          annotationSets,
          throwsAnnotations,
          types: types2,
          strings
        } = model;
        let offset = 0;
        const headerOffset = 0;
        const checksumOffset = 8;
        const signatureOffset = 12;
        const signatureSize = 20;
        const headerSize = 112;
        offset += headerSize;
        const stringIdsOffset = offset;
        const stringIdsSize = strings.length * kStringIdSize;
        offset += stringIdsSize;
        const typeIdsOffset = offset;
        const typeIdsSize = types2.length * kTypeIdSize;
        offset += typeIdsSize;
        const protoIdsOffset = offset;
        const protoIdsSize = protos.length * kProtoIdSize;
        offset += protoIdsSize;
        const fieldIdsOffset = offset;
        const fieldIdsSize = fields.length * kFieldIdSize;
        offset += fieldIdsSize;
        const methodIdsOffset = offset;
        const methodIdsSize = methods.length * kMethodIdSize;
        offset += methodIdsSize;
        const classDefsOffset = offset;
        const classDefsSize = classes.length * kClassDefSize;
        offset += classDefsSize;
        const dataOffset = offset;
        const annotationSetOffsets = annotationSets.map((set) => {
          const setOffset = offset;
          set.offset = setOffset;
          offset += 4 + set.items.length * 4;
          return setOffset;
        });
        const javaCodeItems = classes.reduce((result2, klass) => {
          const constructorMethods = klass.classData.constructorMethods;
          constructorMethods.forEach((method2) => {
            const [, accessFlags, superConstructor] = method2;
            if ((accessFlags & kAccNative2) === 0 && superConstructor >= 0) {
              method2.push(offset);
              result2.push({ offset, superConstructor });
              offset += kDefaultConstructorSize;
            }
          });
          return result2;
        }, []);
        annotationDirectories.forEach((dir) => {
          dir.offset = offset;
          offset += 16 + dir.methods.length * 8;
        });
        const interfaceOffsets = interfaces.map((iface) => {
          offset = align2(offset, 4);
          const ifaceOffset = offset;
          iface.offset = ifaceOffset;
          offset += 4 + 2 * iface.types.length;
          return ifaceOffset;
        });
        const parameterOffsets = parameters.map((param) => {
          offset = align2(offset, 4);
          const paramOffset = offset;
          param.offset = paramOffset;
          offset += 4 + 2 * param.types.length;
          return paramOffset;
        });
        const stringChunks = [];
        const stringOffsets = strings.map((str) => {
          const strOffset = offset;
          const header = Buffer2.from(createUleb128(str.length));
          const data = Buffer2.from(str, "utf8");
          const chunk = Buffer2.concat([header, data, kNullTerminator]);
          stringChunks.push(chunk);
          offset += chunk.length;
          return strOffset;
        });
        const debugInfoOffsets = javaCodeItems.map((codeItem) => {
          const debugOffset = offset;
          offset += kDefaultConstructorDebugInfo.length;
          return debugOffset;
        });
        const throwsAnnotationBlobs = throwsAnnotations.map((annotation) => {
          const blob = makeThrowsAnnotation(annotation);
          annotation.offset = offset;
          offset += blob.length;
          return blob;
        });
        const classDataBlobs = classes.map((klass, index) => {
          klass.classData.offset = offset;
          const blob = makeClassData(klass);
          offset += blob.length;
          return blob;
        });
        const linkSize = 0;
        const linkOffset = 0;
        offset = align2(offset, 4);
        const mapOffset = offset;
        const typeListLength = interfaces.length + parameters.length;
        const mapNumItems = 4 + (fields.length > 0 ? 1 : 0) + 2 + annotationSets.length + javaCodeItems.length + annotationDirectories.length + (typeListLength > 0 ? 1 : 0) + 1 + debugInfoOffsets.length + throwsAnnotations.length + classes.length + 1;
        const mapSize = 4 + mapNumItems * kMapItemSize;
        offset += mapSize;
        const dataSize = offset - dataOffset;
        const fileSize = offset;
        const dex = Buffer2.alloc(fileSize);
        dex.write("dex\n035");
        dex.writeUInt32LE(fileSize, 32);
        dex.writeUInt32LE(headerSize, 36);
        dex.writeUInt32LE(kEndianTag, 40);
        dex.writeUInt32LE(linkSize, 44);
        dex.writeUInt32LE(linkOffset, 48);
        dex.writeUInt32LE(mapOffset, 52);
        dex.writeUInt32LE(strings.length, 56);
        dex.writeUInt32LE(stringIdsOffset, 60);
        dex.writeUInt32LE(types2.length, 64);
        dex.writeUInt32LE(typeIdsOffset, 68);
        dex.writeUInt32LE(protos.length, 72);
        dex.writeUInt32LE(protoIdsOffset, 76);
        dex.writeUInt32LE(fields.length, 80);
        dex.writeUInt32LE(fields.length > 0 ? fieldIdsOffset : 0, 84);
        dex.writeUInt32LE(methods.length, 88);
        dex.writeUInt32LE(methodIdsOffset, 92);
        dex.writeUInt32LE(classes.length, 96);
        dex.writeUInt32LE(classDefsOffset, 100);
        dex.writeUInt32LE(dataSize, 104);
        dex.writeUInt32LE(dataOffset, 108);
        stringOffsets.forEach((offset2, index) => {
          dex.writeUInt32LE(offset2, stringIdsOffset + index * kStringIdSize);
        });
        types2.forEach((id, index) => {
          dex.writeUInt32LE(id, typeIdsOffset + index * kTypeIdSize);
        });
        protos.forEach((proto, index) => {
          const [shortyIndex, returnTypeIndex, params] = proto;
          const protoOffset = protoIdsOffset + index * kProtoIdSize;
          dex.writeUInt32LE(shortyIndex, protoOffset);
          dex.writeUInt32LE(returnTypeIndex, protoOffset + 4);
          dex.writeUInt32LE(params !== null ? params.offset : 0, protoOffset + 8);
        });
        fields.forEach((field, index) => {
          const [classIndex, typeIndex, nameIndex] = field;
          const fieldOffset = fieldIdsOffset + index * kFieldIdSize;
          dex.writeUInt16LE(classIndex, fieldOffset);
          dex.writeUInt16LE(typeIndex, fieldOffset + 2);
          dex.writeUInt32LE(nameIndex, fieldOffset + 4);
        });
        methods.forEach((method2, index) => {
          const [classIndex, protoIndex, nameIndex] = method2;
          const methodOffset = methodIdsOffset + index * kMethodIdSize;
          dex.writeUInt16LE(classIndex, methodOffset);
          dex.writeUInt16LE(protoIndex, methodOffset + 2);
          dex.writeUInt32LE(nameIndex, methodOffset + 4);
        });
        classes.forEach((klass, index) => {
          const { interfaces: interfaces2, annotationsDirectory } = klass;
          const interfacesOffset = interfaces2 !== null ? interfaces2.offset : 0;
          const annotationsOffset = annotationsDirectory !== null ? annotationsDirectory.offset : 0;
          const staticValuesOffset = 0;
          const classOffset = classDefsOffset + index * kClassDefSize;
          dex.writeUInt32LE(klass.index, classOffset);
          dex.writeUInt32LE(klass.accessFlags, classOffset + 4);
          dex.writeUInt32LE(klass.superClassIndex, classOffset + 8);
          dex.writeUInt32LE(interfacesOffset, classOffset + 12);
          dex.writeUInt32LE(klass.sourceFileIndex, classOffset + 16);
          dex.writeUInt32LE(annotationsOffset, classOffset + 20);
          dex.writeUInt32LE(klass.classData.offset, classOffset + 24);
          dex.writeUInt32LE(staticValuesOffset, classOffset + 28);
        });
        annotationSets.forEach((set, index) => {
          const { items } = set;
          const setOffset = annotationSetOffsets[index];
          dex.writeUInt32LE(items.length, setOffset);
          items.forEach((item, index2) => {
            dex.writeUInt32LE(item.offset, setOffset + 4 + index2 * 4);
          });
        });
        javaCodeItems.forEach((codeItem, index) => {
          const { offset: offset2, superConstructor } = codeItem;
          const registersSize = 1;
          const insSize = 1;
          const outsSize = 1;
          const triesSize = 0;
          const insnsSize = 4;
          dex.writeUInt16LE(registersSize, offset2);
          dex.writeUInt16LE(insSize, offset2 + 2);
          dex.writeUInt16LE(outsSize, offset2 + 4);
          dex.writeUInt16LE(triesSize, offset2 + 6);
          dex.writeUInt32LE(debugInfoOffsets[index], offset2 + 8);
          dex.writeUInt32LE(insnsSize, offset2 + 12);
          dex.writeUInt16LE(4208, offset2 + 16);
          dex.writeUInt16LE(superConstructor, offset2 + 18);
          dex.writeUInt16LE(0, offset2 + 20);
          dex.writeUInt16LE(14, offset2 + 22);
        });
        annotationDirectories.forEach((dir) => {
          const dirOffset = dir.offset;
          const classAnnotationsOffset = 0;
          const fieldsSize = 0;
          const annotatedMethodsSize = dir.methods.length;
          const annotatedParametersSize = 0;
          dex.writeUInt32LE(classAnnotationsOffset, dirOffset);
          dex.writeUInt32LE(fieldsSize, dirOffset + 4);
          dex.writeUInt32LE(annotatedMethodsSize, dirOffset + 8);
          dex.writeUInt32LE(annotatedParametersSize, dirOffset + 12);
          dir.methods.forEach((method2, index) => {
            const entryOffset = dirOffset + 16 + index * 8;
            const [methodIndex, annotationSet] = method2;
            dex.writeUInt32LE(methodIndex, entryOffset);
            dex.writeUInt32LE(annotationSet.offset, entryOffset + 4);
          });
        });
        interfaces.forEach((iface, index) => {
          const ifaceOffset = interfaceOffsets[index];
          dex.writeUInt32LE(iface.types.length, ifaceOffset);
          iface.types.forEach((type, typeIndex) => {
            dex.writeUInt16LE(type, ifaceOffset + 4 + typeIndex * 2);
          });
        });
        parameters.forEach((param, index) => {
          const paramOffset = parameterOffsets[index];
          dex.writeUInt32LE(param.types.length, paramOffset);
          param.types.forEach((type, typeIndex) => {
            dex.writeUInt16LE(type, paramOffset + 4 + typeIndex * 2);
          });
        });
        stringChunks.forEach((chunk, index) => {
          chunk.copy(dex, stringOffsets[index]);
        });
        debugInfoOffsets.forEach((debugInfoOffset) => {
          kDefaultConstructorDebugInfo.copy(dex, debugInfoOffset);
        });
        throwsAnnotationBlobs.forEach((annotationBlob, index) => {
          annotationBlob.copy(dex, throwsAnnotations[index].offset);
        });
        classDataBlobs.forEach((classDataBlob, index) => {
          classDataBlob.copy(dex, classes[index].classData.offset);
        });
        dex.writeUInt32LE(mapNumItems, mapOffset);
        const mapItems = [
          [TYPE_HEADER_ITEM, 1, headerOffset],
          [TYPE_STRING_ID_ITEM, strings.length, stringIdsOffset],
          [TYPE_TYPE_ID_ITEM, types2.length, typeIdsOffset],
          [TYPE_PROTO_ID_ITEM, protos.length, protoIdsOffset]
        ];
        if (fields.length > 0) {
          mapItems.push([TYPE_FIELD_ID_ITEM, fields.length, fieldIdsOffset]);
        }
        mapItems.push([TYPE_METHOD_ID_ITEM, methods.length, methodIdsOffset]);
        mapItems.push([TYPE_CLASS_DEF_ITEM, classes.length, classDefsOffset]);
        annotationSets.forEach((set, index) => {
          mapItems.push([TYPE_ANNOTATION_SET_ITEM, set.items.length, annotationSetOffsets[index]]);
        });
        javaCodeItems.forEach((codeItem) => {
          mapItems.push([TYPE_CODE_ITEM, 1, codeItem.offset]);
        });
        annotationDirectories.forEach((dir) => {
          mapItems.push([TYPE_ANNOTATIONS_DIRECTORY_ITEM, 1, dir.offset]);
        });
        if (typeListLength > 0) {
          mapItems.push([TYPE_TYPE_LIST, typeListLength, interfaceOffsets.concat(parameterOffsets)[0]]);
        }
        mapItems.push([TYPE_STRING_DATA_ITEM, strings.length, stringOffsets[0]]);
        debugInfoOffsets.forEach((debugInfoOffset) => {
          mapItems.push([TYPE_DEBUG_INFO_ITEM, 1, debugInfoOffset]);
        });
        throwsAnnotations.forEach((annotation) => {
          mapItems.push([TYPE_ANNOTATION_ITEM, 1, annotation.offset]);
        });
        classes.forEach((klass) => {
          mapItems.push([TYPE_CLASS_DATA_ITEM, 1, klass.classData.offset]);
        });
        mapItems.push([TYPE_MAP_LIST, 1, mapOffset]);
        mapItems.forEach((item, index) => {
          const [type, size, offset2] = item;
          const itemOffset = mapOffset + 4 + index * kMapItemSize;
          dex.writeUInt16LE(type, itemOffset);
          dex.writeUInt32LE(size, itemOffset + 4);
          dex.writeUInt32LE(offset2, itemOffset + 8);
        });
        const hash = new Checksum("sha1");
        hash.update(dex.slice(signatureOffset + signatureSize));
        Buffer2.from(hash.getDigest()).copy(dex, signatureOffset);
        dex.writeUInt32LE(adler32(dex, signatureOffset), checksumOffset);
        return dex;
      }
    };
    mkdex_default = mkdex;
  }
});

// node_modules/frida-java-bridge/lib/types.js
function initialize(_vm) {
  vm = _vm;
}
function getType(typeName, unbox, factory) {
  let type = getPrimitiveType(typeName);
  if (type === null) {
    if (typeName.indexOf("[") === 0) {
      type = getArrayType(typeName, unbox, factory);
    } else {
      if (typeName[0] === "L" && typeName[typeName.length - 1] === ";") {
        typeName = typeName.substring(1, typeName.length - 1);
      }
      type = getObjectType(typeName, unbox, factory);
    }
  }
  return Object.assign({ className: typeName }, type);
}
function getPrimitiveType(name2) {
  const result2 = primitiveTypes[name2];
  return result2 !== void 0 ? result2 : null;
}
function getObjectType(typeName, unbox, factory) {
  const cache = factory._types[unbox ? 1 : 0];
  let type = cache[typeName];
  if (type !== void 0) {
    return type;
  }
  if (typeName === "java.lang.Object") {
    type = getJavaLangObjectType(factory);
  } else {
    type = getAnyObjectType(typeName, unbox, factory);
  }
  cache[typeName] = type;
  return type;
}
function getJavaLangObjectType(factory) {
  return {
    name: "Ljava/lang/Object;",
    type: "pointer",
    size: 1,
    defaultValue: NULL,
    isCompatible(v) {
      if (v === null) {
        return true;
      }
      if (v === void 0) {
        return false;
      }
      const isWrapper = v.$h instanceof NativePointer;
      if (isWrapper) {
        return true;
      }
      return typeof v === "string";
    },
    fromJni(h, env2, owned) {
      if (h.isNull()) {
        return null;
      }
      return factory.cast(h, factory.use("java.lang.Object"), owned);
    },
    toJni(o, env2) {
      if (o === null) {
        return NULL;
      }
      if (typeof o === "string") {
        return env2.newStringUtf(o);
      }
      return o.$h;
    }
  };
}
function getAnyObjectType(typeName, unbox, factory) {
  let cachedClass = null;
  let cachedIsInstance = null;
  let cachedIsDefaultString = null;
  function getClass() {
    if (cachedClass === null) {
      cachedClass = factory.use(typeName).class;
    }
    return cachedClass;
  }
  function isInstance(v) {
    const klass = getClass();
    if (cachedIsInstance === null) {
      cachedIsInstance = klass.isInstance.overload("java.lang.Object");
    }
    return cachedIsInstance.call(klass, v);
  }
  function typeIsDefaultString() {
    if (cachedIsDefaultString === null) {
      const x = getClass();
      cachedIsDefaultString = factory.use("java.lang.String").class.isAssignableFrom(x);
    }
    return cachedIsDefaultString;
  }
  return {
    name: makeJniObjectTypeName(typeName),
    type: "pointer",
    size: 1,
    defaultValue: NULL,
    isCompatible(v) {
      if (v === null) {
        return true;
      }
      if (v === void 0) {
        return false;
      }
      const isWrapper = v.$h instanceof NativePointer;
      if (isWrapper) {
        return isInstance(v);
      }
      return typeof v === "string" && typeIsDefaultString();
    },
    fromJni(h, env2, owned) {
      if (h.isNull()) {
        return null;
      }
      if (typeIsDefaultString() && unbox) {
        return env2.stringFromJni(h);
      }
      return factory.cast(h, factory.use(typeName), owned);
    },
    toJni(o, env2) {
      if (o === null) {
        return NULL;
      }
      if (typeof o === "string") {
        return env2.newStringUtf(o);
      }
      return o.$h;
    },
    toString() {
      return this.name;
    }
  };
}
function makePrimitiveArrayType(shorty, name2) {
  const envProto = Env.prototype;
  const nameTitled = toTitleCase(name2);
  const spec = {
    typeName: name2,
    newArray: envProto["new" + nameTitled + "Array"],
    setRegion: envProto["set" + nameTitled + "ArrayRegion"],
    getElements: envProto["get" + nameTitled + "ArrayElements"],
    releaseElements: envProto["release" + nameTitled + "ArrayElements"]
  };
  return {
    name: shorty,
    type: "pointer",
    size: 1,
    defaultValue: NULL,
    isCompatible(v) {
      return isCompatiblePrimitiveArray(v, name2);
    },
    fromJni(h, env2, owned) {
      return fromJniPrimitiveArray(h, spec, env2, owned);
    },
    toJni(arr, env2) {
      return toJniPrimitiveArray(arr, spec, env2);
    }
  };
}
function getArrayType(typeName, unbox, factory) {
  const primitiveType = primitiveArrayTypes[typeName];
  if (primitiveType !== void 0) {
    return primitiveType;
  }
  if (typeName.indexOf("[") !== 0) {
    throw new Error("Unsupported type: " + typeName);
  }
  let elementTypeName = typeName.substring(1);
  const elementType = getType(elementTypeName, unbox, factory);
  let numInternalArrays = 0;
  const end = elementTypeName.length;
  while (numInternalArrays !== end && elementTypeName[numInternalArrays] === "[") {
    numInternalArrays++;
  }
  elementTypeName = elementTypeName.substring(numInternalArrays);
  if (elementTypeName[0] === "L" && elementTypeName[elementTypeName.length - 1] === ";") {
    elementTypeName = elementTypeName.substring(1, elementTypeName.length - 1);
  }
  let internalElementTypeName = elementTypeName.replace(/\./g, "/");
  if (primitiveTypesNames.has(internalElementTypeName)) {
    internalElementTypeName = "[".repeat(numInternalArrays) + internalElementTypeName;
  } else {
    internalElementTypeName = "[".repeat(numInternalArrays) + "L" + internalElementTypeName + ";";
  }
  const internalTypeName = "[" + internalElementTypeName;
  elementTypeName = "[".repeat(numInternalArrays) + elementTypeName;
  return {
    name: typeName.replace(/\./g, "/"),
    type: "pointer",
    size: 1,
    defaultValue: NULL,
    isCompatible(v) {
      if (v === null) {
        return true;
      }
      if (typeof v !== "object" || v.length === void 0) {
        return false;
      }
      return v.every(function(element) {
        return elementType.isCompatible(element);
      });
    },
    fromJni(arr, env2, owned) {
      if (arr.isNull()) {
        return null;
      }
      const result2 = [];
      const n = env2.getArrayLength(arr);
      for (let i = 0; i !== n; i++) {
        const element = env2.getObjectArrayElement(arr, i);
        try {
          result2.push(elementType.fromJni(element, env2));
        } finally {
          env2.deleteLocalRef(element);
        }
      }
      try {
        result2.$w = factory.cast(arr, factory.use(internalTypeName), owned);
      } catch (e) {
        factory.use("java.lang.reflect.Array").newInstance(factory.use(elementTypeName).class, 0);
        result2.$w = factory.cast(arr, factory.use(internalTypeName), owned);
      }
      result2.$dispose = disposeObjectArray;
      return result2;
    },
    toJni(elements, env2) {
      if (elements === null) {
        return NULL;
      }
      if (!(elements instanceof Array)) {
        throw new Error("Expected an array");
      }
      const wrapper = elements.$w;
      if (wrapper !== void 0) {
        return wrapper.$h;
      }
      const n = elements.length;
      const klassObj = factory.use(elementTypeName);
      const classHandle = klassObj.$borrowClassHandle(env2);
      try {
        const result2 = env2.newObjectArray(n, classHandle.value, NULL);
        env2.throwIfExceptionPending();
        for (let i = 0; i !== n; i++) {
          const handle2 = elementType.toJni(elements[i], env2);
          try {
            env2.setObjectArrayElement(result2, i, handle2);
          } finally {
            if (elementType.type === "pointer" && env2.getObjectRefType(handle2) === JNILocalRefType) {
              env2.deleteLocalRef(handle2);
            }
          }
          env2.throwIfExceptionPending();
        }
        return result2;
      } finally {
        classHandle.unref(env2);
      }
    }
  };
}
function disposeObjectArray() {
  const n = this.length;
  for (let i = 0; i !== n; i++) {
    const obj = this[i];
    if (obj === null) {
      continue;
    }
    const dispose2 = obj.$dispose;
    if (dispose2 === void 0) {
      break;
    }
    dispose2.call(obj);
  }
  this.$w.$dispose();
}
function fromJniPrimitiveArray(arr, spec, env2, owned) {
  if (arr.isNull()) {
    return null;
  }
  const type = getPrimitiveType(spec.typeName);
  const length = env2.getArrayLength(arr);
  return new PrimitiveArray(arr, spec, type, length, env2, owned);
}
function toJniPrimitiveArray(arr, spec, env2) {
  if (arr === null) {
    return NULL;
  }
  const handle2 = arr.$h;
  if (handle2 !== void 0) {
    return handle2;
  }
  const length = arr.length;
  const type = getPrimitiveType(spec.typeName);
  const result2 = spec.newArray.call(env2, length);
  if (result2.isNull()) {
    throw new Error("Unable to construct array");
  }
  if (length > 0) {
    const elementSize = type.byteSize;
    const writeElement = type.write;
    const unparseElementValue = type.toJni;
    const elements = Memory.alloc(length * type.byteSize);
    for (let index = 0; index !== length; index++) {
      writeElement(elements.add(index * elementSize), unparseElementValue(arr[index]));
    }
    spec.setRegion.call(env2, result2, 0, length, elements);
    env2.throwIfExceptionPending();
  }
  return result2;
}
function isCompatiblePrimitiveArray(value, typeName) {
  if (value === null) {
    return true;
  }
  if (value instanceof PrimitiveArray) {
    return value.$s.typeName === typeName;
  }
  const isArrayLike = typeof value === "object" && value.length !== void 0;
  if (!isArrayLike) {
    return false;
  }
  const elementType = getPrimitiveType(typeName);
  return Array.prototype.every.call(value, (element) => elementType.isCompatible(element));
}
function PrimitiveArray(handle2, spec, type, length, env2, owned = true) {
  if (owned) {
    const h = env2.newGlobalRef(handle2);
    this.$h = h;
    this.$r = Script.bindWeak(this, env2.vm.makeHandleDestructor(h));
  } else {
    this.$h = handle2;
    this.$r = null;
  }
  this.$s = spec;
  this.$t = type;
  this.length = length;
  return new Proxy(this, primitiveArrayHandler);
}
function makeJniObjectTypeName(typeName) {
  return "L" + typeName.replace(/\./g, "/") + ";";
}
function toTitleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function identity(value) {
  return value;
}
var JNILocalRefType, vm, primitiveArrayHandler, primitiveTypes, primitiveTypesNames, primitiveArrayTypes;
var init_types = __esm({
  "node_modules/frida-java-bridge/lib/types.js"() {
    "use strict";
    init_node_globals();
    init_env();
    JNILocalRefType = 1;
    vm = null;
    primitiveArrayHandler = null;
    primitiveTypes = {
      boolean: {
        name: "Z",
        type: "uint8",
        size: 1,
        byteSize: 1,
        defaultValue: false,
        isCompatible(v) {
          return typeof v === "boolean";
        },
        fromJni(v) {
          return !!v;
        },
        toJni(v) {
          return v ? 1 : 0;
        },
        read(address) {
          return address.readU8();
        },
        write(address, value) {
          address.writeU8(value);
        },
        toString() {
          return this.name;
        }
      },
      byte: {
        name: "B",
        type: "int8",
        size: 1,
        byteSize: 1,
        defaultValue: 0,
        isCompatible(v) {
          return Number.isInteger(v) && v >= -128 && v <= 127;
        },
        fromJni: identity,
        toJni: identity,
        read(address) {
          return address.readS8();
        },
        write(address, value) {
          address.writeS8(value);
        },
        toString() {
          return this.name;
        }
      },
      char: {
        name: "C",
        type: "uint16",
        size: 1,
        byteSize: 2,
        defaultValue: 0,
        isCompatible(v) {
          if (typeof v !== "string" || v.length !== 1) {
            return false;
          }
          const code5 = v.charCodeAt(0);
          return code5 >= 0 && code5 <= 65535;
        },
        fromJni(c) {
          return String.fromCharCode(c);
        },
        toJni(s) {
          return s.charCodeAt(0);
        },
        read(address) {
          return address.readU16();
        },
        write(address, value) {
          address.writeU16(value);
        },
        toString() {
          return this.name;
        }
      },
      short: {
        name: "S",
        type: "int16",
        size: 1,
        byteSize: 2,
        defaultValue: 0,
        isCompatible(v) {
          return Number.isInteger(v) && v >= -32768 && v <= 32767;
        },
        fromJni: identity,
        toJni: identity,
        read(address) {
          return address.readS16();
        },
        write(address, value) {
          address.writeS16(value);
        },
        toString() {
          return this.name;
        }
      },
      int: {
        name: "I",
        type: "int32",
        size: 1,
        byteSize: 4,
        defaultValue: 0,
        isCompatible(v) {
          return Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;
        },
        fromJni: identity,
        toJni: identity,
        read(address) {
          return address.readS32();
        },
        write(address, value) {
          address.writeS32(value);
        },
        toString() {
          return this.name;
        }
      },
      long: {
        name: "J",
        type: "int64",
        size: 2,
        byteSize: 8,
        defaultValue: 0,
        isCompatible(v) {
          return typeof v === "number" || v instanceof Int64;
        },
        fromJni: identity,
        toJni: identity,
        read(address) {
          return address.readS64();
        },
        write(address, value) {
          address.writeS64(value);
        },
        toString() {
          return this.name;
        }
      },
      float: {
        name: "F",
        type: "float",
        size: 1,
        byteSize: 4,
        defaultValue: 0,
        isCompatible(v) {
          return typeof v === "number";
        },
        fromJni: identity,
        toJni: identity,
        read(address) {
          return address.readFloat();
        },
        write(address, value) {
          address.writeFloat(value);
        },
        toString() {
          return this.name;
        }
      },
      double: {
        name: "D",
        type: "double",
        size: 2,
        byteSize: 8,
        defaultValue: 0,
        isCompatible(v) {
          return typeof v === "number";
        },
        fromJni: identity,
        toJni: identity,
        read(address) {
          return address.readDouble();
        },
        write(address, value) {
          address.writeDouble(value);
        },
        toString() {
          return this.name;
        }
      },
      void: {
        name: "V",
        type: "void",
        size: 0,
        byteSize: 0,
        defaultValue: void 0,
        isCompatible(v) {
          return v === void 0;
        },
        fromJni() {
          return void 0;
        },
        toJni() {
          return NULL;
        },
        toString() {
          return this.name;
        }
      }
    };
    primitiveTypesNames = new Set(Object.values(primitiveTypes).map((t) => t.name));
    primitiveArrayTypes = [
      ["Z", "boolean"],
      ["B", "byte"],
      ["C", "char"],
      ["D", "double"],
      ["F", "float"],
      ["I", "int"],
      ["J", "long"],
      ["S", "short"]
    ].reduce((result2, [shorty, name2]) => {
      result2["[" + shorty] = makePrimitiveArrayType("[" + shorty, name2);
      return result2;
    }, {});
    primitiveArrayHandler = {
      has(target, property) {
        if (property in target) {
          return true;
        }
        return target.tryParseIndex(property) !== null;
      },
      get(target, property, receiver) {
        const index = target.tryParseIndex(property);
        if (index === null) {
          return target[property];
        }
        return target.readElement(index);
      },
      set(target, property, value, receiver) {
        const index = target.tryParseIndex(property);
        if (index === null) {
          target[property] = value;
          return true;
        }
        target.writeElement(index, value);
        return true;
      },
      ownKeys(target) {
        const keys = [];
        const { length } = target;
        for (let i = 0; i !== length; i++) {
          const key = i.toString();
          keys.push(key);
        }
        keys.push("length");
        return keys;
      },
      getOwnPropertyDescriptor(target, property) {
        const index = target.tryParseIndex(property);
        if (index !== null) {
          return {
            writable: true,
            configurable: true,
            enumerable: true
          };
        }
        return Object.getOwnPropertyDescriptor(target, property);
      }
    };
    Object.defineProperties(PrimitiveArray.prototype, {
      $dispose: {
        enumerable: true,
        value() {
          const ref = this.$r;
          if (ref !== null) {
            this.$r = null;
            Script.unbindWeak(ref);
          }
        }
      },
      $clone: {
        value(env2) {
          return new PrimitiveArray(this.$h, this.$s, this.$t, this.length, env2);
        }
      },
      tryParseIndex: {
        value(rawIndex) {
          if (typeof rawIndex === "symbol") {
            return null;
          }
          const index = parseInt(rawIndex);
          if (isNaN(index) || index < 0 || index >= this.length) {
            return null;
          }
          return index;
        }
      },
      readElement: {
        value(index) {
          return this.withElements((elements) => {
            const type = this.$t;
            return type.fromJni(type.read(elements.add(index * type.byteSize)));
          });
        }
      },
      writeElement: {
        value(index, value) {
          const { $h: handle2, $s: spec, $t: type } = this;
          const env2 = vm.getEnv();
          const element = Memory.alloc(type.byteSize);
          type.write(element, type.toJni(value));
          spec.setRegion.call(env2, handle2, index, 1, element);
        }
      },
      withElements: {
        value(perform) {
          const { $h: handle2, $s: spec } = this;
          const env2 = vm.getEnv();
          const elements = spec.getElements.call(env2, handle2);
          if (elements.isNull()) {
            throw new Error("Unable to get array elements");
          }
          try {
            return perform(elements);
          } finally {
            spec.releaseElements.call(env2, handle2, elements);
          }
        }
      },
      toJSON: {
        value() {
          const { length, $t: type } = this;
          const { byteSize: elementSize, fromJni, read: read2 } = type;
          return this.withElements((elements) => {
            const values = [];
            for (let i = 0; i !== length; i++) {
              const value = fromJni(read2(elements.add(i * elementSize)));
              values.push(value);
            }
            return values;
          });
        }
      },
      toString: {
        value() {
          return this.toJSON().toString();
        }
      }
    });
  }
});

// node_modules/frida-java-bridge/lib/class-factory.js
function makeClassWrapperConstructor() {
  return function(handle2, strategy, env2, owned) {
    return Wrapper.call(this, handle2, strategy, env2, owned);
  };
}
function Wrapper(handle2, strategy, env2, owned = true) {
  if (handle2 !== null) {
    if (owned) {
      const h = env2.newGlobalRef(handle2);
      this.$h = h;
      this.$r = Script.bindWeak(this, vm2.makeHandleDestructor(h));
    } else {
      this.$h = handle2;
      this.$r = null;
    }
  } else {
    this.$h = null;
    this.$r = null;
  }
  this.$t = strategy;
  return new Proxy(this, wrapperHandler);
}
function ClassHandle(value, env2) {
  this.value = env2.newGlobalRef(value);
  env2.deleteLocalRef(value);
  this.refs = 1;
}
function releaseClassHandle(handle2, env2) {
  handle2.unref(env2);
}
function makeBasicClassHandleGetter(className) {
  const canonicalClassName = className.replace(/\./g, "/");
  return function(env2) {
    const tid = getCurrentThreadId();
    ignore(tid);
    try {
      return env2.findClass(canonicalClassName);
    } finally {
      unignore(tid);
    }
  };
}
function makeLoaderClassHandleGetter(className, usedLoader, callerEnv) {
  if (cachedLoaderMethod === null) {
    cachedLoaderInvoke = callerEnv.vaMethod("pointer", ["pointer"]);
    cachedLoaderMethod = usedLoader.loadClass.overload("java.lang.String").handle;
  }
  callerEnv = null;
  return function(env2) {
    const classNameValue = env2.newStringUtf(className);
    const tid = getCurrentThreadId();
    ignore(tid);
    try {
      const result2 = cachedLoaderInvoke(env2.handle, usedLoader.$h, cachedLoaderMethod, classNameValue);
      env2.throwIfExceptionPending();
      return result2;
    } finally {
      unignore(tid);
      env2.deleteLocalRef(classNameValue);
    }
  };
}
function makeSuperHandleGetter(classWrapper) {
  return function(env2) {
    const h = classWrapper.$borrowClassHandle(env2);
    try {
      return env2.getSuperclass(h.value);
    } finally {
      h.unref(env2);
    }
  };
}
function makeConstructor(classHandle, classWrapper, env2) {
  const { $n: className, $f: factory } = classWrapper;
  const methodName = basename(className);
  const Class = env2.javaLangClass();
  const Constructor = env2.javaLangReflectConstructor();
  const invokeObjectMethodNoArgs = env2.vaMethod("pointer", []);
  const invokeUInt8MethodNoArgs = env2.vaMethod("uint8", []);
  const jsCtorMethods = [];
  const jsInitMethods = [];
  const jsRetType = factory._getType(className, false);
  const jsVoidType = factory._getType("void", false);
  const constructors = invokeObjectMethodNoArgs(env2.handle, classHandle, Class.getDeclaredConstructors);
  try {
    const n = env2.getArrayLength(constructors);
    if (n !== 0) {
      for (let i = 0; i !== n; i++) {
        let methodId, types2;
        const constructor = env2.getObjectArrayElement(constructors, i);
        try {
          methodId = env2.fromReflectedMethod(constructor);
          types2 = invokeObjectMethodNoArgs(env2.handle, constructor, Constructor.getGenericParameterTypes);
        } finally {
          env2.deleteLocalRef(constructor);
        }
        let jsArgTypes;
        try {
          jsArgTypes = readTypeNames(env2, types2).map((name2) => factory._getType(name2));
        } finally {
          env2.deleteLocalRef(types2);
        }
        jsCtorMethods.push(makeMethod(methodName, classWrapper, CONSTRUCTOR_METHOD, methodId, jsRetType, jsArgTypes, env2));
        jsInitMethods.push(makeMethod(methodName, classWrapper, INSTANCE_METHOD, methodId, jsVoidType, jsArgTypes, env2));
      }
    } else {
      const isInterface = invokeUInt8MethodNoArgs(env2.handle, classHandle, Class.isInterface);
      if (isInterface) {
        throw new Error("cannot instantiate an interface");
      }
      const defaultClass = env2.javaLangObject();
      const defaultConstructor = env2.getMethodId(defaultClass, "<init>", "()V");
      jsCtorMethods.push(makeMethod(methodName, classWrapper, CONSTRUCTOR_METHOD, defaultConstructor, jsRetType, [], env2));
      jsInitMethods.push(makeMethod(methodName, classWrapper, INSTANCE_METHOD, defaultConstructor, jsVoidType, [], env2));
    }
  } finally {
    env2.deleteLocalRef(constructors);
  }
  if (jsInitMethods.length === 0) {
    throw new Error("no supported overloads");
  }
  return {
    allocAndInit: makeMethodDispatcher(jsCtorMethods),
    initOnly: makeMethodDispatcher(jsInitMethods)
  };
}
function makeMember(name2, spec, classHandle, classWrapper, env2) {
  if (spec.startsWith("m")) {
    return makeMethodFromSpec(name2, spec, classHandle, classWrapper, env2);
  }
  return makeFieldFromSpec(name2, spec, classHandle, classWrapper, env2);
}
function makeMethodFromSpec(name2, spec, classHandle, classWrapper, env2) {
  const { $f: factory } = classWrapper;
  const overloads = spec.split(":").slice(1);
  const Method = env2.javaLangReflectMethod();
  const invokeObjectMethodNoArgs = env2.vaMethod("pointer", []);
  const invokeUInt8MethodNoArgs = env2.vaMethod("uint8", []);
  const methods = overloads.map((params) => {
    const type = params[0] === "s" ? STATIC_METHOD : INSTANCE_METHOD;
    const methodId = ptr(params.substr(1));
    let jsRetType;
    const jsArgTypes = [];
    const handle2 = env2.toReflectedMethod(classHandle, methodId, type === STATIC_METHOD ? 1 : 0);
    try {
      const isVarArgs = !!invokeUInt8MethodNoArgs(env2.handle, handle2, Method.isVarArgs);
      const retType2 = invokeObjectMethodNoArgs(env2.handle, handle2, Method.getGenericReturnType);
      env2.throwIfExceptionPending();
      try {
        jsRetType = factory._getType(env2.getTypeName(retType2));
      } finally {
        env2.deleteLocalRef(retType2);
      }
      const argTypes2 = invokeObjectMethodNoArgs(env2.handle, handle2, Method.getParameterTypes);
      try {
        const n = env2.getArrayLength(argTypes2);
        for (let i = 0; i !== n; i++) {
          const t = env2.getObjectArrayElement(argTypes2, i);
          let argClassName;
          try {
            argClassName = isVarArgs && i === n - 1 ? env2.getArrayTypeName(t) : env2.getTypeName(t);
          } finally {
            env2.deleteLocalRef(t);
          }
          const argType = factory._getType(argClassName);
          jsArgTypes.push(argType);
        }
      } finally {
        env2.deleteLocalRef(argTypes2);
      }
    } catch (e) {
      return null;
    } finally {
      env2.deleteLocalRef(handle2);
    }
    return makeMethod(name2, classWrapper, type, methodId, jsRetType, jsArgTypes, env2);
  }).filter((m2) => m2 !== null);
  if (methods.length === 0) {
    throw new Error("No supported overloads");
  }
  if (name2 === "valueOf") {
    ensureDefaultValueOfImplemented(methods);
  }
  const result2 = makeMethodDispatcher(methods);
  return function(receiver) {
    return result2;
  };
}
function makeMethodDispatcher(overloads) {
  const m2 = makeMethodDispatcherCallable();
  Object.setPrototypeOf(m2, dispatcherPrototype);
  m2._o = overloads;
  return m2;
}
function makeMethodDispatcherCallable() {
  const m2 = function() {
    return m2.invoke(this, arguments);
  };
  return m2;
}
function makeOverloadId(name2, returnType, argumentTypes) {
  return `${returnType.className} ${name2}(${argumentTypes.map((t) => t.className).join(", ")})`;
}
function throwIfDispatcherAmbiguous(dispatcher) {
  const methods = dispatcher._o;
  if (methods.length > 1) {
    throwOverloadError(methods[0].methodName, methods, "has more than one overload, use .overload(<signature>) to choose from:");
  }
}
function throwOverloadError(name2, methods, message) {
  const methodsSortedByArity = methods.slice().sort((a, b) => a.argumentTypes.length - b.argumentTypes.length);
  const overloads = methodsSortedByArity.map((m2) => {
    const argTypes2 = m2.argumentTypes;
    if (argTypes2.length > 0) {
      return ".overload('" + m2.argumentTypes.map((t) => t.className).join("', '") + "')";
    } else {
      return ".overload()";
    }
  });
  throw new Error(`${name2}(): ${message}
	${overloads.join("\n	")}`);
}
function makeMethod(methodName, classWrapper, type, methodId, retType2, argTypes2, env2, invocationOptions2) {
  const rawRetType = retType2.type;
  const rawArgTypes = argTypes2.map((t) => t.type);
  if (env2 === null) {
    env2 = vm2.getEnv();
  }
  let callVirtually, callDirectly;
  if (type === INSTANCE_METHOD) {
    callVirtually = env2.vaMethod(rawRetType, rawArgTypes, invocationOptions2);
    callDirectly = env2.nonvirtualVaMethod(rawRetType, rawArgTypes, invocationOptions2);
  } else if (type === STATIC_METHOD) {
    callVirtually = env2.staticVaMethod(rawRetType, rawArgTypes, invocationOptions2);
    callDirectly = callVirtually;
  } else {
    callVirtually = env2.constructor(rawArgTypes, invocationOptions2);
    callDirectly = callVirtually;
  }
  return makeMethodInstance([methodName, classWrapper, type, methodId, retType2, argTypes2, callVirtually, callDirectly]);
}
function makeMethodInstance(params) {
  const m2 = makeMethodCallable();
  Object.setPrototypeOf(m2, methodPrototype);
  m2._p = params;
  return m2;
}
function makeMethodCallable() {
  const m2 = function() {
    return m2.invoke(this, arguments);
  };
  return m2;
}
function implement(methodName, classWrapper, type, retType2, argTypes2, handler, fallback = null) {
  const pendingCalls = /* @__PURE__ */ new Set();
  const f2 = makeMethodImplementation([methodName, classWrapper, type, retType2, argTypes2, handler, fallback, pendingCalls]);
  const impl = new NativeCallback(f2, retType2.type, ["pointer", "pointer"].concat(argTypes2.map((t) => t.type)));
  impl._c = pendingCalls;
  return impl;
}
function makeMethodImplementation(params) {
  return function() {
    return handleMethodInvocation(arguments, params);
  };
}
function handleMethodInvocation(jniArgs, params) {
  const env2 = new Env(jniArgs[0], vm2);
  const [methodName, classWrapper, type, retType2, argTypes2, handler, fallback, pendingCalls] = params;
  const ownedObjects = [];
  let self;
  if (type === INSTANCE_METHOD) {
    const C = classWrapper.$C;
    self = new C(jniArgs[1], STRATEGY_VIRTUAL, env2, false);
  } else {
    self = classWrapper;
  }
  const tid = getCurrentThreadId();
  env2.pushLocalFrame(3);
  let haveFrame = true;
  vm2.link(tid, env2);
  try {
    pendingCalls.add(tid);
    let fn;
    if (fallback === null || !ignoredThreads.has(tid)) {
      fn = handler;
    } else {
      fn = fallback;
    }
    const args = [];
    const numArgs = jniArgs.length - 2;
    for (let i = 0; i !== numArgs; i++) {
      const t = argTypes2[i];
      const value = t.fromJni(jniArgs[2 + i], env2, false);
      args.push(value);
      ownedObjects.push(value);
    }
    const retval = fn.apply(self, args);
    if (!retType2.isCompatible(retval)) {
      throw new Error(`Implementation for ${methodName} expected return value compatible with ${retType2.className}`);
    }
    let jniRetval = retType2.toJni(retval, env2);
    if (retType2.type === "pointer") {
      jniRetval = env2.popLocalFrame(jniRetval);
      haveFrame = false;
      ownedObjects.push(retval);
    }
    return jniRetval;
  } catch (e) {
    const jniException = e.$h;
    if (jniException !== void 0) {
      env2.throw(jniException);
    } else {
      Script.nextTick(() => {
        throw e;
      });
    }
    return retType2.defaultValue;
  } finally {
    vm2.unlink(tid);
    if (haveFrame) {
      env2.popLocalFrame(NULL);
    }
    pendingCalls.delete(tid);
    ownedObjects.forEach((obj) => {
      if (obj === null) {
        return;
      }
      const dispose2 = obj.$dispose;
      if (dispose2 !== void 0) {
        dispose2.call(obj);
      }
    });
  }
}
function ensureDefaultValueOfImplemented(methods) {
  const { holder, type } = methods[0];
  const hasDefaultValueOf = methods.some((m2) => m2.type === type && m2.argumentTypes.length === 0);
  if (hasDefaultValueOf) {
    return;
  }
  methods.push(makeValueOfMethod([holder, type]));
}
function makeValueOfMethod(params) {
  const m2 = makeValueOfCallable();
  Object.setPrototypeOf(m2, valueOfPrototype);
  m2._p = params;
  return m2;
}
function makeValueOfCallable() {
  const m2 = function() {
    return this;
  };
  return m2;
}
function makeFieldFromSpec(name2, spec, classHandle, classWrapper, env2) {
  const type = spec[2] === "s" ? STATIC_FIELD : INSTANCE_FIELD;
  const id = ptr(spec.substr(3));
  const { $f: factory } = classWrapper;
  let fieldType;
  const field = env2.toReflectedField(classHandle, id, type === STATIC_FIELD ? 1 : 0);
  try {
    fieldType = env2.vaMethod("pointer", [])(env2.handle, field, env2.javaLangReflectField().getGenericType);
    env2.throwIfExceptionPending();
  } finally {
    env2.deleteLocalRef(field);
  }
  let rtype;
  try {
    rtype = factory._getType(env2.getTypeName(fieldType));
  } finally {
    env2.deleteLocalRef(fieldType);
  }
  let getValue, setValue;
  const rtypeJni = rtype.type;
  if (type === STATIC_FIELD) {
    getValue = env2.getStaticField(rtypeJni);
    setValue = env2.setStaticField(rtypeJni);
  } else {
    getValue = env2.getField(rtypeJni);
    setValue = env2.setField(rtypeJni);
  }
  return makeFieldFromParams([type, rtype, id, getValue, setValue]);
}
function makeFieldFromParams(params) {
  return function(receiver) {
    return new Field([receiver].concat(params));
  };
}
function Field(params) {
  this._p = params;
}
function createTemporaryDex(factory) {
  const { cacheDir, tempFileNaming } = factory;
  const JFile = factory.use("java.io.File");
  const cacheDirValue = JFile.$new(cacheDir);
  cacheDirValue.mkdirs();
  return JFile.createTempFile(tempFileNaming.prefix, tempFileNaming.suffix + ".dex", cacheDirValue);
}
function setReadOnlyDex(filePath, factory) {
  const JFile = factory.use("java.io.File");
  const file = JFile.$new(filePath);
  file.setWritable(false, false);
}
function getFactoryCache() {
  switch (factoryCache.state) {
    case "empty": {
      factoryCache.state = "pending";
      const defaultFactory = factoryCache.factories[0];
      const HashMap = defaultFactory.use("java.util.HashMap");
      const Integer = defaultFactory.use("java.lang.Integer");
      factoryCache.loaders = HashMap.$new();
      factoryCache.Integer = Integer;
      const loader = defaultFactory.loader;
      if (loader !== null) {
        addFactoryToCache(defaultFactory, loader);
      }
      factoryCache.state = "ready";
      return factoryCache;
    }
    case "pending":
      do {
        Thread.sleep(0.05);
      } while (factoryCache.state === "pending");
      return factoryCache;
    case "ready":
      return factoryCache;
  }
}
function addFactoryToCache(factory, loader) {
  const { factories, loaders, Integer } = factoryCache;
  const index = Integer.$new(factories.indexOf(factory));
  loaders.put(loader, index);
  for (let l = loader.getParent(); l !== null; l = l.getParent()) {
    if (loaders.containsKey(l)) {
      break;
    }
    loaders.put(l, index);
  }
}
function ignore(threadId) {
  let count = ignoredThreads.get(threadId);
  if (count === void 0) {
    count = 0;
  }
  count++;
  ignoredThreads.set(threadId, count);
}
function unignore(threadId) {
  let count = ignoredThreads.get(threadId);
  if (count === void 0) {
    throw new Error(`Thread ${threadId} is not ignored`);
  }
  count--;
  if (count === 0) {
    ignoredThreads.delete(threadId);
  } else {
    ignoredThreads.set(threadId, count);
  }
}
function basename(className) {
  return className.slice(className.lastIndexOf(".") + 1);
}
function readTypeNames(env2, types2) {
  const names = [];
  const n = env2.getArrayLength(types2);
  for (let i = 0; i !== n; i++) {
    const t = env2.getObjectArrayElement(types2, i);
    try {
      names.push(env2.getTypeName(t));
    } finally {
      env2.deleteLocalRef(t);
    }
  }
  return names;
}
function makeSourceFileName(className) {
  const tokens = className.split(".");
  return tokens[tokens.length - 1] + ".java";
}
var jsizeSize3, ensureClassInitialized3, makeMethodMangler3, kAccStatic2, CONSTRUCTOR_METHOD, STATIC_METHOD, INSTANCE_METHOD, STATIC_FIELD, INSTANCE_FIELD, STRATEGY_VIRTUAL, STRATEGY_DIRECT, PENDING_USE, DEFAULT_CACHE_DIR, getCurrentThreadId, pointerSize9, factoryCache, vm2, api2, isArtVm, wrapperHandler, dispatcherPrototype, methodPrototype, valueOfPrototype, cachedLoaderInvoke, cachedLoaderMethod, ignoredThreads, ClassFactory, DexFile;
var init_class_factory = __esm({
  "node_modules/frida-java-bridge/lib/class-factory.js"() {
    "use strict";
    init_node_globals();
    init_env();
    init_android();
    init_jvm();
    init_class_model();
    init_lru();
    init_mkdex();
    init_types();
    jsizeSize3 = 4;
    ({
      ensureClassInitialized: ensureClassInitialized3,
      makeMethodMangler: makeMethodMangler3
    } = android_exports);
    kAccStatic2 = 8;
    CONSTRUCTOR_METHOD = 1;
    STATIC_METHOD = 2;
    INSTANCE_METHOD = 3;
    STATIC_FIELD = 1;
    INSTANCE_FIELD = 2;
    STRATEGY_VIRTUAL = 1;
    STRATEGY_DIRECT = 2;
    PENDING_USE = Symbol("PENDING_USE");
    DEFAULT_CACHE_DIR = "/data/local/tmp";
    ({
      getCurrentThreadId,
      pointerSize: pointerSize9
    } = Process);
    factoryCache = {
      state: "empty",
      factories: [],
      loaders: null,
      Integer: null
    };
    vm2 = null;
    api2 = null;
    isArtVm = null;
    wrapperHandler = null;
    dispatcherPrototype = null;
    methodPrototype = null;
    valueOfPrototype = null;
    cachedLoaderInvoke = null;
    cachedLoaderMethod = null;
    ignoredThreads = /* @__PURE__ */ new Map();
    ClassFactory = class _ClassFactory {
      static _initialize(_vm, _api) {
        vm2 = _vm;
        api2 = _api;
        isArtVm = _api.flavor === "art";
        if (_api.flavor === "jvm") {
          ensureClassInitialized3 = ensureClassInitialized2;
          makeMethodMangler3 = makeMethodMangler2;
        }
      }
      static _disposeAll(env2) {
        factoryCache.factories.forEach((factory) => {
          factory._dispose(env2);
        });
      }
      static get(classLoader) {
        const cache = getFactoryCache();
        const defaultFactory = cache.factories[0];
        if (classLoader === null) {
          return defaultFactory;
        }
        const indexObj = cache.loaders.get(classLoader);
        if (indexObj !== null) {
          const index = defaultFactory.cast(indexObj, cache.Integer);
          return cache.factories[index.intValue()];
        }
        const factory = new _ClassFactory();
        factory.loader = classLoader;
        factory.cacheDir = defaultFactory.cacheDir;
        addFactoryToCache(factory, classLoader);
        return factory;
      }
      constructor() {
        this.cacheDir = DEFAULT_CACHE_DIR;
        this.codeCacheDir = DEFAULT_CACHE_DIR + "/dalvik-cache";
        this.tempFileNaming = {
          prefix: "frida",
          suffix: ""
        };
        this._classes = {};
        this._classHandles = new LRU(10, releaseClassHandle);
        this._patchedMethods = /* @__PURE__ */ new Set();
        this._loader = null;
        this._types = [{}, {}];
        factoryCache.factories.push(this);
      }
      _dispose(env2) {
        Array.from(this._patchedMethods).forEach((method2) => {
          method2.implementation = null;
        });
        this._patchedMethods.clear();
        revertGlobalPatches();
        this._classHandles.dispose(env2);
        this._classes = {};
      }
      get loader() {
        return this._loader;
      }
      set loader(value) {
        const isInitial = this._loader === null && value !== null;
        this._loader = value;
        if (isInitial && factoryCache.state === "ready" && this === factoryCache.factories[0]) {
          addFactoryToCache(this, value);
        }
      }
      use(className, options = {}) {
        const allowCached = options.cache !== "skip";
        let C = allowCached ? this._getUsedClass(className) : void 0;
        if (C === void 0) {
          try {
            const env2 = vm2.getEnv();
            const { _loader: loader } = this;
            const getClassHandle = loader !== null ? makeLoaderClassHandleGetter(className, loader, env2) : makeBasicClassHandleGetter(className);
            C = this._make(className, getClassHandle, env2);
          } finally {
            if (allowCached) {
              this._setUsedClass(className, C);
            }
          }
        }
        return C;
      }
      _getUsedClass(className) {
        let c;
        while ((c = this._classes[className]) === PENDING_USE) {
          Thread.sleep(0.05);
        }
        if (c === void 0) {
          this._classes[className] = PENDING_USE;
        }
        return c;
      }
      _setUsedClass(className, c) {
        if (c !== void 0) {
          this._classes[className] = c;
        } else {
          delete this._classes[className];
        }
      }
      _make(name2, getClassHandle, env2) {
        const C = makeClassWrapperConstructor();
        const proto = Object.create(Wrapper.prototype, {
          [Symbol.for("n")]: {
            value: name2
          },
          $n: {
            get() {
              return this[Symbol.for("n")];
            }
          },
          [Symbol.for("C")]: {
            value: C
          },
          $C: {
            get() {
              return this[Symbol.for("C")];
            }
          },
          [Symbol.for("w")]: {
            value: null,
            writable: true
          },
          $w: {
            get() {
              return this[Symbol.for("w")];
            },
            set(val) {
              this[Symbol.for("w")] = val;
            }
          },
          [Symbol.for("_s")]: {
            writable: true
          },
          $_s: {
            get() {
              return this[Symbol.for("_s")];
            },
            set(val) {
              this[Symbol.for("_s")] = val;
            }
          },
          [Symbol.for("c")]: {
            value: [null]
          },
          $c: {
            get() {
              return this[Symbol.for("c")];
            }
          },
          [Symbol.for("m")]: {
            value: /* @__PURE__ */ new Map()
          },
          $m: {
            get() {
              return this[Symbol.for("m")];
            }
          },
          [Symbol.for("l")]: {
            value: null,
            writable: true
          },
          $l: {
            get() {
              return this[Symbol.for("l")];
            },
            set(val) {
              this[Symbol.for("l")] = val;
            }
          },
          [Symbol.for("gch")]: {
            value: getClassHandle
          },
          $gch: {
            get() {
              return this[Symbol.for("gch")];
            }
          },
          [Symbol.for("f")]: {
            value: this
          },
          $f: {
            get() {
              return this[Symbol.for("f")];
            }
          }
        });
        C.prototype = proto;
        const classWrapper = new C(null);
        proto[Symbol.for("w")] = classWrapper;
        proto.$w = classWrapper;
        const h = classWrapper.$borrowClassHandle(env2);
        try {
          const classHandle = h.value;
          ensureClassInitialized3(env2, classHandle);
          proto.$l = Model.build(classHandle, env2);
        } finally {
          h.unref(env2);
        }
        return classWrapper;
      }
      retain(obj) {
        const env2 = vm2.getEnv();
        return obj.$clone(env2);
      }
      cast(obj, klass, owned) {
        const env2 = vm2.getEnv();
        let handle2 = obj.$h;
        if (handle2 === void 0) {
          handle2 = obj;
        }
        const h = klass.$borrowClassHandle(env2);
        try {
          const isValidCast = env2.isInstanceOf(handle2, h.value);
          if (!isValidCast) {
            throw new Error(`Cast from '${env2.getObjectClassName(handle2)}' to '${klass.$n}' isn't possible`);
          }
        } finally {
          h.unref(env2);
        }
        const C = klass.$C;
        return new C(handle2, STRATEGY_VIRTUAL, env2, owned);
      }
      wrap(handle2, klass, env2) {
        const C = klass.$C;
        const wrapper = new C(handle2, STRATEGY_VIRTUAL, env2, false);
        wrapper.$r = Script.bindWeak(wrapper, vm2.makeHandleDestructor(handle2));
        return wrapper;
      }
      array(type, elements) {
        const env2 = vm2.getEnv();
        const primitiveType = getPrimitiveType(type);
        if (primitiveType !== null) {
          type = primitiveType.name;
        }
        const arrayType2 = getArrayType("[" + type, false, this);
        const rawArray = arrayType2.toJni(elements, env2);
        return arrayType2.fromJni(rawArray, env2, true);
      }
      registerClass(spec) {
        const env2 = vm2.getEnv();
        const tempHandles = [];
        try {
          const Class = this.use("java.lang.Class");
          const Method = env2.javaLangReflectMethod();
          const invokeObjectMethodNoArgs = env2.vaMethod("pointer", []);
          const className = spec.name;
          const interfaces = spec.implements || [];
          const superClass = spec.superClass || this.use("java.lang.Object");
          const dexFields = [];
          const dexMethods = [];
          const dexSpec = {
            name: makeJniObjectTypeName(className),
            sourceFileName: makeSourceFileName(className),
            superClass: makeJniObjectTypeName(superClass.$n),
            interfaces: interfaces.map((iface) => makeJniObjectTypeName(iface.$n)),
            fields: dexFields,
            methods: dexMethods
          };
          const allInterfaces = interfaces.slice();
          interfaces.forEach((iface) => {
            Array.prototype.slice.call(iface.class.getInterfaces()).forEach((baseIface) => {
              const baseIfaceName = this.cast(baseIface, Class).getCanonicalName();
              allInterfaces.push(this.use(baseIfaceName));
            });
          });
          const fields = spec.fields || {};
          Object.getOwnPropertyNames(fields).forEach((name2) => {
            const fieldType = this._getType(fields[name2]);
            dexFields.push([name2, fieldType.name]);
          });
          const baseMethods = {};
          const pendingOverloads = {};
          allInterfaces.forEach((iface) => {
            const h = iface.$borrowClassHandle(env2);
            tempHandles.push(h);
            const ifaceHandle = h.value;
            iface.$ownMembers.filter((name2) => {
              return iface[name2].overloads !== void 0;
            }).forEach((name2) => {
              const method2 = iface[name2];
              const overloads = method2.overloads;
              const overloadIds = overloads.map((overload) => makeOverloadId(name2, overload.returnType, overload.argumentTypes));
              baseMethods[name2] = [method2, overloadIds, ifaceHandle];
              overloads.forEach((overload, index) => {
                const id = overloadIds[index];
                pendingOverloads[id] = [overload, ifaceHandle];
              });
            });
          });
          const methods = spec.methods || {};
          const methodNames = Object.keys(methods);
          const methodEntries = methodNames.reduce((result2, name2) => {
            const entry = methods[name2];
            const rawName = name2 === "$init" ? "<init>" : name2;
            if (entry instanceof Array) {
              result2.push(...entry.map((e) => [rawName, e]));
            } else {
              result2.push([rawName, entry]);
            }
            return result2;
          }, []);
          const implMethods = [];
          methodEntries.forEach(([name2, methodValue]) => {
            let type = INSTANCE_METHOD;
            let returnType;
            let argumentTypes;
            let thrownTypeNames = [];
            let impl;
            if (typeof methodValue === "function") {
              const m2 = baseMethods[name2];
              if (m2 !== void 0 && Array.isArray(m2)) {
                const [baseMethod, overloadIds, parentTypeHandle] = m2;
                if (overloadIds.length > 1) {
                  throw new Error(`More than one overload matching '${name2}': signature must be specified`);
                }
                delete pendingOverloads[overloadIds[0]];
                const overload = baseMethod.overloads[0];
                type = overload.type;
                returnType = overload.returnType;
                argumentTypes = overload.argumentTypes;
                impl = methodValue;
                const reflectedMethod = env2.toReflectedMethod(parentTypeHandle, overload.handle, 0);
                const thrownTypes = invokeObjectMethodNoArgs(env2.handle, reflectedMethod, Method.getGenericExceptionTypes);
                thrownTypeNames = readTypeNames(env2, thrownTypes).map(makeJniObjectTypeName);
                env2.deleteLocalRef(thrownTypes);
                env2.deleteLocalRef(reflectedMethod);
              } else {
                returnType = this._getType("void");
                argumentTypes = [];
                impl = methodValue;
              }
            } else {
              if (methodValue.isStatic) {
                type = STATIC_METHOD;
              }
              returnType = this._getType(methodValue.returnType || "void");
              argumentTypes = (methodValue.argumentTypes || []).map((name3) => this._getType(name3));
              impl = methodValue.implementation;
              if (typeof impl !== "function") {
                throw new Error("Expected a function implementation for method: " + name2);
              }
              const id = makeOverloadId(name2, returnType, argumentTypes);
              const pendingOverload = pendingOverloads[id];
              if (pendingOverload !== void 0) {
                const [overload, parentTypeHandle] = pendingOverload;
                delete pendingOverloads[id];
                type = overload.type;
                returnType = overload.returnType;
                argumentTypes = overload.argumentTypes;
                const reflectedMethod = env2.toReflectedMethod(parentTypeHandle, overload.handle, 0);
                const thrownTypes = invokeObjectMethodNoArgs(env2.handle, reflectedMethod, Method.getGenericExceptionTypes);
                thrownTypeNames = readTypeNames(env2, thrownTypes).map(makeJniObjectTypeName);
                env2.deleteLocalRef(thrownTypes);
                env2.deleteLocalRef(reflectedMethod);
              }
            }
            const returnTypeName = returnType.name;
            const argumentTypeNames = argumentTypes.map((t) => t.name);
            const signature2 = "(" + argumentTypeNames.join("") + ")" + returnTypeName;
            dexMethods.push([name2, returnTypeName, argumentTypeNames, thrownTypeNames, type === STATIC_METHOD ? kAccStatic2 : 0]);
            implMethods.push([name2, signature2, type, returnType, argumentTypes, impl]);
          });
          const unimplementedMethodIds = Object.keys(pendingOverloads);
          if (unimplementedMethodIds.length > 0) {
            throw new Error("Missing implementation for: " + unimplementedMethodIds.join(", "));
          }
          const dex = DexFile.fromBuffer(mkdex_default(dexSpec), this);
          try {
            dex.load();
          } finally {
            dex.file.delete();
          }
          const classWrapper = this.use(spec.name);
          const numMethods = methodEntries.length;
          if (numMethods > 0) {
            const methodElementSize = 3 * pointerSize9;
            const methodElements = Memory.alloc(numMethods * methodElementSize);
            const nativeMethods = [];
            const temporaryHandles = [];
            implMethods.forEach(([name2, signature2, type, returnType, argumentTypes, impl], index) => {
              const rawName = Memory.allocUtf8String(name2);
              const rawSignature = Memory.allocUtf8String(signature2);
              const rawImpl = implement(name2, classWrapper, type, returnType, argumentTypes, impl);
              methodElements.add(index * methodElementSize).writePointer(rawName);
              methodElements.add(index * methodElementSize + pointerSize9).writePointer(rawSignature);
              methodElements.add(index * methodElementSize + 2 * pointerSize9).writePointer(rawImpl);
              temporaryHandles.push(rawName, rawSignature);
              nativeMethods.push(rawImpl);
            });
            const h = classWrapper.$borrowClassHandle(env2);
            tempHandles.push(h);
            const classHandle = h.value;
            env2.registerNatives(classHandle, methodElements, numMethods);
            env2.throwIfExceptionPending();
            classWrapper.$nativeMethods = nativeMethods;
          }
          return classWrapper;
        } finally {
          tempHandles.forEach((h) => {
            h.unref(env2);
          });
        }
      }
      choose(specifier, callbacks) {
        const env2 = vm2.getEnv();
        const { flavor } = api2;
        if (flavor === "jvm") {
          this._chooseObjectsJvm(specifier, env2, callbacks);
        } else if (flavor === "art") {
          const legacyApiMissing = api2["art::gc::Heap::VisitObjects"] === void 0;
          if (legacyApiMissing) {
            const preA12ApiMissing = api2["art::gc::Heap::GetInstances"] === void 0;
            if (preA12ApiMissing) {
              return this._chooseObjectsJvm(specifier, env2, callbacks);
            }
          }
          withRunnableArtThread(vm2, env2, (thread) => {
            if (legacyApiMissing) {
              this._chooseObjectsArtPreA12(specifier, env2, thread, callbacks);
            } else {
              this._chooseObjectsArtLegacy(specifier, env2, thread, callbacks);
            }
          });
        } else {
          this._chooseObjectsDalvik(specifier, env2, callbacks);
        }
      }
      _chooseObjectsJvm(className, env2, callbacks) {
        const classWrapper = this.use(className);
        const { jvmti } = api2;
        const JVMTI_ITERATION_CONTINUE = 1;
        const JVMTI_HEAP_OBJECT_EITHER = 3;
        const h = classWrapper.$borrowClassHandle(env2);
        const tag = int64(h.value.toString());
        try {
          const heapObjectCallback = new NativeCallback((classTag, size, tagPtr2, userData) => {
            tagPtr2.writeS64(tag);
            return JVMTI_ITERATION_CONTINUE;
          }, "int", ["int64", "int64", "pointer", "pointer"]);
          jvmti.iterateOverInstancesOfClass(h.value, JVMTI_HEAP_OBJECT_EITHER, heapObjectCallback, h.value);
          const tagPtr = Memory.alloc(8);
          tagPtr.writeS64(tag);
          const countPtr = Memory.alloc(jsizeSize3);
          const objectsPtr = Memory.alloc(pointerSize9);
          jvmti.getObjectsWithTags(1, tagPtr, countPtr, objectsPtr, NULL);
          const count = countPtr.readS32();
          const objects = objectsPtr.readPointer();
          const handles = [];
          for (let i = 0; i !== count; i++) {
            handles.push(objects.add(i * pointerSize9).readPointer());
          }
          jvmti.deallocate(objects);
          try {
            for (const handle2 of handles) {
              const instance = this.cast(handle2, classWrapper);
              const result2 = callbacks.onMatch(instance);
              if (result2 === "stop") {
                break;
              }
            }
            callbacks.onComplete();
          } finally {
            handles.forEach((handle2) => {
              env2.deleteLocalRef(handle2);
            });
          }
        } finally {
          h.unref(env2);
        }
      }
      _chooseObjectsArtPreA12(className, env2, thread, callbacks) {
        const classWrapper = this.use(className);
        const scope = VariableSizedHandleScope.$new(thread, vm2);
        let needle;
        const h = classWrapper.$borrowClassHandle(env2);
        try {
          const object = api2["art::JavaVMExt::DecodeGlobal"](api2.vm, thread, h.value);
          needle = scope.newHandle(object);
        } finally {
          h.unref(env2);
        }
        const maxCount = 0;
        const instances = HandleVector.$new();
        api2["art::gc::Heap::GetInstances"](api2.artHeap, scope, needle, maxCount, instances);
        const instanceHandles = instances.handles.map((handle2) => env2.newGlobalRef(handle2));
        instances.$delete();
        scope.$delete();
        try {
          for (const handle2 of instanceHandles) {
            const instance = this.cast(handle2, classWrapper);
            const result2 = callbacks.onMatch(instance);
            if (result2 === "stop") {
              break;
            }
          }
          callbacks.onComplete();
        } finally {
          instanceHandles.forEach((handle2) => {
            env2.deleteGlobalRef(handle2);
          });
        }
      }
      _chooseObjectsArtLegacy(className, env2, thread, callbacks) {
        const classWrapper = this.use(className);
        const instanceHandles = [];
        const addGlobalReference = api2["art::JavaVMExt::AddGlobalRef"];
        const vmHandle = api2.vm;
        let needle;
        const h = classWrapper.$borrowClassHandle(env2);
        try {
          needle = api2["art::JavaVMExt::DecodeGlobal"](vmHandle, thread, h.value).toInt32();
        } finally {
          h.unref(env2);
        }
        const collectMatchingInstanceHandles = makeObjectVisitorPredicate(needle, (object) => {
          instanceHandles.push(addGlobalReference(vmHandle, thread, object));
        });
        api2["art::gc::Heap::VisitObjects"](api2.artHeap, collectMatchingInstanceHandles, NULL);
        try {
          for (const handle2 of instanceHandles) {
            const instance = this.cast(handle2, classWrapper);
            const result2 = callbacks.onMatch(instance);
            if (result2 === "stop") {
              break;
            }
          }
        } finally {
          instanceHandles.forEach((handle2) => {
            env2.deleteGlobalRef(handle2);
          });
        }
        callbacks.onComplete();
      }
      _chooseObjectsDalvik(className, callerEnv, callbacks) {
        const classWrapper = this.use(className);
        if (api2.addLocalReference === null) {
          const libdvm = Process.getModuleByName("libdvm.so");
          let pattern;
          switch (Process.arch) {
            case "arm":
              pattern = "2d e9 f0 41 05 46 15 4e 0c 46 7e 44 11 b3 43 68";
              break;
            case "ia32":
              pattern = "8d 64 24 d4 89 5c 24 1c 89 74 24 20 e8 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 85 d2";
              break;
          }
          Memory.scan(libdvm.base, libdvm.size, pattern, {
            onMatch: (address, size) => {
              let wrapper;
              if (Process.arch === "arm") {
                address = address.or(1);
                wrapper = new NativeFunction(address, "pointer", ["pointer", "pointer"]);
              } else {
                const thunk = Memory.alloc(Process.pageSize);
                Memory.patchCode(thunk, 16, (code5) => {
                  const cw = new X86Writer(code5, { pc: thunk });
                  cw.putMovRegRegOffsetPtr("eax", "esp", 4);
                  cw.putMovRegRegOffsetPtr("edx", "esp", 8);
                  cw.putJmpAddress(address);
                  cw.flush();
                });
                wrapper = new NativeFunction(thunk, "pointer", ["pointer", "pointer"]);
                wrapper._thunk = thunk;
              }
              api2.addLocalReference = wrapper;
              vm2.perform((env2) => {
                enumerateInstances(this, env2);
              });
              return "stop";
            },
            onError(reason) {
            },
            onComplete() {
              if (api2.addLocalReference === null) {
                callbacks.onComplete();
              }
            }
          });
        } else {
          enumerateInstances(this, callerEnv);
        }
        function enumerateInstances(factory, env2) {
          const { DVM_JNI_ENV_OFFSET_SELF: DVM_JNI_ENV_OFFSET_SELF2 } = android_exports;
          const thread = env2.handle.add(DVM_JNI_ENV_OFFSET_SELF2).readPointer();
          let ptrClassObject;
          const h = classWrapper.$borrowClassHandle(env2);
          try {
            ptrClassObject = api2.dvmDecodeIndirectRef(thread, h.value);
          } finally {
            h.unref(env2);
          }
          const pattern = ptrClassObject.toMatchPattern();
          const heapSourceBase = api2.dvmHeapSourceGetBase();
          const heapSourceLimit = api2.dvmHeapSourceGetLimit();
          const size = heapSourceLimit.sub(heapSourceBase).toInt32();
          Memory.scan(heapSourceBase, size, pattern, {
            onMatch: (address, size2) => {
              if (api2.dvmIsValidObject(address)) {
                vm2.perform((env3) => {
                  const thread2 = env3.handle.add(DVM_JNI_ENV_OFFSET_SELF2).readPointer();
                  let instance;
                  const localReference = api2.addLocalReference(thread2, address);
                  try {
                    instance = factory.cast(localReference, classWrapper);
                  } finally {
                    env3.deleteLocalRef(localReference);
                  }
                  const result2 = callbacks.onMatch(instance);
                  if (result2 === "stop") {
                    return "stop";
                  }
                });
              }
            },
            onError(reason) {
            },
            onComplete() {
              callbacks.onComplete();
            }
          });
        }
      }
      openClassFile(filePath) {
        return new DexFile(filePath, null, this);
      }
      _getType(typeName, unbox = true) {
        return getType(typeName, unbox, this);
      }
    };
    wrapperHandler = {
      has(target, property) {
        if (property in target) {
          return true;
        }
        return target.$has(property);
      },
      get(target, property, receiver) {
        if (typeof property !== "string" || property.startsWith("$") || property === "class") {
          return target[property];
        }
        const unwrap2 = target.$find(property);
        if (unwrap2 !== null) {
          return unwrap2(receiver);
        }
        return target[property];
      },
      set(target, property, value, receiver) {
        target[property] = value;
        return true;
      },
      ownKeys(target) {
        return target.$list();
      },
      getOwnPropertyDescriptor(target, property) {
        if (Object.prototype.hasOwnProperty.call(target, property)) {
          return Object.getOwnPropertyDescriptor(target, property);
        }
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    };
    Object.defineProperties(Wrapper.prototype, {
      [Symbol.for("new")]: {
        enumerable: false,
        get() {
          return this.$getCtor("allocAndInit");
        }
      },
      $new: {
        enumerable: true,
        get() {
          return this[Symbol.for("new")];
        }
      },
      [Symbol.for("alloc")]: {
        enumerable: false,
        value() {
          const env2 = vm2.getEnv();
          const h = this.$borrowClassHandle(env2);
          try {
            const obj = env2.allocObject(h.value);
            const factory = this.$f;
            return factory.cast(obj, this);
          } finally {
            h.unref(env2);
          }
        }
      },
      $alloc: {
        enumerable: true,
        get() {
          return this[Symbol.for("alloc")];
        }
      },
      [Symbol.for("init")]: {
        enumerable: false,
        get() {
          return this.$getCtor("initOnly");
        }
      },
      $init: {
        enumerable: true,
        get() {
          return this[Symbol.for("init")];
        }
      },
      [Symbol.for("dispose")]: {
        enumerable: false,
        value() {
          const ref = this.$r;
          if (ref !== null) {
            this.$r = null;
            Script.unbindWeak(ref);
          }
          if (this.$h !== null) {
            this.$h = void 0;
          }
        }
      },
      $dispose: {
        enumerable: true,
        get() {
          return this[Symbol.for("dispose")];
        }
      },
      [Symbol.for("clone")]: {
        enumerable: false,
        value(env2) {
          const C = this.$C;
          return new C(this.$h, this.$t, env2);
        }
      },
      $clone: {
        value(env2) {
          return this[Symbol.for("clone")](env2);
        }
      },
      [Symbol.for("class")]: {
        enumerable: false,
        get() {
          const env2 = vm2.getEnv();
          const h = this.$borrowClassHandle(env2);
          try {
            const factory = this.$f;
            return factory.cast(h.value, factory.use("java.lang.Class"));
          } finally {
            h.unref(env2);
          }
        }
      },
      class: {
        enumerable: true,
        get() {
          return this[Symbol.for("class")];
        }
      },
      [Symbol.for("className")]: {
        enumerable: false,
        get() {
          const handle2 = this.$h;
          if (handle2 === null) {
            return this.$n;
          }
          return vm2.getEnv().getObjectClassName(handle2);
        }
      },
      $className: {
        enumerable: true,
        get() {
          return this[Symbol.for("className")];
        }
      },
      [Symbol.for("ownMembers")]: {
        enumerable: false,
        get() {
          const model = this.$l;
          return model.list();
        }
      },
      $ownMembers: {
        enumerable: true,
        get() {
          return this[Symbol.for("ownMembers")];
        }
      },
      [Symbol.for("super")]: {
        enumerable: false,
        get() {
          const env2 = vm2.getEnv();
          const C = this.$s.$C;
          return new C(this.$h, STRATEGY_DIRECT, env2);
        }
      },
      $super: {
        enumerable: true,
        get() {
          return this[Symbol.for("super")];
        }
      },
      [Symbol.for("s")]: {
        enumerable: false,
        get() {
          const proto = Object.getPrototypeOf(this);
          let superWrapper = proto.$_s;
          if (superWrapper === void 0) {
            const env2 = vm2.getEnv();
            const h = this.$borrowClassHandle(env2);
            try {
              const superHandle = env2.getSuperclass(h.value);
              if (!superHandle.isNull()) {
                try {
                  const superClassName = env2.getClassName(superHandle);
                  const factory = proto.$f;
                  superWrapper = factory._getUsedClass(superClassName);
                  if (superWrapper === void 0) {
                    try {
                      const getSuperClassHandle = makeSuperHandleGetter(this);
                      superWrapper = factory._make(superClassName, getSuperClassHandle, env2);
                    } finally {
                      factory._setUsedClass(superClassName, superWrapper);
                    }
                  }
                } finally {
                  env2.deleteLocalRef(superHandle);
                }
              } else {
                superWrapper = null;
              }
            } finally {
              h.unref(env2);
            }
            proto.$_s = superWrapper;
          }
          return superWrapper;
        }
      },
      $s: {
        get() {
          return this[Symbol.for("s")];
        }
      },
      [Symbol.for("isSameObject")]: {
        enumerable: false,
        value(obj) {
          const env2 = vm2.getEnv();
          return env2.isSameObject(obj.$h, this.$h);
        }
      },
      $isSameObject: {
        value(obj) {
          return this[Symbol.for("isSameObject")](obj);
        }
      },
      [Symbol.for("getCtor")]: {
        enumerable: false,
        value(type) {
          const slot = this.$c;
          let ctor = slot[0];
          if (ctor === null) {
            const env2 = vm2.getEnv();
            const h = this.$borrowClassHandle(env2);
            try {
              ctor = makeConstructor(h.value, this.$w, env2);
              slot[0] = ctor;
            } finally {
              h.unref(env2);
            }
          }
          return ctor[type];
        }
      },
      $getCtor: {
        value(type) {
          return this[Symbol.for("getCtor")](type);
        }
      },
      [Symbol.for("borrowClassHandle")]: {
        enumerable: false,
        value(env2) {
          const className = this.$n;
          const classHandles = this.$f._classHandles;
          let handle2 = classHandles.get(className);
          if (handle2 === void 0) {
            handle2 = new ClassHandle(this.$gch(env2), env2);
            classHandles.set(className, handle2, env2);
          }
          return handle2.ref();
        }
      },
      $borrowClassHandle: {
        value(env2) {
          return this[Symbol.for("borrowClassHandle")](env2);
        }
      },
      [Symbol.for("copyClassHandle")]: {
        enumerable: false,
        value(env2) {
          const h = this.$borrowClassHandle(env2);
          try {
            return env2.newLocalRef(h.value);
          } finally {
            h.unref(env2);
          }
        }
      },
      $copyClassHandle: {
        value(env2) {
          return this[Symbol.for("copyClassHandle")](env2);
        }
      },
      [Symbol.for("getHandle")]: {
        enumerable: false,
        value(env2) {
          const handle2 = this.$h;
          const isDisposed = handle2 === void 0;
          if (isDisposed) {
            throw new Error("Wrapper is disposed; perhaps it was borrowed from a hook instead of calling Java.retain() to make a long-lived wrapper?");
          }
          return handle2;
        }
      },
      $getHandle: {
        value(env2) {
          return this[Symbol.for("getHandle")](env2);
        }
      },
      [Symbol.for("list")]: {
        enumerable: false,
        value() {
          const superWrapper = this.$s;
          const superMembers = superWrapper !== null ? superWrapper.$list() : [];
          const model = this.$l;
          return Array.from(new Set(superMembers.concat(model.list())));
        }
      },
      $list: {
        get() {
          return this[Symbol.for("list")];
        }
      },
      [Symbol.for("has")]: {
        enumerable: false,
        value(member) {
          const members = this.$m;
          if (members.has(member)) {
            return true;
          }
          const model = this.$l;
          if (model.has(member)) {
            return true;
          }
          const superWrapper = this.$s;
          if (superWrapper !== null && superWrapper.$has(member)) {
            return true;
          }
          return false;
        }
      },
      $has: {
        value(member) {
          return this[Symbol.for("has")](member);
        }
      },
      [Symbol.for("find")]: {
        enumerable: false,
        value(member) {
          const members = this.$m;
          let value = members.get(member);
          if (value !== void 0) {
            return value;
          }
          const model = this.$l;
          const spec = model.find(member);
          if (spec !== null) {
            const env2 = vm2.getEnv();
            const h = this.$borrowClassHandle(env2);
            try {
              value = makeMember(member, spec, h.value, this.$w, env2);
            } finally {
              h.unref(env2);
            }
            members.set(member, value);
            return value;
          }
          const superWrapper = this.$s;
          if (superWrapper !== null) {
            return superWrapper.$find(member);
          }
          return null;
        }
      },
      $find: {
        value(member) {
          return this[Symbol.for("find")](member);
        }
      },
      [Symbol.for("toJSON")]: {
        enumerable: false,
        value() {
          const wrapperName = this.$n;
          const handle2 = this.$h;
          if (handle2 === null) {
            return `<class: ${wrapperName}>`;
          }
          const actualName = this.$className;
          if (wrapperName === actualName) {
            return `<instance: ${wrapperName}>`;
          }
          return `<instance: ${wrapperName}, $className: ${actualName}>`;
        }
      },
      toJSON: {
        get() {
          return this[Symbol.for("toJSON")];
        }
      }
    });
    ClassHandle.prototype.ref = function() {
      this.refs++;
      return this;
    };
    ClassHandle.prototype.unref = function(env2) {
      if (--this.refs === 0) {
        env2.deleteGlobalRef(this.value);
      }
    };
    dispatcherPrototype = Object.create(Function.prototype, {
      overloads: {
        enumerable: true,
        get() {
          return this._o;
        }
      },
      overload: {
        value(...args) {
          const overloads = this._o;
          const numArgs = args.length;
          const signature2 = args.join(":");
          for (let i = 0; i !== overloads.length; i++) {
            const method2 = overloads[i];
            const { argumentTypes } = method2;
            if (argumentTypes.length !== numArgs) {
              continue;
            }
            const s = argumentTypes.map((t) => t.className).join(":");
            if (s === signature2) {
              return method2;
            }
          }
          throwOverloadError(this.methodName, this.overloads, "specified argument types do not match any of:");
        }
      },
      methodName: {
        enumerable: true,
        get() {
          return this._o[0].methodName;
        }
      },
      holder: {
        enumerable: true,
        get() {
          return this._o[0].holder;
        }
      },
      type: {
        enumerable: true,
        get() {
          return this._o[0].type;
        }
      },
      handle: {
        enumerable: true,
        get() {
          throwIfDispatcherAmbiguous(this);
          return this._o[0].handle;
        }
      },
      implementation: {
        enumerable: true,
        get() {
          throwIfDispatcherAmbiguous(this);
          return this._o[0].implementation;
        },
        set(fn) {
          throwIfDispatcherAmbiguous(this);
          this._o[0].implementation = fn;
        }
      },
      returnType: {
        enumerable: true,
        get() {
          throwIfDispatcherAmbiguous(this);
          return this._o[0].returnType;
        }
      },
      argumentTypes: {
        enumerable: true,
        get() {
          throwIfDispatcherAmbiguous(this);
          return this._o[0].argumentTypes;
        }
      },
      canInvokeWith: {
        enumerable: true,
        get(args) {
          throwIfDispatcherAmbiguous(this);
          return this._o[0].canInvokeWith;
        }
      },
      clone: {
        enumerable: true,
        value(options) {
          throwIfDispatcherAmbiguous(this);
          return this._o[0].clone(options);
        }
      },
      invoke: {
        value(receiver, args) {
          const overloads = this._o;
          const isInstance = receiver.$h !== null;
          for (let i = 0; i !== overloads.length; i++) {
            const method2 = overloads[i];
            if (!method2.canInvokeWith(args)) {
              continue;
            }
            if (method2.type === INSTANCE_METHOD && !isInstance) {
              const name2 = this.methodName;
              if (name2 === "toString") {
                return `<class: ${receiver.$n}>`;
              }
              throw new Error(name2 + ": cannot call instance method without an instance");
            }
            return method2.apply(receiver, args);
          }
          if (this.methodName === "toString") {
            return `<class: ${receiver.$n}>`;
          }
          throwOverloadError(this.methodName, this.overloads, "argument types do not match any of:");
        }
      }
    });
    methodPrototype = Object.create(Function.prototype, {
      methodName: {
        enumerable: true,
        get() {
          return this._p[0];
        }
      },
      holder: {
        enumerable: true,
        get() {
          return this._p[1];
        }
      },
      type: {
        enumerable: true,
        get() {
          return this._p[2];
        }
      },
      handle: {
        enumerable: true,
        get() {
          return this._p[3];
        }
      },
      implementation: {
        enumerable: true,
        get() {
          const replacement = this._r;
          return replacement !== void 0 ? replacement : null;
        },
        set(fn) {
          const params = this._p;
          const holder = params[1];
          const type = params[2];
          if (type === CONSTRUCTOR_METHOD) {
            throw new Error("Reimplementing $new is not possible; replace implementation of $init instead");
          }
          const existingReplacement = this._r;
          if (existingReplacement !== void 0) {
            holder.$f._patchedMethods.delete(this);
            const mangler = existingReplacement._m;
            mangler.revert(vm2);
            this._r = void 0;
          }
          if (fn !== null) {
            const [methodName, classWrapper, type2, methodId, retType2, argTypes2] = params;
            const replacement = implement(methodName, classWrapper, type2, retType2, argTypes2, fn, this);
            const mangler = makeMethodMangler3(methodId);
            replacement._m = mangler;
            this._r = replacement;
            mangler.replace(replacement, type2 === INSTANCE_METHOD, argTypes2, vm2, api2);
            holder.$f._patchedMethods.add(this);
          }
        }
      },
      returnType: {
        enumerable: true,
        get() {
          return this._p[4];
        }
      },
      argumentTypes: {
        enumerable: true,
        get() {
          return this._p[5];
        }
      },
      canInvokeWith: {
        enumerable: true,
        value(args) {
          const argTypes2 = this._p[5];
          if (args.length !== argTypes2.length) {
            return false;
          }
          return argTypes2.every((t, i) => {
            return t.isCompatible(args[i]);
          });
        }
      },
      clone: {
        enumerable: true,
        value(options) {
          const params = this._p.slice(0, 6);
          return makeMethod(...params, null, options);
        }
      },
      invoke: {
        value(receiver, args) {
          const env2 = vm2.getEnv();
          const params = this._p;
          const type = params[2];
          const retType2 = params[4];
          const argTypes2 = params[5];
          const replacement = this._r;
          const isInstanceMethod = type === INSTANCE_METHOD;
          const numArgs = args.length;
          const frameCapacity = 2 + numArgs;
          env2.pushLocalFrame(frameCapacity);
          let borrowedHandle = null;
          try {
            let jniThis;
            if (isInstanceMethod) {
              jniThis = receiver.$getHandle();
            } else {
              borrowedHandle = receiver.$borrowClassHandle(env2);
              jniThis = borrowedHandle.value;
            }
            let methodId;
            let strategy = receiver.$t;
            if (replacement === void 0) {
              methodId = params[3];
            } else {
              const mangler = replacement._m;
              methodId = mangler.resolveTarget(receiver, isInstanceMethod, env2, api2);
              if (isArtVm) {
                const pendingCalls = replacement._c;
                if (pendingCalls.has(getCurrentThreadId())) {
                  strategy = STRATEGY_DIRECT;
                }
              }
            }
            const jniArgs = [
              env2.handle,
              jniThis,
              methodId
            ];
            for (let i = 0; i !== numArgs; i++) {
              jniArgs.push(argTypes2[i].toJni(args[i], env2));
            }
            let jniCall;
            if (strategy === STRATEGY_VIRTUAL) {
              jniCall = params[6];
            } else {
              jniCall = params[7];
              if (isInstanceMethod) {
                jniArgs.splice(2, 0, receiver.$copyClassHandle(env2));
              }
            }
            const jniRetval = jniCall.apply(null, jniArgs);
            env2.throwIfExceptionPending();
            return retType2.fromJni(jniRetval, env2, true);
          } finally {
            if (borrowedHandle !== null) {
              borrowedHandle.unref(env2);
            }
            env2.popLocalFrame(NULL);
          }
        }
      },
      toString: {
        enumerable: true,
        value() {
          return `function ${this.methodName}(${this.argumentTypes.map((t) => t.className).join(", ")}): ${this.returnType.className}`;
        }
      }
    });
    valueOfPrototype = Object.create(Function.prototype, {
      methodName: {
        enumerable: true,
        get() {
          return "valueOf";
        }
      },
      holder: {
        enumerable: true,
        get() {
          return this._p[0];
        }
      },
      type: {
        enumerable: true,
        get() {
          return this._p[1];
        }
      },
      handle: {
        enumerable: true,
        get() {
          return NULL;
        }
      },
      implementation: {
        enumerable: true,
        get() {
          return null;
        },
        set(fn) {
        }
      },
      returnType: {
        enumerable: true,
        get() {
          const classWrapper = this.holder;
          return classWrapper.$f.use(classWrapper.$n);
        }
      },
      argumentTypes: {
        enumerable: true,
        get() {
          return [];
        }
      },
      canInvokeWith: {
        enumerable: true,
        value(args) {
          return args.length === 0;
        }
      },
      clone: {
        enumerable: true,
        value(options) {
          throw new Error("Invalid operation");
        }
      }
    });
    Object.defineProperties(Field.prototype, {
      value: {
        enumerable: true,
        get() {
          const [holder, type, rtype, id, getValue] = this._p;
          const env2 = vm2.getEnv();
          env2.pushLocalFrame(4);
          let borrowedHandle = null;
          try {
            let jniThis;
            if (type === INSTANCE_FIELD) {
              jniThis = holder.$getHandle();
              if (jniThis === null) {
                throw new Error("Cannot access an instance field without an instance");
              }
            } else {
              borrowedHandle = holder.$borrowClassHandle(env2);
              jniThis = borrowedHandle.value;
            }
            const jniRetval = getValue(env2.handle, jniThis, id);
            env2.throwIfExceptionPending();
            return rtype.fromJni(jniRetval, env2, true);
          } finally {
            if (borrowedHandle !== null) {
              borrowedHandle.unref(env2);
            }
            env2.popLocalFrame(NULL);
          }
        },
        set(value) {
          const [holder, type, rtype, id, , setValue] = this._p;
          const env2 = vm2.getEnv();
          env2.pushLocalFrame(4);
          let borrowedHandle = null;
          try {
            let jniThis;
            if (type === INSTANCE_FIELD) {
              jniThis = holder.$getHandle();
              if (jniThis === null) {
                throw new Error("Cannot access an instance field without an instance");
              }
            } else {
              borrowedHandle = holder.$borrowClassHandle(env2);
              jniThis = borrowedHandle.value;
            }
            if (!rtype.isCompatible(value)) {
              throw new Error(`Expected value compatible with ${rtype.className}`);
            }
            const jniValue = rtype.toJni(value, env2);
            setValue(env2.handle, jniThis, id, jniValue);
            env2.throwIfExceptionPending();
          } finally {
            if (borrowedHandle !== null) {
              borrowedHandle.unref(env2);
            }
            env2.popLocalFrame(NULL);
          }
        }
      },
      holder: {
        enumerable: true,
        get() {
          return this._p[0];
        }
      },
      fieldType: {
        enumerable: true,
        get() {
          return this._p[1];
        }
      },
      fieldReturnType: {
        enumerable: true,
        get() {
          return this._p[2];
        }
      },
      toString: {
        enumerable: true,
        value() {
          const inlineString = `Java.Field{holder: ${this.holder}, fieldType: ${this.fieldType}, fieldReturnType: ${this.fieldReturnType}, value: ${this.value}}`;
          if (inlineString.length < 200) {
            return inlineString;
          }
          const multilineString = `Java.Field{
	holder: ${this.holder},
	fieldType: ${this.fieldType},
	fieldReturnType: ${this.fieldReturnType},
	value: ${this.value},
}`;
          return multilineString.split("\n").map((l) => l.length > 200 ? l.slice(0, l.indexOf(" ") + 1) + "...," : l).join("\n");
        }
      }
    });
    DexFile = class _DexFile {
      static fromBuffer(buffer, factory) {
        const fileValue = createTemporaryDex(factory);
        const filePath = fileValue.getCanonicalPath().toString();
        const file = new File(filePath, "w");
        file.write(buffer.buffer);
        file.close();
        setReadOnlyDex(filePath, factory);
        return new _DexFile(filePath, fileValue, factory);
      }
      constructor(path, file, factory) {
        this.path = path;
        this.file = file;
        this._factory = factory;
      }
      load() {
        const { _factory: factory } = this;
        const { codeCacheDir } = factory;
        const DexClassLoader = factory.use("dalvik.system.DexClassLoader");
        const JFile = factory.use("java.io.File");
        let file = this.file;
        if (file === null) {
          file = factory.use("java.io.File").$new(this.path);
        }
        if (!file.exists()) {
          throw new Error("File not found");
        }
        JFile.$new(codeCacheDir).mkdirs();
        factory.loader = DexClassLoader.$new(file.getCanonicalPath(), codeCacheDir, null, factory.loader);
        vm2.preventDetachDueToClassLoader();
      }
      getClassNames() {
        const { _factory: factory } = this;
        const DexFile2 = factory.use("dalvik.system.DexFile");
        const optimizedDex = createTemporaryDex(factory);
        const dx = DexFile2.loadDex(this.path, optimizedDex.getCanonicalPath(), 0);
        const classNames = [];
        const enumeratorClassNames = dx.entries();
        while (enumeratorClassNames.hasMoreElements()) {
          classNames.push(enumeratorClassNames.nextElement().toString());
        }
        return classNames;
      }
    };
  }
});

// node_modules/frida-java-bridge/index.js
function initFactoryFromApplication(factory, app) {
  const Process2 = factory.use("android.os.Process");
  factory.loader = app.getClassLoader();
  if (Process2.myUid() === Process2.SYSTEM_UID.value) {
    factory.cacheDir = "/data/system";
    factory.codeCacheDir = "/data/dalvik-cache";
  } else {
    if ("getCodeCacheDir" in app) {
      factory.cacheDir = app.getCacheDir().getCanonicalPath();
      factory.codeCacheDir = app.getCodeCacheDir().getCanonicalPath();
    } else {
      factory.cacheDir = app.getFilesDir().getCanonicalPath();
      factory.codeCacheDir = app.getCacheDir().getCanonicalPath();
    }
  }
}
function initFactoryFromLoadedApk(factory, apk) {
  const JFile = factory.use("java.io.File");
  factory.loader = apk.getClassLoader();
  const dataDir = JFile.$new(apk.getDataDir()).getCanonicalPath();
  factory.cacheDir = dataDir;
  factory.codeCacheDir = dataDir + "/cache";
}
var jsizeSize4, pointerSize10, Runtime2, runtime2, frida_java_bridge_default;
var init_frida_java_bridge = __esm({
  "node_modules/frida-java-bridge/index.js"() {
    "use strict";
    init_node_globals();
    init_api2();
    init_android();
    init_class_factory();
    init_class_model();
    init_env();
    init_types();
    init_vm();
    init_result();
    jsizeSize4 = 4;
    pointerSize10 = Process.pointerSize;
    Runtime2 = class {
      ACC_PUBLIC = 1;
      ACC_PRIVATE = 2;
      ACC_PROTECTED = 4;
      ACC_STATIC = 8;
      ACC_FINAL = 16;
      ACC_SYNCHRONIZED = 32;
      ACC_BRIDGE = 64;
      ACC_VARARGS = 128;
      ACC_NATIVE = 256;
      ACC_ABSTRACT = 1024;
      ACC_STRICT = 2048;
      ACC_SYNTHETIC = 4096;
      constructor() {
        this.classFactory = null;
        this.ClassFactory = ClassFactory;
        this.vm = null;
        this.api = null;
        this._initialized = false;
        this._apiError = null;
        this._wakeupHandler = null;
        this._pollListener = null;
        this._pendingMainOps = [];
        this._pendingVmOps = [];
        this._cachedIsAppProcess = null;
        try {
          this._tryInitialize();
        } catch (e) {
        }
      }
      _tryInitialize() {
        if (this._initialized) {
          return true;
        }
        if (this._apiError !== null) {
          throw this._apiError;
        }
        let api3;
        try {
          api3 = api_default();
          this.api = api3;
        } catch (e) {
          this._apiError = e;
          throw e;
        }
        if (api3 === null) {
          return false;
        }
        const vm3 = new VM(api3);
        this.vm = vm3;
        initialize(vm3);
        ClassFactory._initialize(vm3, api3);
        this.classFactory = new ClassFactory();
        this._initialized = true;
        return true;
      }
      _dispose() {
        if (this.api === null) {
          return;
        }
        const { vm: vm3 } = this;
        vm3.perform((env2) => {
          ClassFactory._disposeAll(env2);
          Env.dispose(env2);
        });
        Script.nextTick(() => {
          VM.dispose(vm3);
        });
      }
      get available() {
        return this._tryInitialize();
      }
      get androidVersion() {
        return getAndroidVersion();
      }
      synchronized(obj, fn) {
        const { $h: objHandle = obj } = obj;
        if (!(objHandle instanceof NativePointer)) {
          throw new Error("Java.synchronized: the first argument `obj` must be either a pointer or a Java instance");
        }
        const env2 = this.vm.getEnv();
        checkJniResult("VM::MonitorEnter", env2.monitorEnter(objHandle));
        try {
          fn();
        } finally {
          env2.monitorExit(objHandle);
        }
      }
      enumerateLoadedClasses(callbacks) {
        this._checkAvailable();
        const { flavor } = this.api;
        if (flavor === "jvm") {
          this._enumerateLoadedClassesJvm(callbacks);
        } else if (flavor === "art") {
          this._enumerateLoadedClassesArt(callbacks);
        } else {
          this._enumerateLoadedClassesDalvik(callbacks);
        }
      }
      enumerateLoadedClassesSync() {
        const classes = [];
        this.enumerateLoadedClasses({
          onMatch(c) {
            classes.push(c);
          },
          onComplete() {
          }
        });
        return classes;
      }
      enumerateClassLoaders(callbacks) {
        this._checkAvailable();
        const { flavor } = this.api;
        if (flavor === "jvm") {
          this._enumerateClassLoadersJvm(callbacks);
        } else if (flavor === "art") {
          this._enumerateClassLoadersArt(callbacks);
        } else {
          throw new Error("Enumerating class loaders is not supported on Dalvik");
        }
      }
      enumerateClassLoadersSync() {
        const loaders = [];
        this.enumerateClassLoaders({
          onMatch(c) {
            loaders.push(c);
          },
          onComplete() {
          }
        });
        return loaders;
      }
      _enumerateLoadedClassesJvm(callbacks) {
        const { api: api3, vm: vm3 } = this;
        const { jvmti } = api3;
        const env2 = vm3.getEnv();
        const countPtr = Memory.alloc(jsizeSize4);
        const classesPtr = Memory.alloc(pointerSize10);
        jvmti.getLoadedClasses(countPtr, classesPtr);
        const count = countPtr.readS32();
        const classes = classesPtr.readPointer();
        const handles = [];
        for (let i = 0; i !== count; i++) {
          handles.push(classes.add(i * pointerSize10).readPointer());
        }
        jvmti.deallocate(classes);
        try {
          for (const handle2 of handles) {
            const className = env2.getClassName(handle2);
            callbacks.onMatch(className, handle2);
          }
          callbacks.onComplete();
        } finally {
          handles.forEach((handle2) => {
            env2.deleteLocalRef(handle2);
          });
        }
      }
      _enumerateClassLoadersJvm(callbacks) {
        this.choose("java.lang.ClassLoader", callbacks);
      }
      _enumerateLoadedClassesArt(callbacks) {
        const { vm: vm3, api: api3 } = this;
        const env2 = vm3.getEnv();
        const addGlobalReference = api3["art::JavaVMExt::AddGlobalRef"];
        const { vm: vmHandle } = api3;
        withRunnableArtThread(vm3, env2, (thread) => {
          const collectClassHandles = makeArtClassVisitor((klass) => {
            const handle2 = addGlobalReference(vmHandle, thread, klass);
            try {
              const className = env2.getClassName(handle2);
              callbacks.onMatch(className, handle2);
            } finally {
              env2.deleteGlobalRef(handle2);
            }
            return true;
          });
          api3["art::ClassLinker::VisitClasses"](api3.artClassLinker.address, collectClassHandles);
        });
        callbacks.onComplete();
      }
      _enumerateClassLoadersArt(callbacks) {
        const { classFactory: factory, vm: vm3, api: api3 } = this;
        const env2 = vm3.getEnv();
        const visitClassLoaders = api3["art::ClassLinker::VisitClassLoaders"];
        if (visitClassLoaders === void 0) {
          throw new Error("This API is only available on Android >= 7.0");
        }
        const ClassLoader = factory.use("java.lang.ClassLoader");
        const loaderHandles = [];
        const addGlobalReference = api3["art::JavaVMExt::AddGlobalRef"];
        const { vm: vmHandle } = api3;
        withRunnableArtThread(vm3, env2, (thread) => {
          const collectLoaderHandles = makeArtClassLoaderVisitor((loader) => {
            loaderHandles.push(addGlobalReference(vmHandle, thread, loader));
            return true;
          });
          withAllArtThreadsSuspended(() => {
            visitClassLoaders(api3.artClassLinker.address, collectLoaderHandles);
          });
        });
        try {
          loaderHandles.forEach((handle2) => {
            const loader = factory.cast(handle2, ClassLoader);
            callbacks.onMatch(loader);
          });
        } finally {
          loaderHandles.forEach((handle2) => {
            env2.deleteGlobalRef(handle2);
          });
        }
        callbacks.onComplete();
      }
      _enumerateLoadedClassesDalvik(callbacks) {
        const { api: api3 } = this;
        const HASH_TOMBSTONE = ptr("0xcbcacccd");
        const loadedClassesOffset = 172;
        const hashEntrySize = 8;
        const ptrLoadedClassesHashtable = api3.gDvm.add(loadedClassesOffset);
        const hashTable = ptrLoadedClassesHashtable.readPointer();
        const tableSize = hashTable.readS32();
        const ptrpEntries = hashTable.add(12);
        const pEntries = ptrpEntries.readPointer();
        const end = tableSize * hashEntrySize;
        for (let offset = 0; offset < end; offset += hashEntrySize) {
          const pEntryPtr = pEntries.add(offset);
          const dataPtr = pEntryPtr.add(4).readPointer();
          if (dataPtr.isNull() || dataPtr.equals(HASH_TOMBSTONE)) {
            continue;
          }
          const descriptionPtr = dataPtr.add(24).readPointer();
          const description = descriptionPtr.readUtf8String();
          if (description.startsWith("L")) {
            const name2 = description.substring(1, description.length - 1).replace(/\//g, ".");
            callbacks.onMatch(name2);
          }
        }
        callbacks.onComplete();
      }
      enumerateMethods(query) {
        const { classFactory: factory } = this;
        const env2 = this.vm.getEnv();
        const ClassLoader = factory.use("java.lang.ClassLoader");
        return Model.enumerateMethods(query, this.api, env2).map((group) => {
          const handle2 = group.loader;
          group.loader = handle2 !== null ? factory.wrap(handle2, ClassLoader, env2) : null;
          return group;
        });
      }
      scheduleOnMainThread(fn) {
        this.performNow(() => {
          this._pendingMainOps.push(fn);
          let { _wakeupHandler: wakeupHandler } = this;
          if (wakeupHandler === null) {
            const { classFactory: factory } = this;
            const Handler = factory.use("android.os.Handler");
            const Looper = factory.use("android.os.Looper");
            wakeupHandler = Handler.$new(Looper.getMainLooper());
            this._wakeupHandler = wakeupHandler;
          }
          if (this._pollListener === null) {
            this._pollListener = Interceptor.attach(Process.getModuleByName("libc.so").getExportByName("epoll_wait"), this._makePollHook());
            Interceptor.flush();
          }
          wakeupHandler.sendEmptyMessage(1);
        });
      }
      _makePollHook() {
        const mainThreadId = Process.id;
        const { _pendingMainOps: pending } = this;
        return function() {
          if (this.threadId !== mainThreadId) {
            return;
          }
          let fn;
          while ((fn = pending.shift()) !== void 0) {
            try {
              fn();
            } catch (e) {
              Script.nextTick(() => {
                throw e;
              });
            }
          }
        };
      }
      perform(fn) {
        this._checkAvailable();
        if (!this._isAppProcess() || this.classFactory.loader !== null) {
          try {
            this.vm.perform(fn);
          } catch (e) {
            Script.nextTick(() => {
              throw e;
            });
          }
        } else {
          this._pendingVmOps.push(fn);
          if (this._pendingVmOps.length === 1) {
            this._performPendingVmOpsWhenReady();
          }
        }
      }
      performNow(fn) {
        this._checkAvailable();
        return this.vm.perform(() => {
          const { classFactory: factory } = this;
          if (this._isAppProcess() && factory.loader === null) {
            const ActivityThread = factory.use("android.app.ActivityThread");
            const app = ActivityThread.currentApplication();
            if (app !== null) {
              initFactoryFromApplication(factory, app);
            }
          }
          return fn();
        });
      }
      _performPendingVmOpsWhenReady() {
        this.vm.perform(() => {
          const { classFactory: factory } = this;
          const ActivityThread = factory.use("android.app.ActivityThread");
          const app = ActivityThread.currentApplication();
          if (app !== null) {
            initFactoryFromApplication(factory, app);
            this._performPendingVmOps();
            return;
          }
          const runtime3 = this;
          let initialized = false;
          let hookpoint = "early";
          const handleBindApplication = ActivityThread.handleBindApplication;
          handleBindApplication.implementation = function(data) {
            if (data.instrumentationName.value !== null) {
              hookpoint = "late";
              const LoadedApk = factory.use("android.app.LoadedApk");
              const makeApplication = LoadedApk.makeApplication;
              makeApplication.implementation = function(forceDefaultAppClass, instrumentation) {
                if (!initialized) {
                  initialized = true;
                  initFactoryFromLoadedApk(factory, this);
                  runtime3._performPendingVmOps();
                }
                return makeApplication.apply(this, arguments);
              };
            }
            handleBindApplication.apply(this, arguments);
          };
          const getPackageInfoCandidates = ActivityThread.getPackageInfo.overloads.map((m2) => [m2.argumentTypes.length, m2]).sort(([arityA], [arityB]) => arityB - arityA).map(([_, method2]) => method2);
          const getPackageInfo = getPackageInfoCandidates[0];
          getPackageInfo.implementation = function(...args) {
            const apk = getPackageInfo.call(this, ...args);
            if (!initialized && hookpoint === "early") {
              initialized = true;
              initFactoryFromLoadedApk(factory, apk);
              runtime3._performPendingVmOps();
            }
            return apk;
          };
        });
      }
      _performPendingVmOps() {
        const { vm: vm3, _pendingVmOps: pending } = this;
        let fn;
        while ((fn = pending.shift()) !== void 0) {
          try {
            vm3.perform(fn);
          } catch (e) {
            Script.nextTick(() => {
              throw e;
            });
          }
        }
      }
      use(className, options) {
        return this.classFactory.use(className, options);
      }
      openClassFile(filePath) {
        return this.classFactory.openClassFile(filePath);
      }
      choose(specifier, callbacks) {
        this.classFactory.choose(specifier, callbacks);
      }
      retain(obj) {
        return this.classFactory.retain(obj);
      }
      cast(obj, C) {
        return this.classFactory.cast(obj, C);
      }
      array(type, elements) {
        return this.classFactory.array(type, elements);
      }
      backtrace(options) {
        return backtrace(this.vm, options);
      }
      // Reference: http://stackoverflow.com/questions/2848575/how-to-detect-ui-thread-on-android
      isMainThread() {
        const Looper = this.classFactory.use("android.os.Looper");
        const mainLooper = Looper.getMainLooper();
        const myLooper = Looper.myLooper();
        if (myLooper === null) {
          return false;
        }
        return mainLooper.$isSameObject(myLooper);
      }
      registerClass(spec) {
        return this.classFactory.registerClass(spec);
      }
      deoptimizeEverything() {
        const { vm: vm3 } = this;
        return deoptimizeEverything(vm3, vm3.getEnv());
      }
      deoptimizeBootImage() {
        const { vm: vm3 } = this;
        return deoptimizeBootImage(vm3, vm3.getEnv());
      }
      deoptimizeMethod(method2) {
        const { vm: vm3 } = this;
        return deoptimizeMethod(vm3, vm3.getEnv(), method2);
      }
      _checkAvailable() {
        if (!this.available) {
          throw new Error("Java API not available");
        }
      }
      _isAppProcess() {
        let result2 = this._cachedIsAppProcess;
        if (result2 === null) {
          if (this.api.flavor === "jvm") {
            result2 = false;
            this._cachedIsAppProcess = result2;
            return result2;
          }
          const readlink = new NativeFunction(Module.getGlobalExportByName("readlink"), "pointer", ["pointer", "pointer", "pointer"], {
            exceptions: "propagate"
          });
          const pathname = Memory.allocUtf8String("/proc/self/exe");
          const bufferSize = 1024;
          const buffer = Memory.alloc(bufferSize);
          const size = readlink(pathname, buffer, ptr(bufferSize)).toInt32();
          if (size !== -1) {
            const exe = buffer.readUtf8String(size);
            result2 = /^\/system\/bin\/app_process/.test(exe);
          } else {
            result2 = true;
          }
          this._cachedIsAppProcess = result2;
        }
        return result2;
      }
    };
    runtime2 = new Runtime2();
    Script.bindWeak(runtime2, () => {
      runtime2._dispose();
    });
    frida_java_bridge_default = runtime2;
  }
});

// agent/Utils/Platform.ts
var PlatformDetector;
var init_Platform = __esm({
  "agent/Utils/Platform.ts"() {
    "use strict";
    init_node_globals();
    init_frida_objc_bridge();
    init_frida_java_bridge();
    PlatformDetector = class {
      static detectedPlatform = null;
      /**
       * Detect the current platform with caching
       */
      static detect() {
        if (this.detectedPlatform === null) {
          this.detectedPlatform = this.performDetection();
        }
        return this.detectedPlatform;
      }
      /**
       * Force re-detection of platform (useful for testing)
       */
      static resetCache() {
        this.detectedPlatform = null;
      }
      /**
       * Check if current platform is iOS
       */
      static isIOS() {
        return this.detect() === "ios";
      }
      /**
       * Check if current platform is Android
       */
      static isAndroid() {
        return this.detect() === "android";
      }
      /**
       * Check if platform is known
       */
      static isKnown() {
        return this.detect() !== "unknown";
      }
      /**
       * Perform actual platform detection
       */
      static performDetection() {
        try {
          if (typeof frida_objc_bridge_default !== "undefined" && frida_objc_bridge_default.available) {
            return "ios";
          }
        } catch (error) {
        }
        try {
          if (typeof frida_java_bridge_default !== "undefined" && frida_java_bridge_default.available) {
            return "android";
          }
        } catch (error) {
        }
        return "unknown";
      }
    };
  }
});

// agent/core/ModuleManager.ts
var ModuleManager;
var init_ModuleManager = __esm({
  "agent/core/ModuleManager.ts"() {
    "use strict";
    init_node_globals();
    init_FunctionRegistry();
    init_ModuleRegistry();
    init_logger();
    init_Platform();
    ModuleManager = class _ModuleManager {
      static instance;
      functionRegistry;
      moduleRegistry;
      platform;
      constructor() {
        this.functionRegistry = FunctionRegistry.getInstance();
        this.moduleRegistry = new ModuleRegistry();
        this.platform = PlatformDetector.detect();
      }
      static getInstance() {
        if (!this.instance) {
          this.instance = new _ModuleManager();
        }
        return this.instance;
      }
      /**
       * Get the detected platform
       */
      getPlatform() {
        return this.platform;
      }
      /**
       * Register a module
       */
      registerModule(module) {
        const modulePlatform = module.metadata.platform;
        if (modulePlatform !== "cross-platform" && modulePlatform !== this.platform) {
          log(`\u26A0\uFE0F Skipping module ${module.metadata.name} (platform mismatch: ${modulePlatform} != ${this.platform})`);
          return;
        }
        this.moduleRegistry.register(module);
      }
      /**
       * Initialize the module system
       */
      async initialize() {
        log("\u{1F680} Initializing Leviathan Module System...");
        log(`\u{1F4F1} Platform: ${this.platform}`);
        try {
          await this.moduleRegistry.initializeAll();
          const status = this.moduleRegistry.getStatus();
          log(`\u2705 Module system initialized: ${status.ready}/${status.total} modules ready`);
        } catch (error) {
          log(`\u274C Module system initialization failed: ${error}`);
          throw error;
        }
      }
      /**
       * Shutdown the module system
       */
      async shutdown() {
        log("\u{1F527} Shutting down Leviathan Module System...");
        await this.moduleRegistry.shutdownAll();
        log("\u2705 Module system shut down");
      }
      /**
       * Get the function registry
       */
      getFunctionRegistry() {
        return this.functionRegistry;
      }
      /**
       * Get the module registry
       */
      getModuleRegistry() {
        return this.moduleRegistry;
      }
      /**
       * Get all RPC exports
       */
      getRPCExports() {
        return this.functionRegistry.getRPCExports();
      }
      /**
       * Get system status
       */
      getSystemStatus() {
        const moduleStatus = this.moduleRegistry.getStatus();
        const functions = this.functionRegistry.getGlobalFunctions();
        const rpcFunctions = this.functionRegistry.getRPCExports();
        return {
          platform: this.platform,
          modules: moduleStatus,
          functions: {
            global: Object.keys(functions).length,
            rpc: Object.keys(rpcFunctions).length,
            names: {
              global: Object.keys(functions),
              rpc: Object.keys(rpcFunctions)
            }
          }
        };
      }
    };
  }
});

// agent/core/BaseModule.ts
var BaseModule;
var init_BaseModule = __esm({
  "agent/core/BaseModule.ts"() {
    "use strict";
    init_node_globals();
    init_FunctionRegistry();
    BaseModule = class {
      metadata;
      registry;
      _ready = false;
      constructor(metadata) {
        this.metadata = metadata;
        this.registry = FunctionRegistry.getInstance();
      }
      async initialize() {
        try {
          await this.onInitialize();
          this._ready = true;
          this.registerFunctions();
        } catch (error) {
          this._ready = false;
          throw error;
        }
      }
      async shutdown() {
        await this.onShutdown();
        this._ready = false;
      }
      isReady() {
        return this._ready;
      }
      getDependencies() {
        return this.metadata.dependencies || [];
      }
    };
  }
});

// agent/Android/Info/AndroidInfoModule.ts
var AndroidInfoModule;
var init_AndroidInfoModule = __esm({
  "agent/Android/Info/AndroidInfoModule.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_frida_java_bridge();
    AndroidInfoModule = class extends BaseModule {
      constructor() {
        super({
          name: "AndroidInfo",
          version: "1.0.0",
          platform: "android",
          category: "deviceInfo",
          description: "Android device information provider"
        });
      }
      async onInitialize() {
        if (!frida_java_bridge_default.available) {
          throw new Error("Java runtime not available");
        }
        log("[AndroidInfo] Module initialized");
      }
      async onShutdown() {
        log("[AndroidInfo] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("getAndroidDeviceInfo", () => this.getAndroidDeviceInfo());
      }
      /**
       * Main function that backend calls via: ('android', 'deviceInfo', 'androidVersion'): 'getAndroidDeviceInfo()'
       */
      getAndroidDeviceInfo() {
        log("\u{1F50D} DEBUG: getAndroidDeviceInfo() called");
        if (!frida_java_bridge_default.available) {
          log("\u274C Java runtime not available");
          return { success: false, message: "Java runtime not available" };
        }
        try {
          let deviceInfo = {};
          frida_java_bridge_default.perform(() => {
            try {
              const Build = frida_java_bridge_default.use("android.os.Build");
              const BuildVersion = frida_java_bridge_default.use("android.os.Build$VERSION");
              deviceInfo = {
                version: BuildVersion.RELEASE.value.toString(),
                apiLevel: BuildVersion.SDK_INT.value,
                manufacturer: Build.MANUFACTURER.value.toString(),
                model: Build.MODEL.value.toString(),
                device: Build.DEVICE ? Build.DEVICE.value.toString() : "unknown",
                buildNumber: Build.DISPLAY ? Build.DISPLAY.value.toString() : "unknown",
                fingerprint: Build.FINGERPRINT ? Build.FINGERPRINT.value.toString() : "unknown",
                bootloader: Build.BOOTLOADER ? Build.BOOTLOADER.value.toString() : "unknown",
                serialNumber: Build.SERIAL ? Build.SERIAL.value.toString() : "unknown",
                brand: Build.BRAND ? Build.BRAND.value.toString() : "unknown",
                board: Build.BOARD ? Build.BOARD.value.toString() : "unknown",
                hardware: Build.HARDWARE ? Build.HARDWARE.value.toString() : "unknown"
              };
              try {
                const ActivityThread = frida_java_bridge_default.use("android.app.ActivityThread");
                const currentApp = ActivityThread.currentApplication();
                if (currentApp) {
                  const context = currentApp.getApplicationContext();
                  deviceInfo.packageName = context.getPackageName().toString();
                  try {
                    const Context = frida_java_bridge_default.use("android.content.Context");
                    const telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE);
                    if (telephonyManager) {
                      try {
                        deviceInfo.deviceId = telephonyManager.getDeviceId ? telephonyManager.getDeviceId()?.toString() || "permission_denied" : "method_unavailable";
                      } catch (e) {
                        deviceInfo.deviceId = "permission_denied";
                      }
                      try {
                        deviceInfo.imei = telephonyManager.getImei ? telephonyManager.getImei()?.toString() || "permission_denied" : "method_unavailable";
                      } catch (e) {
                        deviceInfo.imei = "permission_denied";
                      }
                      try {
                        deviceInfo.phoneNumber = telephonyManager.getLine1Number ? telephonyManager.getLine1Number()?.toString() || "unavailable" : "method_unavailable";
                      } catch (e) {
                        deviceInfo.phoneNumber = "unavailable";
                      }
                    }
                  } catch (e) {
                    log("Could not get telephony info");
                  }
                  try {
                    const Context = frida_java_bridge_default.use("android.content.Context");
                    const wifiManager = context.getSystemService(Context.WIFI_SERVICE);
                    if (wifiManager) {
                      const wifiInfo = wifiManager.getConnectionInfo();
                      if (wifiInfo) {
                        deviceInfo.macAddress = wifiInfo.getMacAddress ? wifiInfo.getMacAddress()?.toString() || "02:00:00:00:00:00" : "unavailable";
                      }
                    }
                  } catch (e) {
                    log("Could not get WiFi info");
                  }
                }
              } catch (e) {
                log("Could not get context info - running without additional data");
              }
            } catch (e) {
              throw e;
            }
          });
          return {
            success: true,
            data: deviceInfo,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          log(`\u274C Error in getAndroidDeviceInfo: ${errorMsg}`);
          return {
            success: false,
            message: `Error: ${errorMsg}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
    };
  }
});

// agent/modules/UtilsModule.ts
var UtilsModule;
var init_UtilsModule = __esm({
  "agent/modules/UtilsModule.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_frida_java_bridge();
    init_frida_objc_bridge();
    UtilsModule = class extends BaseModule {
      constructor() {
        super({
          name: "Utils",
          version: "2.0.0",
          platform: "cross-platform",
          category: "utils",
          description: "Frida utility functions with modular architecture"
        });
      }
      async onInitialize() {
        log("[Utils] Module initialized");
      }
      async onShutdown() {
        log("[Utils] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("frida_version", () => this.getFridaVersion());
        this.registry.registerBoth("frida_loaded_bridges", () => this.getLoadedBridges());
        this.registry.registerBoth("frida_runtime_info", () => this.getRuntimeInfo());
        this.registry.registerBoth("frida_runtime_test", () => this.testRuntime());
        this.registry.registerBoth("frida_bridge_details", () => this.getBridgeDetails());
      }
      /**
       * Get Frida version information
       */
      getFridaVersion() {
        try {
          return {
            success: true,
            data: {
              version: Frida.version,
              runtime: Script.runtime,
              arch: Process.arch,
              platform: Process.platform,
              pageSize: Process.pageSize,
              pointerSize: Process.pointerSize
            },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          throw error;
        }
      }
      /**
       * Get loaded runtime bridges
       */
      getLoadedBridges() {
        try {
          const bridges = [];
          const details = [];
          if (typeof frida_objc_bridge_default !== "undefined" && frida_objc_bridge_default.available) {
            bridges.push("objc");
            details.push({
              name: "objc",
              available: true,
              version: frida_objc_bridge_default.api?.$metadata?.version || "unknown"
            });
          }
          if (typeof frida_java_bridge_default !== "undefined" && frida_java_bridge_default.available) {
            bridges.push("java");
            details.push({
              name: "java",
              available: true,
              version: "active"
            });
          }
          return {
            success: true,
            data: {
              bridges,
              count: bridges.length,
              details
            },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          throw error;
        }
      }
      /**
       * Get comprehensive runtime information
       */
      getRuntimeInfo() {
        try {
          return {
            success: true,
            data: {
              runtime: Script.runtime,
              frida: {
                version: Frida.version,
                heapSize: Frida.heapSize
              },
              process: {
                arch: Process.arch,
                platform: Process.platform,
                pageSize: Process.pageSize,
                pointerSize: Process.pointerSize,
                codeSigningPolicy: Process.codeSigningPolicy,
                isDebuggerAttached: Process.isDebuggerAttached()
              },
              script: {
                runtime: Script.runtime,
                pin: typeof Script.pin === "function" ? "available" : "unavailable",
                unpin: typeof Script.unpin === "function" ? "available" : "unavailable"
              }
            },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          throw error;
        }
      }
      /**
       * Test various runtime features
       */
      testRuntime() {
        try {
          const tests = {
            objc: false,
            java: false,
            interceptor: false,
            stalker: false,
            memory: false,
            module: false,
            process: false
          };
          try {
            if (typeof frida_objc_bridge_default !== "undefined" && frida_objc_bridge_default.available) {
              frida_objc_bridge_default.classes.NSString;
              tests.objc = true;
            }
          } catch (e) {
            log("[Utils] ObjC test failed");
          }
          try {
            if (typeof frida_java_bridge_default !== "undefined" && frida_java_bridge_default.available) {
              tests.java = true;
            }
          } catch (e) {
            log("[Utils] Java test failed");
          }
          try {
            if (typeof Interceptor !== "undefined") {
              tests.interceptor = true;
            }
          } catch (e) {
            log("[Utils] Interceptor test failed");
          }
          try {
            if (typeof Stalker !== "undefined") {
              tests.stalker = true;
            }
          } catch (e) {
            log("[Utils] Stalker test failed");
          }
          try {
            if (typeof Memory !== "undefined") {
              const testAlloc = Memory.alloc(1);
              Memory.protect(testAlloc, 1, "r--");
              tests.memory = true;
            }
          } catch (e) {
            log("[Utils] Memory test failed");
          }
          try {
            if (typeof Process !== "undefined") {
              Process.arch;
              tests.process = true;
            }
          } catch (e) {
            log("[Utils] Process test failed");
          }
          return {
            success: true,
            data: {
              tests,
              passed: Object.values(tests).filter((t) => t).length,
              total: Object.keys(tests).length,
              percentage: Math.round(Object.values(tests).filter((t) => t).length / Object.keys(tests).length * 100)
            },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          throw error;
        }
      }
      /**
       * Get detailed bridge information
       */
      getBridgeDetails() {
        try {
          const details = {
            available: [],
            unavailable: [],
            platform: Process.platform,
            arch: Process.arch
          };
          if (typeof frida_objc_bridge_default !== "undefined" && frida_objc_bridge_default.available) {
            details.available.push({
              bridge: "ObjC",
              features: {
                classes: typeof frida_objc_bridge_default.classes === "object",
                protocols: typeof frida_objc_bridge_default.protocols === "object",
                api: typeof frida_objc_bridge_default.api === "object",
                choose: typeof frida_objc_bridge_default.choose === "function",
                chooseSync: typeof frida_objc_bridge_default.chooseSync === "function"
              },
              classCount: Object.keys(frida_objc_bridge_default.classes || {}).length,
              protocolCount: Object.keys(frida_objc_bridge_default.protocols || {}).length
            });
          } else {
            details.unavailable.push({
              bridge: "ObjC",
              reason: Process.platform === "darwin" ? "Not loaded" : "Wrong platform"
            });
          }
          if (typeof frida_java_bridge_default !== "undefined" && frida_java_bridge_default.available) {
            let vmDetails = {
              bridge: "Java",
              features: {
                perform: typeof frida_java_bridge_default.perform === "function",
                performNow: typeof frida_java_bridge_default.performNow === "function",
                use: typeof frida_java_bridge_default.use === "function",
                choose: typeof frida_java_bridge_default.choose === "function",
                retain: typeof frida_java_bridge_default.retain === "function"
              }
            };
            try {
              frida_java_bridge_default.performNow(() => {
                try {
                  const Build = frida_java_bridge_default.use("android.os.Build$VERSION");
                  vmDetails.androidVersion = Build.RELEASE.value.toString();
                  vmDetails.apiLevel = Build.SDK_INT.value;
                } catch (e) {
                  log("[Utils] Could not get Android version");
                }
              });
            } catch (e) {
              log("[Utils] Java.performNow failed");
            }
            details.available.push(vmDetails);
          } else {
            details.unavailable.push({
              bridge: "Java",
              reason: Process.platform === "linux" ? "Not loaded" : "Wrong platform"
            });
          }
          return {
            success: true,
            data: details,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          throw error;
        }
      }
    };
  }
});

// agent/modules/ClassEnumerationModule.ts
var ClassEnumerationModule;
var init_ClassEnumerationModule = __esm({
  "agent/modules/ClassEnumerationModule.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_Platform();
    init_frida_java_bridge();
    init_frida_objc_bridge();
    ClassEnumerationModule = class extends BaseModule {
      systemPatterns = {
        android: [
          "java.",
          "javax.",
          "android.",
          "com.android.",
          "dalvik.",
          "sun.",
          "org.apache.",
          "org.json.",
          "org.xml.",
          "org.w3c.",
          "kotlin.",
          "kotlinx."
        ],
        ios: [
          "NS",
          // Foundation
          "UI",
          // UIKit
          "CF",
          // CoreFoundation
          "CA",
          // CoreAnimation
          "CG",
          // CoreGraphics
          "AB",
          // AddressBook
          "AV",
          // AVFoundation
          "CL",
          // CoreLocation
          "MK",
          // MapKit
          "SK",
          // StoreKit/SpriteKit
          "WK",
          // WebKit
          "PK",
          // PassKit
          "SC",
          // SystemConfiguration
          "_",
          // Private classes
          "OS_"
          // OS internal classes
        ]
      };
      constructor() {
        super({
          name: "ClassEnumeration",
          version: "1.0.0",
          platform: "cross-platform",
          category: "introspection",
          description: "Enumerate and inspect loaded classes on Android and iOS"
        });
      }
      async onInitialize() {
        const platform2 = PlatformDetector.detect();
        if (platform2 === "unknown") {
          throw new Error("Unknown platform - ClassEnumeration requires Android or iOS");
        }
        log(`[ClassEnumeration] Module initialized for platform: ${platform2}`);
      }
      async onShutdown() {
        log("[ClassEnumeration] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("enumerateClasses", (filters) => this.enumerateClasses(filters));
        this.registry.registerBoth("enumerateAppClasses", () => this.enumerateAppClasses());
        this.registry.registerBoth("enumerateClassesByPattern", (pattern) => this.enumerateClassesByPattern(pattern));
        this.registry.registerBoth("getClassStatistics", () => this.getClassStatistics());
        this.registry.registerBoth("isSystemClass", (className) => this.isSystemClass(className));
      }
      /**
       * Main enumeration function
       */
      enumerateClasses(filters) {
        const startTime = Date.now();
        const platform2 = PlatformDetector.detect();
        try {
          if (platform2 === "android") {
            return this.enumerateAndroidClasses(filters || {}, startTime);
          } else if (platform2 === "ios") {
            return this.enumerateiOSClasses(filters || {}, startTime);
          } else {
            return {
              success: false,
              error: "Unsupported platform",
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Class enumeration failed: ${errorMsg}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
      /**
       * Android class enumeration
       */
      enumerateAndroidClasses(filters, startTime) {
        if (!frida_java_bridge_default.available) {
          return {
            success: false,
            error: "Java runtime not available",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
        const classes = [];
        const packageCounts = {};
        let systemCount = 0;
        let appCount = 0;
        const excludeSystem = filters.excludeSystem !== false;
        const limit = filters.limit || 1e4;
        frida_java_bridge_default.perform(() => {
          frida_java_bridge_default.enumerateLoadedClasses({
            onMatch: (className) => {
              if (classes.length >= limit) {
                return "stop";
              }
              if (filters.pattern && !this.matchesPattern(className, filters.pattern)) {
                return;
              }
              if (filters.packages && filters.packages.length > 0) {
                const matchesPackage = filters.packages.some((pkg) => className.startsWith(pkg));
                if (!matchesPackage)
                  return;
              }
              const classInfo = this.getAndroidClassInfo(className);
              if (excludeSystem && classInfo.isSystemClass) {
                systemCount++;
                return;
              }
              if (classInfo.isSystemClass) {
                systemCount++;
              } else {
                appCount++;
              }
              if (classInfo.package) {
                packageCounts[classInfo.package] = (packageCounts[classInfo.package] || 0) + 1;
              }
              classes.push(classInfo);
            },
            onComplete: () => {
              log(`[ClassEnumeration] Android enumeration complete: ${classes.length} classes`);
            }
          });
        });
        const enumurationTimeMs = Date.now() - startTime;
        return {
          success: true,
          data: {
            classes,
            count: classes.length,
            platform: "android",
            filters,
            statistics: {
              totalClasses: classes.length + systemCount,
              systemClasses: systemCount,
              appClasses: appCount,
              byPackage: packageCounts,
              enumurationTimeMs
            }
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      /**
       * Get Android class information
       */
      getAndroidClassInfo(className) {
        let superclassName = null;
        let interfaceCount = 0;
        let address = "0x0";
        try {
          frida_java_bridge_default.perform(() => {
            const clazz = frida_java_bridge_default.use(className);
            try {
              const superClass = clazz.class.getSuperclass();
              if (superClass) {
                superclassName = superClass.getName();
              }
            } catch (e) {
            }
            try {
              const interfaces = clazz.class.getInterfaces();
              interfaceCount = interfaces.length;
            } catch (e) {
            }
            try {
              const classHandle = clazz.class.getHandle();
              if (classHandle) {
                address = ptr(classHandle).toString();
              }
            } catch (e) {
            }
          });
        } catch (e) {
          log(`[ClassEnumeration] Could not introspect class: ${className}`);
        }
        const lastDotIndex = className.lastIndexOf(".");
        const packageName = lastDotIndex > 0 ? className.substring(0, lastDotIndex) : "";
        return {
          name: className,
          address,
          superclass: superclassName,
          interfaceCount,
          package: packageName,
          isSystemClass: this.isAndroidSystemClass(className)
        };
      }
      /**
       * iOS class enumeration
       */
      enumerateiOSClasses(filters, startTime) {
        if (!frida_objc_bridge_default.available) {
          return {
            success: false,
            error: "ObjC runtime not available",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
        const classes = [];
        const frameworkCounts = {};
        let systemCount = 0;
        let appCount = 0;
        const excludeSystem = filters.excludeSystem !== false;
        const limit = filters.limit || 1e4;
        const classNames = Object.keys(frida_objc_bridge_default.classes);
        for (const className of classNames) {
          if (classes.length >= limit) {
            break;
          }
          if (filters.pattern && !this.matchesPattern(className, filters.pattern)) {
            continue;
          }
          if (filters.frameworks && filters.frameworks.length > 0) {
            const matchesFramework = filters.frameworks.some((fw) => className.startsWith(fw));
            if (!matchesFramework)
              continue;
          }
          const classInfo = this.getiOSClassInfo(className);
          if (excludeSystem && classInfo.isSystemClass) {
            systemCount++;
            continue;
          }
          if (classInfo.isSystemClass) {
            systemCount++;
          } else {
            appCount++;
          }
          if (classInfo.framework) {
            frameworkCounts[classInfo.framework] = (frameworkCounts[classInfo.framework] || 0) + 1;
          }
          classes.push(classInfo);
        }
        const enumurationTimeMs = Date.now() - startTime;
        return {
          success: true,
          data: {
            classes,
            count: classes.length,
            platform: "ios",
            filters,
            statistics: {
              totalClasses: classes.length + systemCount,
              systemClasses: systemCount,
              appClasses: appCount,
              byFramework: frameworkCounts,
              enumurationTimeMs
            }
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      /**
       * Get iOS class information
       */
      getiOSClassInfo(className) {
        let superclassName = null;
        let protocolCount = 0;
        let address = "0x0";
        try {
          const clazz = frida_objc_bridge_default.classes[className];
          try {
            if (clazz && clazz.handle) {
              address = clazz.handle.toString();
            }
          } catch (e) {
          }
          try {
            const superClass = clazz.$superClass;
            if (superClass) {
              superclassName = superClass.$className || null;
            }
          } catch (e) {
          }
          try {
            const protocols = clazz.$protocols;
            if (protocols && Array.isArray(protocols)) {
              protocolCount = protocols.length;
            } else if (protocols && typeof protocols === "object") {
              protocolCount = Object.keys(protocols).length;
            }
          } catch (e) {
          }
        } catch (e) {
          log(`[ClassEnumeration] Could not introspect class: ${className}`);
        }
        const framework = this.inferFramework(className);
        return {
          name: className,
          address,
          superclass: superclassName,
          protocols: protocolCount,
          interfaceCount: protocolCount,
          // Alias for cross-platform consistency
          framework,
          isSystemClass: this.isiOSSystemClass(className)
        };
      }
      /**
       * Infer framework from class name prefix
       */
      inferFramework(className) {
        const frameworkPrefixes = {
          "NS": "Foundation",
          "UI": "UIKit",
          "CF": "CoreFoundation",
          "CA": "CoreAnimation",
          "CG": "CoreGraphics",
          "AB": "AddressBook",
          "AV": "AVFoundation",
          "CL": "CoreLocation",
          "MK": "MapKit",
          "SK": "StoreKit",
          "WK": "WebKit",
          "PK": "PassKit",
          "SC": "SystemConfiguration",
          "_": "Private",
          "OS_": "System"
        };
        for (const [prefix, framework] of Object.entries(frameworkPrefixes)) {
          if (className.startsWith(prefix)) {
            return framework;
          }
        }
        return "App";
      }
      /**
       * Check if Android class is a system class
       */
      isAndroidSystemClass(className) {
        return this.systemPatterns.android.some((pattern) => className.startsWith(pattern));
      }
      /**
       * Check if iOS class is a system class
       */
      isiOSSystemClass(className) {
        return this.systemPatterns.ios.some((pattern) => className.startsWith(pattern));
      }
      /**
       * Convenience function to enumerate only app classes
       */
      enumerateAppClasses() {
        return this.enumerateClasses({
          excludeSystem: true,
          limit: 5e3
        });
      }
      /**
       * Convenience function to enumerate by pattern
       */
      enumerateClassesByPattern(pattern) {
        return this.enumerateClasses({
          pattern,
          excludeSystem: false,
          // Don't filter when using pattern
          limit: 5e3
        });
      }
      /**
       * Get statistics without full enumeration
       */
      getClassStatistics() {
        const result2 = this.enumerateClasses({
          excludeSystem: false,
          limit: 5e4
        });
        if (result2.success && result2.data) {
          return {
            success: true,
            data: {
              classes: [],
              // Empty array
              count: 0,
              platform: result2.data.platform,
              filters: result2.data.filters,
              statistics: result2.data.statistics
            },
            timestamp: result2.timestamp
          };
        }
        return result2;
      }
      /**
       * Check if a class is a system class
       */
      isSystemClass(className) {
        try {
          const platform2 = PlatformDetector.detect();
          let isSystem = false;
          if (platform2 === "android") {
            isSystem = this.isAndroidSystemClass(className);
          } else if (platform2 === "ios") {
            isSystem = this.isiOSSystemClass(className);
          } else {
            return {
              success: false,
              error: "Unknown platform"
            };
          }
          return {
            success: true,
            data: isSystem
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMsg
          };
        }
      }
      /**
       * Pattern matching helper (supports wildcards and regex)
       */
      matchesPattern(str, pattern) {
        try {
          if (pattern.includes("[") || pattern.includes("(") || pattern.includes("^")) {
            const regex = new RegExp(pattern);
            return regex.test(str);
          } else {
            const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(str);
          }
        } catch (e) {
          log(`[ClassEnumeration] Invalid pattern: ${pattern}`);
          return false;
        }
      }
    };
  }
});

// agent/Android/Network/hooks.ts
var SSL_HOOKS_REGISTRY;
var init_hooks = __esm({
  "agent/Android/Network/hooks.ts"() {
    "use strict";
    init_node_globals();
    SSL_HOOKS_REGISTRY = [
      // ===== NATIVE HOOKS =====
      {
        id: "native_ssl_ctx_verify_callback",
        name: "SSL_CTX_set_cert_verify_callback",
        displayName: "Native Certificate Verify Callback",
        description: "Monitors/bypasses native SSL certificate verification callbacks",
        category: "native",
        library: "libssl.so",
        type: "both",
        metadata: { nativeSymbol: "SSL_CTX_set_cert_verify_callback" }
      },
      {
        id: "native_ssl_ctx_custom_verify",
        name: "SSL_CTX_set_custom_verify",
        displayName: "Native Custom Verify",
        description: "Monitors/bypasses custom SSL verification in BoringSSL",
        category: "native",
        library: "libboringssl.so",
        type: "both",
        metadata: { nativeSymbol: "SSL_CTX_set_custom_verify" }
      },
      {
        id: "native_ssl_verify_result",
        name: "SSL_get_verify_result",
        displayName: "Native SSL Verify Result",
        description: "Monitors SSL verification results",
        category: "native",
        library: "libssl.so",
        type: "monitor",
        metadata: { nativeSymbol: "SSL_get_verify_result" }
      },
      {
        id: "native_x509_verify_cert",
        name: "X509_verify_cert",
        displayName: "Native X509 Certificate Verification",
        description: "Core certificate chain verification",
        category: "native",
        library: "libssl.so",
        type: "both",
        metadata: { nativeSymbol: "X509_verify_cert" }
      },
      // ===== CONSCRYPT HOOKS =====
      {
        id: "conscrypt_trust_manager",
        name: "TrustManagerImpl.checkTrustedRecursive",
        displayName: "Conscrypt Trust Manager",
        description: "Android's main certificate validation",
        category: "conscrypt",
        library: "com.android.org.conscrypt",
        type: "both",
        metadata: {
          className: "com.android.org.conscrypt.TrustManagerImpl",
          methodName: "checkTrustedRecursive"
        }
      },
      {
        id: "conscrypt_platform_trust",
        name: "TrustManagerImpl.checkServerTrusted",
        displayName: "Conscrypt Platform Trust",
        description: "Conscrypt server certificate validation",
        category: "conscrypt",
        library: "com.android.org.conscrypt",
        type: "both",
        metadata: {
          className: "com.android.org.conscrypt.TrustManagerImpl",
          methodName: "checkServerTrusted",
          // Don't specify overloads here - we'll handle them in the hook implementation
          handleMultipleOverloads: true
        }
      },
      // ===== JAVA SSL HOOKS =====
      {
        id: "java_ssl_context",
        name: "SSLContext.init",
        displayName: "Java SSL Context Init",
        description: "SSL Context initialization with trust managers",
        category: "java",
        library: "javax.net.ssl",
        type: "monitor",
        metadata: {
          className: "javax.net.ssl.SSLContext",
          methodName: "init",
          overloads: [["[Ljavax.net.ssl.KeyManager;", "[Ljavax.net.ssl.TrustManager;", "java.security.SecureRandom"]],
          skipOriginalImpl: true
          // This method often has no implementation to override
        }
      },
      {
        id: "java_trust_manager",
        name: "X509TrustManager.checkServerTrusted",
        displayName: "Java X509 Trust Manager",
        description: "Standard Java certificate validation",
        category: "java",
        library: "javax.net.ssl",
        type: "both",
        metadata: {
          className: "javax.net.ssl.X509TrustManager",
          methodName: "checkServerTrusted",
          overloads: [["[Ljava.security.cert.X509Certificate;", "java.lang.String"]]
        }
      },
      {
        id: "java_hostname_verifier",
        name: "HostnameVerifier.verify",
        displayName: "Java Hostname Verifier",
        description: "Hostname verification in SSL connections",
        category: "java",
        library: "javax.net.ssl",
        type: "both",
        metadata: {
          className: "javax.net.ssl.HostnameVerifier",
          methodName: "verify",
          overloads: [["java.lang.String", "javax.net.ssl.SSLSession"]]
        }
      },
      // ===== OKHTTP HOOKS =====
      {
        id: "okhttp3_cert_pinner",
        name: "CertificatePinner.check",
        displayName: "OkHttp3 Certificate Pinner",
        description: "OkHttp3 certificate pinning checks",
        category: "okhttp",
        library: "okhttp3",
        type: "both",
        metadata: {
          className: "okhttp3.CertificatePinner",
          methodName: "check",
          overloads: [
            ["java.lang.String", "java.util.List"],
            ["java.lang.String", "[Ljava.security.cert.Certificate;"]
          ]
        }
      },
      {
        id: "okhttp_hostname_verifier",
        name: "OkHostnameVerifier.verify",
        displayName: "OkHttp Hostname Verifier",
        description: "OkHttp hostname verification",
        category: "okhttp",
        library: "okhttp3",
        type: "both",
        metadata: {
          className: "okhttp3.internal.tls.OkHostnameVerifier",
          methodName: "verify",
          overloads: [
            ["java.lang.String", "javax.net.ssl.SSLSession"],
            ["java.lang.String", "java.security.cert.X509Certificate"]
          ]
        }
      },
      // ===== WEBVIEW HOOKS =====
      {
        id: "webview_client_cert",
        name: "WebViewClient.onReceivedSslError",
        displayName: "WebView SSL Error Handler",
        description: "WebView SSL error handling",
        category: "webview",
        library: "android.webkit",
        type: "both",
        metadata: {
          className: "android.webkit.WebViewClient",
          methodName: "onReceivedSslError"
        }
      },
      // ===== NETWORK SECURITY CONFIG =====
      {
        id: "network_security_config",
        name: "NetworkSecurityTrustManager.checkPins",
        displayName: "Network Security Config Pins",
        description: "Android Network Security Config pin validation",
        category: "java",
        library: "android.security.net.config",
        type: "both",
        metadata: {
          className: "android.security.net.config.NetworkSecurityTrustManager",
          methodName: "checkPins"
        }
      }
    ];
  }
});

// agent/Android/Network/SSLPinning.ts
var AndroidSSLPinningModule;
var init_SSLPinning = __esm({
  "agent/Android/Network/SSLPinning.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_frida_java_bridge();
    init_hooks();
    AndroidSSLPinningModule = class extends BaseModule {
      state = {
        initialized: false,
        active: false,
        startTime: (/* @__PURE__ */ new Date()).toISOString(),
        endTime: void 0,
        eventCount: 0,
        hooks: /* @__PURE__ */ new Map(),
        activeHooks: /* @__PURE__ */ new Map(),
        eventHistory: [],
        hitCounts: /* @__PURE__ */ new Map(),
        lastHits: /* @__PURE__ */ new Map(),
        bypassModes: /* @__PURE__ */ new Map(),
        maxEventHistory: 1e3,
        eventCallback: void 0
      };
      constructor() {
        const metadata = {
          name: "AndroidSSLPinning",
          version: "2.0.0",
          platform: "android",
          category: "Network-Security",
          description: "Comprehensive SSL/TLS monitoring and bypassing with individual hook control",
          dependencies: []
        };
        super(metadata);
      }
      async onInitialize() {
        log("\u{1F510} Initializing Enhanced SSL Pinning Module...");
        if (!frida_java_bridge_default.available) {
          throw new Error("Java runtime not available");
        }
        await this.initializeHookRegistry();
        this.state.initialized = true;
        log("\u2705 Enhanced SSL Pinning Module initialized");
      }
      async onShutdown() {
        for (const [hookId] of this.state.activeHooks) {
          if (this.state.activeHooks.get(hookId)) {
            this.disableHook(hookId);
          }
        }
        this.state.eventHistory = [];
        this.state.hitCounts.clear();
        this.state.lastHits.clear();
        log("\u{1F510} SSL Pinning Module shut down");
      }
      registerFunctions() {
        this.registry.registerBoth("discoverSSLHooks", () => this.discoverAvailableHooks());
        this.registry.registerBoth("getSSLHookStatus", () => this.getHookStatus());
        this.registry.registerBoth("getSSLEvents", (limit) => this.getEvents(limit));
        this.registry.registerBoth("monitorSSLCalls", () => this.monitorSSLCalls());
        this.registry.registerBoth("stopSSLMonitoring", () => this.stopSSLMonitoring());
        this.registry.registerBoth("getSSLMonitoringStatus", () => this.getMonitoringStatus());
        this.registry.registerBoth("enableSSLHook", (hookId, bypassMode) => this.enableHook(hookId, bypassMode));
        this.registry.registerBoth("disableSSLHook", (hookId) => this.disableHook(hookId));
        this.registry.registerBoth("toggleSSLHook", (hookId, bypassMode) => this.toggleHook(hookId, bypassMode));
        this.registry.registerBoth("enableAllSSLHooks", (bypassMode) => this.enableAllHooks(bypassMode));
        this.registry.registerBoth("disableAllSSLHooks", () => this.disableAllHooks());
        this.registry.registerBoth("enableSSLHooksByCategory", (category, bypassMode) => this.enableHooksByCategory(category, bypassMode));
        this.registry.registerBoth("clearSSLEvents", () => this.clearEvents());
        this.registry.registerBoth("setSSLEventCallback", (callback) => this.setEventCallback(callback));
        this.registry.registerBoth("setSSLBypassMode", (hookId, bypass) => this.setBypassMode(hookId, bypass));
        this.registry.registerBoth("getSSLHookCategories", () => this.getHookCategories());
        this.registry.registerBoth("enableSSLBypass", (hookId) => this.setBypassMode(hookId, true));
        this.registry.registerBoth("disableSSLBypass", (hookId) => this.setBypassMode(hookId, false));
        this.registry.registerBoth("enableAllSSLBypass", () => this.enableAllBypass());
        this.registry.registerBoth("disableAllSSLBypass", () => this.disableAllBypass());
      }
      /**
       * ===== SECURE IMPLEMENTATION HELPERS =====
       */
      /**
       * Get safe default return value for SSL methods
       */
      getSafeDefaultReturn(methodName, args) {
        switch (methodName) {
          case "checkServerTrusted":
          case "checkTrustedRecursive":
            if (args && args[0]) {
              const ArrayList = frida_java_bridge_default.use("java.util.ArrayList");
              const list = ArrayList.$new();
              const certs = args[0];
              if (Array.isArray(certs) || certs && certs.length !== void 0) {
                for (let i = 0; i < certs.length; i++) {
                  list.add(certs[i]);
                }
              }
              return list;
            } else {
              const ArrayList = frida_java_bridge_default.use("java.util.ArrayList");
              return ArrayList.$new();
            }
          case "verify":
            return true;
          case "check":
          case "checkPins":
            return;
          case "init":
            return;
          case "onReceivedSslError":
            if (args && args[2] && args[2].proceed) {
              args[2].proceed();
            }
            return;
          default:
            return;
        }
      }
      /**
       * Create safe unhook function for single method
       */
      createSafeUnhookFunction(method2, originalImpl, hookDef) {
        const moduleInstance = this;
        return () => {
          try {
            log(`\u{1F504} Safely unhooking ${hookDef.name}...`);
            const safeImplementation = (...args) => {
              if (originalImpl && typeof originalImpl === "function") {
                try {
                  return originalImpl.apply(null, args);
                } catch (e) {
                  return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                }
              }
              return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
            };
            method2.implementation = safeImplementation;
            setTimeout(() => {
              try {
                if (originalImpl && typeof originalImpl === "function") {
                  method2.implementation = originalImpl;
                  log(`\u2705 Successfully restored ${hookDef.name} to original implementation`);
                } else {
                  log(`\u26A0\uFE0F No original implementation for ${hookDef.name}, keeping safe implementation`);
                }
              } catch (e) {
                log(`\u26A0\uFE0F Could not restore original implementation for ${hookDef.name}: ${e}`);
              }
            }, 150);
          } catch (error) {
            logError(`Error during unhook of ${hookDef.name}`, error);
            method2.implementation = (...args) => {
              return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
            };
          }
        };
      }
      /**
       * Create safe unhook function for multiple overloads
       */
      createSafeUnhookFunctionForOverloads(hookedOverloads, originalImplementations, hookDef) {
        const moduleInstance = this;
        return () => {
          log(`\u{1F504} Safely unhooking ${hookedOverloads.length} overloads for ${hookDef.name}...`);
          hookedOverloads.forEach((overload, index) => {
            try {
              const originalImpl = originalImplementations[index];
              const safeImplementation = (...args) => {
                if (originalImpl && typeof originalImpl === "function") {
                  try {
                    return originalImpl.apply(null, args);
                  } catch (e) {
                    return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                  }
                }
                return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
              };
              overload.implementation = safeImplementation;
              setTimeout(() => {
                try {
                  if (originalImpl && typeof originalImpl === "function") {
                    overload.implementation = originalImpl;
                    log(`\u2705 Successfully restored ${hookDef.name} overload ${index} to original`);
                  }
                } catch (e) {
                  log(`\u26A0\uFE0F Could not restore original implementation for ${hookDef.name} overload ${index}: ${e}`);
                }
              }, 150 + index * 10);
            } catch (error) {
              logError(`Error unhooking overload ${index} of ${hookDef.name}`, error);
              overload.implementation = (...args) => {
                return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
              };
            }
          });
          setTimeout(() => {
            originalImplementations.length = 0;
            hookedOverloads.length = 0;
            log(`\u{1F9F9} Cleaned up references for ${hookDef.name}`);
          }, 300);
        };
      }
      /**
       * ===== SECURE HOOK CREATION METHODS =====
       */
      /**
       * Create Native hook with safe unhook
       */
      createNativeHook(hookDef) {
        const lib = Process.findModuleByName(hookDef.library);
        if (!lib || !hookDef.metadata?.nativeSymbol)
          return false;
        const funcPtr = lib.findExportByName(hookDef.metadata.nativeSymbol);
        if (!funcPtr)
          return false;
        const bypassMode = this.state.bypassModes.get(hookDef.id) || false;
        const moduleInstance = this;
        const hook = Interceptor.attach(funcPtr, {
          onEnter(args) {
            if (!moduleInstance.state.activeHooks.get(hookDef.id)) {
              return;
            }
            const event = moduleInstance.createEvent(hookDef, "enter", args);
            moduleInstance.recordEvent(event);
            this.args = args;
            this.startTime = Date.now();
          },
          onLeave(retval) {
            if (!moduleInstance.state.activeHooks.get(hookDef.id)) {
              return;
            }
            const duration = Date.now() - this.startTime;
            if (bypassMode && hookDef.type !== "monitor") {
              if (hookDef.name.includes("verify") || hookDef.name.includes("check")) {
                retval.replace(ptr(1));
              }
            }
            const event = moduleInstance.createEvent(hookDef, "leave", this.args, retval, { duration });
            moduleInstance.recordEvent(event);
          }
        });
        hookDef.unhookFunction = () => {
          try {
            hook.detach();
            log(`\u2705 Successfully detached native hook ${hookDef.name}`);
          } catch (error) {
            logError(`Error detaching native hook ${hookDef.name}`, error);
          }
        };
        hookDef.hookInstance = hook;
        return true;
      }
      /**
       * Create Java hook with secure unhook function
       */
      createJavaHook(hookDef) {
        if (!hookDef.metadata?.className || !hookDef.metadata?.methodName)
          return false;
        try {
          const clazz = frida_java_bridge_default.use(hookDef.metadata.className);
          const bypassMode = this.state.bypassModes.get(hookDef.id) || false;
          const moduleInstance = this;
          if (hookDef.metadata.handleMultipleOverloads) {
            try {
              const methodOverloads = clazz[hookDef.metadata.methodName].overloads;
              log(`Found ${methodOverloads.length} overloads for ${hookDef.name}`);
              const originalImplementations = [];
              const hookedOverloads = [];
              methodOverloads.forEach((overload, index) => {
                try {
                  originalImplementations[index] = overload.implementation;
                  hookedOverloads[index] = overload;
                  overload.implementation = function(...args) {
                    const currentThis = this;
                    if (!moduleInstance.state.activeHooks.get(hookDef.id)) {
                      if (originalImplementations[index] && typeof originalImplementations[index] === "function") {
                        try {
                          return originalImplementations[index].apply(currentThis, args);
                        } catch (e) {
                          return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                        }
                      }
                      return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                    }
                    const event = moduleInstance.createEvent(hookDef, "call", args);
                    moduleInstance.recordEvent(event);
                    if (!bypassMode || hookDef.type === "monitor") {
                      try {
                        let result2;
                        if (originalImplementations[index] && typeof originalImplementations[index] === "function") {
                          result2 = originalImplementations[index].apply(currentThis, args);
                        } else {
                          result2 = moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                        }
                        const completionEvent = { ...event };
                        completionEvent.action = "completed";
                        moduleInstance.recordEvent(completionEvent);
                        return result2;
                      } catch (e) {
                        const errorEvent = { ...event };
                        errorEvent.type = "error";
                        errorEvent.error = e instanceof Error ? e.message : String(e);
                        moduleInstance.recordEvent(errorEvent);
                        throw e;
                      }
                    }
                    try {
                      if (hookDef.metadata.methodName === "checkServerTrusted" || hookDef.metadata.methodName === "checkTrustedRecursive") {
                        event.action = "bypassed";
                        moduleInstance.recordEvent(event);
                        return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                      }
                      if (hookDef.metadata.methodName === "verify") {
                        event.action = "bypassed";
                        moduleInstance.recordEvent(event);
                        return true;
                      }
                      if (originalImplementations[index] && typeof originalImplementations[index] === "function") {
                        return originalImplementations[index].apply(currentThis, args);
                      }
                      return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                    } catch (e) {
                      event.type = "error";
                      event.error = e instanceof Error ? e.message : String(e);
                      moduleInstance.recordEvent(event);
                      return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                    }
                  };
                } catch (e) {
                  log(`Failed to hook overload ${index} of ${hookDef.name}: ${e}`);
                }
              });
              hookDef.unhookFunction = this.createSafeUnhookFunctionForOverloads(hookedOverloads, originalImplementations, hookDef);
              return true;
            } catch (error) {
              logError(`Failed to handle multiple overloads for ${hookDef.id}`, error);
              return false;
            }
          }
          if (hookDef.metadata.skipOriginalImpl || hookDef.id === "java_ssl_context") {
            try {
              let method3;
              let originalImpl2;
              if (hookDef.metadata.overloads && hookDef.metadata.overloads.length > 0) {
                method3 = clazz[hookDef.metadata.methodName].overload(...hookDef.metadata.overloads[0]);
              } else {
                method3 = clazz[hookDef.metadata.methodName];
              }
              originalImpl2 = method3.implementation;
              method3.implementation = function(...args) {
                const currentThis = this;
                if (!moduleInstance.state.activeHooks.get(hookDef.id)) {
                  if (originalImpl2 && typeof originalImpl2 === "function") {
                    try {
                      return originalImpl2.apply(currentThis, args);
                    } catch (e) {
                      return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                    }
                  }
                  return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                }
                const event = moduleInstance.createEvent(hookDef, "call", args);
                moduleInstance.recordEvent(event);
                try {
                  let result2;
                  if (originalImpl2 && typeof originalImpl2 === "function") {
                    result2 = originalImpl2.apply(currentThis, args);
                  } else {
                    result2 = moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                  }
                  const completionEvent = { ...event };
                  completionEvent.action = "completed";
                  moduleInstance.recordEvent(completionEvent);
                  return result2;
                } catch (e) {
                  const errorEvent = { ...event };
                  errorEvent.type = "error";
                  errorEvent.error = e instanceof Error ? e.message : String(e);
                  moduleInstance.recordEvent(errorEvent);
                  return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                }
              };
              hookDef.unhookFunction = this.createSafeUnhookFunction(method3, originalImpl2, hookDef);
              hookDef.hookInstance = method3;
              return true;
            } catch (error) {
              logError(`Failed to hook ${hookDef.id} with skipOriginalImpl`, error);
              return false;
            }
          }
          let method2;
          let originalImpl;
          if (hookDef.metadata.overloads && hookDef.metadata.overloads.length > 0) {
            for (const overloadSig of hookDef.metadata.overloads) {
              try {
                method2 = clazz[hookDef.metadata.methodName].overload(...overloadSig);
                break;
              } catch (e) {
                continue;
              }
            }
            if (!method2) {
              throw new Error(`No matching overload found for ${hookDef.name}`);
            }
          } else {
            method2 = clazz[hookDef.metadata.methodName];
          }
          originalImpl = method2.implementation;
          method2.implementation = function(...args) {
            const currentThis = this;
            if (!moduleInstance.state.activeHooks.get(hookDef.id)) {
              if (originalImpl && typeof originalImpl === "function") {
                try {
                  return originalImpl.apply(currentThis, args);
                } catch (e) {
                  return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                }
              }
              return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
            }
            const event = moduleInstance.createEvent(hookDef, "call", args);
            moduleInstance.recordEvent(event);
            if (!bypassMode || hookDef.type === "monitor") {
              try {
                let result2;
                if (originalImpl && typeof originalImpl === "function") {
                  result2 = originalImpl.apply(currentThis, args);
                } else {
                  result2 = moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
                }
                const completionEvent = { ...event };
                completionEvent.action = "completed";
                if (result2 !== void 0 && result2 !== null) {
                  completionEvent.parameters.returnValue = "[object]";
                }
                moduleInstance.recordEvent(completionEvent);
                return result2;
              } catch (e) {
                const errorEvent = { ...event };
                errorEvent.type = "error";
                errorEvent.error = e instanceof Error ? e.message : String(e);
                moduleInstance.recordEvent(errorEvent);
                throw e;
              }
            }
            try {
              event.action = "bypassed";
              moduleInstance.recordEvent(event);
              return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
            } catch (e) {
              event.type = "error";
              event.error = e instanceof Error ? e.message : String(e);
              moduleInstance.recordEvent(event);
              return moduleInstance.getSafeDefaultReturn(hookDef.metadata.methodName, args);
            }
          };
          hookDef.unhookFunction = this.createSafeUnhookFunction(method2, originalImpl, hookDef);
          hookDef.hookInstance = method2;
          return true;
        } catch (error) {
          logError(`Failed to create Java hook ${hookDef.id}`, error);
          return false;
        }
      }
      /**
       * ===== INITIALIZATION AND DISCOVERY =====
       */
      async initializeHookRegistry() {
        SSL_HOOKS_REGISTRY.forEach((hookEntry) => {
          const fullHook = {
            ...hookEntry,
            enabled: false,
            available: false,
            hookFunction: () => this.createHookImplementation({
              ...hookEntry,
              enabled: false,
              available: false,
              hookFunction: () => false
            })
          };
          this.state.hooks.set(fullHook.id, fullHook);
          this.state.hitCounts.set(fullHook.id, 0);
          this.state.bypassModes.set(fullHook.id, false);
        });
      }
      createHookImplementation(hookDef) {
        try {
          switch (hookDef.category) {
            case "native":
              return this.createNativeHook(hookDef);
            case "java":
            case "conscrypt":
            case "okhttp":
            case "webview":
              return this.createJavaHook(hookDef);
            default:
              return false;
          }
        } catch (error) {
          logError(`Failed to create hook ${hookDef.id}`, error);
          return false;
        }
      }
      checkHookAvailability(hookDef) {
        try {
          if (hookDef.category === "native") {
            const lib = Process.findModuleByName(hookDef.library);
            if (!lib || !hookDef.metadata?.nativeSymbol)
              return false;
            return !!lib.findExportByName(hookDef.metadata.nativeSymbol);
          } else {
            if (!hookDef.metadata?.className)
              return false;
            try {
              frida_java_bridge_default.use(hookDef.metadata.className);
              return true;
            } catch (e) {
              return false;
            }
          }
        } catch (error) {
          return false;
        }
      }
      /**
       * Discover which hooks are available
       */
      discoverAvailableHooks() {
        let availableCount = 0;
        frida_java_bridge_default.perform(() => {
          for (const [hookId, hookDef] of this.state.hooks) {
            const isAvailable = this.checkHookAvailability(hookDef);
            hookDef.available = isAvailable;
            if (isAvailable)
              availableCount++;
          }
        });
        const hooks = this.getHookStatus().hooks;
        send({
          type: "ssl_discovery_complete",
          availableHooks: availableCount,
          totalHooks: this.state.hooks.size,
          hooks,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          success: true,
          available: availableCount,
          total: this.state.hooks.size,
          hooks
        };
      }
      /**
       * Start monitoring all available SSL calls
       */
      monitorSSLCalls() {
        log("\u{1F50D} Starting SSL call monitoring...");
        let enabledCount = 0;
        let errors2 = [];
        this.discoverAvailableHooks();
        frida_java_bridge_default.perform(() => {
          for (const [hookId, hookDef] of this.state.hooks) {
            if (hookDef.available && !this.state.activeHooks.get(hookId)) {
              try {
                const result2 = this.enableHook(hookId, false);
                if (result2.success) {
                  enabledCount++;
                  log(`\u2705 Enabled monitoring for: ${hookDef.displayName}`);
                } else {
                  errors2.push(`${hookDef.displayName}: ${result2.message}`);
                }
              } catch (error) {
                errors2.push(`${hookDef.displayName}: ${error}`);
              }
            }
          }
        });
        this.state.active = true;
        send({
          type: "ssl_monitoring_started",
          hooksEnabled: enabledCount,
          totalAvailable: Array.from(this.state.hooks.values()).filter((h) => h.available).length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        const message = errors2.length > 0 ? `Monitoring ${enabledCount} SSL hooks. Errors: ${errors2.slice(0, 3).join(", ")}` : `Monitoring ${enabledCount} SSL hooks successfully`;
        return {
          success: true,
          message,
          enabled: enabledCount,
          failed: errors2.length
        };
      }
      /**
       * Stop SSL monitoring
       */
      stopSSLMonitoring() {
        log("\u{1F6D1} Stopping SSL monitoring...");
        const result2 = this.disableAllHooks();
        this.state.active = false;
        send({
          type: "ssl_monitoring_stopped",
          hooksDisabled: result2.disabled || 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        return result2;
      }
      /**
       * Get monitoring status
       */
      getMonitoringStatus() {
        return {
          active: this.state.active,
          startTime: this.state.startTime,
          endTime: this.state.endTime,
          eventCount: this.state.eventHistory.length
        };
      }
      /**
       * ===== HOOK CONTROL METHODS =====
       */
      /**
       * Enable a specific hook
       */
      enableHook(hookId, bypassMode = false) {
        const hookDef = this.state.hooks.get(hookId);
        if (!hookDef) {
          return { success: false, message: `Hook ${hookId} not found`, enabled: false };
        }
        if (!hookDef.available) {
          return { success: false, message: `Hook ${hookId} is not available`, enabled: false };
        }
        if (this.state.activeHooks.get(hookId)) {
          return { success: true, message: `Hook ${hookId} is already enabled`, enabled: true };
        }
        try {
          this.state.bypassModes.set(hookId, bypassMode);
          const success = this.createHookImplementation(hookDef);
          if (!success) {
            return { success: false, message: `Failed to create hook ${hookId}`, enabled: false };
          }
          this.state.activeHooks.set(hookId, true);
          hookDef.enabled = true;
          send({
            type: "ssl_hook_enabled",
            hookId,
            hookName: hookDef.displayName,
            bypassMode,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          return {
            success: true,
            message: `Hook ${hookDef.displayName} enabled${bypassMode ? " with bypass" : ""}`,
            enabled: true
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return { success: false, message: `Failed to enable hook: ${errorMsg}`, enabled: false };
        }
      }
      /**
       * Disable a specific hook
       */
      disableHook(hookId) {
        const hookDef = this.state.hooks.get(hookId);
        if (!hookDef) {
          return { success: false, message: `Hook ${hookId} not found`, enabled: false };
        }
        if (!this.state.activeHooks.get(hookId)) {
          return { success: true, message: `Hook ${hookId} is not enabled`, enabled: false };
        }
        try {
          this.state.activeHooks.set(hookId, false);
          hookDef.enabled = false;
          if (hookDef.unhookFunction) {
            hookDef.unhookFunction();
            hookDef.unhookFunction = void 0;
          } else if (hookDef.hookInstance && "detach" in hookDef.hookInstance) {
            hookDef.hookInstance.detach();
          }
          hookDef.hookInstance = void 0;
          send({
            type: "ssl_hook_disabled",
            hookId,
            hookName: hookDef.displayName,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          return { success: true, message: `Hook ${hookDef.displayName} safely disabled`, enabled: false };
        } catch (error) {
          this.state.activeHooks.set(hookId, false);
          hookDef.enabled = false;
          const errorMsg = error instanceof Error ? error.message : String(error);
          return { success: false, message: `Failed to disable hook: ${errorMsg}`, enabled: false };
        }
      }
      /**
       * Toggle a hook on/off
       */
      toggleHook(hookId, bypassMode = false) {
        const isEnabled = this.state.activeHooks.get(hookId) || false;
        const result2 = isEnabled ? this.disableHook(hookId) : this.enableHook(hookId, bypassMode);
        return {
          ...result2,
          enabled: !isEnabled
        };
      }
      /**
       * Enable all available hooks
       */
      enableAllHooks(bypassMode = false) {
        let enabled = 0;
        let failed = 0;
        for (const [hookId, hookDef] of this.state.hooks) {
          if (hookDef.available && !this.state.activeHooks.get(hookId)) {
            const result2 = this.enableHook(hookId, bypassMode);
            if (result2.success) {
              enabled++;
            } else {
              failed++;
            }
          }
        }
        return {
          success: true,
          message: `Enabled ${enabled} hooks${failed > 0 ? `, failed on ${failed}` : ""}`,
          enabled,
          failed
        };
      }
      /**
       * Disable all hooks
       */
      disableAllHooks() {
        let disabled = 0;
        let failed = 0;
        for (const [hookId] of this.state.hooks) {
          if (this.state.activeHooks.get(hookId)) {
            const result2 = this.disableHook(hookId);
            if (result2.success) {
              disabled++;
            } else {
              failed++;
            }
          }
        }
        return {
          success: true,
          message: `Disabled ${disabled} hooks${failed > 0 ? `, failed on ${failed}` : ""}`,
          disabled,
          failed
        };
      }
      /**
       * Enable hooks by category
       */
      enableHooksByCategory(category, bypassMode = false) {
        let enabled = 0;
        let failed = 0;
        for (const [hookId, hookDef] of this.state.hooks) {
          if (hookDef.category === category && hookDef.available && !this.state.activeHooks.get(hookId)) {
            const result2 = this.enableHook(hookId, bypassMode);
            if (result2.success) {
              enabled++;
            } else {
              failed++;
            }
          }
        }
        return {
          success: true,
          message: `Enabled ${enabled} ${category} hooks${failed > 0 ? `, failed on ${failed}` : ""}`,
          enabled,
          failed
        };
      }
      /**
       * ===== BYPASS CONTROL METHODS =====
       */
      /**
       * Set bypass mode for a hook
       */
      setBypassMode(hookId, bypass) {
        const hookDef = this.state.hooks.get(hookId);
        if (!hookDef) {
          return { success: false, message: `Hook ${hookId} not found`, enabled: false };
        }
        this.state.bypassModes.set(hookId, bypass);
        return {
          success: true,
          message: `Bypass ${bypass ? "enabled" : "disabled"} for ${hookDef.displayName}`,
          enabled: bypass
        };
      }
      /**
       * Enable bypass for all active hooks
       */
      enableAllBypass() {
        let enabled = 0;
        for (const [hookId] of this.state.hooks) {
          if (this.state.activeHooks.get(hookId)) {
            this.state.bypassModes.set(hookId, true);
            enabled++;
          }
        }
        return {
          success: true,
          message: `Enabled bypass on ${enabled} active hooks`,
          enabled
        };
      }
      /**
       * Disable bypass for all hooks
       */
      disableAllBypass() {
        let disabled = 0;
        for (const [hookId] of this.state.hooks) {
          this.state.bypassModes.set(hookId, false);
          disabled++;
        }
        return {
          success: true,
          message: `Disabled bypass on ${disabled} hooks`,
          disabled
        };
      }
      /**
       * ===== STATUS AND EVENT METHODS =====
       */
      /**
       * Get hook status
       */
      getHookStatus() {
        const hooks = [];
        let totalHits = 0;
        for (const [hookId, hookDef] of this.state.hooks) {
          const hitCount = this.state.hitCounts.get(hookId) || 0;
          totalHits += hitCount;
          hooks.push({
            id: hookId,
            name: hookDef.name,
            displayName: hookDef.displayName,
            category: hookDef.category,
            library: hookDef.library,
            type: hookDef.type,
            enabled: this.state.activeHooks.get(hookId) || false,
            available: hookDef.available,
            hitCount,
            lastHit: this.state.lastHits.get(hookId),
            bypassActive: this.state.bypassModes.get(hookId) || false,
            description: hookDef.description
          });
        }
        const stats = {
          totalHooks: this.state.hooks.size,
          availableHooks: Array.from(this.state.hooks.values()).filter((h) => h.available).length,
          enabledHooks: Array.from(this.state.activeHooks.values()).filter(Boolean).length,
          totalHits,
          categories: this.getHookCategories()
        };
        return { success: true, hooks, stats };
      }
      /**
       * Get available hook categories
       */
      getHookCategories() {
        const categories = /* @__PURE__ */ new Map();
        for (const [hookId, hookDef] of this.state.hooks) {
          const cat = categories.get(hookDef.category) || { count: 0, available: 0, enabled: 0 };
          cat.count++;
          if (hookDef.available)
            cat.available++;
          if (this.state.activeHooks.get(hookId))
            cat.enabled++;
          categories.set(hookDef.category, cat);
        }
        return Array.from(categories.entries()).map(([category, stats]) => ({
          category,
          ...stats
        }));
      }
      /**
       * Create an SSL event
       */
      createEvent(hookDef, phase, args, retval, extra) {
        const event = {
          id: `ssl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "monitor",
          hookId: hookDef.id,
          hookName: hookDef.displayName,
          action: "triggered",
          library: hookDef.library,
          function: hookDef.name,
          success: true,
          parameters: {
            phase,
            ...extra
          }
        };
        if (args && (hookDef.name.includes("cert") || hookDef.name.includes("trust"))) {
          event.certificateInfo = this.extractCertificateInfo(args);
        }
        if (hookDef.category !== "native") {
          event.stackTrace = this.getJavaStackTrace();
        }
        log(`\u{1F510} SSL Call: ${hookDef.displayName} - ${phase}`);
        return event;
      }
      /**
       * Record an SSL event
       */
      recordEvent(event) {
        const currentCount = this.state.hitCounts.get(event.hookId) || 0;
        this.state.hitCounts.set(event.hookId, currentCount + 1);
        this.state.lastHits.set(event.hookId, event.timestamp);
        this.state.eventHistory.unshift(event);
        if (this.state.eventHistory.length > this.state.maxEventHistory) {
          this.state.eventHistory = this.state.eventHistory.slice(0, this.state.maxEventHistory);
        }
        this.state.eventCount++;
        if (this.state.eventCallback) {
          try {
            this.state.eventCallback(event);
          } catch (e) {
            logError("Error in event callback", e);
          }
        }
        send({
          type: "ssl_event",
          event,
          hitCount: this.state.hitCounts.get(event.hookId),
          timestamp: event.timestamp
        });
      }
      /**
       * Get events with optional limit
       */
      getEvents(limit) {
        const events = limit ? this.state.eventHistory.slice(0, limit) : this.state.eventHistory;
        return {
          success: true,
          events,
          count: events.length
        };
      }
      /**
       * Clear all events
       */
      clearEvents() {
        this.state.eventHistory = [];
        this.state.eventCount = 0;
        return {
          success: true,
          message: "All events cleared"
        };
      }
      /**
       * Set event callback
       */
      setEventCallback(callback) {
        this.state.eventCallback = callback;
        return {
          success: true,
          message: "Event callback set"
        };
      }
      /**
       * ===== HELPER METHODS =====
       */
      /**
       * Extract certificate information from arguments
       */
      extractCertificateInfo(args) {
        try {
          if (args && args[0]) {
            const certs = args[0];
            if (Array.isArray(certs) || certs && certs.length !== void 0) {
              const certInfo = [];
              for (let i = 0; i < Math.min(certs.length, 3); i++) {
                try {
                  const cert = certs[i];
                  if (cert && typeof cert === "object") {
                    certInfo.push({
                      subject: cert.getSubjectDN ? cert.getSubjectDN().toString() : "[Unknown]",
                      issuer: cert.getIssuerDN ? cert.getIssuerDN().toString() : "[Unknown]",
                      serialNumber: cert.getSerialNumber ? cert.getSerialNumber().toString() : "[Unknown]"
                    });
                  }
                } catch (e) {
                }
              }
              return { certificates: certInfo, count: certs.length };
            }
          }
        } catch (e) {
        }
        return null;
      }
      /**
       * Get Java stack trace
       */
      getJavaStackTrace() {
        try {
          const Exception = frida_java_bridge_default.use("java.lang.Exception");
          const exception = Exception.$new();
          const StringWriter = frida_java_bridge_default.use("java.io.StringWriter");
          const PrintWriter = frida_java_bridge_default.use("java.io.PrintWriter");
          const sw = StringWriter.$new();
          const pw = PrintWriter.$new(sw);
          exception.printStackTrace(pw);
          const stackTrace = sw.toString();
          return stackTrace.split("\n").filter((line) => line.trim().length > 0);
        } catch (e) {
          return ["[Stack trace unavailable]"];
        }
      }
    };
  }
});

// agent/Android/IPC/IPC.ts
var AndroidIPCModule;
var init_IPC = __esm({
  "agent/Android/IPC/IPC.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_frida_java_bridge();
    AndroidIPCModule = class extends BaseModule {
      state;
      eventIdCounter = 0;
      // Store the actual hooked method objects and their original implementations
      hooks = /* @__PURE__ */ new Map();
      // Deduplication cache to prevent duplicate events
      deduplicationCache = [];
      DEDUP_WINDOW_MS = 100;
      // 100ms window for duplicates
      MAX_DEDUP_CACHE_SIZE = 100;
      constructor() {
        super({
          name: "AndroidIPC",
          version: "1.0.0",
          platform: "android",
          category: "IPC",
          description: "Monitor and intercept Android IPC calls (Intents, Content Providers, Binder, Services)"
        });
        this.state = {
          active: false,
          startTime: (/* @__PURE__ */ new Date()).toISOString(),
          events: [],
          statistics: {
            totalEvents: 0,
            byType: {
              intent: 0,
              broadcast: 0,
              content_provider: 0,
              binder: 0,
              service: 0
            },
            byPackage: {},
            byOperation: {},
            errorCount: 0,
            startTime: (/* @__PURE__ */ new Date()).toISOString()
          },
          filters: {
            types: ["intent", "broadcast", "content_provider", "binder", "service"],
            packages: [],
            excludeSystem: true
          }
        };
      }
      async onInitialize() {
        log("[AndroidIPC] Module initialized");
        setInterval(() => this.cleanDeduplicationCache(), 5e3);
      }
      async onShutdown() {
        if (this.state.active) {
          this.stopMonitoring();
        }
        log("[AndroidIPC] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("startIPCMonitoring", () => this.startMonitoring());
        this.registry.registerBoth("stopIPCMonitoring", () => this.stopMonitoring());
        this.registry.registerBoth("getIPCEvents", () => this.getEvents());
        this.registry.registerBoth("getIPCStatistics", () => this.getStatistics());
        this.registry.registerBoth("clearIPCEvents", () => this.clearEvents());
        this.registry.registerBoth("setIPCFilters", (filters) => this.setFilters(filters));
        this.registry.registerBoth("getIPCFilters", () => this.getFilters());
        this.registry.registerBoth("exportIPCData", () => this.exportData());
      }
      startMonitoring() {
        if (this.state.active) {
          warn("[AndroidIPC] Monitoring is already active");
          return { success: false, message: "IPC monitoring is already active" };
        }
        try {
          frida_java_bridge_default.perform(() => {
            this.hookIntents();
            this.hookContentProviders();
            this.hookBinder();
            this.hookServices();
          });
          this.state.active = true;
          this.state.startTime = (/* @__PURE__ */ new Date()).toISOString();
          this.state.statistics.startTime = this.state.startTime;
          log("[AndroidIPC] Monitoring started");
          return {
            success: true,
            message: "IPC monitoring started successfully",
            data: {
              filters: this.state.filters,
              startTime: this.state.startTime
            }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logError("[AndroidIPC] Failed to start monitoring", error);
          this.state.lastError = errorMsg;
          return { success: false, error: errorMsg };
        }
      }
      stopMonitoring() {
        if (!this.state.active) {
          warn("[AndroidIPC] Monitoring is not active");
          return { success: false, message: "IPC monitoring is not active" };
        }
        try {
          frida_java_bridge_default.perform(() => {
            this.hooks.forEach((hookInfo, key) => {
              try {
                hookInfo.method.implementation = hookInfo.original;
                log(`[AndroidIPC] Restored ${key}`);
              } catch (e) {
                logError(`[AndroidIPC] Failed to restore ${key}`, e);
              }
            });
          });
          this.hooks.clear();
          this.deduplicationCache = [];
          this.state.active = false;
          this.state.endTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[AndroidIPC] Monitoring stopped - all hooks restored");
          return {
            success: true,
            message: "IPC monitoring stopped and hooks restored",
            data: {
              duration: this.calculateDuration(),
              totalEvents: this.state.statistics.totalEvents
            }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logError("[AndroidIPC] Failed to stop monitoring", error);
          return { success: false, error: errorMsg };
        }
      }
      hookIntents() {
        const Context = frida_java_bridge_default.use("android.content.Context");
        const Intent = frida_java_bridge_default.use("android.content.Intent");
        const Activity = frida_java_bridge_default.use("android.app.Activity");
        const moduleRef = this;
        try {
          const startActivity = Context.startActivity.overload("android.content.Intent");
          const originalStartActivity = startActivity.implementation;
          const wrapperFunction = frida_java_bridge_default.registerClass({
            name: "com.leviathan.StartActivityWrapper",
            methods: {
              invoke: function(context, intent) {
                if (moduleRef.state && moduleRef.state.active) {
                  try {
                    moduleRef.captureIntentEvent(intent, "startActivity", context);
                  } catch (e) {
                    logError("[AndroidIPC] Error capturing startActivity", e);
                  }
                }
                return originalStartActivity.call(context, intent);
              }
            }
          });
          const wrapper = wrapperFunction.$new();
          startActivity.implementation = function(intent) {
            return wrapper.invoke(this, intent);
          };
          this.hooks.set("Context.startActivity", {
            method: startActivity,
            original: originalStartActivity
          });
          log("[AndroidIPC] Hooked Context.startActivity");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Context.startActivity", e);
        }
        try {
          let hooked = false;
          try {
            const startActivityForResultBundle = Activity.startActivityForResult.overload("android.content.Intent", "int", "android.os.Bundle");
            const originalBundle = startActivityForResultBundle.implementation;
            startActivityForResultBundle.implementation = function(intent, requestCode, options) {
              if (moduleRef.state && moduleRef.state.active) {
                try {
                  moduleRef.captureIntentEvent(intent, "startActivityForResult", this);
                } catch (e) {
                  logError("[AndroidIPC] Error in startActivityForResult bundle hook", e);
                }
              }
              if (originalBundle) {
                return originalBundle.call(this, intent, requestCode, options);
              } else {
                log("[AndroidIPC] Warning: originalBundle is null, calling super");
                return this.startActivityForResult(intent, requestCode, options);
              }
            };
            this.hooks.set("Activity.startActivityForResult_bundle", {
              method: startActivityForResultBundle,
              original: originalBundle
            });
            hooked = true;
            log("[AndroidIPC] Hooked Activity.startActivityForResult (with Bundle)");
          } catch (e) {
          }
          if (!hooked) {
            const startActivityForResultSimple = Activity.startActivityForResult.overload("android.content.Intent", "int");
            const originalSimple = startActivityForResultSimple.implementation;
            startActivityForResultSimple.implementation = function(intent, requestCode) {
              if (moduleRef.state && moduleRef.state.active) {
                try {
                  moduleRef.captureIntentEvent(intent, "startActivityForResult", this);
                } catch (e) {
                  logError("[AndroidIPC] Error in startActivityForResult simple hook", e);
                }
              }
              if (originalSimple) {
                return originalSimple.call(this, intent, requestCode);
              } else {
                return this.startActivityForResult(intent, requestCode);
              }
            };
            this.hooks.set("Activity.startActivityForResult_simple", {
              method: startActivityForResultSimple,
              original: originalSimple
            });
            log("[AndroidIPC] Hooked Activity.startActivityForResult (simple)");
          }
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Activity.startActivityForResult", e);
        }
        try {
          const sendBroadcast = Context.sendBroadcast.overload("android.content.Intent");
          const originalSendBroadcast = sendBroadcast.implementation;
          sendBroadcast.implementation = function(intent) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureIntentEvent(intent, "broadcast", this);
              } catch (e) {
                logError("[AndroidIPC] Error in sendBroadcast hook", e);
              }
            }
            if (originalSendBroadcast) {
              return originalSendBroadcast.call(this, intent);
            } else {
              return this.sendBroadcast(intent);
            }
          };
          this.hooks.set("Context.sendBroadcast", {
            method: sendBroadcast,
            original: originalSendBroadcast
          });
          log("[AndroidIPC] Hooked Context.sendBroadcast");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Context.sendBroadcast", e);
        }
        try {
          const sendOrderedBroadcast = Context.sendOrderedBroadcast.overload("android.content.Intent", "java.lang.String");
          const originalSendOrderedBroadcast = sendOrderedBroadcast.implementation;
          sendOrderedBroadcast.implementation = function(intent, permission) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureIntentEvent(intent, "orderedBroadcast", this);
              } catch (e) {
                logError("[AndroidIPC] Error in sendOrderedBroadcast hook", e);
              }
            }
            if (originalSendOrderedBroadcast) {
              return originalSendOrderedBroadcast.call(this, intent, permission);
            } else {
              return this.sendOrderedBroadcast(intent, permission);
            }
          };
          this.hooks.set("Context.sendOrderedBroadcast", {
            method: sendOrderedBroadcast,
            original: originalSendOrderedBroadcast
          });
          log("[AndroidIPC] Hooked Context.sendOrderedBroadcast");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Context.sendOrderedBroadcast", e);
        }
      }
      hookContentProviders() {
        const ContentResolver = frida_java_bridge_default.use("android.content.ContentResolver");
        const moduleRef = this;
        try {
          const query = ContentResolver.query.overload("android.net.Uri", "[Ljava.lang.String;", "java.lang.String", "[Ljava.lang.String;", "java.lang.String");
          const originalQuery = query.implementation;
          query.implementation = function(uri, projection, selection, selectionArgs, sortOrder) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureContentProviderEvent("query", uri, {
                  projection: moduleRef.safeExtractStringArray(projection),
                  selection,
                  selectionArgs: moduleRef.safeExtractStringArray(selectionArgs),
                  sortOrder
                });
              } catch (e) {
                logError("[AndroidIPC] Error in query hook", e);
              }
            }
            if (originalQuery) {
              return originalQuery.call(this, uri, projection, selection, selectionArgs, sortOrder);
            } else {
              return this.query(uri, projection, selection, selectionArgs, sortOrder);
            }
          };
          this.hooks.set("ContentResolver.query", {
            method: query,
            original: originalQuery
          });
          log("[AndroidIPC] Hooked ContentResolver.query");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook ContentResolver.query", e);
        }
        try {
          const insert = ContentResolver.insert.overload("android.net.Uri", "android.content.ContentValues");
          const originalInsert = insert.implementation;
          insert.implementation = function(uri, values) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureContentProviderEvent("insert", uri, {
                  values: moduleRef.extractContentValues(values)
                });
              } catch (e) {
                logError("[AndroidIPC] Error in insert hook", e);
              }
            }
            if (originalInsert) {
              return originalInsert.call(this, uri, values);
            } else {
              return this.insert(uri, values);
            }
          };
          this.hooks.set("ContentResolver.insert", {
            method: insert,
            original: originalInsert
          });
          log("[AndroidIPC] Hooked ContentResolver.insert");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook ContentResolver.insert", e);
        }
        try {
          const update = ContentResolver.update.overload("android.net.Uri", "android.content.ContentValues", "java.lang.String", "[Ljava.lang.String;");
          const originalUpdate = update.implementation;
          update.implementation = function(uri, values, where, selectionArgs) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureContentProviderEvent("update", uri, {
                  values: moduleRef.extractContentValues(values),
                  selection: where,
                  selectionArgs: moduleRef.safeExtractStringArray(selectionArgs)
                });
              } catch (e) {
                logError("[AndroidIPC] Error in update hook", e);
              }
            }
            if (originalUpdate) {
              return originalUpdate.call(this, uri, values, where, selectionArgs);
            } else {
              return this.update(uri, values, where, selectionArgs);
            }
          };
          this.hooks.set("ContentResolver.update", {
            method: update,
            original: originalUpdate
          });
          log("[AndroidIPC] Hooked ContentResolver.update");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook ContentResolver.update", e);
        }
        try {
          const deleteMethod = ContentResolver.delete.overload("android.net.Uri", "java.lang.String", "[Ljava.lang.String;");
          const originalDelete = deleteMethod.implementation;
          deleteMethod.implementation = function(uri, where, selectionArgs) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureContentProviderEvent("delete", uri, {
                  selection: where,
                  selectionArgs: moduleRef.safeExtractStringArray(selectionArgs)
                });
              } catch (e) {
                logError("[AndroidIPC] Error in delete hook", e);
              }
            }
            if (originalDelete) {
              return originalDelete.call(this, uri, where, selectionArgs);
            } else {
              return this.delete(uri, where, selectionArgs);
            }
          };
          this.hooks.set("ContentResolver.delete", {
            method: deleteMethod,
            original: originalDelete
          });
          log("[AndroidIPC] Hooked ContentResolver.delete");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook ContentResolver.delete", e);
        }
      }
      hookBinder() {
        try {
          const Binder = frida_java_bridge_default.use("android.os.Binder");
          const moduleRef = this;
          const onTransact = Binder.onTransact.overload("int", "android.os.Parcel", "android.os.Parcel", "int");
          const originalOnTransact = onTransact.implementation;
          onTransact.implementation = function(code5, data, reply, flags) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                const descriptor = this.getInterfaceDescriptor();
                moduleRef.captureBinderEvent(code5, data, reply, flags, descriptor);
              } catch (e) {
                logError("[AndroidIPC] Error in onTransact hook", e);
              }
            }
            if (originalOnTransact) {
              return originalOnTransact.call(this, code5, data, reply, flags);
            } else {
              return this.onTransact(code5, data, reply, flags);
            }
          };
          this.hooks.set("Binder.onTransact", {
            method: onTransact,
            original: originalOnTransact
          });
          log("[AndroidIPC] Hooked Binder.onTransact");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Binder", e);
        }
      }
      hookServices() {
        const Context = frida_java_bridge_default.use("android.content.Context");
        const moduleRef = this;
        try {
          const startService = Context.startService.overload("android.content.Intent");
          const originalStartService = startService.implementation;
          startService.implementation = function(intent) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureServiceEvent("start", intent, this);
              } catch (e) {
                logError("[AndroidIPC] Error in startService hook", e);
              }
            }
            if (originalStartService) {
              return originalStartService.call(this, intent);
            } else {
              return this.startService(intent);
            }
          };
          this.hooks.set("Context.startService", {
            method: startService,
            original: originalStartService
          });
          log("[AndroidIPC] Hooked Context.startService");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Context.startService", e);
        }
        try {
          const stopService = Context.stopService.overload("android.content.Intent");
          const originalStopService = stopService.implementation;
          stopService.implementation = function(intent) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureServiceEvent("stop", intent, this);
              } catch (e) {
                logError("[AndroidIPC] Error in stopService hook", e);
              }
            }
            if (originalStopService) {
              return originalStopService.call(this, intent);
            } else {
              return this.stopService(intent);
            }
          };
          this.hooks.set("Context.stopService", {
            method: stopService,
            original: originalStopService
          });
          log("[AndroidIPC] Hooked Context.stopService");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Context.stopService", e);
        }
        try {
          const bindService = Context.bindService.overload("android.content.Intent", "android.content.ServiceConnection", "int");
          const originalBindService = bindService.implementation;
          bindService.implementation = function(intent, conn, flags) {
            if (moduleRef.state && moduleRef.state.active) {
              try {
                moduleRef.captureServiceEvent("bind", intent, this, flags);
              } catch (e) {
                logError("[AndroidIPC] Error in bindService hook", e);
              }
            }
            if (originalBindService) {
              return originalBindService.call(this, intent, conn, flags);
            } else {
              return this.bindService(intent, conn, flags);
            }
          };
          this.hooks.set("Context.bindService", {
            method: bindService,
            original: originalBindService
          });
          log("[AndroidIPC] Hooked Context.bindService");
        } catch (e) {
          logError("[AndroidIPC] Failed to hook Context.bindService", e);
        }
      }
      // Rest of the methods remain the same...
      isDuplicateEvent(type, key, additionalInfo) {
        const now = Date.now();
        const tid = Process.getCurrentThreadId();
        this.deduplicationCache = this.deduplicationCache.filter((entry) => now - entry.timestamp < this.DEDUP_WINDOW_MS);
        const isDuplicate = this.deduplicationCache.some((entry) => entry.type === type && entry.action === key && entry.tid === tid && (additionalInfo ? entry.targetPackage === additionalInfo || entry.uri === additionalInfo : true));
        if (!isDuplicate) {
          this.deduplicationCache.push({
            action: key,
            timestamp: now,
            tid,
            type,
            targetPackage: type === "intent" ? additionalInfo : void 0,
            uri: type === "content_provider" ? additionalInfo : void 0
          });
          if (this.deduplicationCache.length > this.MAX_DEDUP_CACHE_SIZE) {
            this.deduplicationCache = this.deduplicationCache.slice(-this.MAX_DEDUP_CACHE_SIZE);
          }
        }
        return isDuplicate;
      }
      cleanDeduplicationCache() {
        const now = Date.now();
        this.deduplicationCache = this.deduplicationCache.filter((entry) => now - entry.timestamp < this.DEDUP_WINDOW_MS * 2);
      }
      captureIntentEvent(intent, operation, context) {
        try {
          const action = intent.getAction() || "unknown";
          const targetPackage = intent.getPackage() || void 0;
          if (this.isDuplicateEvent("intent", action, targetPackage)) {
            return;
          }
          const eventType = operation === "broadcast" || operation === "orderedBroadcast" ? "broadcast" : "intent";
          const event = {
            id: this.generateEventId(),
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: eventType,
            action,
            targetComponent: intent.getComponent()?.toString() || void 0,
            targetPackage,
            sourcePackage: this.getCurrentPackageName(),
            extras: this.extractExtras(intent),
            flags: intent.getFlags(),
            categories: this.extractCategories(intent),
            data: intent.getDataString() || void 0,
            scheme: intent.getScheme() || void 0,
            mimeType: intent.getType() || void 0,
            stackTrace: this.getStackTrace(),
            callChain: this.getCallChain(),
            pid: Process.id,
            tid: Process.getCurrentThreadId()
          };
          this.addEvent(event);
          this.sendEventToUI(event);
        } catch (error) {
          logError("[AndroidIPC] Error capturing intent event", error);
        }
      }
      captureContentProviderEvent(operation, uri, params) {
        try {
          const uriString = uri.toString();
          if (this.isDuplicateEvent("content_provider", operation, uriString)) {
            return;
          }
          const event = {
            id: this.generateEventId(),
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "content_provider",
            uri: uriString,
            operation,
            authority: uri.getAuthority() || void 0,
            ...params,
            stackTrace: this.getStackTrace(),
            callChain: this.getCallChain(),
            packageName: this.getCurrentPackageName(),
            pid: Process.id,
            tid: Process.getCurrentThreadId()
          };
          this.addEvent(event);
          this.sendEventToUI(event);
        } catch (error) {
          logError("[AndroidIPC] Error capturing content provider event", error);
        }
      }
      captureBinderEvent(code5, data, reply, flags, descriptor) {
        try {
          const interfaceName = descriptor || this.getBinderInterface();
          const binderKey = `${interfaceName}_${code5}`;
          if (this.isDuplicateEvent("binder", binderKey)) {
            return;
          }
          const event = {
            id: this.generateEventId(),
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "binder",
            interfaceName,
            methodName: `transaction_${code5}`,
            transactionCode: code5,
            flags,
            stackTrace: this.getStackTrace(),
            callChain: this.getCallChain(),
            packageName: this.getCurrentPackageName(),
            pid: Process.id,
            tid: Process.getCurrentThreadId()
          };
          this.addEvent(event);
          this.sendEventToUI(event);
        } catch (error) {
          logError("[AndroidIPC] Error capturing binder event", error);
        }
      }
      captureServiceEvent(operation, intent, context, flags) {
        try {
          const serviceName = intent?.getComponent()?.toString() || "unknown";
          if (this.isDuplicateEvent("service", operation, serviceName)) {
            return;
          }
          const event = {
            id: this.generateEventId(),
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "service",
            serviceName,
            operation,
            flags,
            stackTrace: this.getStackTrace(),
            callChain: this.getCallChain(),
            packageName: this.getCurrentPackageName(),
            pid: Process.id,
            tid: Process.getCurrentThreadId()
          };
          this.addEvent(event);
          this.sendEventToUI(event);
        } catch (error) {
          logError("[AndroidIPC] Error capturing service event", error);
        }
      }
      addEvent(event) {
        if (!this.shouldCaptureEvent(event)) {
          return;
        }
        this.state.events.push(event);
        if (this.state.events.length > 1e3) {
          this.state.events = this.state.events.slice(-1e3);
        }
        this.updateStatistics(event);
      }
      shouldCaptureEvent(event) {
        const { filters } = this.state;
        if (!filters.types.includes(event.type)) {
          return false;
        }
        if (filters.packages.length > 0) {
          const eventPackages = [
            event.packageName,
            event.targetPackage,
            event.sourcePackage
          ].filter(Boolean);
          if (!eventPackages.some((pkg) => pkg && filters.packages.includes(pkg))) {
            return false;
          }
        }
        if (filters.excludeSystem) {
          const systemPackages = ["android", "com.android", "com.google.android"];
          const eventPackages = [
            event.packageName,
            event.targetPackage,
            event.sourcePackage
          ];
          for (const pkg of eventPackages) {
            if (pkg && systemPackages.some((sysPkg) => pkg.startsWith(sysPkg))) {
              return false;
            }
          }
        }
        return true;
      }
      updateStatistics(event) {
        const stats = this.state.statistics;
        stats.totalEvents++;
        stats.byType[event.type]++;
        stats.lastEventTime = event.timestamp;
        if (event.error) {
          stats.errorCount++;
        }
        if (event.packageName) {
          stats.byPackage[event.packageName] = (stats.byPackage[event.packageName] || 0) + 1;
        }
        let operation = "";
        switch (event.type) {
          case "intent":
          case "broadcast":
            operation = event.action || "unknown";
            break;
          case "content_provider":
            operation = event.operation;
            break;
          case "service":
            operation = event.operation;
            break;
          case "binder":
            operation = `binder_${event.transactionCode}`;
            break;
        }
        stats.byOperation[operation] = (stats.byOperation[operation] || 0) + 1;
      }
      sendEventToUI(event) {
        send({
          type: "ipc_event",
          data: event
        });
      }
      generateEventId() {
        return `ipc_${Date.now()}_${++this.eventIdCounter}`;
      }
      getCurrentPackageName() {
        try {
          const ActivityThread = frida_java_bridge_default.use("android.app.ActivityThread");
          const currentApplication = ActivityThread.currentApplication();
          if (currentApplication) {
            return currentApplication.getPackageName();
          }
        } catch (e) {
        }
        return "unknown";
      }
      calculateDuration() {
        if (!this.state.endTime) {
          return "ongoing";
        }
        const start = new Date(this.state.startTime).getTime();
        const end = new Date(this.state.endTime).getTime();
        const duration = end - start;
        return `${Math.round(duration / 1e3)}s`;
      }
      getEvents() {
        return {
          success: true,
          data: {
            events: this.state.events,
            count: this.state.events.length,
            active: this.state.active,
            statistics: this.state.statistics,
            filters: this.state.filters
          }
        };
      }
      getStatistics() {
        return {
          success: true,
          data: this.state.statistics
        };
      }
      clearEvents() {
        this.state.events = [];
        this.deduplicationCache = [];
        this.state.statistics = {
          totalEvents: 0,
          byType: {
            intent: 0,
            broadcast: 0,
            content_provider: 0,
            binder: 0,
            service: 0
          },
          byPackage: {},
          byOperation: {},
          errorCount: 0,
          startTime: this.state.statistics.startTime,
          lastEventTime: void 0
        };
        return {
          success: true,
          message: "IPC events cleared"
        };
      }
      setFilters(filters) {
        if (filters.types) {
          this.state.filters.types = filters.types;
        }
        if (filters.packages !== void 0) {
          this.state.filters.packages = filters.packages;
        }
        if (filters.excludeSystem !== void 0) {
          this.state.filters.excludeSystem = filters.excludeSystem;
        }
        return {
          success: true,
          data: this.state.filters
        };
      }
      getFilters() {
        return {
          success: true,
          data: this.state.filters
        };
      }
      exportData() {
        const exportData = {
          metadata: {
            exportTime: (/* @__PURE__ */ new Date()).toISOString(),
            duration: this.calculateDuration(),
            filters: this.state.filters
          },
          statistics: this.state.statistics,
          events: this.state.events
        };
        return {
          success: true,
          data: exportData
        };
      }
      extractExtras(intent) {
        const extras = {};
        try {
          const bundle = intent.getExtras();
          if (bundle) {
            const keySet = bundle.keySet();
            const iterator = keySet.iterator();
            while (iterator.hasNext()) {
              const key = iterator.next();
              try {
                const value = bundle.get(key);
                extras[key] = value ? String(value) : "null";
              } catch (e) {
                extras[key] = "<error reading value>";
              }
            }
          }
        } catch (error) {
          logError("[AndroidIPC] Error extracting extras", error);
        }
        return extras;
      }
      extractCategories(intent) {
        const categories = [];
        try {
          const categorySet = intent.getCategories();
          if (categorySet) {
            const iterator = categorySet.iterator();
            while (iterator.hasNext()) {
              categories.push(iterator.next());
            }
          }
        } catch (error) {
          logError("[AndroidIPC] Error extracting categories", error);
        }
        return categories;
      }
      extractContentValues(contentValues) {
        const values = {};
        try {
          if (contentValues) {
            const keySet = contentValues.keySet();
            const iterator = keySet.iterator();
            while (iterator.hasNext()) {
              const key = iterator.next();
              try {
                const value = contentValues.get(key);
                values[key] = value ? String(value) : "null";
              } catch (e) {
                values[key] = "<error reading value>";
              }
            }
          }
        } catch (error) {
          logError("[AndroidIPC] Error extracting content values", error);
        }
        return values;
      }
      /**
       * Safely extract a Java String array to a JavaScript array.
       * Handles null values and invalid pointers gracefully.
       */
      safeExtractStringArray(javaArray) {
        if (javaArray === null || javaArray === void 0) {
          return null;
        }
        try {
          const length = javaArray.length;
          if (typeof length !== "number" || length < 0) {
            return null;
          }
          const result2 = [];
          for (let i = 0; i < length; i++) {
            try {
              const item = javaArray[i];
              result2.push(item !== null ? String(item) : "null");
            } catch (e) {
              result2.push("<error reading element>");
            }
          }
          return result2;
        } catch (error) {
          return null;
        }
      }
      getBinderInterface() {
        try {
          const stackTrace = this.getStackTrace();
          for (const frame of stackTrace) {
            if (frame.includes("$Stub$Proxy")) {
              const match = frame.match(/([a-zA-Z0-9._]+)\$Stub\$Proxy/);
              if (match) {
                return match[1];
              }
            }
          }
        } catch (e) {
        }
        return "Unknown";
      }
      getStackTrace() {
        const stackTrace = [];
        try {
          const JavaThread = frida_java_bridge_default.use("java.lang.Thread");
          const currentThread = JavaThread.currentThread();
          const stackTraceElements = currentThread.getStackTrace();
          for (let i = 3; i < Math.min(stackTraceElements.length, 20); i++) {
            const element = stackTraceElements[i];
            const className = element.getClassName();
            const methodName = element.getMethodName();
            const fileName = element.getFileName();
            const lineNumber = element.getLineNumber();
            const formatted = `${className}.${methodName}(${fileName}:${lineNumber})`;
            stackTrace.push(formatted);
            if (className.includes("Activity") || className.includes("Service") || className.includes("BroadcastReceiver") || className.includes("ContentProvider")) {
              stackTrace[stackTrace.length - 1] = `\u2192 ${formatted}`;
            }
          }
        } catch (error) {
          logError("[AndroidIPC] Error getting stack trace", error);
        }
        return stackTrace;
      }
      getCallChain() {
        const callChain = [];
        const seen = /* @__PURE__ */ new Set();
        try {
          const JavaThread = frida_java_bridge_default.use("java.lang.Thread");
          const currentThread = JavaThread.currentThread();
          const stackTraceElements = currentThread.getStackTrace();
          for (let i = 3; i < stackTraceElements.length; i++) {
            const element = stackTraceElements[i];
            const className = element.getClassName();
            const methodName = element.getMethodName();
            if (className.includes("Activity") || className.includes("Service") || className.includes("BroadcastReceiver") || className.includes("ContentProvider") || className.includes("Fragment") || className.includes("Application")) {
              const simplifiedClass = className.substring(className.lastIndexOf(".") + 1);
              const callChainEntry = `${simplifiedClass}.${methodName}()`;
              if (!seen.has(callChainEntry)) {
                seen.add(callChainEntry);
                callChain.push(callChainEntry);
              }
            }
          }
        } catch (error) {
          logError("[AndroidIPC] Error getting call chain", error);
        }
        return callChain;
      }
    };
  }
});

// agent/iOS/Info/iOSInfoModule.ts
var iOSInfoModule;
var init_iOSInfoModule = __esm({
  "agent/iOS/Info/iOSInfoModule.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_frida_objc_bridge();
    iOSInfoModule = class extends BaseModule {
      constructor() {
        super({
          name: "iOSInfo",
          version: "1.0.0",
          platform: "ios",
          category: "deviceInfo",
          description: "iOS device information provider"
        });
      }
      async onInitialize() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        log("[iOSInfo] Module initialized");
      }
      async onShutdown() {
        log("[iOSInfo] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("getiOSDeviceInfo", () => this.getiOSDeviceInfo());
      }
      getiOSDeviceInfo() {
        log("\u{1F50D} DEBUG: getiOSDeviceInfo() called");
        if (!frida_objc_bridge_default.available) {
          log("\u274C ObjC runtime not available");
          return {
            success: false,
            message: "ObjC runtime not available",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
        try {
          const deviceInfo = {};
          const UIDevice = frida_objc_bridge_default.classes.UIDevice;
          const device = UIDevice.currentDevice();
          device.setBatteryMonitoringEnabled_(true);
          deviceInfo.name = device.name().toString();
          deviceInfo.systemName = device.systemName().toString();
          deviceInfo.systemVersion = device.systemVersion().toString();
          deviceInfo.model = device.model().toString();
          deviceInfo.localizedModel = device.localizedModel().toString();
          deviceInfo.orientation = device.orientation().toString();
          deviceInfo.batteryState = device.batteryState().toString();
          deviceInfo.batteryLevel = device.batteryLevel();
          const idfv = device.identifierForVendor();
          deviceInfo.identifierForVendor = idfv ? idfv.UUIDString().toString() : null;
          const processInfo = frida_objc_bridge_default.classes.NSProcessInfo.processInfo();
          deviceInfo.processorCount = Number(processInfo.processorCount());
          deviceInfo.physicalMemory = Number(processInfo.physicalMemory());
          const NSBundle = frida_objc_bridge_default.classes.NSBundle;
          const mainBundle = NSBundle.mainBundle();
          deviceInfo.bundleIdentifier = mainBundle.bundleIdentifier().toString();
          const infoDict = mainBundle.infoDictionary();
          deviceInfo.appVersion = infoDict.objectForKey_("CFBundleShortVersionString").toString();
          deviceInfo.buildVersion = infoDict.objectForKey_("CFBundleVersion").toString();
          log("Successfully retrieved iOS device info");
          return {
            success: true,
            data: deviceInfo,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          log("Error retrieving iOS device info: " + error);
          return {
            success: false,
            message: error.message || String(error),
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
    };
  }
});

// agent/Utils/ObjC/Helper.ts
var ObjCUtils;
var init_Helper = __esm({
  "agent/Utils/ObjC/Helper.ts"() {
    "use strict";
    init_node_globals();
    init_logger();
    init_frida_objc_bridge();
    ObjCUtils = {
      /**
       * Convert any ObjC object to string safely
       * Handles NSString, NSURL, and other common ObjC objects
       */
      toString(obj) {
        if (!obj)
          return "";
        try {
          if (typeof obj === "string")
            return obj;
          if (typeof obj === "number")
            return String(obj);
          if (typeof obj === "object" && String(obj).includes("0x") && !obj.$className) {
            try {
              const wrapped = new frida_objc_bridge_default.Object(obj);
              return this.toString(wrapped);
            } catch (e) {
            }
          }
          if (obj.absoluteString) {
            try {
              const absStr = obj.absoluteString();
              return absStr.toString();
            } catch (e) {
              log(`[ObjCUtils] Failed to get absoluteString: ${e}`);
            }
          }
          if (obj.UTF8String) {
            try {
              const utf8Str = obj.UTF8String();
              return String(utf8Str);
            } catch (e) {
              log(`[ObjCUtils] Failed to get UTF8String: ${e}`);
            }
          }
          if (obj.description) {
            try {
              const desc = obj.description();
              return desc.toString();
            } catch (e) {
              log(`[ObjCUtils] Failed to get description: ${e}`);
            }
          }
          if (obj.toString && typeof obj.toString === "function") {
            try {
              return obj.toString();
            } catch (e) {
              log(`[ObjCUtils] Failed to call toString: ${e}`);
            }
          }
          if (obj.$className) {
            return `<${obj.$className} instance>`;
          }
          return String(obj);
        } catch (e) {
          log(`[ObjCUtils] Failed to convert to string: ${e}`);
          return `<conversion error: ${e}>`;
        }
      },
      /**
       * Get property value safely (handles both properties and methods)
       */
      getProperty(obj, propertyName) {
        if (!obj || !propertyName)
          return null;
        try {
          const prop = obj[propertyName];
          if (typeof prop === "function") {
            return prop.call(obj);
          }
          return prop;
        } catch (e) {
          log(`[ObjCUtils] Failed to get property ${propertyName}: ${e}`);
          return null;
        }
      },
      /**
       * Safely call a method on an ObjC object
       */
      callMethod(obj, methodName, ...args) {
        if (!obj || !methodName)
          return null;
        try {
          const method2 = obj[methodName];
          if (typeof method2 === "function") {
            return method2.apply(obj, args);
          }
          log(`[ObjCUtils] ${methodName} is not a function`);
          return null;
        } catch (e) {
          log(`[ObjCUtils] Failed to call method ${methodName}: ${e}`);
          return null;
        }
      },
      /**
       * Convert NSArray to JavaScript array
       */
      nsArrayToArray(nsArray) {
        const result2 = [];
        if (!nsArray)
          return result2;
        try {
          const count = nsArray.count();
          for (let i = 0; i < count; i++) {
            const item = nsArray.objectAtIndex_(i);
            result2.push(item);
          }
        } catch (e) {
          log(`[ObjCUtils] Failed to convert NSArray: ${e}`);
        }
        return result2;
      },
      /**
       * Convert NSDictionary to JavaScript object
       */
      nsDictionaryToObject(nsDict) {
        const result2 = {};
        if (!nsDict)
          return result2;
        try {
          const keys = nsDict.allKeys();
          const keyCount = keys.count();
          for (let i = 0; i < keyCount; i++) {
            const key = keys.objectAtIndex_(i);
            const keyStr = this.toString(key);
            const value = nsDict.objectForKey_(key);
            result2[keyStr] = value;
          }
        } catch (e) {
          log(`[ObjCUtils] Failed to convert NSDictionary: ${e}`);
        }
        return result2;
      },
      /**
       * Get class name of an ObjC object
       */
      getClassName(obj) {
        if (!obj)
          return "null";
        try {
          if (obj.$className) {
            return obj.$className;
          }
          if (obj.handle) {
            try {
              const objcObj = new frida_objc_bridge_default.Object(obj.handle);
              if (objcObj.$className) {
                return objcObj.$className;
              }
            } catch (e) {
            }
          }
          if (obj.class) {
            try {
              const cls = obj.class();
              if (cls) {
                if (cls.$className)
                  return cls.$className;
                if (cls.name)
                  return String(cls.name());
                if (cls.toString)
                  return cls.toString();
              }
            } catch (e) {
            }
          }
          if (obj.className) {
            try {
              const name2 = obj.className();
              return String(name2);
            } catch (e) {
            }
          }
          try {
            const NSStringFromClass = new NativeFunction(Module.getGlobalExportByName("NSStringFromClass"), "pointer", ["pointer"]);
            if (obj.class) {
              const clsPtr = obj.class();
              const namePtr = NSStringFromClass(clsPtr);
              if (namePtr) {
                const name2 = new frida_objc_bridge_default.Object(namePtr);
                return String(name2);
              }
            }
          } catch (e) {
          }
          return "unknown";
        } catch (e) {
          return `<error: ${e}>`;
        }
      },
      /**
       * Convert NSURL to string
       */
      urlToString(urlObj) {
        if (!urlObj)
          return null;
        try {
          if (urlObj.absoluteString) {
            const absString = urlObj.absoluteString();
            return String(absString);
          }
          if (urlObj.handle) {
            const nsUrl = new frida_objc_bridge_default.Object(urlObj.handle);
            if (nsUrl.absoluteString) {
              const absString = nsUrl.absoluteString();
              return String(absString);
            }
          }
          try {
            const sel_absoluteString = frida_objc_bridge_default.selector("absoluteString");
            const objc_msgSend2 = new NativeFunction(Module.getGlobalExportByName("objc_msgSend"), "pointer", ["pointer", "pointer"]);
            const result2 = objc_msgSend2(urlObj.handle || urlObj, sel_absoluteString);
            if (result2) {
              const str = new frida_objc_bridge_default.Object(result2);
              return String(str);
            }
          } catch (e) {
            log(`[ObjCUtils] Native function approach failed: ${e}`);
          }
          return null;
        } catch (e) {
          log(`[ObjCUtils] urlToString failed: ${e}`);
          return null;
        }
      },
      /**
       * Check if object is an instance of a specific ObjC class
       */
      isKindOfClass(obj, className) {
        if (!obj || !className)
          return false;
        try {
          const targetClass = frida_objc_bridge_default.classes[className];
          if (!targetClass) {
            log(`[ObjCUtils] Class ${className} not found`);
            return false;
          }
          return obj.isKindOfClass_(targetClass);
        } catch (e) {
          log(`[ObjCUtils] Failed to check class: ${e}`);
          return false;
        }
      },
      /**
       * Format a stack trace element
       */
      formatStackFrame(frame) {
        try {
          const frameStr = this.toString(frame);
          const match = frameStr.match(/^\s*(\d+)\s+(\S+)\s+(0x[0-9a-fA-F]+)\s+(.+)$/);
          if (match) {
            const [, index, library, address, symbol] = match;
            return `${library} ${symbol}`;
          }
          return frameStr;
        } catch (e) {
          return this.toString(frame);
        }
      }
    };
  }
});

// agent/iOS/IPC/URLScheme/URLScheme.ts
var URLSchemeMonitor;
var init_URLScheme = __esm({
  "agent/iOS/IPC/URLScheme/URLScheme.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_Helper();
    init_frida_objc_bridge();
    URLSchemeMonitor = class extends BaseModule {
      state;
      eventCounter = 0;
      // Keep track of the original implementations and hooked classes
      hooks = /* @__PURE__ */ new Map();
      nativeHooks = [];
      constructor() {
        super({
          name: "URLSchemeMonitor",
          version: "1.0.0",
          platform: "ios",
          category: "IPC",
          description: "Monitor custom URL scheme invocations"
        });
        const now = (/* @__PURE__ */ new Date()).toISOString();
        this.state = {
          active: false,
          startTime: now,
          events: [],
          stats: {
            totalEvents: 0,
            byType: {
              xpc: 0,
              mach: 0,
              message_port: 0,
              darwin_notification: 0,
              url_scheme: 0,
              pasteboard: 0,
              app_group: 0,
              unix_socket: 0
            },
            byBundle: {},
            byOperation: {},
            errors: 0,
            startTime: now
          },
          filters: {
            types: ["url_scheme"],
            bundles: [],
            excludeSystem: true
          }
        };
      }
      async onInitialize() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        log("[URLSchemeMonitor] Module initialized");
      }
      async onShutdown() {
        if (this.state.active) {
          this.stop();
        }
        log("[URLSchemeMonitor] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("startURLSchemeMonitor", () => this.start());
        this.registry.registerBoth("stopURLSchemeMonitor", () => this.stop());
        this.registry.registerBoth("getURLSchemeEvents", () => this.getEvents());
        this.registry.registerBoth("clearURLSchemeEvents", () => this.clearEvents());
        this.registry.registerBoth("sendURLSchemeEvent", (urlString, options, senderName) => this.sendURLSchemeEvent(urlString, options, senderName));
        this.registry.registerBoth("getRegisteredURLSchemes", () => this.getRegisteredURLSchemes());
        this.registry.registerBoth("getUniversalLinkDomains", () => this.getUniversalLinkDomains());
      }
      start() {
        if (this.state.active) {
          warn("[URLSchemeMonitor] Already active");
          return { success: false, message: "Already active" };
        }
        try {
          const moduleRef = this;
          frida_objc_bridge_default.schedule(frida_objc_bridge_default.mainQueue, () => {
            moduleRef.hookOutgoingURLCalls();
            const appDelegateClass = moduleRef.findAppDelegateClass();
            if (appDelegateClass) {
              log(`[URLSchemeMonitor] Found app delegate class: ${appDelegateClass.$className}`);
              moduleRef.hookURLMethod(appDelegateClass, "- application:openURL:options:");
              moduleRef.hookURLMethod(appDelegateClass, "- application:openURL:sourceApplication:annotation:");
              moduleRef.hookURLMethod(appDelegateClass, "- application:handleOpenURL:");
            } else {
              log("[URLSchemeMonitor] Could not find app delegate class, incoming hooks skipped");
            }
            moduleRef.hookSceneURLHandling();
          });
          this.state.active = true;
          this.state.startTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[URLSchemeMonitor] Started monitoring URL schemes");
          return { success: true, message: "URL scheme monitoring started" };
        } catch (startErr) {
          const e = startErr instanceof Error ? startErr : Error(String(startErr));
          logError("[URLSchemeMonitor] Failed to start", e);
          this.state.lastError = e.message;
          return { success: false, error: e.message };
        }
      }
      stop() {
        if (!this.state.active) {
          warn("[URLSchemeMonitor] Not active");
          return { success: false, message: "Not active" };
        }
        try {
          for (const listener of this.nativeHooks) {
            listener.detach();
          }
          this.nativeHooks = [];
          frida_objc_bridge_default.schedule(frida_objc_bridge_default.mainQueue, () => {
            this.hooks.forEach((hookInfo, key) => {
              try {
                hookInfo.method.implementation = hookInfo.original;
                log(`[URLSchemeMonitor] Restored ${key}`);
              } catch (e) {
                logError(`[URLSchemeMonitor] Failed to restore ${key}`, e);
              }
            });
            this.hooks.clear();
          });
          this.state.active = false;
          this.state.endTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[URLSchemeMonitor] Stopped");
          return { success: true, message: "URL scheme monitoring stopped" };
        } catch (stopErr) {
          const e = stopErr instanceof Error ? stopErr : Error(String(stopErr));
          logError("[URLSchemeMonitor] Failed to stop", e);
          return { success: false, error: e.message };
        }
      }
      findAppDelegateClass() {
        try {
          const UIApplication = frida_objc_bridge_default.classes.UIApplication;
          const sharedApp = UIApplication.sharedApplication();
          if (sharedApp) {
            const delegate = sharedApp.delegate();
            if (delegate) {
              return delegate.$class;
            }
          }
        } catch (e) {
          log("[URLSchemeMonitor] Could not get app delegate from UIApplication");
        }
        const possibleNames = [
          "AppDelegate",
          "ApplicationDelegate",
          "SceneDelegate"
        ];
        for (const className of Object.keys(frida_objc_bridge_default.classes)) {
          if (possibleNames.includes(className)) {
            return frida_objc_bridge_default.classes[className];
          }
          if (className.endsWith("AppDelegate") || className.endsWith("ApplicationDelegate")) {
            const clazz = frida_objc_bridge_default.classes[className];
            try {
              if (clazz["- application:didFinishLaunchingWithOptions:"] || clazz["- applicationDidBecomeActive:"] || clazz["- application:openURL:options:"]) {
                return clazz;
              }
            } catch (e) {
            }
          }
        }
        return null;
      }
      hookURLMethod(targetClass, selector2) {
        try {
          const method2 = targetClass[selector2];
          if (!method2) {
            log(`[URLSchemeMonitor] Selector ${selector2} not found on ${targetClass.$className}`);
            return;
          }
          const origImpl = method2.implementation;
          const moduleRef = this;
          const className = targetClass.$className;
          if (selector2 === "- application:openURL:options:") {
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, app, url, options) {
              log(`[URLSchemeMonitor] Hook called with url parameter: ${url}`);
              log(`[URLSchemeMonitor] URL parameter type: ${typeof url}`);
              moduleRef.captureURLEvent(url, options, selector2);
              return origImpl(handle2, sel2, app, url, options);
            });
          } else if (selector2 === "- application:openURL:sourceApplication:annotation:") {
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, app, url, sourceApp, annotation) {
              log(`[URLSchemeMonitor] Hook called with url: ${url}, sourceApp: ${sourceApp}`);
              const opts = { sourceApplication: sourceApp ? ObjCUtils.toString(sourceApp) : void 0 };
              moduleRef.captureURLEvent(url, opts, selector2);
              return origImpl(handle2, sel2, app, url, sourceApp, annotation);
            });
          } else if (selector2 === "- application:handleOpenURL:") {
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, app, url) {
              log(`[URLSchemeMonitor] Hook called with url: ${url}`);
              moduleRef.captureURLEvent(url, {}, selector2);
              return origImpl(handle2, sel2, app, url);
            });
          }
          this.hooks.set(`${className}.${selector2}`, {
            class: targetClass,
            method: method2,
            original: origImpl
          });
          log(`[URLSchemeMonitor] Hooked ${className} ${selector2}`);
        } catch (e) {
          log(`[URLSchemeMonitor] Failed to hook ${selector2}: ${e}`);
        }
      }
      hookSceneURLHandling() {
        try {
          const moduleRef = this;
          for (const className of Object.keys(frida_objc_bridge_default.classes)) {
            if (className.includes("SceneDelegate")) {
              const sceneClass = frida_objc_bridge_default.classes[className];
              const selector2 = "- scene:openURLContexts:";
              const method2 = sceneClass[selector2];
              if (method2) {
                const origImpl = method2.implementation;
                method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, scene, urlContexts) {
                  try {
                    log("[URLSchemeMonitor] Scene URL handler called");
                    const allObjects = urlContexts.allObjects();
                    const count = allObjects.count();
                    for (let i = 0; i < count; i++) {
                      const context = allObjects.objectAtIndex_(i);
                      const url = context.URL();
                      const options = {};
                      try {
                        const sourceApp = ObjCUtils.getProperty(context, "sourceApplication");
                        if (sourceApp) {
                          options.sourceApplication = ObjCUtils.toString(sourceApp);
                        }
                      } catch (e) {
                      }
                      moduleRef.captureURLEvent(url, options, selector2);
                    }
                  } catch (e) {
                    logError("[URLSchemeMonitor] Error in scene URL handler", e);
                  }
                  return origImpl(handle2, sel2, scene, urlContexts);
                });
                this.hooks.set(`${className}.${selector2}`, {
                  class: sceneClass,
                  method: method2,
                  original: origImpl
                });
                log(`[URLSchemeMonitor] Hooked ${className} ${selector2}`);
              }
            }
          }
        } catch (e) {
          log("[URLSchemeMonitor] Failed to hook scene URL handling: " + e);
        }
      }
      hookOutgoingURLCalls() {
        const moduleRef = this;
        const UIApplication = frida_objc_bridge_default.classes.UIApplication;
        if (!UIApplication) {
          log("[URLSchemeMonitor] UIApplication not found, skipping outgoing hooks");
          return;
        }
        try {
          const selector2 = "- openURL:";
          const method2 = UIApplication[selector2];
          if (method2) {
            const origImpl = method2.implementation;
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, url) {
              try {
                moduleRef.captureOutgoingURL(url, "openURL:");
              } catch (e) {
              }
              return origImpl(handle2, sel2, url);
            });
            this.hooks.set(`UIApplication.${selector2}`, {
              class: UIApplication,
              method: method2,
              original: origImpl
            });
            log(`[URLSchemeMonitor] Hooked UIApplication ${selector2} (outgoing)`);
          }
        } catch (e) {
          log(`[URLSchemeMonitor] Failed to hook openURL: ${e}`);
        }
        try {
          const selector2 = "- openURL:options:completionHandler:";
          const method2 = UIApplication[selector2];
          if (method2) {
            const impl = method2.implementation;
            const listener = Interceptor.attach(impl, {
              onEnter(args) {
                try {
                  const urlPtr = args[2];
                  if (urlPtr && !urlPtr.isNull()) {
                    const urlObj = new frida_objc_bridge_default.Object(urlPtr);
                    moduleRef.captureOutgoingURL(urlObj, "openURL:options:completionHandler:");
                  }
                } catch (e) {
                }
              }
            });
            this.nativeHooks.push(listener);
            log(`[URLSchemeMonitor] Hooked UIApplication ${selector2} (outgoing, Interceptor)`);
          }
        } catch (e) {
          log(`[URLSchemeMonitor] Failed to hook openURL:options:completionHandler: ${e}`);
        }
        try {
          const selector2 = "- canOpenURL:";
          const method2 = UIApplication[selector2];
          if (method2) {
            const origImpl = method2.implementation;
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, url) {
              const result2 = origImpl(handle2, sel2, url);
              try {
                moduleRef.captureOutgoingURL(url, "canOpenURL:", result2);
              } catch (e) {
              }
              return result2;
            });
            this.hooks.set(`UIApplication.${selector2}`, {
              class: UIApplication,
              method: method2,
              original: origImpl
            });
            log(`[URLSchemeMonitor] Hooked UIApplication ${selector2} (outgoing)`);
          }
        } catch (e) {
          log(`[URLSchemeMonitor] Failed to hook canOpenURL: ${e}`);
        }
      }
      captureOutgoingURL(urlObj, selectorName, canOpenResult) {
        try {
          let url = "<unknown>";
          try {
            if (urlObj && urlObj.absoluteString) {
              url = String(urlObj.absoluteString());
            } else if (urlObj) {
              const wrapped = new frida_objc_bridge_default.Object(urlObj);
              if (wrapped.absoluteString) {
                url = String(wrapped.absoluteString());
              }
            }
          } catch (e) {
            try {
              if (urlObj && urlObj.description) {
                url = String(urlObj.description());
              }
            } catch (e2) {
            }
          }
          if (!url || url === "<unknown>")
            return;
          let bundleId = "unknown";
          try {
            bundleId = ObjCUtils.toString(frida_objc_bridge_default.classes.NSBundle.mainBundle().bundleIdentifier());
          } catch (e) {
          }
          const direction = selectorName === "canOpenURL:" ? "query" : "outgoing";
          const event = {
            id: `url_${Date.now()}_${++this.eventCounter}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "url_scheme",
            process: {
              bundleId,
              pid: Process.id,
              tid: Process.getCurrentThreadId()
            },
            url,
            stackTrace: this.getStackTrace(),
            callChain: [direction, selectorName]
          };
          if (selectorName === "canOpenURL:" && canOpenResult !== void 0) {
            event.canOpen = !!canOpenResult;
          }
          this.capture(event);
          log(`[URLSchemeMonitor] ${direction}: ${url} via ${selectorName}`);
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[URLSchemeMonitor] Error capturing outgoing URL", e);
        }
      }
      sendURLSchemeEvent(urlString, options = {}, senderName = "URLSchemeMonitor") {
        try {
          log(`[URLSchemeMonitor] Sending URL scheme event: ${urlString}`);
          frida_objc_bridge_default.schedule(frida_objc_bridge_default.mainQueue, () => {
            try {
              const app = frida_objc_bridge_default.classes.UIApplication.sharedApplication();
              const url = frida_objc_bridge_default.classes.NSURL.URLWithString_(urlString);
              if (!url || url.isNull()) {
                logError(`[URLSchemeMonitor] Invalid URL: ${urlString}`);
                return;
              }
              log(`[URLSchemeMonitor] Created NSURL: ${url.absoluteString()}`);
              if (frida_objc_bridge_default.classes.UIScene) {
                try {
                  const scenes = app.connectedScenes().allObjects();
                  const sceneCount = scenes.count();
                  log(`[URLSchemeMonitor] Found ${sceneCount} connected scenes`);
                  for (let i = 0; i < sceneCount; i++) {
                    let scene = null;
                    let delegate2 = null;
                    try {
                      scene = scenes.objectAtIndex_(i);
                      log(`[URLSchemeMonitor] Processing scene ${i}: ${scene ? scene.$className : "null"}`);
                      if (!scene) {
                        log(`[URLSchemeMonitor] Scene ${i} is null, skipping`);
                        continue;
                      }
                      try {
                        delegate2 = scene.delegate();
                        log(`[URLSchemeMonitor] Scene ${i} delegate: ${delegate2 ? delegate2.$className : "null"}`);
                      } catch (delegateError) {
                        log(`[URLSchemeMonitor] Error getting delegate for scene ${i}: ${delegateError}`);
                        continue;
                      }
                      if (!delegate2) {
                        log(`[URLSchemeMonitor] Scene ${i} has no delegate, skipping`);
                        continue;
                      }
                      const sceneSelector = "scene:openURLContexts:";
                      let hasSceneMethod = false;
                      try {
                        hasSceneMethod = delegate2.respondsToSelector_(sceneSelector);
                        log(`[URLSchemeMonitor] Scene ${i} delegate responds to ${sceneSelector}: ${hasSceneMethod}`);
                      } catch (selectorError) {
                        log(`[URLSchemeMonitor] Error checking selector for scene ${i}: ${selectorError}`);
                        continue;
                      }
                      if (!hasSceneMethod) {
                        log(`[URLSchemeMonitor] Scene ${i} delegate doesn't respond to ${sceneSelector}, skipping`);
                        continue;
                      }
                      try {
                        log(`[URLSchemeMonitor] Attempting to use scene delegate: ${delegate2.$className}`);
                        let opts = null;
                        try {
                          const UISceneOpenURLOptions = frida_objc_bridge_default.classes.UISceneOpenURLOptions;
                          if (UISceneOpenURLOptions) {
                            opts = UISceneOpenURLOptions.new();
                            if (options.sourceApplication) {
                              try {
                                if (opts.respondsToSelector_("setSourceApplication:")) {
                                  opts.setSourceApplication_(frida_objc_bridge_default.classes.NSString.stringWithString_(options.sourceApplication));
                                }
                              } catch (e) {
                                log(`[URLSchemeMonitor] Could not set sourceApplication: ${e}`);
                              }
                            }
                          }
                        } catch (e) {
                          log(`[URLSchemeMonitor] Could not create UISceneOpenURLOptions: ${e}`);
                        }
                        let contextSet = null;
                        try {
                          const UIOpenURLContext = frida_objc_bridge_default.classes.UIOpenURLContext;
                          if (UIOpenURLContext) {
                            let ctx = null;
                            try {
                              ctx = UIOpenURLContext.alloc();
                              if (ctx && ctx.respondsToSelector_("initWithURL:options:")) {
                                ctx = ctx.initWithURL_options_(url, opts || frida_objc_bridge_default.classes.NSNull.null());
                                log(`[URLSchemeMonitor] Created context using alloc/initWithURL:options:`);
                              } else if (ctx && ctx.respondsToSelector_("init")) {
                                ctx = ctx.init();
                                log(`[URLSchemeMonitor] Created context using alloc/init`);
                              }
                            } catch (e) {
                              log(`[URLSchemeMonitor] alloc/init method failed: ${e}`);
                              ctx = null;
                            }
                            if (!ctx) {
                              try {
                                if (UIOpenURLContext.respondsToSelector_("contextWithURL:options:")) {
                                  ctx = UIOpenURLContext.contextWithURL_options_(url, opts || frida_objc_bridge_default.classes.NSNull.null());
                                  log(`[URLSchemeMonitor] Created context using contextWithURL:options:`);
                                }
                              } catch (e) {
                                log(`[URLSchemeMonitor] contextWithURL:options: method failed: ${e}`);
                              }
                            }
                            if (!ctx) {
                              try {
                                ctx = UIOpenURLContext.new();
                                log(`[URLSchemeMonitor] Created context using new()`);
                                if (ctx.respondsToSelector_("setURL:")) {
                                  ctx.setURL_(url);
                                  log(`[URLSchemeMonitor] Set URL on context`);
                                }
                              } catch (e) {
                                log(`[URLSchemeMonitor] new() method failed: ${e}`);
                              }
                            }
                            if (ctx) {
                              try {
                                contextSet = frida_objc_bridge_default.classes.NSSet.setWithObject_(ctx);
                                log(`[URLSchemeMonitor] Created context set successfully`);
                              } catch (e) {
                                log(`[URLSchemeMonitor] Failed to create context set: ${e}`);
                              }
                            } else {
                              log(`[URLSchemeMonitor] Could not create UIOpenURLContext`);
                            }
                          } else {
                            log(`[URLSchemeMonitor] UIOpenURLContext class not available`);
                          }
                        } catch (e) {
                          log(`[URLSchemeMonitor] Error creating context: ${e}`);
                        }
                        if (contextSet) {
                          try {
                            delegate2.scene_openURLContexts_(scene, contextSet);
                            log(`[URLSchemeMonitor] Successfully sent to scene delegate: ${delegate2.$className}.${sceneSelector} - ${urlString}`);
                            return;
                          } catch (e) {
                            log(`[URLSchemeMonitor] Error calling scene delegate: ${e}`);
                          }
                        } else {
                          log(`[URLSchemeMonitor] No context set, cannot call scene delegate`);
                        }
                      } catch (sceneError) {
                        const e = sceneError instanceof Error ? sceneError : Error(String(sceneError));
                        log(`[URLSchemeMonitor] Scene delegate error for scene ${i}: ${e.message}`);
                      }
                    } catch (sceneProcessingError) {
                      const e = sceneProcessingError instanceof Error ? sceneProcessingError : Error(String(sceneProcessingError));
                      log(`[URLSchemeMonitor] Error processing scene ${i}: ${e.message}`);
                      continue;
                    }
                  }
                  log(`[URLSchemeMonitor] All scene delegates processed, falling back to app delegate`);
                } catch (scenesError) {
                  const e = scenesError instanceof Error ? scenesError : Error(String(scenesError));
                  log(`[URLSchemeMonitor] Error accessing scenes: ${e.message}, falling back to app delegate`);
                }
              }
              const delegate = app.delegate();
              if (!delegate) {
                logError("[URLSchemeMonitor] No app delegate found");
                return;
              }
              log(`[URLSchemeMonitor] Using app delegate: ${delegate.$className}`);
              const candidates = [
                {
                  selector: "application:openURL:options:",
                  handler: (app2, url2, options2) => {
                    const NSDictionary = frida_objc_bridge_default.classes.NSDictionary;
                    const NSMutableDictionary = frida_objc_bridge_default.classes.NSMutableDictionary;
                    let optionsDict = NSDictionary.dictionary();
                    if (options2.sourceApplication) {
                      const mutableDict = NSMutableDictionary.dictionary();
                      const sourceAppKey = frida_objc_bridge_default.classes.UIApplicationOpenURLOptionsSourceApplicationKey;
                      if (sourceAppKey) {
                        const sourceAppValue = frida_objc_bridge_default.classes.NSString.stringWithString_(options2.sourceApplication);
                        mutableDict.setObject_forKey_(sourceAppValue, sourceAppKey);
                      }
                      optionsDict = mutableDict;
                    }
                    return delegate.application_openURL_options_(app2, url2, optionsDict);
                  }
                },
                {
                  selector: "application:openURL:sourceApplication:annotation:",
                  handler: (app2, url2, options2) => {
                    const sourceApp = options2.sourceApplication ? frida_objc_bridge_default.classes.NSString.stringWithString_(options2.sourceApplication) : frida_objc_bridge_default.classes.NSNull.null();
                    const annotation = options2.annotation || frida_objc_bridge_default.classes.NSNull.null();
                    return delegate.application_openURL_sourceApplication_annotation_(app2, url2, sourceApp, annotation);
                  }
                },
                {
                  selector: "application:handleOpenURL:",
                  handler: (app2, url2, options2) => {
                    return delegate.application_handleOpenURL_(app2, url2);
                  }
                }
              ];
              for (const candidate of candidates) {
                const method2 = delegate[candidate.selector.replace(/:/g, "_")];
                if (typeof method2 === "function") {
                  try {
                    log(`[URLSchemeMonitor] Calling ${candidate.selector} on ${delegate.$className}`);
                    const result2 = candidate.handler(app, url, options);
                    log(`[URLSchemeMonitor] Successfully sent via ${candidate.selector}: ${urlString} (result: ${result2})`);
                    return;
                  } catch (methodError) {
                    const e = methodError instanceof Error ? methodError : Error(String(methodError));
                    log(`[URLSchemeMonitor] Error calling ${candidate.selector}: ${e.message}`);
                  }
                }
              }
              log("[URLSchemeMonitor] Falling back to UIApplication.openURL");
              const success = app.openURL_(url);
              log(`[URLSchemeMonitor] UIApplication.openURL result: ${success}`);
            } catch (objcError) {
              const e = objcError instanceof Error ? objcError : Error(String(objcError));
              logError("[URLSchemeMonitor] ObjC error in sendURLSchemeEvent", e);
            }
          });
          return {
            success: true,
            message: `URL scheme event sent: ${urlString}`,
            url: urlString,
            sender: senderName,
            options
          };
        } catch (sendErr) {
          const e = sendErr instanceof Error ? sendErr : Error(String(sendErr));
          logError("[URLSchemeMonitor] Failed to send URL scheme event", e);
          return {
            success: false,
            error: e.message,
            url: urlString
          };
        }
      }
      captureURLEvent(urlObj, options, selectorName) {
        try {
          let url = "";
          log(`[URLSchemeMonitor] Received URL object with type: ${typeof urlObj}`);
          try {
            if (urlObj && urlObj.absoluteString) {
              const urlString = urlObj.absoluteString();
              url = String(urlString);
              log(`[URLSchemeMonitor] Direct absoluteString() worked: ${url}`);
            } else {
              log(`[URLSchemeMonitor] Object class: ${urlObj?.$className || "no $className"}`);
              if (String(urlObj).includes("0x")) {
                const wrapped = new frida_objc_bridge_default.Object(urlObj);
                log(`[URLSchemeMonitor] Wrapped object class: ${wrapped.$className}`);
                if (wrapped.absoluteString) {
                  const urlString = wrapped.absoluteString();
                  url = String(urlString);
                  log(`[URLSchemeMonitor] Wrapped absoluteString() worked: ${url}`);
                }
              }
            }
          } catch (e) {
            log(`[URLSchemeMonitor] Error extracting URL: ${e}`);
            try {
              if (urlObj && urlObj.description) {
                url = String(urlObj.description());
                log(`[URLSchemeMonitor] Got URL from description: ${url}`);
              }
            } catch (e2) {
              log(`[URLSchemeMonitor] Description also failed: ${e2}`);
            }
          }
          if (!url || url === "" || url.includes("0x")) {
            url = "<failed to extract URL>";
            log(`[URLSchemeMonitor] ERROR: Could not extract valid URL`);
            try {
              log(`[URLSchemeMonitor] Debug - URL object properties:`);
              for (let prop in urlObj) {
                if (typeof urlObj[prop] === "function") {
                  log(`[URLSchemeMonitor]   - ${prop}: [Function]`);
                } else {
                  log(`[URLSchemeMonitor]   - ${prop}: ${urlObj[prop]}`);
                }
              }
            } catch (e) {
              log(`[URLSchemeMonitor] Could not enumerate properties: ${e}`);
            }
          }
          let bundleId = "unknown";
          try {
            const bundle = frida_objc_bridge_default.classes.NSBundle.mainBundle();
            const bundleIdObj = bundle.bundleIdentifier();
            bundleId = ObjCUtils.toString(bundleIdObj);
          } catch (e) {
            log("[URLSchemeMonitor] Could not get bundle ID: " + e);
          }
          const pid2 = Process.id;
          const tid = Process.getCurrentThreadId();
          let sourceBundleId;
          if (options) {
            if (options.sourceApplication) {
              sourceBundleId = options.sourceApplication;
            } else if (options.objectForKey_) {
              try {
                const sourceAppKey = frida_objc_bridge_default.classes.UIApplicationOpenURLOptionsSourceApplicationKey;
                if (sourceAppKey) {
                  const sourceApp = options.objectForKey_(sourceAppKey);
                  if (sourceApp) {
                    sourceBundleId = ObjCUtils.toString(sourceApp);
                  }
                }
              } catch (e) {
                log("[URLSchemeMonitor] Could not extract source app from options");
              }
            }
          }
          const event = {
            id: `url_${Date.now()}_${++this.eventCounter}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "url_scheme",
            process: {
              bundleId,
              pid: pid2,
              tid
            },
            url,
            sourceBundleId,
            stackTrace: this.getStackTrace(),
            callChain: [`${selectorName}`]
          };
          this.capture(event);
          log(`[URLSchemeMonitor] Captured URL: ${url} from ${sourceBundleId || "unknown"} via ${selectorName}`);
        } catch (capErr) {
          const e = capErr instanceof Error ? capErr : Error(String(capErr));
          logError("[URLSchemeMonitor] Error capturing URL", e);
          log(`[URLSchemeMonitor] Debug - urlObj: ${urlObj}, selector: ${selectorName}`);
        }
      }
      capture(event) {
        if (!this.state.filters.types.includes(event.type))
          return;
        if (this.state.filters.bundles.length > 0) {
          const eventBundles = [event.process?.bundleId, event.sourceBundleId].filter((b) => b !== void 0 && b !== null);
          if (!eventBundles.some((b) => this.state.filters.bundles.includes(b))) {
            return;
          }
        }
        if (this.state.filters.excludeSystem) {
          const systemBundles = ["com.apple"];
          const eventBundles = [event.process?.bundleId, event.sourceBundleId].filter((b) => b !== void 0 && b !== null);
          if (eventBundles.some((b) => systemBundles.some((sys) => b.startsWith(sys)))) {
            return;
          }
        }
        this.state.events.push(event);
        if (this.state.events.length > 1e3) {
          this.state.events = this.state.events.slice(-1e3);
        }
        this.state.stats.totalEvents++;
        this.state.stats.byType[event.type]++;
        const bid = event.process?.bundleId ?? "unknown";
        this.state.stats.byBundle[bid] = (this.state.stats.byBundle[bid] || 0) + 1;
        try {
          const urlParts = event.url.split(":");
          if (urlParts.length > 0) {
            const scheme = urlParts[0].toLowerCase();
            this.state.stats.byOperation[scheme] = (this.state.stats.byOperation[scheme] || 0) + 1;
          }
        } catch (e) {
        }
        send({ type: "ipc_event", data: event });
      }
      getStackTrace() {
        const trace = [];
        try {
          const thread = frida_objc_bridge_default.classes.NSThread.currentThread();
          if (thread) {
            const callStackSymbols = thread.callStackSymbols;
            if (callStackSymbols) {
              const count = callStackSymbols.count();
              for (let i = 0; i < Math.min(count, 10); i++) {
                try {
                  const symbol = callStackSymbols.objectAtIndex_(i);
                  if (symbol) {
                    trace.push(ObjCUtils.toString(symbol));
                  }
                } catch (e) {
                }
              }
            }
          }
        } catch (e) {
          log("[URLSchemeMonitor] Failed to get stack trace: " + e);
        }
        return trace;
      }
      getEvents() {
        return {
          success: true,
          data: {
            events: this.state.events,
            count: this.state.events.length,
            active: this.state.active,
            statistics: this.state.stats,
            filters: this.state.filters
          }
        };
      }
      clearEvents() {
        this.state.events = [];
        this.state.stats.totalEvents = 0;
        this.state.stats.byType.url_scheme = 0;
        this.state.stats.byBundle = {};
        this.state.stats.byOperation = {};
        return {
          success: true,
          message: "URL scheme events cleared"
        };
      }
      getRegisteredURLSchemes() {
        try {
          const schemes = [];
          const bundle = frida_objc_bridge_default.classes.NSBundle.mainBundle();
          const bundleId = ObjCUtils.toString(bundle.bundleIdentifier());
          const infoDictionary = bundle.infoDictionary();
          if (!infoDictionary) {
            return { success: true, data: { schemes, bundleId } };
          }
          const urlTypesKey = frida_objc_bridge_default.classes.NSString.stringWithString_("CFBundleURLTypes");
          const urlTypes = infoDictionary.objectForKey_(urlTypesKey);
          if (urlTypes && urlTypes.count) {
            const count = urlTypes.count();
            for (let i = 0; i < count; i++) {
              const urlType = urlTypes.objectAtIndex_(i);
              const roleKey = frida_objc_bridge_default.classes.NSString.stringWithString_("CFBundleTypeRole");
              const roleObj = urlType.objectForKey_(roleKey);
              const role = roleObj ? ObjCUtils.toString(roleObj) : void 0;
              const schemesKey = frida_objc_bridge_default.classes.NSString.stringWithString_("CFBundleURLSchemes");
              const schemesArray = urlType.objectForKey_(schemesKey);
              if (schemesArray && schemesArray.count) {
                const sCount = schemesArray.count();
                for (let j = 0; j < sCount; j++) {
                  const scheme = ObjCUtils.toString(schemesArray.objectAtIndex_(j));
                  schemes.push({ scheme, role, bundleId });
                }
              }
            }
          }
          const querySchemesKey = frida_objc_bridge_default.classes.NSString.stringWithString_("LSApplicationQueriesSchemes");
          const querySchemes = infoDictionary.objectForKey_(querySchemesKey);
          const canQuery = [];
          if (querySchemes && querySchemes.count) {
            const qCount = querySchemes.count();
            for (let i = 0; i < qCount; i++) {
              canQuery.push(ObjCUtils.toString(querySchemes.objectAtIndex_(i)));
            }
          }
          log(`[URLSchemeMonitor] Found ${schemes.length} registered schemes, ${canQuery.length} queryable schemes`);
          return {
            success: true,
            data: {
              schemes,
              canQuery,
              bundleId
            }
          };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[URLSchemeMonitor] Failed to get registered URL schemes", e);
          return { success: false, error: e.message };
        }
      }
      getUniversalLinkDomains() {
        try {
          const domains = [];
          const bundle = frida_objc_bridge_default.classes.NSBundle.mainBundle();
          const bundleId = ObjCUtils.toString(bundle.bundleIdentifier());
          const infoDictionary = bundle.infoDictionary();
          if (!infoDictionary) {
            return { success: true, data: { domains, bundleId } };
          }
          const entitlementsKey = frida_objc_bridge_default.classes.NSString.stringWithString_("com.apple.developer.associated-domains");
          let associatedDomains = infoDictionary.objectForKey_(entitlementsKey);
          if (!associatedDomains) {
            try {
              const executablePath = bundle.executablePath();
              if (executablePath) {
                const codesignPath = ObjCUtils.toString(executablePath);
                log(`[URLSchemeMonitor] Checking entitlements for: ${codesignPath}`);
                const provisionPath = frida_objc_bridge_default.classes.NSString.stringWithString_(ObjCUtils.toString(bundle.bundlePath()) + "/embedded.mobileprovision");
                const provisionData = frida_objc_bridge_default.classes.NSData.dataWithContentsOfFile_(provisionPath);
                if (provisionData && !provisionData.isEqual_(frida_objc_bridge_default.classes.NSNull.null())) {
                  const provisionStr = frida_objc_bridge_default.classes.NSString.alloc().initWithData_encoding_(
                    provisionData,
                    4
                    /* NSUTF8StringEncoding */
                  );
                  const fullStr = ObjCUtils.toString(provisionStr);
                  const domainRegex = /applinks:([^\s<"]+)/g;
                  let match;
                  while ((match = domainRegex.exec(fullStr)) !== null) {
                    const domain = match[1];
                    if (!domains.find((d) => d.domain === domain)) {
                      domains.push({
                        domain,
                        applinks: true,
                        webcredentials: false,
                        activitycontinuation: false
                      });
                    }
                  }
                  const wcRegex = /webcredentials:([^\s<"]+)/g;
                  while ((match = wcRegex.exec(fullStr)) !== null) {
                    const domain = match[1];
                    const existing = domains.find((d) => d.domain === domain);
                    if (existing) {
                      existing.webcredentials = true;
                    } else {
                      domains.push({
                        domain,
                        applinks: false,
                        webcredentials: true,
                        activitycontinuation: false
                      });
                    }
                  }
                  const acRegex = /activitycontinuation:([^\s<"]+)/g;
                  while ((match = acRegex.exec(fullStr)) !== null) {
                    const domain = match[1];
                    const existing = domains.find((d) => d.domain === domain);
                    if (existing) {
                      existing.activitycontinuation = true;
                    } else {
                      domains.push({
                        domain,
                        applinks: false,
                        webcredentials: false,
                        activitycontinuation: true
                      });
                    }
                  }
                }
              }
            } catch (e) {
              log(`[URLSchemeMonitor] Could not read entitlements: ${e}`);
            }
          }
          if (associatedDomains && associatedDomains.count) {
            const count = associatedDomains.count();
            for (let i = 0; i < count; i++) {
              const entry = ObjCUtils.toString(associatedDomains.objectAtIndex_(i));
              const parts = entry.split(":");
              if (parts.length >= 2) {
                const type = parts[0];
                const domain = parts.slice(1).join(":");
                const existing = domains.find((d) => d.domain === domain);
                if (existing) {
                  if (type === "applinks")
                    existing.applinks = true;
                  if (type === "webcredentials")
                    existing.webcredentials = true;
                  if (type === "activitycontinuation")
                    existing.activitycontinuation = true;
                } else {
                  domains.push({
                    domain,
                    applinks: type === "applinks",
                    webcredentials: type === "webcredentials",
                    activitycontinuation: type === "activitycontinuation"
                  });
                }
              }
            }
          }
          log(`[URLSchemeMonitor] Found ${domains.length} universal link domains`);
          return {
            success: true,
            data: {
              domains,
              bundleId
            }
          };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[URLSchemeMonitor] Failed to get universal link domains", e);
          return { success: false, error: e.message };
        }
      }
    };
  }
});

// agent/iOS/IPC/Pasteboard/PasteboardMonitor.ts
var PasteboardMonitor;
var init_PasteboardMonitor = __esm({
  "agent/iOS/IPC/Pasteboard/PasteboardMonitor.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_Helper();
    init_frida_objc_bridge();
    PasteboardMonitor = class extends BaseModule {
      state;
      eventCounter = 0;
      pollingTimer = null;
      lastChangeCount = -1;
      hooks = /* @__PURE__ */ new Map();
      constructor() {
        super({
          name: "PasteboardMonitor",
          version: "1.0.0",
          platform: "ios",
          category: "IPC",
          description: "Monitor UIPasteboard read/write operations"
        });
        const now = (/* @__PURE__ */ new Date()).toISOString();
        this.state = {
          active: false,
          startTime: now,
          events: [],
          stats: {
            totalEvents: 0,
            byType: {
              xpc: 0,
              mach: 0,
              message_port: 0,
              darwin_notification: 0,
              url_scheme: 0,
              pasteboard: 0,
              app_group: 0,
              unix_socket: 0
            },
            byBundle: {},
            byOperation: {},
            errors: 0,
            startTime: now
          },
          filters: {
            types: ["pasteboard"],
            bundles: [],
            excludeSystem: false
          }
        };
      }
      async onInitialize() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        log("[PasteboardMonitor] Module initialized");
      }
      async onShutdown() {
        if (this.state.active) {
          this.stop();
        }
        log("[PasteboardMonitor] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("startPasteboardMonitor", () => this.start());
        this.registry.registerBoth("stopPasteboardMonitor", () => this.stop());
        this.registry.registerBoth("getPasteboardEvents", () => this.getEvents());
        this.registry.registerBoth("clearPasteboardEvents", () => this.clearEvents());
        this.registry.registerBoth("getPasteboardContents", () => this.getPasteboardContents());
        this.registry.registerBoth("setPasteboardString", (text) => this.setPasteboardString(text));
      }
      start() {
        if (this.state.active) {
          warn("[PasteboardMonitor] Already active");
          return { success: false, message: "Already active" };
        }
        try {
          this.hookPasteboardMethods();
          this.startPolling();
          this.state.active = true;
          this.state.startTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[PasteboardMonitor] Started monitoring pasteboard");
          return { success: true, message: "Pasteboard monitoring started" };
        } catch (startErr) {
          const e = startErr instanceof Error ? startErr : Error(String(startErr));
          logError("[PasteboardMonitor] Failed to start", e);
          this.state.lastError = e.message;
          return { success: false, error: e.message };
        }
      }
      stop() {
        if (!this.state.active) {
          warn("[PasteboardMonitor] Not active");
          return { success: false, message: "Not active" };
        }
        try {
          this.stopPolling();
          this.hooks.forEach((hookInfo, key) => {
            try {
              hookInfo.method.implementation = hookInfo.original;
              log(`[PasteboardMonitor] Restored ${key}`);
            } catch (e) {
              logError(`[PasteboardMonitor] Failed to restore ${key}`, e);
            }
          });
          this.hooks.clear();
          this.state.active = false;
          this.state.endTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[PasteboardMonitor] Stopped");
          return { success: true, message: "Pasteboard monitoring stopped" };
        } catch (stopErr) {
          const e = stopErr instanceof Error ? stopErr : Error(String(stopErr));
          logError("[PasteboardMonitor] Failed to stop", e);
          return { success: false, error: e.message };
        }
      }
      hookPasteboardMethods() {
        const moduleRef = this;
        const UIPasteboard = frida_objc_bridge_default.classes.UIPasteboard;
        if (!UIPasteboard) {
          log("[PasteboardMonitor] UIPasteboard class not found");
          return;
        }
        this.hookMethod(UIPasteboard, "- setString:", (origImpl) => {
          return frida_objc_bridge_default.implement(UIPasteboard["- setString:"], function(handle2, sel2, value) {
            const strValue = value ? ObjCUtils.toString(value) : "<null>";
            moduleRef.captureEvent("write", "general", "public.utf8-plain-text", strValue);
            return origImpl(handle2, sel2, value);
          });
        });
        this.hookMethod(UIPasteboard, "- string", (origImpl) => {
          return frida_objc_bridge_default.implement(UIPasteboard["- string"], function(handle2, sel2) {
            const result2 = origImpl(handle2, sel2);
            const strValue = result2 ? ObjCUtils.toString(new frida_objc_bridge_default.Object(result2)) : "<null>";
            moduleRef.captureEvent("read", "general", "public.utf8-plain-text", strValue);
            return result2;
          });
        });
        this.hookMethod(UIPasteboard, "- setItems:options:", (origImpl) => {
          return frida_objc_bridge_default.implement(UIPasteboard["- setItems:options:"], function(handle2, sel2, items, options) {
            try {
              const itemsObj = new frida_objc_bridge_default.Object(items);
              const count = itemsObj.count ? itemsObj.count() : 0;
              moduleRef.captureEvent("write", "general", "multiple", `${count} items`);
            } catch (e) {
              moduleRef.captureEvent("write", "general", "multiple", "<items>");
            }
            return origImpl(handle2, sel2, items, options);
          });
        });
        this.hookMethod(UIPasteboard, "- setData:forPasteboardType:", (origImpl) => {
          return frida_objc_bridge_default.implement(UIPasteboard["- setData:forPasteboardType:"], function(handle2, sel2, data, pbType) {
            const typeStr = pbType ? ObjCUtils.toString(new frida_objc_bridge_default.Object(pbType)) : "unknown";
            let sizeStr = "<unknown>";
            try {
              const dataObj = new frida_objc_bridge_default.Object(data);
              if (dataObj.length) {
                sizeStr = `${dataObj.length()} bytes`;
              }
            } catch (e) {
            }
            moduleRef.captureEvent("write", "general", typeStr, sizeStr);
            return origImpl(handle2, sel2, data, pbType);
          });
        });
        this.hookMethod(UIPasteboard, "- dataForPasteboardType:", (origImpl) => {
          return frida_objc_bridge_default.implement(UIPasteboard["- dataForPasteboardType:"], function(handle2, sel2, pbType) {
            const typeStr = pbType ? ObjCUtils.toString(new frida_objc_bridge_default.Object(pbType)) : "unknown";
            moduleRef.captureEvent("read", "general", typeStr, void 0);
            return origImpl(handle2, sel2, pbType);
          });
        });
      }
      hookMethod(cls, selector2, implFactory) {
        try {
          const method2 = cls[selector2];
          if (!method2) {
            log(`[PasteboardMonitor] ${selector2} not found on ${cls.$className}`);
            return;
          }
          const origImpl = method2.implementation;
          method2.implementation = implFactory(origImpl);
          this.hooks.set(`${cls.$className}.${selector2}`, {
            class: cls,
            method: method2,
            original: origImpl
          });
          log(`[PasteboardMonitor] Hooked ${cls.$className} ${selector2}`);
        } catch (e) {
          log(`[PasteboardMonitor] Failed to hook ${selector2}: ${e}`);
        }
      }
      startPolling() {
        try {
          const pb = frida_objc_bridge_default.classes.UIPasteboard.generalPasteboard();
          this.lastChangeCount = pb.changeCount();
        } catch (e) {
          this.lastChangeCount = -1;
        }
        this.pollingTimer = setInterval(() => {
          try {
            const pb = frida_objc_bridge_default.classes.UIPasteboard.generalPasteboard();
            const currentCount = pb.changeCount();
            if (this.lastChangeCount >= 0 && currentCount !== this.lastChangeCount) {
              this.captureEvent("external_change", "general", "unknown", `changeCount: ${this.lastChangeCount} -> ${currentCount}`);
            }
            this.lastChangeCount = currentCount;
          } catch (e) {
          }
        }, 2e3);
      }
      stopPolling() {
        if (this.pollingTimer) {
          clearInterval(this.pollingTimer);
          this.pollingTimer = null;
        }
      }
      captureEvent(operation, boardName, dataType, data) {
        try {
          let bundleId = "unknown";
          try {
            bundleId = ObjCUtils.toString(frida_objc_bridge_default.classes.NSBundle.mainBundle().bundleIdentifier());
          } catch (e) {
          }
          const event = {
            id: `pb_${Date.now()}_${++this.eventCounter}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "pasteboard",
            process: {
              bundleId,
              pid: Process.id,
              tid: Process.getCurrentThreadId()
            },
            boardName,
            dataType,
            data: typeof data === "string" && data.length > 500 ? data.substring(0, 500) + "..." : data,
            stackTrace: this.getStackTrace(),
            callChain: [operation]
          };
          this.capture(event);
          log(`[PasteboardMonitor] ${operation}: ${dataType} on ${boardName}`);
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[PasteboardMonitor] Error capturing event", e);
        }
      }
      capture(event) {
        this.state.events.push(event);
        if (this.state.events.length > 1e3) {
          this.state.events = this.state.events.slice(-1e3);
        }
        this.state.stats.totalEvents++;
        this.state.stats.byType.pasteboard++;
        const bid = event.process?.bundleId ?? "unknown";
        this.state.stats.byBundle[bid] = (this.state.stats.byBundle[bid] || 0) + 1;
        const op = event.callChain?.[0] ?? "unknown";
        this.state.stats.byOperation[op] = (this.state.stats.byOperation[op] || 0) + 1;
        send({ type: "ipc_event", data: event });
      }
      getStackTrace() {
        const trace = [];
        try {
          const thread = frida_objc_bridge_default.classes.NSThread.currentThread();
          if (thread) {
            const callStackSymbols = thread.callStackSymbols;
            if (callStackSymbols) {
              const count = callStackSymbols.count();
              for (let i = 0; i < Math.min(count, 10); i++) {
                try {
                  const symbol = callStackSymbols.objectAtIndex_(i);
                  if (symbol)
                    trace.push(ObjCUtils.toString(symbol));
                } catch (e) {
                }
              }
            }
          }
        } catch (e) {
          log("[PasteboardMonitor] Failed to get stack trace: " + e);
        }
        return trace;
      }
      getPasteboardContents() {
        try {
          const pb = frida_objc_bridge_default.classes.UIPasteboard.generalPasteboard();
          const result2 = {
            changeCount: pb.changeCount(),
            numberOfItems: pb.numberOfItems(),
            types: [],
            string: null,
            hasStrings: false,
            hasURLs: false,
            hasImages: false
          };
          try {
            const types2 = pb.pasteboardTypes();
            if (types2 && types2.count) {
              const count = types2.count();
              for (let i = 0; i < count; i++) {
                result2.types.push(ObjCUtils.toString(types2.objectAtIndex_(i)));
              }
            }
          } catch (e) {
            log("[PasteboardMonitor] Could not get pasteboard types: " + e);
          }
          try {
            const str = pb.string();
            if (str) {
              result2.string = ObjCUtils.toString(str);
            }
          } catch (e) {
          }
          try {
            result2.hasStrings = !!pb.hasStrings();
          } catch (e) {
          }
          try {
            result2.hasURLs = !!pb.hasURLs();
          } catch (e) {
          }
          try {
            result2.hasImages = !!pb.hasImages();
          } catch (e) {
          }
          try {
            const url = pb.URL();
            if (url) {
              result2.url = ObjCUtils.toString(url);
            }
          } catch (e) {
          }
          return { success: true, data: result2 };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[PasteboardMonitor] Failed to get pasteboard contents", e);
          return { success: false, error: e.message };
        }
      }
      setPasteboardString(text) {
        try {
          frida_objc_bridge_default.schedule(frida_objc_bridge_default.mainQueue, () => {
            try {
              const pb = frida_objc_bridge_default.classes.UIPasteboard.generalPasteboard();
              const nsString = frida_objc_bridge_default.classes.NSString.stringWithString_(text);
              pb.setString_(nsString);
              log(`[PasteboardMonitor] Set pasteboard string: ${text.substring(0, 100)}`);
            } catch (e) {
              logError("[PasteboardMonitor] ObjC error setting pasteboard", e);
            }
          });
          return {
            success: true,
            message: `Pasteboard string set (${text.length} chars)`
          };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[PasteboardMonitor] Failed to set pasteboard string", e);
          return { success: false, error: e.message };
        }
      }
      getEvents() {
        return {
          success: true,
          data: {
            events: this.state.events,
            count: this.state.events.length,
            active: this.state.active,
            statistics: this.state.stats,
            filters: this.state.filters
          }
        };
      }
      clearEvents() {
        this.state.events = [];
        this.state.stats.totalEvents = 0;
        this.state.stats.byType.pasteboard = 0;
        this.state.stats.byBundle = {};
        this.state.stats.byOperation = {};
        return { success: true, message: "Pasteboard events cleared" };
      }
    };
  }
});

// agent/iOS/IPC/DarwinNotification/DarwinNotificationMonitor.ts
function resolveExport(moduleName, symbolName) {
  const mod = Module;
  try {
    if (typeof mod.getGlobalExportByName === "function") {
      return mod.getGlobalExportByName(symbolName);
    }
    if (typeof mod.getExportByName === "function") {
      return mod.getExportByName(moduleName, symbolName);
    }
    if (typeof mod.findExportByName === "function") {
      return mod.findExportByName(moduleName, symbolName);
    }
  } catch (e) {
  }
  return null;
}
var DarwinNotificationMonitor;
var init_DarwinNotificationMonitor = __esm({
  "agent/iOS/IPC/DarwinNotification/DarwinNotificationMonitor.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_Helper();
    init_frida_objc_bridge();
    DarwinNotificationMonitor = class extends BaseModule {
      state;
      eventCounter = 0;
      hooks = /* @__PURE__ */ new Map();
      nativeHooks = [];
      constructor() {
        super({
          name: "DarwinNotificationMonitor",
          version: "1.0.0",
          platform: "ios",
          category: "IPC",
          description: "Monitor Darwin notification center posts and observations"
        });
        const now = (/* @__PURE__ */ new Date()).toISOString();
        this.state = {
          active: false,
          startTime: now,
          events: [],
          stats: {
            totalEvents: 0,
            byType: {
              xpc: 0,
              mach: 0,
              message_port: 0,
              darwin_notification: 0,
              url_scheme: 0,
              pasteboard: 0,
              app_group: 0,
              unix_socket: 0
            },
            byBundle: {},
            byOperation: {},
            errors: 0,
            startTime: now
          },
          filters: {
            types: ["darwin_notification"],
            bundles: [],
            excludeSystem: false
          }
        };
      }
      async onInitialize() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        log("[DarwinNotificationMonitor] Module initialized");
      }
      async onShutdown() {
        if (this.state.active) {
          this.stop();
        }
        log("[DarwinNotificationMonitor] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("startDarwinNotificationMonitor", () => this.start());
        this.registry.registerBoth("stopDarwinNotificationMonitor", () => this.stop());
        this.registry.registerBoth("getDarwinNotificationEvents", () => this.getEvents());
        this.registry.registerBoth("clearDarwinNotificationEvents", () => this.clearEvents());
        this.registry.registerBoth("postDarwinNotification", (name2) => this.postNotification(name2));
      }
      start() {
        if (this.state.active) {
          warn("[DarwinNotificationMonitor] Already active");
          return { success: false, message: "Already active" };
        }
        try {
          this.hookCFNotificationCenter();
          this.hookNSNotificationCenter();
          this.state.active = true;
          this.state.startTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[DarwinNotificationMonitor] Started monitoring notifications");
          return { success: true, message: "Darwin notification monitoring started" };
        } catch (startErr) {
          const e = startErr instanceof Error ? startErr : Error(String(startErr));
          logError("[DarwinNotificationMonitor] Failed to start", e);
          this.state.lastError = e.message;
          return { success: false, error: e.message };
        }
      }
      stop() {
        if (!this.state.active) {
          warn("[DarwinNotificationMonitor] Not active");
          return { success: false, message: "Not active" };
        }
        try {
          for (const listener of this.nativeHooks) {
            listener.detach();
          }
          this.nativeHooks = [];
          this.hooks.forEach((hookInfo, key) => {
            try {
              hookInfo.method.implementation = hookInfo.original;
              log(`[DarwinNotificationMonitor] Restored ${key}`);
            } catch (e) {
              logError(`[DarwinNotificationMonitor] Failed to restore ${key}`, e);
            }
          });
          this.hooks.clear();
          this.state.active = false;
          this.state.endTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[DarwinNotificationMonitor] Stopped");
          return { success: true, message: "Darwin notification monitoring stopped" };
        } catch (stopErr) {
          const e = stopErr instanceof Error ? stopErr : Error(String(stopErr));
          logError("[DarwinNotificationMonitor] Failed to stop", e);
          return { success: false, error: e.message };
        }
      }
      hookCFNotificationCenter() {
        const moduleRef = this;
        try {
          const postNotifAddr = resolveExport("CoreFoundation", "CFNotificationCenterPostNotification");
          if (postNotifAddr) {
            const listener = Interceptor.attach(postNotifAddr, {
              onEnter(args) {
                try {
                  const namePtr = args[1];
                  if (namePtr && !namePtr.isNull()) {
                    const nameObj = new frida_objc_bridge_default.Object(namePtr);
                    const name2 = ObjCUtils.toString(nameObj);
                    moduleRef.captureNotification(name2, "post_cf");
                  }
                } catch (e) {
                }
              }
            });
            this.nativeHooks.push(listener);
            log("[DarwinNotificationMonitor] Hooked CFNotificationCenterPostNotification");
          }
        } catch (e) {
          log(`[DarwinNotificationMonitor] Failed to hook CFNotificationCenterPostNotification: ${e}`);
        }
        try {
          const notifyPostAddr = resolveExport("libSystem.B.dylib", "notify_post");
          if (notifyPostAddr) {
            const listener = Interceptor.attach(notifyPostAddr, {
              onEnter(args) {
                try {
                  const name2 = args[0].readUtf8String();
                  if (name2) {
                    moduleRef.captureNotification(name2, "post_notify");
                  }
                } catch (e) {
                }
              }
            });
            this.nativeHooks.push(listener);
            log("[DarwinNotificationMonitor] Hooked notify_post");
          }
        } catch (e) {
          log(`[DarwinNotificationMonitor] Failed to hook notify_post: ${e}`);
        }
        try {
          const notifyRegAddr = resolveExport("libSystem.B.dylib", "notify_register_dispatch");
          if (notifyRegAddr) {
            const listener = Interceptor.attach(notifyRegAddr, {
              onEnter(args) {
                try {
                  const name2 = args[0].readUtf8String();
                  if (name2) {
                    moduleRef.captureNotification(name2, "register_observe");
                  }
                } catch (e) {
                }
              }
            });
            this.nativeHooks.push(listener);
            log("[DarwinNotificationMonitor] Hooked notify_register_dispatch");
          }
        } catch (e) {
          log(`[DarwinNotificationMonitor] Failed to hook notify_register_dispatch: ${e}`);
        }
      }
      hookNSNotificationCenter() {
        const moduleRef = this;
        const NSNotificationCenter = frida_objc_bridge_default.classes.NSNotificationCenter;
        if (!NSNotificationCenter) {
          log("[DarwinNotificationMonitor] NSNotificationCenter not found");
          return;
        }
        const postSelector = "- postNotificationName:object:userInfo:";
        try {
          const method2 = NSNotificationCenter[postSelector];
          if (method2) {
            const origImpl = method2.implementation;
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, name2, object, userInfo) {
              try {
                const notifName = name2 ? ObjCUtils.toString(new frida_objc_bridge_default.Object(name2)) : "<unknown>";
                if (!moduleRef.isNoisyNotification(notifName)) {
                  moduleRef.captureNotification(notifName, "post_ns");
                }
              } catch (e) {
              }
              return origImpl(handle2, sel2, name2, object, userInfo);
            });
            this.hooks.set(`NSNotificationCenter.${postSelector}`, {
              class: NSNotificationCenter,
              method: method2,
              original: origImpl
            });
            log(`[DarwinNotificationMonitor] Hooked NSNotificationCenter ${postSelector}`);
          }
        } catch (e) {
          log(`[DarwinNotificationMonitor] Failed to hook ${postSelector}: ${e}`);
        }
      }
      isNoisyNotification(name2) {
        const noisy = [
          "UIDeviceBatteryLevelDidChangeNotification",
          "UIDeviceBatteryStateDidChangeNotification",
          "_UIWindowSystemGestureStateChangedNotification",
          "UITextInputCurrentInputModeDidChangeNotification",
          "_UIApplicationDidRemoveDeactivationReasonNotification",
          "_UIApplicationWillAddDeactivationReasonNotification",
          "UIScreenBrightnessDidChangeNotification",
          "com.apple.system.clock.tick",
          "FlurryHeartBeatNotification",
          "_UISceneLifecycleMultiplexerNotification",
          "UIApplicationStatusBarOrientationDidChangeNotification",
          "_UIApplicationDidChangeDeactivationReasonNotification",
          "NSBundleResourceRequestLowDiskSpaceNotification"
        ];
        return noisy.includes(name2);
      }
      captureNotification(name2, operation) {
        try {
          let bundleId = "unknown";
          try {
            bundleId = ObjCUtils.toString(frida_objc_bridge_default.classes.NSBundle.mainBundle().bundleIdentifier());
          } catch (e) {
          }
          const event = {
            id: `dn_${Date.now()}_${++this.eventCounter}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "darwin_notification",
            process: {
              bundleId,
              pid: Process.id,
              tid: Process.getCurrentThreadId()
            },
            name: name2,
            callChain: [operation]
          };
          this.capture(event);
          log(`[DarwinNotificationMonitor] ${operation}: ${name2}`);
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[DarwinNotificationMonitor] Error capturing notification", e);
        }
      }
      capture(event) {
        this.state.events.push(event);
        if (this.state.events.length > 1e3) {
          this.state.events = this.state.events.slice(-1e3);
        }
        this.state.stats.totalEvents++;
        this.state.stats.byType.darwin_notification++;
        const bid = event.process?.bundleId ?? "unknown";
        this.state.stats.byBundle[bid] = (this.state.stats.byBundle[bid] || 0) + 1;
        const op = event.callChain?.[0] ?? "unknown";
        this.state.stats.byOperation[op] = (this.state.stats.byOperation[op] || 0) + 1;
        send({ type: "ipc_event", data: event });
      }
      postNotification(name2) {
        try {
          const notifyPostAddr = resolveExport("libSystem.B.dylib", "notify_post");
          if (!notifyPostAddr) {
            return { success: false, error: "notify_post not found" };
          }
          const notifyPost = new NativeFunction(notifyPostAddr, "uint32", ["pointer"]);
          const namePtr = Memory.allocUtf8String(name2);
          const result2 = notifyPost(namePtr);
          log(`[DarwinNotificationMonitor] Posted notification: ${name2} (result: ${result2})`);
          return {
            success: result2 === 0,
            message: result2 === 0 ? `Posted notification: ${name2}` : `notify_post returned ${result2}`,
            name: name2
          };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[DarwinNotificationMonitor] Failed to post notification", e);
          return { success: false, error: e.message };
        }
      }
      getEvents() {
        return {
          success: true,
          data: {
            events: this.state.events,
            count: this.state.events.length,
            active: this.state.active,
            statistics: this.state.stats,
            filters: this.state.filters
          }
        };
      }
      clearEvents() {
        this.state.events = [];
        this.state.stats.totalEvents = 0;
        this.state.stats.byType.darwin_notification = 0;
        this.state.stats.byBundle = {};
        this.state.stats.byOperation = {};
        return { success: true, message: "Darwin notification events cleared" };
      }
    };
  }
});

// agent/iOS/IPC/AppGroup/AppGroupMonitor.ts
var AppGroupMonitor;
var init_AppGroupMonitor = __esm({
  "agent/iOS/IPC/AppGroup/AppGroupMonitor.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_Helper();
    init_frida_objc_bridge();
    AppGroupMonitor = class extends BaseModule {
      state;
      eventCounter = 0;
      hooks = /* @__PURE__ */ new Map();
      nativeHooks = [];
      constructor() {
        super({
          name: "AppGroupMonitor",
          version: "1.0.0",
          platform: "ios",
          category: "IPC",
          description: "Monitor App Group shared container and UserDefaults access"
        });
        const now = (/* @__PURE__ */ new Date()).toISOString();
        this.state = {
          active: false,
          startTime: now,
          events: [],
          stats: {
            totalEvents: 0,
            byType: {
              xpc: 0,
              mach: 0,
              message_port: 0,
              darwin_notification: 0,
              url_scheme: 0,
              pasteboard: 0,
              app_group: 0,
              unix_socket: 0
            },
            byBundle: {},
            byOperation: {},
            errors: 0,
            startTime: now
          },
          filters: {
            types: ["app_group"],
            bundles: [],
            excludeSystem: false
          }
        };
      }
      async onInitialize() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        log("[AppGroupMonitor] Module initialized");
      }
      async onShutdown() {
        if (this.state.active) {
          this.stop();
        }
        log("[AppGroupMonitor] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("startAppGroupMonitor", () => this.start());
        this.registry.registerBoth("stopAppGroupMonitor", () => this.stop());
        this.registry.registerBoth("getAppGroupEvents", () => this.getEvents());
        this.registry.registerBoth("clearAppGroupEvents", () => this.clearEvents());
        this.registry.registerBoth("getAppGroups", () => this.getAppGroups());
        this.registry.registerBoth("getAppGroupContents", (groupId) => this.getAppGroupContents(groupId));
      }
      start() {
        if (this.state.active) {
          warn("[AppGroupMonitor] Already active");
          return { success: false, message: "Already active" };
        }
        try {
          this.hookSharedContainerAccess();
          this.hookSuiteUserDefaults();
          this.state.active = true;
          this.state.startTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[AppGroupMonitor] Started monitoring app groups");
          return { success: true, message: "App group monitoring started" };
        } catch (startErr) {
          const e = startErr instanceof Error ? startErr : Error(String(startErr));
          logError("[AppGroupMonitor] Failed to start", e);
          this.state.lastError = e.message;
          return { success: false, error: e.message };
        }
      }
      stop() {
        if (!this.state.active) {
          warn("[AppGroupMonitor] Not active");
          return { success: false, message: "Not active" };
        }
        try {
          for (const listener of this.nativeHooks) {
            listener.detach();
          }
          this.nativeHooks = [];
          this.hooks.forEach((hookInfo, key) => {
            try {
              hookInfo.method.implementation = hookInfo.original;
              log(`[AppGroupMonitor] Restored ${key}`);
            } catch (e) {
              logError(`[AppGroupMonitor] Failed to restore ${key}`, e);
            }
          });
          this.hooks.clear();
          this.state.active = false;
          this.state.endTime = (/* @__PURE__ */ new Date()).toISOString();
          log("[AppGroupMonitor] Stopped");
          return { success: true, message: "App group monitoring stopped" };
        } catch (stopErr) {
          const e = stopErr instanceof Error ? stopErr : Error(String(stopErr));
          logError("[AppGroupMonitor] Failed to stop", e);
          return { success: false, error: e.message };
        }
      }
      hookSharedContainerAccess() {
        const moduleRef = this;
        const NSFileManager = frida_objc_bridge_default.classes.NSFileManager;
        if (!NSFileManager) {
          log("[AppGroupMonitor] NSFileManager not found");
          return;
        }
        const selector2 = "- containerURLForSecurityApplicationGroupIdentifier:";
        try {
          const method2 = NSFileManager[selector2];
          if (method2) {
            const origImpl = method2.implementation;
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, groupId) {
              const result2 = origImpl(handle2, sel2, groupId);
              try {
                const gid = groupId ? ObjCUtils.toString(new frida_objc_bridge_default.Object(groupId)) : "<unknown>";
                let filePath;
                if (result2 && !new frida_objc_bridge_default.Object(result2).isEqual_(frida_objc_bridge_default.classes.NSNull.null())) {
                  filePath = ObjCUtils.toString(new frida_objc_bridge_default.Object(result2));
                }
                moduleRef.captureEvent(gid, "container_access", filePath);
              } catch (e) {
              }
              return result2;
            });
            this.hooks.set(`NSFileManager.${selector2}`, {
              class: NSFileManager,
              method: method2,
              original: origImpl
            });
            log(`[AppGroupMonitor] Hooked NSFileManager ${selector2}`);
          }
        } catch (e) {
          log(`[AppGroupMonitor] Failed to hook ${selector2}: ${e}`);
        }
      }
      hookSuiteUserDefaults() {
        const moduleRef = this;
        const NSUserDefaults = frida_objc_bridge_default.classes.NSUserDefaults;
        if (!NSUserDefaults) {
          log("[AppGroupMonitor] NSUserDefaults not found");
          return;
        }
        const initSelector = "- initWithSuiteName:";
        try {
          const method2 = NSUserDefaults[initSelector];
          if (method2) {
            const origImpl = method2.implementation;
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, suiteName) {
              const result2 = origImpl(handle2, sel2, suiteName);
              try {
                if (suiteName) {
                  const suite = ObjCUtils.toString(new frida_objc_bridge_default.Object(suiteName));
                  if (suite.startsWith("group.") || suite.includes(".")) {
                    moduleRef.captureEvent(suite, "userdefaults_init");
                  }
                }
              } catch (e) {
              }
              return result2;
            });
            this.hooks.set(`NSUserDefaults.${initSelector}`, {
              class: NSUserDefaults,
              method: method2,
              original: origImpl
            });
            log(`[AppGroupMonitor] Hooked NSUserDefaults ${initSelector}`);
          }
        } catch (e) {
          log(`[AppGroupMonitor] Failed to hook ${initSelector}: ${e}`);
        }
        const setSelector = "- setObject:forKey:";
        try {
          const method2 = NSUserDefaults[setSelector];
          if (method2) {
            const origImpl = method2.implementation;
            method2.implementation = frida_objc_bridge_default.implement(method2, function(handle2, sel2, value, key) {
              try {
                const defaults = new frida_objc_bridge_default.Object(handle2);
                const suiteName = ObjCUtils.getProperty(defaults, "suiteName");
                if (suiteName) {
                  const suite = ObjCUtils.toString(suiteName);
                  if (suite.startsWith("group.") || suite.includes(".")) {
                    const keyStr = key ? ObjCUtils.toString(new frida_objc_bridge_default.Object(key)) : "<unknown>";
                    let valueStr;
                    try {
                      if (value) {
                        const valObj = new frida_objc_bridge_default.Object(value);
                        valueStr = ObjCUtils.toString(valObj);
                        if (valueStr.length > 200)
                          valueStr = valueStr.substring(0, 200) + "...";
                      }
                    } catch (e) {
                    }
                    moduleRef.captureEvent(suite, "userdefaults_write", void 0, keyStr, valueStr);
                  }
                }
              } catch (e) {
              }
              return origImpl(handle2, sel2, value, key);
            });
            this.hooks.set(`NSUserDefaults.${setSelector}`, {
              class: NSUserDefaults,
              method: method2,
              original: origImpl
            });
            log(`[AppGroupMonitor] Hooked NSUserDefaults ${setSelector}`);
          }
        } catch (e) {
          log(`[AppGroupMonitor] Failed to hook ${setSelector}: ${e}`);
        }
      }
      captureEvent(groupId, operation, filePath, userDefaultsKey, value) {
        try {
          let bundleId = "unknown";
          try {
            bundleId = ObjCUtils.toString(frida_objc_bridge_default.classes.NSBundle.mainBundle().bundleIdentifier());
          } catch (e) {
          }
          const event = {
            id: `ag_${Date.now()}_${++this.eventCounter}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            type: "app_group",
            process: {
              bundleId,
              pid: Process.id,
              tid: Process.getCurrentThreadId()
            },
            groupId,
            filePath,
            userDefaultsKey,
            value,
            callChain: [operation]
          };
          this.capture(event);
          log(`[AppGroupMonitor] ${operation}: ${groupId}${userDefaultsKey ? ` key=${userDefaultsKey}` : ""}`);
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[AppGroupMonitor] Error capturing event", e);
        }
      }
      capture(event) {
        this.state.events.push(event);
        if (this.state.events.length > 1e3) {
          this.state.events = this.state.events.slice(-1e3);
        }
        this.state.stats.totalEvents++;
        this.state.stats.byType.app_group++;
        const bid = event.process?.bundleId ?? "unknown";
        this.state.stats.byBundle[bid] = (this.state.stats.byBundle[bid] || 0) + 1;
        const op = event.callChain?.[0] ?? "unknown";
        this.state.stats.byOperation[op] = (this.state.stats.byOperation[op] || 0) + 1;
        send({ type: "ipc_event", data: event });
      }
      getAppGroups() {
        try {
          const groups = [];
          const bundleId = ObjCUtils.toString(frida_objc_bridge_default.classes.NSBundle.mainBundle().bundleIdentifier());
          const bundle = frida_objc_bridge_default.classes.NSBundle.mainBundle();
          const infoDictionary = bundle.infoDictionary();
          try {
            const provisionPath = frida_objc_bridge_default.classes.NSString.stringWithString_(ObjCUtils.toString(bundle.bundlePath()) + "/embedded.mobileprovision");
            const provisionData = frida_objc_bridge_default.classes.NSData.dataWithContentsOfFile_(provisionPath);
            if (provisionData) {
              const provisionStr = frida_objc_bridge_default.classes.NSString.alloc().initWithData_encoding_(provisionData, 4);
              const fullStr = ObjCUtils.toString(provisionStr);
              const groupRegex = /group\.[a-zA-Z0-9._-]+/g;
              let match;
              const seen = /* @__PURE__ */ new Set();
              while ((match = groupRegex.exec(fullStr)) !== null) {
                const gid = match[0];
                if (!seen.has(gid)) {
                  seen.add(gid);
                  let containerPath = null;
                  try {
                    const fileManager = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
                    const nsGroupId = frida_objc_bridge_default.classes.NSString.stringWithString_(gid);
                    const containerURL = fileManager.containerURLForSecurityApplicationGroupIdentifier_(nsGroupId);
                    if (containerURL) {
                      containerPath = ObjCUtils.toString(containerURL);
                    }
                  } catch (e) {
                  }
                  groups.push({ groupId: gid, containerPath });
                }
              }
            }
          } catch (e) {
            log(`[AppGroupMonitor] Could not read provisioning profile: ${e}`);
          }
          return {
            success: true,
            data: {
              groups,
              bundleId
            }
          };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[AppGroupMonitor] Failed to get app groups", e);
          return { success: false, error: e.message };
        }
      }
      getAppGroupContents(groupId) {
        try {
          const fileManager = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
          const nsGroupId = frida_objc_bridge_default.classes.NSString.stringWithString_(groupId);
          const containerURL = fileManager.containerURLForSecurityApplicationGroupIdentifier_(nsGroupId);
          if (!containerURL) {
            return { success: false, error: `No container found for group: ${groupId}` };
          }
          const containerPath = ObjCUtils.toString(containerURL);
          const files = [];
          try {
            const error = frida_objc_bridge_default.classes.NSObject.alloc();
            const contents = fileManager.contentsOfDirectoryAtPath_error_(frida_objc_bridge_default.classes.NSString.stringWithString_(containerPath.replace("file://", "")), NULL);
            if (contents && contents.count) {
              const count = contents.count();
              for (let i = 0; i < Math.min(count, 100); i++) {
                const fileName = ObjCUtils.toString(contents.objectAtIndex_(i));
                const fullPath = containerPath.replace("file://", "") + "/" + fileName;
                let size = 0;
                let isDirectory = false;
                let modified;
                try {
                  const attrs = fileManager.attributesOfItemAtPath_error_(frida_objc_bridge_default.classes.NSString.stringWithString_(fullPath), NULL);
                  if (attrs) {
                    const sizeKey = frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileSize");
                    const sizeObj = attrs.objectForKey_(sizeKey);
                    if (sizeObj)
                      size = parseInt(ObjCUtils.toString(sizeObj), 10) || 0;
                    const typeKey = frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileType");
                    const typeObj = attrs.objectForKey_(typeKey);
                    if (typeObj)
                      isDirectory = ObjCUtils.toString(typeObj) === "NSFileTypeDirectory";
                    const dateKey = frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileModificationDate");
                    const dateObj = attrs.objectForKey_(dateKey);
                    if (dateObj)
                      modified = ObjCUtils.toString(dateObj);
                  }
                } catch (e) {
                }
                files.push({ name: fileName, size, isDirectory, modified });
              }
            }
          } catch (e) {
            log(`[AppGroupMonitor] Error listing container: ${e}`);
          }
          let userDefaults = {};
          try {
            const defaults = frida_objc_bridge_default.classes.NSUserDefaults.alloc().initWithSuiteName_(nsGroupId);
            if (defaults) {
              const dict = defaults.dictionaryRepresentation();
              if (dict) {
                const keys = dict.allKeys();
                const keyCount = Math.min(keys.count(), 50);
                for (let i = 0; i < keyCount; i++) {
                  const key = ObjCUtils.toString(keys.objectAtIndex_(i));
                  const value = dict.objectForKey_(keys.objectAtIndex_(i));
                  let valueStr = ObjCUtils.toString(value);
                  if (valueStr.length > 200)
                    valueStr = valueStr.substring(0, 200) + "...";
                  userDefaults[key] = valueStr;
                }
              }
            }
          } catch (e) {
            log(`[AppGroupMonitor] Error reading UserDefaults for ${groupId}: ${e}`);
          }
          return {
            success: true,
            data: {
              groupId,
              containerPath,
              files,
              userDefaults
            }
          };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[AppGroupMonitor] Failed to get app group contents", e);
          return { success: false, error: e.message };
        }
      }
      getEvents() {
        return {
          success: true,
          data: {
            events: this.state.events,
            count: this.state.events.length,
            active: this.state.active,
            statistics: this.state.stats,
            filters: this.state.filters
          }
        };
      }
      clearEvents() {
        this.state.events = [];
        this.state.stats.totalEvents = 0;
        this.state.stats.byType.app_group = 0;
        this.state.stats.byBundle = {};
        this.state.stats.byOperation = {};
        return { success: true, message: "App group events cleared" };
      }
    };
  }
});

// agent/iOS/MachO/types.ts
var LoadCommandType;
var init_types2 = __esm({
  "agent/iOS/MachO/types.ts"() {
    "use strict";
    init_node_globals();
    (function(LoadCommandType2) {
      LoadCommandType2[LoadCommandType2["LC_SEGMENT"] = 1] = "LC_SEGMENT";
      LoadCommandType2[LoadCommandType2["LC_SYMTAB"] = 2] = "LC_SYMTAB";
      LoadCommandType2[LoadCommandType2["LC_SYMSEG"] = 3] = "LC_SYMSEG";
      LoadCommandType2[LoadCommandType2["LC_THREAD"] = 4] = "LC_THREAD";
      LoadCommandType2[LoadCommandType2["LC_UNIXTHREAD"] = 5] = "LC_UNIXTHREAD";
      LoadCommandType2[LoadCommandType2["LC_LOADFVMLIB"] = 6] = "LC_LOADFVMLIB";
      LoadCommandType2[LoadCommandType2["LC_IDFVMLIB"] = 7] = "LC_IDFVMLIB";
      LoadCommandType2[LoadCommandType2["LC_IDENT"] = 8] = "LC_IDENT";
      LoadCommandType2[LoadCommandType2["LC_FVMFILE"] = 9] = "LC_FVMFILE";
      LoadCommandType2[LoadCommandType2["LC_PREPAGE"] = 10] = "LC_PREPAGE";
      LoadCommandType2[LoadCommandType2["LC_DYSYMTAB"] = 11] = "LC_DYSYMTAB";
      LoadCommandType2[LoadCommandType2["LC_LOAD_DYLIB"] = 12] = "LC_LOAD_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_ID_DYLIB"] = 13] = "LC_ID_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_LOAD_DYLINKER"] = 14] = "LC_LOAD_DYLINKER";
      LoadCommandType2[LoadCommandType2["LC_ID_DYLINKER"] = 15] = "LC_ID_DYLINKER";
      LoadCommandType2[LoadCommandType2["LC_PREBOUND_DYLIB"] = 16] = "LC_PREBOUND_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_ROUTINES"] = 17] = "LC_ROUTINES";
      LoadCommandType2[LoadCommandType2["LC_SUB_FRAMEWORK"] = 18] = "LC_SUB_FRAMEWORK";
      LoadCommandType2[LoadCommandType2["LC_SUB_UMBRELLA"] = 19] = "LC_SUB_UMBRELLA";
      LoadCommandType2[LoadCommandType2["LC_SUB_CLIENT"] = 20] = "LC_SUB_CLIENT";
      LoadCommandType2[LoadCommandType2["LC_SUB_LIBRARY"] = 21] = "LC_SUB_LIBRARY";
      LoadCommandType2[LoadCommandType2["LC_TWOLEVEL_HINTS"] = 22] = "LC_TWOLEVEL_HINTS";
      LoadCommandType2[LoadCommandType2["LC_PREBIND_CKSUM"] = 23] = "LC_PREBIND_CKSUM";
      LoadCommandType2[LoadCommandType2["LC_LOAD_WEAK_DYLIB"] = -2147483624] = "LC_LOAD_WEAK_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_SEGMENT_64"] = 25] = "LC_SEGMENT_64";
      LoadCommandType2[LoadCommandType2["LC_ROUTINES_64"] = 26] = "LC_ROUTINES_64";
      LoadCommandType2[LoadCommandType2["LC_UUID"] = 27] = "LC_UUID";
      LoadCommandType2[LoadCommandType2["LC_RPATH"] = -2147483620] = "LC_RPATH";
      LoadCommandType2[LoadCommandType2["LC_CODE_SIGNATURE"] = 29] = "LC_CODE_SIGNATURE";
      LoadCommandType2[LoadCommandType2["LC_SEGMENT_SPLIT_INFO"] = 30] = "LC_SEGMENT_SPLIT_INFO";
      LoadCommandType2[LoadCommandType2["LC_REEXPORT_DYLIB"] = -2147483617] = "LC_REEXPORT_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_LAZY_LOAD_DYLIB"] = 32] = "LC_LAZY_LOAD_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_ENCRYPTION_INFO"] = 33] = "LC_ENCRYPTION_INFO";
      LoadCommandType2[LoadCommandType2["LC_DYLD_INFO"] = 34] = "LC_DYLD_INFO";
      LoadCommandType2[LoadCommandType2["LC_DYLD_INFO_ONLY"] = -2147483614] = "LC_DYLD_INFO_ONLY";
      LoadCommandType2[LoadCommandType2["LC_LOAD_UPWARD_DYLIB"] = -2147483613] = "LC_LOAD_UPWARD_DYLIB";
      LoadCommandType2[LoadCommandType2["LC_VERSION_MIN_MACOSX"] = 36] = "LC_VERSION_MIN_MACOSX";
      LoadCommandType2[LoadCommandType2["LC_VERSION_MIN_IPHONEOS"] = 37] = "LC_VERSION_MIN_IPHONEOS";
      LoadCommandType2[LoadCommandType2["LC_FUNCTION_STARTS"] = 38] = "LC_FUNCTION_STARTS";
      LoadCommandType2[LoadCommandType2["LC_DYLD_ENVIRONMENT"] = 39] = "LC_DYLD_ENVIRONMENT";
      LoadCommandType2[LoadCommandType2["LC_MAIN"] = -2147483608] = "LC_MAIN";
      LoadCommandType2[LoadCommandType2["LC_DATA_IN_CODE"] = 41] = "LC_DATA_IN_CODE";
      LoadCommandType2[LoadCommandType2["LC_SOURCE_VERSION"] = 42] = "LC_SOURCE_VERSION";
      LoadCommandType2[LoadCommandType2["LC_DYLIB_CODE_SIGN_DRS"] = 43] = "LC_DYLIB_CODE_SIGN_DRS";
      LoadCommandType2[LoadCommandType2["LC_ENCRYPTION_INFO_64"] = 44] = "LC_ENCRYPTION_INFO_64";
      LoadCommandType2[LoadCommandType2["LC_LINKER_OPTION"] = 45] = "LC_LINKER_OPTION";
      LoadCommandType2[LoadCommandType2["LC_LINKER_OPTIMIZATION_HINT"] = 46] = "LC_LINKER_OPTIMIZATION_HINT";
      LoadCommandType2[LoadCommandType2["LC_VERSION_MIN_TVOS"] = 47] = "LC_VERSION_MIN_TVOS";
      LoadCommandType2[LoadCommandType2["LC_VERSION_MIN_WATCHOS"] = 48] = "LC_VERSION_MIN_WATCHOS";
      LoadCommandType2[LoadCommandType2["LC_NOTE"] = 49] = "LC_NOTE";
      LoadCommandType2[LoadCommandType2["LC_BUILD_VERSION"] = 50] = "LC_BUILD_VERSION";
    })(LoadCommandType || (LoadCommandType = {}));
  }
});

// agent/iOS/MachO/parser.ts
function bytesToHexString(buffer, offset, length) {
  return Array.from(buffer.slice(offset, offset + length)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var CPU_TYPE_ARM, CPU_TYPE_ARM64, CPU_TYPE_ARM64_32, CPU_TYPE_X86, CPU_TYPE_X86_64, FILE_TYPE_MAP, MachOByteReader, MachOParser;
var init_parser = __esm({
  "agent/iOS/MachO/parser.ts"() {
    "use strict";
    init_node_globals();
    init_types2();
    CPU_TYPE_ARM = 12;
    CPU_TYPE_ARM64 = 16777228;
    CPU_TYPE_ARM64_32 = 33554444;
    CPU_TYPE_X86 = 7;
    CPU_TYPE_X86_64 = 16777223;
    FILE_TYPE_MAP = {
      1: "MH_OBJECT",
      2: "MH_EXECUTE",
      3: "MH_FVMLIB",
      4: "MH_CORE",
      5: "MH_PRELOAD",
      6: "MH_DYLIB",
      7: "MH_DYLINKER",
      8: "MH_BUNDLE",
      9: "MH_DYLIB_STUB",
      10: "MH_DSYM",
      11: "MH_KEXT_BUNDLE"
    };
    MachOByteReader = class {
      isLittleEndian;
      is64Bit;
      constructor(isLittleEndian, is64Bit) {
        this.isLittleEndian = isLittleEndian;
        this.is64Bit = is64Bit;
      }
      readUInt8(buffer, offset) {
        return buffer[offset] & 255;
      }
      readUInt16(buffer, offset) {
        if (this.isLittleEndian) {
          return buffer[offset] & 255 | (buffer[offset + 1] & 255) << 8;
        } else {
          return (buffer[offset] & 255) << 8 | buffer[offset + 1] & 255;
        }
      }
      readUInt32(buffer, offset) {
        if (this.isLittleEndian) {
          return buffer[offset] & 255 | (buffer[offset + 1] & 255) << 8 | (buffer[offset + 2] & 255) << 16 | (buffer[offset + 3] & 255) << 24;
        } else {
          return (buffer[offset] & 255) << 24 | (buffer[offset + 1] & 255) << 16 | (buffer[offset + 2] & 255) << 8 | buffer[offset + 3] & 255;
        }
      }
      readUInt64(buffer, offset) {
        if (this.isLittleEndian) {
          const low = this.readUInt32(buffer, offset);
          const high = this.readUInt32(buffer, offset + 4);
          return BigInt(high) << 32n | BigInt(low);
        } else {
          const high = this.readUInt32(buffer, offset);
          const low = this.readUInt32(buffer, offset + 4);
          return BigInt(high) << 32n | BigInt(low);
        }
      }
      readInt32(buffer, offset) {
        const value = this.readUInt32(buffer, offset);
        return value > 2147483647 ? value - 4294967296 : value;
      }
      readInt64(buffer, offset) {
        const value = this.readUInt64(buffer, offset);
        return value > 0x7fffffffffffffffn ? value - 0x10000000000000000n : value;
      }
      writeUInt32(buffer, offset, value) {
        if (this.isLittleEndian) {
          buffer[offset] = value & 255;
          buffer[offset + 1] = value >> 8 & 255;
          buffer[offset + 2] = value >> 16 & 255;
          buffer[offset + 3] = value >> 24 & 255;
        } else {
          buffer[offset] = value >> 24 & 255;
          buffer[offset + 1] = value >> 16 & 255;
          buffer[offset + 2] = value >> 8 & 255;
          buffer[offset + 3] = value & 255;
        }
      }
      readString(buffer, offset, maxLength) {
        let length = 0;
        while (length < maxLength && buffer[offset + length] !== 0) {
          length++;
        }
        return String.fromCharCode(...Array.from(buffer.slice(offset, offset + length)));
      }
      bytesToHexString(buffer, offset, length) {
        return Array.from(buffer.slice(offset, offset + length)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    };
    MachOParser = class {
      reader = null;
      /**
       * Parse Mach-O header from buffer
       */
      parseHeader(buffer) {
        const headerBytes = bytesToHexString(buffer, 0, 16);
        const magicHex = headerBytes.substring(0, 8);
        let is64Bit = false;
        let isLittleEndian = false;
        let magic;
        switch (magicHex) {
          case "cefaedfe":
            is64Bit = false;
            isLittleEndian = true;
            magic = 3472551422;
            break;
          case "feedface":
            is64Bit = false;
            isLittleEndian = false;
            magic = 4277009102;
            break;
          case "cffaedfe":
            is64Bit = true;
            isLittleEndian = true;
            magic = 3489328638;
            break;
          case "feedfacf":
            is64Bit = true;
            isLittleEndian = false;
            magic = 4277009103;
            break;
          default:
            throw new Error(`Not a valid Mach-O binary (header: ${magicHex})`);
        }
        this.reader = new MachOByteReader(isLittleEndian, is64Bit);
        const headerSize = is64Bit ? 32 : 28;
        const cputype = this.reader.readInt32(buffer, 4);
        const cpusubtype = this.reader.readInt32(buffer, 8);
        const filetype = this.reader.readUInt32(buffer, 12);
        const ncmds = this.reader.readUInt32(buffer, 16);
        const sizeofcmds = this.reader.readUInt32(buffer, 20);
        const flags = this.reader.readUInt32(buffer, 24);
        const reserved = is64Bit ? this.reader.readUInt32(buffer, 28) : void 0;
        const cpuTypeName = this.getCPUTypeName(cputype);
        const fileTypeName = FILE_TYPE_MAP[filetype];
        const header = {
          magic,
          magicHex,
          cputype,
          cpusubtype,
          filetype,
          ncmds,
          sizeofcmds,
          flags,
          reserved,
          architecture: is64Bit ? "64bit" : "32bit",
          endianness: isLittleEndian ? "little" : "big",
          headerSize,
          cpuTypeName,
          fileTypeName
        };
        return header;
      }
      /**
       * Parse load commands from buffer
       */
      parseLoadCommands(buffer, header) {
        if (!this.reader) {
          throw new Error("Must call parseHeader before parseLoadCommands");
        }
        const commands = [];
        let offset = header.headerSize;
        for (let i = 0; i < header.ncmds; i++) {
          const cmd = this.reader.readUInt32(buffer, offset);
          const cmdsize = this.reader.readUInt32(buffer, offset + 4);
          commands.push({
            cmd,
            cmdsize,
            offset
          });
          offset += cmdsize;
        }
        return commands;
      }
      /**
       * Find encryption info in load commands
       */
      findEncryptionInfo(buffer, loadCommands) {
        if (!this.reader) {
          throw new Error("Must call parseHeader before findEncryptionInfo");
        }
        for (const lc of loadCommands) {
          if (lc.cmd === LoadCommandType.LC_ENCRYPTION_INFO || lc.cmd === LoadCommandType.LC_ENCRYPTION_INFO_64) {
            const cryptoff = this.reader.readUInt32(buffer, lc.offset + 8);
            const cryptsize = this.reader.readUInt32(buffer, lc.offset + 12);
            const cryptid = this.reader.readUInt32(buffer, lc.offset + 16);
            const cryptidOffset = lc.offset + 16;
            return {
              isEncrypted: cryptid !== 0,
              cryptid,
              cryptoff,
              cryptsize,
              cryptidOffset,
              loadCommandType: lc.cmd,
              loadCommandOffset: lc.offset
            };
          }
        }
        return null;
      }
      /**
       * Get CPU type name from CPU type value
       */
      getCPUTypeName(cputype) {
        switch (cputype) {
          case CPU_TYPE_ARM:
            return "ARM";
          case CPU_TYPE_ARM64:
            return "ARM64";
          case CPU_TYPE_ARM64_32:
            return "ARM64_32";
          case CPU_TYPE_X86:
            return "X86";
          case CPU_TYPE_X86_64:
            return "X86_64";
          default:
            return "Unknown";
        }
      }
      /**
       * Get the current byte reader (useful for external operations)
       */
      getReader() {
        return this.reader;
      }
    };
  }
});

// agent/iOS/Crypto/BinaryReader.ts
function getExportFunction(type, name2, ret, args) {
  const mod = Module;
  const resolver = typeof mod.getGlobalExportByName === "function" ? (sym) => mod.getGlobalExportByName(sym) : typeof mod.getExportByName === "function" ? (sym) => mod.getExportByName(null, sym) : typeof mod.findExportByName === "function" ? (sym) => mod.findExportByName(null, sym) : null;
  if (!resolver) {
    console.log("No suitable export resolver on Module");
    return null;
  }
  const nptr = resolver(name2);
  if (nptr === null || nptr.isNull()) {
    console.log("cannot find " + name2);
    return null;
  }
  if (type === "f") {
    if (!ret || !args) {
      throw new Error(`ret/args are required for function export ${name2}`);
    }
    const funclet = new NativeFunction(nptr, ret, args);
    if (typeof funclet === "undefined") {
      console.log("parse error " + name2);
      return null;
    }
    return funclet;
  }
  const datalet = nptr.readPointer();
  if (typeof datalet === "undefined") {
    console.log("parse error " + name2);
    return null;
  }
  return datalet;
}
var BinaryReader;
var init_BinaryReader = __esm({
  "agent/iOS/Crypto/BinaryReader.ts"() {
    "use strict";
    init_node_globals();
    init_frida_objc_bridge();
    init_logger();
    BinaryReader = class {
      /**
       * Get information about the main application bundle and executable
       */
      static getBundleInfo() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        const NSBundle = frida_objc_bridge_default.classes.NSBundle;
        const mainBundle = NSBundle.mainBundle();
        const bundlePath = mainBundle.bundlePath().toString();
        const bundleID = mainBundle.bundleIdentifier().toString();
        const infoDictionary = mainBundle.infoDictionary();
        const executableName = infoDictionary.objectForKey_("CFBundleExecutable").toString();
        const executablePath = `${bundlePath}/${executableName}`;
        const NSFileManager = frida_objc_bridge_default.classes.NSFileManager;
        const fileManager = NSFileManager.defaultManager();
        const attributes = fileManager.attributesOfItemAtPath_error_(executablePath, NULL);
        const fileSize = attributes ? attributes.objectForKey_("NSFileSize").intValue() : 0;
        log(`[BinaryReader] Bundle ID: ${bundleID}`);
        log(`[BinaryReader] Bundle Path: ${bundlePath}`);
        log(`[BinaryReader] Executable: ${executableName}`);
        log(`[BinaryReader] Executable Path: ${executablePath}`);
        log(`[BinaryReader] File Size: ${fileSize} bytes`);
        return {
          bundleId: bundleID,
          bundlePath,
          executableName,
          executablePath,
          fileSize
        };
      }
      /**
       * Read binary file from disk into a buffer
       */
      static readBinaryFile(path) {
        try {
          log(`[BinaryReader] Reading file using C API: ${path}`);
          const O_RDONLY = 0;
          const SEEK_END = 2;
          const SEEK_SET = 0;
          const open = getExportFunction("f", "open", "int", ["pointer", "int", "int"]);
          const read2 = getExportFunction("f", "read", "int", ["int", "pointer", "int"]);
          const close = getExportFunction("f", "close", "int", ["int"]);
          const lseek = getExportFunction("f", "lseek", "int64", ["int", "int64", "int"]);
          if (!open || !read2 || !close || !lseek) {
            throw new Error("Failed to resolve one or more libc symbols: open/read/close/lseek");
          }
          const pathPtr = Memory.allocUtf8String(path);
          const fd = open(pathPtr, O_RDONLY, 0);
          if (fd === -1) {
            throw new Error(`Failed to open file: ${path}`);
          }
          const fileSize = Number(lseek(fd, 0, SEEK_END));
          lseek(fd, 0, SEEK_SET);
          log(`[BinaryReader] File size: ${fileSize} bytes`);
          const buffer = Memory.alloc(fileSize);
          const bytesRead = read2(fd, buffer, fileSize);
          close(fd);
          if (bytesRead !== fileSize) {
            throw new Error(`Read ${bytesRead} bytes, expected ${fileSize}`);
          }
          const fileBytes = buffer.readByteArray(fileSize);
          if (!fileBytes) {
            throw new Error("Failed to read file data");
          }
          log(`[BinaryReader] Successfully read ${bytesRead} bytes`);
          return new Uint8Array(fileBytes);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`[BinaryReader] Error in readBinaryFile: ${errorMsg}`);
          if (error instanceof Error && error.stack) {
            log(`[BinaryReader] Stack trace: ${error.stack}`);
          }
          throw error;
        }
      }
      /**
       * Write buffer to file
       */
      static writeBinaryFile(path, buffer) {
        const O_WRONLY = 1;
        const O_CREAT = 512;
        const O_TRUNC = 1024;
        const flags = O_WRONLY | O_CREAT | O_TRUNC;
        const mode = 420;
        const open = getExportFunction("f", "open", "int", ["pointer", "int", "int"]);
        const write3 = getExportFunction("f", "write", "int", ["int", "pointer", "int"]);
        const close = getExportFunction("f", "close", "int", ["int"]);
        if (!open || !write3 || !close) {
          throw new Error("Failed to resolve libc symbols for writeBinaryFile (open/write/close)");
        }
        const pathPtr = Memory.allocUtf8String(path);
        const bufPtr = Memory.alloc(buffer.length);
        bufPtr.writeByteArray(Array.from(buffer));
        const fd = open(pathPtr, flags, mode);
        if (fd === -1) {
          throw new Error(`Failed to open output file for writing: ${path}`);
        }
        const bytesWritten = write3(fd, bufPtr, buffer.length);
        close(fd);
        if (bytesWritten !== buffer.length) {
          throw new Error(`Wrote ${bytesWritten} bytes, expected ${buffer.length}`);
        }
        log(`[BinaryReader] Wrote ${buffer.length} bytes to ${path}`);
        return true;
      }
      /**
       * Verify file exists and is readable
       */
      static verifyFile(path) {
        const O_RDONLY = 0;
        const open = getExportFunction("f", "open", "int", ["pointer", "int", "int"]);
        const close = getExportFunction("f", "close", "int", ["int"]);
        if (!open || !close) {
          throw new Error("Failed to resolve libc symbols for verifyFile (open/close)");
        }
        const pathPtr = Memory.allocUtf8String(path);
        const fd = open(pathPtr, O_RDONLY, 0);
        if (fd === -1) {
          return false;
        }
        close(fd);
        return true;
      }
      /**
       * Get file size without reading entire file
       */
      static getFileSize(path) {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        const NSFileManager = frida_objc_bridge_default.classes.NSFileManager;
        const fileManager = NSFileManager.defaultManager();
        const attributes = fileManager.attributesOfItemAtPath_error_(path, NULL);
        if (!attributes || attributes.isNil()) {
          throw new Error(`Failed to get file attributes: ${path}`);
        }
        return attributes.objectForKey_("NSFileSize").intValue();
      }
    };
  }
});

// agent/iOS/Crypto/MemoryDumper.ts
var MemoryDumper;
var init_MemoryDumper = __esm({
  "agent/iOS/Crypto/MemoryDumper.ts"() {
    "use strict";
    init_node_globals();
    init_logger();
    MemoryDumper = class {
      /**
       * Find module by name in loaded modules
       */
      static findModule(moduleName) {
        const module = Process.findModuleByName(moduleName);
        if (module) {
          log(`[MemoryDumper] Found module: ${moduleName}`);
          log(`[MemoryDumper] Base address: ${module.base}`);
          log(`[MemoryDumper] Size: ${module.size} bytes`);
          log(`[MemoryDumper] Path: ${module.path}`);
        } else {
          log(`[MemoryDumper] Module not found: ${moduleName}`);
        }
        return module;
      }
      /**
       * Read decrypted data from memory at specified offset and size
       */
      static readMemoryRegion(moduleName, offset, size) {
        const module = this.findModule(moduleName);
        if (!module) {
          throw new Error(`Module not found: ${moduleName}`);
        }
        const address = module.base.add(offset);
        log(`[MemoryDumper] Reading ${size} bytes from ${address}`);
        const memoryData = address.readByteArray(size);
        if (!memoryData) {
          throw new Error(`Failed to read memory at ${address}`);
        }
        const region = {
          address: address.toString(),
          size,
          offset,
          module: moduleName,
          protection: this.getMemoryProtection(address)
        };
        log(`[MemoryDumper] Successfully read ${size} bytes`);
        log(`[MemoryDumper] Protection: ${region.protection}`);
        return {
          data: new Uint8Array(memoryData),
          region
        };
      }
      /**
       * Get memory protection flags for an address
       */
      static getMemoryProtection(address) {
        try {
          const range = Process.findRangeByAddress(address);
          if (range) {
            return range.protection;
          }
        } catch (e) {
          log(`[MemoryDumper] Failed to get memory protection: ${e}`);
        }
        return "unknown";
      }
      /**
       * Verify memory region is accessible before reading
       */
      static verifyMemoryAccess(address, size) {
        try {
          const range = Process.findRangeByAddress(address);
          if (!range) {
            log(`[MemoryDumper] Address ${address} is not in a valid memory range`);
            return false;
          }
          const endAddress = address.add(size);
          const rangeEnd = range.base.add(range.size);
          if (endAddress.compare(rangeEnd) > 0) {
            log(`[MemoryDumper] Region extends beyond valid range`);
            return false;
          }
          if (!range.protection.includes("r")) {
            log(`[MemoryDumper] Memory is not readable (protection: ${range.protection})`);
            return false;
          }
          return true;
        } catch (e) {
          log(`[MemoryDumper] Memory verification failed: ${e}`);
          return false;
        }
      }
      /**
       * Get all loaded modules (useful for debugging)
       */
      static getAllModules() {
        return Process.enumerateModules();
      }
      /**
       * Find module by address
       */
      static findModuleByAddress(address) {
        try {
          return Process.findModuleByAddress(address);
        } catch (e) {
          log(`[MemoryDumper] Failed to find module by address: ${e}`);
          return null;
        }
      }
      /**
       * Calculate memory checksum (simple validation)
       */
      static calculateChecksum(data) {
        let checksum = 0;
        for (let i = 0; i < data.length; i++) {
          checksum = checksum + data[i] & 4294967295;
        }
        return checksum >>> 0;
      }
      /**
       * Compare two memory regions for equality
       */
      static compareMemoryRegions(data1, data2) {
        if (data1.length !== data2.length) {
          return false;
        }
        for (let i = 0; i < data1.length; i++) {
          if (data1[i] !== data2[i]) {
            return false;
          }
        }
        return true;
      }
      /**
       * Get memory statistics for a region
       */
      static getMemoryStats(data) {
        let zeroBytes = 0;
        let nonZeroBytes = 0;
        for (let i = 0; i < data.length; i++) {
          if (data[i] === 0) {
            zeroBytes++;
          } else {
            nonZeroBytes++;
          }
        }
        return {
          size: data.length,
          checksum: this.calculateChecksum(data),
          zeroBytes,
          nonZeroBytes
        };
      }
    };
  }
});

// agent/iOS/Crypto/DecryptionOrchestrator.ts
var DecryptionOrchestrator;
var init_DecryptionOrchestrator = __esm({
  "agent/iOS/Crypto/DecryptionOrchestrator.ts"() {
    "use strict";
    init_node_globals();
    init_parser();
    init_BinaryReader();
    init_MemoryDumper();
    init_logger();
    DecryptionOrchestrator = class {
      parser;
      progressCallback;
      constructor(progressCallback) {
        this.parser = new MachOParser();
        this.progressCallback = progressCallback;
      }
      /**
       * Report progress
       */
      reportProgress(step, message, progress) {
        log(`[Decrypt] [${step}] ${message}`);
        if (this.progressCallback) {
          this.progressCallback(step, message, progress);
        }
      }
      /**
       * Main decryption method
       */
      async decrypt(options = {}) {
        try {
          this.reportProgress("init", "Initializing decryption process", 5);
          this.reportProgress("read_binary", "Reading application bundle info", 10);
          const binaryInfo = BinaryReader.getBundleInfo();
          this.reportProgress("parse_header", "Reading original binary", 20);
          const binaryBuffer = BinaryReader.readBinaryFile(binaryInfo.executablePath);
          log(`[Decrypt] Binary size: ${binaryBuffer.length} bytes`);
          this.reportProgress("parse_header", "Parsing Mach-O header", 30);
          let header;
          try {
            log(`[Decrypt] About to parse header, buffer length: ${binaryBuffer.length}`);
            header = this.parser.parseHeader(binaryBuffer);
            log(`[Decrypt] Header parsed successfully`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log(`[Decrypt] Parse header error: ${errorMsg}`);
            if (error instanceof Error && error.stack) {
              log(`[Decrypt] Stack: ${error.stack}`);
            }
            throw error;
          }
          log(`[Decrypt] Architecture: ${header.architecture}`);
          log(`[Decrypt] Endianness: ${header.endianness}`);
          log(`[Decrypt] CPU Type: ${header.cpuTypeName}`);
          log(`[Decrypt] File Type: ${header.fileTypeName}`);
          this.reportProgress("parse_load_commands", "Parsing load commands", 40);
          const loadCommands = this.parser.parseLoadCommands(binaryBuffer, header);
          log(`[Decrypt] Found ${loadCommands.length} load commands`);
          this.reportProgress("find_encryption_info", "Finding encryption info", 50);
          const encryptionInfo = this.parser.findEncryptionInfo(binaryBuffer, loadCommands);
          if (!encryptionInfo) {
            throw new Error("No encryption info found in binary");
          }
          log(`[Decrypt] Encryption Info:`);
          log(`[Decrypt]   cryptoff: 0x${encryptionInfo.cryptoff.toString(16)}`);
          log(`[Decrypt]   cryptsize: ${encryptionInfo.cryptsize} bytes`);
          log(`[Decrypt]   cryptid: ${encryptionInfo.cryptid}`);
          log(`[Decrypt]   cryptid offset: 0x${encryptionInfo.cryptidOffset.toString(16)}`);
          this.reportProgress("validate_encryption", "Validating encryption status", 55);
          if (!options.skipEncryptionCheck && encryptionInfo.cryptid === 0) {
            throw new Error("Binary is not encrypted (cryptid = 0)");
          }
          this.reportProgress("locate_memory", "Locating decrypted memory", 60);
          this.reportProgress("dump_decrypted_memory", "Dumping decrypted data", 70);
          const { data: decryptedData, region } = MemoryDumper.readMemoryRegion(binaryInfo.executableName, encryptionInfo.cryptoff, encryptionInfo.cryptsize);
          log(`[Decrypt] Dumped ${decryptedData.length} bytes from memory`);
          log(`[Decrypt] Memory region: ${region.address} (${region.protection})`);
          const outputBuffer = new Uint8Array(binaryBuffer);
          log(`[Decrypt] Replacing encrypted section with decrypted data...`);
          outputBuffer.set(decryptedData, encryptionInfo.cryptoff);
          this.reportProgress("patch_cryptid", "Patching cryptid field", 80);
          const reader = this.parser.getReader();
          if (!reader) {
            throw new Error("Parser reader not initialized");
          }
          reader.writeUInt32(outputBuffer, encryptionInfo.cryptidOffset, 0);
          log(`[Decrypt] Patched cryptid to 0 at offset 0x${encryptionInfo.cryptidOffset.toString(16)}`);
          this.reportProgress("write_output", "Writing decrypted binary to disk", 90);
          const outputPath = options.outputPath || `/tmp/${binaryInfo.executableName}.decrypted`;
          BinaryReader.writeBinaryFile(outputPath, outputBuffer);
          log(`[Decrypt] Decrypted binary written to: ${outputPath}`);
          this.reportProgress("verify_output", "Verifying output", 95);
          let verificationPassed = true;
          if (options.verify !== false) {
            verificationPassed = BinaryReader.verifyFile(outputPath);
            const outputSize = BinaryReader.getFileSize(outputPath);
            if (outputSize !== binaryBuffer.length) {
              log(`[Decrypt] Warning: Output size mismatch (${outputSize} vs ${binaryBuffer.length})`);
              verificationPassed = false;
            } else {
              log(`[Decrypt] Verification passed: Size matches (${outputSize} bytes)`);
            }
          }
          this.reportProgress("complete", "Decryption complete", 100);
          return {
            success: true,
            outputPath,
            originalSize: binaryBuffer.length,
            decryptedSize: outputBuffer.length,
            bytesDecrypted: encryptionInfo.cryptsize,
            cryptidPatched: true,
            patchedCryptidValue: 0,
            verificationPassed
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.reportProgress("failed", errorMsg);
          return {
            success: false,
            outputPath: "",
            originalSize: 0,
            decryptedSize: 0,
            bytesDecrypted: 0,
            cryptidPatched: false,
            error: errorMsg,
            verificationPassed: false
          };
        }
      }
      /**
       * Get encryption status without performing decryption
       */
      async getEncryptionStatus() {
        const binaryInfo = BinaryReader.getBundleInfo();
        const binaryBuffer = BinaryReader.readBinaryFile(binaryInfo.executablePath);
        const header = this.parser.parseHeader(binaryBuffer);
        const loadCommands = this.parser.parseLoadCommands(binaryBuffer, header);
        const encryption = this.parser.findEncryptionInfo(binaryBuffer, loadCommands);
        return {
          binary: binaryInfo,
          header,
          encryption
        };
      }
      /**
       * Validate binary is decryptable
       */
      async validateBinary() {
        const errors2 = [];
        const warnings = [];
        try {
          const { binary, header, encryption } = await this.getEncryptionStatus();
          if (!encryption) {
            errors2.push("No encryption info found in binary");
          } else {
            if (encryption.cryptid === 0) {
              warnings.push("Binary appears to be already decrypted (cryptid = 0)");
            }
            if (encryption.cryptsize === 0) {
              errors2.push("Encrypted section size is 0");
            }
            if (encryption.cryptsize > binary.fileSize) {
              errors2.push("Encrypted section size exceeds file size");
            }
          }
          const module = MemoryDumper.findModule(binary.executableName);
          if (!module) {
            errors2.push(`Module not found in memory: ${binary.executableName}`);
          }
          if (header.cpuTypeName === "Unknown") {
            warnings.push(`Unknown CPU type: 0x${header.cputype.toString(16)}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors2.push(`Validation failed: ${errorMsg}`);
        }
        return {
          valid: errors2.length === 0,
          errors: errors2,
          warnings
        };
      }
    };
  }
});

// agent/iOS/Crypto/iOSDecryptModule.ts
var iOSDecryptModule;
var init_iOSDecryptModule = __esm({
  "agent/iOS/Crypto/iOSDecryptModule.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_frida_objc_bridge();
    init_DecryptionOrchestrator();
    init_BinaryReader();
    init_parser();
    iOSDecryptModule = class extends BaseModule {
      state;
      orchestrator;
      constructor() {
        super({
          name: "iOSDecrypt",
          version: "2.0.0",
          platform: "ios",
          category: "crypto",
          description: "iOS IPA binary decryption module with modular architecture"
        });
        this.state = {
          isDecrypting: false,
          progress: []
        };
        this.orchestrator = new DecryptionOrchestrator((step, message, progress) => this.addProgress(step, message, progress));
      }
      async onInitialize() {
        if (!frida_objc_bridge_default.available) {
          throw new Error("ObjC runtime not available");
        }
        log("[iOSDecrypt] Module initialized (v2.0.0 - Modular)");
      }
      async onShutdown() {
        log("[iOSDecrypt] Module shutdown");
        this.state.isDecrypting = false;
      }
      registerFunctions() {
        this.registry.registerBoth("decrypt_ipa", (args) => this.decryptIPA(args || {}));
        this.registry.registerBoth("get_decrypt_status", () => this.getStatus());
        this.registry.registerBoth("get_encryption_info", () => this.getEncryptionInfo());
        this.registry.registerBoth("validate_binary", () => this.validateBinary());
        this.registry.registerBoth("get_bundle_info", () => this.getBundleInfo());
        this.registry.registerBoth("parse_and_decrypt_ipa", (args) => this.parseAndDecryptIPA(args || {}));
      }
      /**
       * Main decryption function
       */
      async decryptIPA(options = {}) {
        log("[iOSDecrypt] Starting IPA decryption...");
        if (!frida_objc_bridge_default.available) {
          return {
            success: false,
            message: "ObjC runtime not available",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
        if (this.state.isDecrypting) {
          return {
            success: false,
            message: "Decryption already in progress",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
        this.state.isDecrypting = true;
        this.state.progress = [];
        this.state.error = void 0;
        try {
          const result2 = await this.orchestrator.decrypt(options);
          this.state.result = result2;
          if (result2.success) {
            return {
              success: true,
              data: result2,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            };
          } else {
            this.state.error = result2.error;
            return {
              success: false,
              message: result2.error,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.state.error = errorMsg;
          this.addProgress("failed", errorMsg);
          return {
            success: false,
            message: errorMsg,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } finally {
          this.state.isDecrypting = false;
        }
      }
      /**
       * Get encryption status without decrypting
       */
      async getEncryptionInfo() {
        try {
          const status = await this.orchestrator.getEncryptionStatus();
          return {
            success: true,
            data: status,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            message: errorMsg,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
      /**
       * Validate binary is decryptable
       */
      async validateBinary() {
        try {
          const validation = await this.orchestrator.validateBinary();
          return {
            success: true,
            data: validation,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            message: errorMsg,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
      /**
       * Get bundle information
       */
      getBundleInfo() {
        try {
          const info = BinaryReader.getBundleInfo();
          return {
            success: true,
            data: info,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            message: errorMsg,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
      /**
       * Step-by-step parse and decrypt with verbose debug output for manual invocation
       */
      async parseAndDecryptIPA(options = {}) {
        const steps = [];
        const logStep = (step, success, data, error) => {
          log(`[ParseAndDecrypt] [${step}] ${success ? "OK" : "FAILED"}${error ? ": " + error : ""}`);
          steps.push({ step, success, data, error });
        };
        try {
          let bundleInfo;
          try {
            bundleInfo = BinaryReader.getBundleInfo();
            logStep("bundle_info", true, bundleInfo);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logStep("bundle_info", false, void 0, msg);
            return { success: false, data: { steps }, message: `Failed at bundle_info: ${msg}`, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
          }
          let binaryBuffer;
          try {
            binaryBuffer = BinaryReader.readBinaryFile(bundleInfo.executablePath);
            logStep("read_binary", true, { size: binaryBuffer.length });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logStep("read_binary", false, void 0, msg);
            return { success: false, data: { steps, bundleInfo }, message: `Failed at read_binary: ${msg}`, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
          }
          let header;
          try {
            const parser = new MachOParser();
            header = parser.parseHeader(binaryBuffer);
            logStep("parse_header", true, {
              architecture: header.architecture,
              endianness: header.endianness,
              cpuType: header.cpuTypeName,
              fileType: header.fileTypeName,
              ncmds: header.ncmds,
              sizeofcmds: header.sizeofcmds
            });
            const loadCommands = parser.parseLoadCommands(binaryBuffer, header);
            logStep("parse_load_commands", true, { count: loadCommands.length });
            const encryptionInfo = parser.findEncryptionInfo(binaryBuffer, loadCommands);
            if (encryptionInfo) {
              logStep("find_encryption_info", true, {
                cryptoff: "0x" + encryptionInfo.cryptoff.toString(16),
                cryptsize: encryptionInfo.cryptsize,
                cryptid: encryptionInfo.cryptid,
                isEncrypted: encryptionInfo.isEncrypted
              });
            } else {
              logStep("find_encryption_info", true, { found: false, message: "No encryption info in binary" });
            }
            if (encryptionInfo && (encryptionInfo.cryptid !== 0 || options.skipEncryptionCheck)) {
              logStep("starting_decryption", true, { message: "Proceeding with full decryption via orchestrator" });
              const result2 = await this.orchestrator.decrypt(options);
              logStep("decryption_result", result2.success, result2, result2.error);
              return {
                success: result2.success,
                data: { steps, result: result2 },
                message: result2.success ? "Decryption completed successfully" : result2.error,
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              };
            } else {
              logStep("skip_decryption", true, {
                reason: encryptionInfo ? "Binary already decrypted (cryptid=0)" : "No encryption info found"
              });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logStep("parse_or_decrypt", false, void 0, msg);
            return { success: false, data: { steps, bundleInfo }, message: `Failed: ${msg}`, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
          }
          return {
            success: true,
            data: { steps },
            message: "Parse and analysis completed",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { success: false, data: { steps }, message: msg, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
        }
      }
      /**
       * Get current decryption status
       */
      getStatus() {
        return {
          success: true,
          data: { ...this.state },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      /**
       * Add progress entry
       */
      addProgress(step, message, progress) {
        const progressEntry = {
          step,
          stepsCompleted: this.state.progress.map((p) => p.step),
          currentOperation: message,
          progress,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.state.progress.push(progressEntry);
        this.state.currentOperation = message;
      }
    };
  }
});

// agent/modules/FileBrowserModule.ts
function resolveExport2(moduleName, symbolName) {
  const mod = Module;
  try {
    if (typeof mod.getGlobalExportByName === "function")
      return mod.getGlobalExportByName(symbolName);
    if (typeof mod.getExportByName === "function")
      return mod.getExportByName(moduleName, symbolName);
    if (typeof mod.findExportByName === "function")
      return mod.findExportByName(moduleName, symbolName);
  } catch (e) {
  }
  return null;
}
var MAX_ENTRIES, MAX_FILE_READ, MAX_BINARY_DOWNLOAD, FileBrowserModule;
var init_FileBrowserModule = __esm({
  "agent/modules/FileBrowserModule.ts"() {
    "use strict";
    init_node_globals();
    init_BaseModule();
    init_logger();
    init_Platform();
    init_frida_objc_bridge();
    init_frida_java_bridge();
    MAX_ENTRIES = 500;
    MAX_FILE_READ = 1024 * 1024;
    MAX_BINARY_DOWNLOAD = 50 * 1024 * 1024;
    FileBrowserModule = class extends BaseModule {
      constructor() {
        super({
          name: "FileBrowser",
          version: "1.0.0",
          platform: "cross-platform",
          category: "filesystem",
          description: "Browse and download files from the target device"
        });
      }
      async onInitialize() {
        log("[FileBrowser] Module initialized");
      }
      async onShutdown() {
        log("[FileBrowser] Module shutdown");
      }
      registerFunctions() {
        this.registry.registerBoth("listDirectory", (path) => this.listDirectory(path));
        this.registry.registerBoth("readFile", (path, offset, length) => this.readFile(path, offset, length));
        this.registry.registerBoth("downloadFile", (path) => this.downloadFile(path));
        this.registry.registerBoth("getFileInfo", (path) => this.getFileInfo(path));
        this.registry.registerBoth("searchFiles", (basePath, pattern, maxDepth) => this.searchFiles(basePath, pattern, maxDepth));
        this.registry.registerBoth("getAppPaths", () => this.getAppPaths());
        this.registry.registerBoth("writeFile", (path, dataBase64) => this.writeFile(path, dataBase64));
        this.registry.registerBoth("deleteFile", (path) => this.deleteFile(path));
        this.registry.registerBoth("createDirectory", (path) => this.createDirectory(path));
      }
      // ─── Directory Listing ─────────────────────────────────────────────
      listDirectory(path) {
        try {
          if (!path) {
            return { success: false, error: "Path is required" };
          }
          path = this.normalizePath(path);
          if (PlatformDetector.isIOS()) {
            return this.listDirectoryIOS(path);
          } else if (PlatformDetector.isAndroid()) {
            return this.listDirectoryAndroid(path);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] listDirectory failed", e);
          return { success: false, error: e.message };
        }
      }
      listDirectoryIOS(path) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        const isDir = Memory.alloc(Process.pointerSize);
        isDir.writeU8(0);
        const exists = fm.fileExistsAtPath_isDirectory_(nsPath, isDir);
        if (!exists) {
          return { success: false, error: `Path does not exist: ${path}` };
        }
        const contents = fm.contentsOfDirectoryAtPath_error_(nsPath, NULL);
        if (!contents) {
          return { success: false, error: `Cannot read directory: ${path}` };
        }
        const count = contents.count();
        const entries = [];
        const truncated = count > MAX_ENTRIES;
        for (let i = 0; i < Math.min(count, MAX_ENTRIES); i++) {
          const name2 = contents.objectAtIndex_(i).toString();
          const fullPath = path.endsWith("/") ? path + name2 : path + "/" + name2;
          const entry = this.getFileEntryIOS(fm, name2, fullPath);
          if (entry)
            entries.push(entry);
        }
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory)
            return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        const parentPath = path === "/" ? null : path.replace(/\/[^/]+\/?$/, "") || "/";
        return {
          success: true,
          data: {
            path,
            entries,
            parentPath,
            totalEntries: count,
            truncated
          }
        };
      }
      getFileEntryIOS(fm, name2, fullPath) {
        try {
          const nsFullPath = frida_objc_bridge_default.classes.NSString.stringWithString_(fullPath);
          const attrs = fm.attributesOfItemAtPath_error_(nsFullPath, NULL);
          let size = 0;
          let isDirectory = false;
          let isSymlink = false;
          let permissions = "";
          let modified;
          let owner2;
          if (attrs) {
            try {
              const sizeObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileSize"));
              if (sizeObj)
                size = parseInt(sizeObj.toString(), 10) || 0;
            } catch (e) {
            }
            try {
              const typeObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileType"));
              if (typeObj) {
                const typeStr = typeObj.toString();
                isDirectory = typeStr === "NSFileTypeDirectory";
                isSymlink = typeStr === "NSFileTypeSymbolicLink";
              }
            } catch (e) {
            }
            try {
              const posixObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFilePosixPermissions"));
              if (posixObj) {
                const posixNum = parseInt(posixObj.toString(), 10);
                permissions = posixNum.toString(8);
              }
            } catch (e) {
            }
            try {
              const dateObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileModificationDate"));
              if (dateObj) {
                const interval = new frida_objc_bridge_default.Object(dateObj).timeIntervalSince1970();
                modified = new Date(interval * 1e3).toISOString();
              }
            } catch (e) {
            }
            try {
              const ownerObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileOwnerAccountName"));
              if (ownerObj)
                owner2 = ownerObj.toString();
            } catch (e) {
            }
          }
          return { name: name2, path: fullPath, size, isDirectory, isSymlink, permissions, modified, owner: owner2 };
        } catch (e) {
          return { name: name2, path: fullPath, size: 0, isDirectory: false, isSymlink: false };
        }
      }
      listDirectoryAndroid(path) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const dir = File2.$new(path);
            if (!dir.exists()) {
              result2 = { success: false, error: `Path does not exist: ${path}` };
              return;
            }
            if (!dir.isDirectory()) {
              result2 = { success: false, error: `Not a directory: ${path}` };
              return;
            }
            const files = dir.listFiles();
            const entries = [];
            let totalEntries = 0;
            let truncated = false;
            if (files !== null) {
              totalEntries = files.length;
              truncated = totalEntries > MAX_ENTRIES;
              for (let i = 0; i < Math.min(totalEntries, MAX_ENTRIES); i++) {
                const f2 = files[i];
                const entry = {
                  name: f2.getName(),
                  path: f2.getAbsolutePath(),
                  size: f2.length(),
                  isDirectory: f2.isDirectory(),
                  isSymlink: false,
                  modified: new Date(f2.lastModified()).toISOString(),
                  permissions: this.getAndroidPermissions(f2)
                };
                entries.push(entry);
              }
            }
            entries.sort((a, b) => {
              if (a.isDirectory !== b.isDirectory)
                return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
            const parentPath = path === "/" ? null : dir.getParent();
            result2 = {
              success: true,
              data: {
                path,
                entries,
                parentPath,
                totalEntries,
                truncated
              }
            };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      getAndroidPermissions(file) {
        try {
          const perms = [];
          if (file.canRead())
            perms.push("r");
          if (file.canWrite())
            perms.push("w");
          if (file.canExecute())
            perms.push("x");
          return perms.join("");
        } catch (e) {
          return "";
        }
      }
      // ─── Read File (text) ──────────────────────────────────────────────
      readFile(path, offset, length) {
        try {
          if (!path)
            return { success: false, error: "Path is required" };
          path = this.normalizePath(path);
          const readLength = Math.min(length || MAX_FILE_READ, MAX_FILE_READ);
          const readOffset = offset || 0;
          if (PlatformDetector.isIOS()) {
            return this.readFileIOS(path, readOffset, readLength);
          } else if (PlatformDetector.isAndroid()) {
            return this.readFileAndroid(path, readOffset, readLength);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] readFile failed", e);
          return { success: false, error: e.message };
        }
      }
      readFileIOS(path, offset, length) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        if (!fm.fileExistsAtPath_(nsPath)) {
          return { success: false, error: `File not found: ${path}` };
        }
        const attrs = fm.attributesOfItemAtPath_error_(nsPath, NULL);
        let fileSize = 0;
        if (attrs) {
          const sizeObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileSize"));
          if (sizeObj)
            fileSize = parseInt(sizeObj.toString(), 10) || 0;
        }
        const data = frida_objc_bridge_default.classes.NSData.dataWithContentsOfFile_(nsPath);
        if (!data) {
          return { success: false, error: `Cannot read file: ${path}` };
        }
        const totalLength = data.length();
        const actualOffset = Math.min(offset, totalLength);
        const actualLength = Math.min(length, totalLength - actualOffset);
        let content = null;
        let encoding = "utf-8";
        try {
          if (actualOffset === 0 && actualLength >= totalLength) {
            const nsStr = frida_objc_bridge_default.classes.NSString.alloc().initWithData_encoding_(data, 4);
            if (nsStr) {
              content = nsStr.toString();
              if (content.length > length) {
                content = content.substring(0, length);
              }
            }
          } else {
            const range = [actualOffset, actualLength];
            const subdata = data.subdataWithRange_(range);
            if (subdata) {
              const nsStr = frida_objc_bridge_default.classes.NSString.alloc().initWithData_encoding_(subdata, 4);
              if (nsStr)
                content = nsStr.toString();
            }
          }
        } catch (e) {
          encoding = "binary";
        }
        if (content === null) {
          encoding = "base64";
          try {
            content = data.base64EncodedStringWithOptions_(0).toString();
            if (offset > 0 || length < totalLength) {
              content = content.substring(0, Math.ceil(actualLength * 4 / 3));
            }
          } catch (e) {
            return { success: false, error: "Cannot read file content" };
          }
        }
        const finalContent = content;
        return {
          success: true,
          data: {
            path,
            content: finalContent,
            encoding,
            size: fileSize,
            offset: actualOffset,
            length: finalContent.length,
            totalSize: totalLength,
            truncated: actualLength < totalLength
          }
        };
      }
      readFileAndroid(path, offset, length) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const FileInputStream = frida_java_bridge_default.use("java.io.FileInputStream");
            const ByteArrayOutputStream = frida_java_bridge_default.use("java.io.ByteArrayOutputStream");
            const file = File2.$new(path);
            if (!file.exists()) {
              result2 = { success: false, error: `File not found: ${path}` };
              return;
            }
            const fileSize = file.length();
            const fis = FileInputStream.$new(file);
            if (offset > 0) {
              fis.skip(offset);
            }
            const buffer = frida_java_bridge_default.array("byte", new Array(4096).fill(0));
            const baos = ByteArrayOutputStream.$new();
            let totalRead = 0;
            while (totalRead < length) {
              const toRead = Math.min(4096, length - totalRead);
              const bytesRead = fis.read(buffer, 0, toRead);
              if (bytesRead === -1)
                break;
              baos.write(buffer, 0, bytesRead);
              totalRead += bytesRead;
            }
            fis.close();
            const bytes = baos.toByteArray();
            let content;
            let encoding;
            try {
              const str = frida_java_bridge_default.use("java.lang.String").$new(bytes, "UTF-8");
              content = str.toString();
              encoding = "utf-8";
              let nonPrintable = 0;
              const sampleLen = Math.min(content.length, 512);
              for (let i = 0; i < sampleLen; i++) {
                const code5 = content.charCodeAt(i);
                if (code5 < 32 && code5 !== 9 && code5 !== 10 && code5 !== 13)
                  nonPrintable++;
              }
              if (sampleLen > 0 && nonPrintable / sampleLen > 0.1) {
                throw new Error("Binary content");
              }
            } catch (e) {
              const Base64 = frida_java_bridge_default.use("android.util.Base64");
              content = Base64.encodeToString(bytes, 2);
              encoding = "base64";
            }
            baos.close();
            result2 = {
              success: true,
              data: {
                path,
                content,
                encoding,
                size: fileSize,
                offset,
                length: totalRead,
                totalSize: fileSize,
                truncated: offset + totalRead < fileSize
              }
            };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── Download File (base64) ────────────────────────────────────────
      downloadFile(path) {
        try {
          if (!path)
            return { success: false, error: "Path is required" };
          path = this.normalizePath(path);
          if (PlatformDetector.isIOS()) {
            return this.downloadFileIOS(path);
          } else if (PlatformDetector.isAndroid()) {
            return this.downloadFileAndroid(path);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] downloadFile failed", e);
          return { success: false, error: e.message };
        }
      }
      downloadFileIOS(path) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        if (!fm.fileExistsAtPath_(nsPath)) {
          return { success: false, error: `File not found: ${path}` };
        }
        const attrs = fm.attributesOfItemAtPath_error_(nsPath, NULL);
        let fileSize = 0;
        if (attrs) {
          const sizeObj = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_("NSFileSize"));
          if (sizeObj)
            fileSize = parseInt(sizeObj.toString(), 10) || 0;
        }
        if (fileSize > MAX_BINARY_DOWNLOAD) {
          return {
            success: false,
            error: `File too large (${this.formatSize(fileSize)}). Max download size: ${this.formatSize(MAX_BINARY_DOWNLOAD)}`
          };
        }
        const data = frida_objc_bridge_default.classes.NSData.dataWithContentsOfFile_(nsPath);
        if (!data) {
          return { success: false, error: `Cannot read file: ${path}` };
        }
        const base64 = data.base64EncodedStringWithOptions_(0).toString();
        const fileName = path.split("/").pop() || "file";
        return {
          success: true,
          data: {
            path,
            fileName,
            size: fileSize,
            base64,
            mimeType: this.guessMimeType(fileName)
          }
        };
      }
      downloadFileAndroid(path) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const FileInputStream = frida_java_bridge_default.use("java.io.FileInputStream");
            const ByteArrayOutputStream = frida_java_bridge_default.use("java.io.ByteArrayOutputStream");
            const Base64 = frida_java_bridge_default.use("android.util.Base64");
            const file = File2.$new(path);
            if (!file.exists()) {
              result2 = { success: false, error: `File not found: ${path}` };
              return;
            }
            const fileSize = file.length();
            if (fileSize > MAX_BINARY_DOWNLOAD) {
              result2 = {
                success: false,
                error: `File too large (${fileSize} bytes). Max: ${MAX_BINARY_DOWNLOAD}`
              };
              return;
            }
            const fis = FileInputStream.$new(file);
            const baos = ByteArrayOutputStream.$new();
            const buffer = frida_java_bridge_default.array("byte", new Array(8192).fill(0));
            let bytesRead;
            while ((bytesRead = fis.read(buffer)) !== -1) {
              baos.write(buffer, 0, bytesRead);
            }
            fis.close();
            const bytes = baos.toByteArray();
            const base64 = Base64.encodeToString(bytes, 2);
            baos.close();
            const fileName = file.getName();
            result2 = {
              success: true,
              data: {
                path,
                fileName,
                size: fileSize,
                base64,
                mimeType: this.guessMimeType(fileName)
              }
            };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── File Info ─────────────────────────────────────────────────────
      getFileInfo(path) {
        try {
          if (!path)
            return { success: false, error: "Path is required" };
          path = this.normalizePath(path);
          if (PlatformDetector.isIOS()) {
            return this.getFileInfoIOS(path);
          } else if (PlatformDetector.isAndroid()) {
            return this.getFileInfoAndroid(path);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] getFileInfo failed", e);
          return { success: false, error: e.message };
        }
      }
      getFileInfoIOS(path) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        if (!fm.fileExistsAtPath_(nsPath)) {
          return { success: false, error: `Path not found: ${path}` };
        }
        const attrs = fm.attributesOfItemAtPath_error_(nsPath, NULL);
        if (!attrs) {
          return { success: false, error: `Cannot get attributes for: ${path}` };
        }
        const info = { path };
        const attrKeys = {
          "NSFileSize": "size",
          "NSFileType": "type",
          "NSFileModificationDate": "modified",
          "NSFileCreationDate": "created",
          "NSFilePosixPermissions": "posixPermissions",
          "NSFileOwnerAccountName": "owner",
          "NSFileGroupOwnerAccountName": "group",
          "NSFileProtectionKey": "protection",
          "NSFileExtensionHidden": "extensionHidden"
        };
        for (const [nsKey, infoKey] of Object.entries(attrKeys)) {
          try {
            const val = attrs.objectForKey_(frida_objc_bridge_default.classes.NSString.stringWithString_(nsKey));
            if (val) {
              if (nsKey.includes("Date")) {
                const d = new frida_objc_bridge_default.Object(val);
                info[infoKey] = new Date(d.timeIntervalSince1970() * 1e3).toISOString();
              } else if (nsKey === "NSFilePosixPermissions") {
                info[infoKey] = parseInt(val.toString(), 10).toString(8);
              } else {
                info[infoKey] = val.toString();
              }
            }
          } catch (e) {
          }
        }
        info.readable = fm.isReadableFileAtPath_(nsPath);
        info.writable = fm.isWritableFileAtPath_(nsPath);
        info.executable = fm.isExecutableFileAtPath_(nsPath);
        if (info.type === "NSFileTypeSymbolicLink") {
          try {
            const resolved = fm.destinationOfSymbolicLinkAtPath_error_(nsPath, NULL);
            if (resolved)
              info.symlinkTarget = resolved.toString();
          } catch (e) {
          }
        }
        info.isDirectory = info.type === "NSFileTypeDirectory";
        info.fileName = path.split("/").pop() || "";
        info.sizeFormatted = this.formatSize(info.size || 0);
        return { success: true, data: info };
      }
      getFileInfoAndroid(path) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const file = File2.$new(path);
            if (!file.exists()) {
              result2 = { success: false, error: `Path not found: ${path}` };
              return;
            }
            const info = {
              path: file.getAbsolutePath(),
              fileName: file.getName(),
              size: file.length(),
              sizeFormatted: this.formatSize(file.length()),
              isDirectory: file.isDirectory(),
              isFile: file.isFile(),
              isHidden: file.isHidden(),
              readable: file.canRead(),
              writable: file.canWrite(),
              executable: file.canExecute(),
              modified: new Date(file.lastModified()).toISOString(),
              parentPath: file.getParent()
            };
            result2 = { success: true, data: info };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── Search Files ──────────────────────────────────────────────────
      searchFiles(basePath, pattern, maxDepth) {
        try {
          if (!basePath || !pattern) {
            return { success: false, error: "basePath and pattern are required" };
          }
          basePath = this.normalizePath(basePath);
          const depth = maxDepth || 3;
          if (PlatformDetector.isIOS()) {
            return this.searchFilesIOS(basePath, pattern, depth);
          } else if (PlatformDetector.isAndroid()) {
            return this.searchFilesAndroid(basePath, pattern, depth);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] searchFiles failed", e);
          return { success: false, error: e.message };
        }
      }
      searchFilesIOS(basePath, pattern, maxDepth) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const results = [];
        const regex = this.patternToRegex(pattern);
        const maxResults = 200;
        const search = (dirPath, currentDepth) => {
          if (currentDepth > maxDepth || results.length >= maxResults)
            return;
          try {
            const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(dirPath);
            const contents = fm.contentsOfDirectoryAtPath_error_(nsPath, NULL);
            if (!contents)
              return;
            const count = contents.count();
            for (let i = 0; i < count && results.length < maxResults; i++) {
              const name2 = contents.objectAtIndex_(i).toString();
              const fullPath = dirPath.endsWith("/") ? dirPath + name2 : dirPath + "/" + name2;
              if (regex.test(name2)) {
                const entry = this.getFileEntryIOS(fm, name2, fullPath);
                if (entry)
                  results.push(entry);
              }
              try {
                const isDir = Memory.alloc(Process.pointerSize);
                isDir.writeU8(0);
                const nsFullPath = frida_objc_bridge_default.classes.NSString.stringWithString_(fullPath);
                fm.fileExistsAtPath_isDirectory_(nsFullPath, isDir);
                if (isDir.readU8() === 1) {
                  search(fullPath, currentDepth + 1);
                }
              } catch (e) {
              }
            }
          } catch (e) {
          }
        };
        search(basePath, 0);
        return {
          success: true,
          data: {
            basePath,
            pattern,
            maxDepth,
            results,
            totalResults: results.length,
            truncated: results.length >= maxResults
          }
        };
      }
      searchFilesAndroid(basePath, pattern, maxDepth) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const results = [];
            const regex = this.patternToRegex(pattern);
            const maxResults = 200;
            const search = (dirPath, currentDepth) => {
              if (currentDepth > maxDepth || results.length >= maxResults)
                return;
              try {
                const dir = File2.$new(dirPath);
                const files = dir.listFiles();
                if (files === null)
                  return;
                for (let i = 0; i < files.length && results.length < maxResults; i++) {
                  const f2 = files[i];
                  const name2 = f2.getName();
                  if (regex.test(name2)) {
                    results.push({
                      name: name2,
                      path: f2.getAbsolutePath(),
                      size: f2.length(),
                      isDirectory: f2.isDirectory(),
                      isSymlink: false,
                      modified: new Date(f2.lastModified()).toISOString()
                    });
                  }
                  if (f2.isDirectory()) {
                    search(f2.getAbsolutePath(), currentDepth + 1);
                  }
                }
              } catch (e) {
              }
            };
            search(basePath, 0);
            result2 = {
              success: true,
              data: {
                basePath,
                pattern,
                maxDepth,
                results,
                totalResults: results.length,
                truncated: results.length >= maxResults
              }
            };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── App Paths (common starting points) ────────────────────────────
      getAppPaths() {
        try {
          if (PlatformDetector.isIOS()) {
            return this.getAppPathsIOS();
          } else if (PlatformDetector.isAndroid()) {
            return this.getAppPathsAndroid();
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] getAppPaths failed", e);
          return { success: false, error: e.message };
        }
      }
      getAppPathsIOS() {
        const paths = [];
        const bundle = frida_objc_bridge_default.classes.NSBundle.mainBundle();
        try {
          const bundlePath = bundle.bundlePath().toString();
          paths.push({ label: "App Bundle", path: bundlePath, description: "App binary and resources (read-only)" });
        } catch (e) {
        }
        try {
          const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
          const docsDir = fm.URLsForDirectory_inDomains_(9, 1).objectAtIndex_(0);
          if (docsDir) {
            const docPath = docsDir.path().toString();
            paths.push({ label: "Documents", path: docPath, description: "User documents (backed up to iCloud)" });
          }
        } catch (e) {
        }
        try {
          const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
          const libDir = fm.URLsForDirectory_inDomains_(5, 1).objectAtIndex_(0);
          if (libDir) {
            const libPath = libDir.path().toString();
            paths.push({ label: "Library", path: libPath, description: "App library (Preferences, Caches, etc.)" });
          }
        } catch (e) {
        }
        try {
          const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
          const cacheDir = fm.URLsForDirectory_inDomains_(13, 1).objectAtIndex_(0);
          if (cacheDir) {
            const cachePath = cacheDir.path().toString();
            paths.push({ label: "Caches", path: cachePath, description: "Temporary cache files" });
          }
        } catch (e) {
        }
        try {
          const tmpAddr = resolveExport2("Foundation", "NSTemporaryDirectory");
          const NSTemporaryDirectory = new NativeFunction(tmpAddr, "pointer", []);
          const tmpResult = NSTemporaryDirectory();
          if (!tmpResult.isNull()) {
            const tmpPath = new frida_objc_bridge_default.Object(tmpResult).toString().replace(/\/$/, "");
            paths.push({ label: "Temp", path: tmpPath, description: "Temporary files" });
          }
        } catch (e) {
        }
        try {
          const homeAddr = resolveExport2("Foundation", "NSHomeDirectory");
          const NSHomeDirectory = new NativeFunction(homeAddr, "pointer", []);
          const homeResult = NSHomeDirectory();
          if (!homeResult.isNull()) {
            const homePath = new frida_objc_bridge_default.Object(homeResult).toString();
            paths.push({ label: "Home", path: homePath, description: "App sandbox root" });
          }
        } catch (e) {
        }
        paths.push({ label: "Keychain DB", path: "/var/Keychains", description: "System keychain databases (jailbroken)" });
        paths.push({ label: "System Root", path: "/", description: "Filesystem root (jailbroken)" });
        const bundleId = bundle.bundleIdentifier() ? bundle.bundleIdentifier().toString() : "unknown";
        return {
          success: true,
          data: {
            bundleId,
            platform: "ios",
            paths
          }
        };
      }
      getAppPathsAndroid() {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const ActivityThread = frida_java_bridge_default.use("android.app.ActivityThread");
            const app = ActivityThread.currentApplication();
            const ctx = app.getApplicationContext();
            const packageName = ctx.getPackageName();
            const paths = [];
            try {
              paths.push({
                label: "Internal Files",
                path: ctx.getFilesDir().getAbsolutePath(),
                description: "App-private internal files"
              });
            } catch (e) {
            }
            try {
              paths.push({
                label: "Cache",
                path: ctx.getCacheDir().getAbsolutePath(),
                description: "Internal cache directory"
              });
            } catch (e) {
            }
            try {
              const extFilesDir = ctx.getExternalFilesDir(null);
              if (extFilesDir) {
                paths.push({
                  label: "External Files",
                  path: extFilesDir.getAbsolutePath(),
                  description: "External storage app files"
                });
              }
            } catch (e) {
            }
            try {
              const extCacheDir = ctx.getExternalCacheDir();
              if (extCacheDir) {
                paths.push({
                  label: "External Cache",
                  path: extCacheDir.getAbsolutePath(),
                  description: "External cache directory"
                });
              }
            } catch (e) {
            }
            try {
              paths.push({
                label: "Data Dir",
                path: ctx.getDataDir().getAbsolutePath(),
                description: "App data root directory"
              });
            } catch (e) {
            }
            try {
              paths.push({
                label: "Databases",
                path: ctx.getDatabasePath("_").getAbsolutePath().replace("/_", ""),
                description: "SQLite databases directory"
              });
            } catch (e) {
            }
            try {
              const dataDir = ctx.getDataDir().getAbsolutePath();
              paths.push({
                label: "Shared Prefs",
                path: dataDir + "/shared_prefs",
                description: "SharedPreferences XML files"
              });
            } catch (e) {
            }
            try {
              paths.push({
                label: "Code Cache",
                path: ctx.getCodeCacheDir().getAbsolutePath(),
                description: "Code cache (dex/oat files)"
              });
            } catch (e) {
            }
            paths.push({ label: "SD Card", path: "/sdcard", description: "External storage root" });
            paths.push({ label: "System Root", path: "/", description: "Filesystem root (rooted devices)" });
            paths.push({ label: "/data/data", path: "/data/data", description: "All app data directories (root)" });
            result2 = {
              success: true,
              data: {
                bundleId: packageName,
                platform: "android",
                paths
              }
            };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── Write File ────────────────────────────────────────────────────
      writeFile(path, dataBase64) {
        try {
          if (!path || !dataBase64) {
            return { success: false, error: "path and dataBase64 are required" };
          }
          path = this.normalizePath(path);
          if (PlatformDetector.isIOS()) {
            return this.writeFileIOS(path, dataBase64);
          } else if (PlatformDetector.isAndroid()) {
            return this.writeFileAndroid(path, dataBase64);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] writeFile failed", e);
          return { success: false, error: e.message };
        }
      }
      writeFileIOS(path, dataBase64) {
        const data = frida_objc_bridge_default.classes.NSData.alloc().initWithBase64EncodedString_options_(frida_objc_bridge_default.classes.NSString.stringWithString_(dataBase64), 0);
        if (!data) {
          return { success: false, error: "Invalid base64 data" };
        }
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        const success = data.writeToFile_atomically_(nsPath, true);
        if (success) {
          log(`[FileBrowser] Wrote ${data.length()} bytes to ${path}`);
          return { success: true, message: `Wrote ${data.length()} bytes to ${path}`, size: data.length() };
        }
        return { success: false, error: `Failed to write file: ${path}` };
      }
      writeFileAndroid(path, dataBase64) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const Base64 = frida_java_bridge_default.use("android.util.Base64");
            const FileOutputStream = frida_java_bridge_default.use("java.io.FileOutputStream");
            const bytes = Base64.decode(dataBase64, 0);
            const fos = FileOutputStream.$new(path);
            fos.write(bytes);
            fos.close();
            log(`[FileBrowser] Wrote ${bytes.length} bytes to ${path}`);
            result2 = { success: true, message: `Wrote ${bytes.length} bytes to ${path}`, size: bytes.length };
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── Delete File ───────────────────────────────────────────────────
      deleteFile(path) {
        try {
          if (!path)
            return { success: false, error: "Path is required" };
          path = this.normalizePath(path);
          if (PlatformDetector.isIOS()) {
            return this.deleteFileIOS(path);
          } else if (PlatformDetector.isAndroid()) {
            return this.deleteFileAndroid(path);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] deleteFile failed", e);
          return { success: false, error: e.message };
        }
      }
      deleteFileIOS(path) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        if (!fm.fileExistsAtPath_(nsPath)) {
          return { success: false, error: `File not found: ${path}` };
        }
        const success = fm.removeItemAtPath_error_(nsPath, NULL);
        if (success) {
          log(`[FileBrowser] Deleted: ${path}`);
          return { success: true, message: `Deleted: ${path}` };
        }
        return { success: false, error: `Failed to delete: ${path}` };
      }
      deleteFileAndroid(path) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const file = File2.$new(path);
            if (!file.exists()) {
              result2 = { success: false, error: `File not found: ${path}` };
              return;
            }
            if (file.delete()) {
              log(`[FileBrowser] Deleted: ${path}`);
              result2 = { success: true, message: `Deleted: ${path}` };
            } else {
              result2 = { success: false, error: `Failed to delete: ${path}` };
            }
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── Create Directory ──────────────────────────────────────────────
      createDirectory(path) {
        try {
          if (!path)
            return { success: false, error: "Path is required" };
          path = this.normalizePath(path);
          if (PlatformDetector.isIOS()) {
            return this.createDirectoryIOS(path);
          } else if (PlatformDetector.isAndroid()) {
            return this.createDirectoryAndroid(path);
          }
          return { success: false, error: "Unsupported platform" };
        } catch (err) {
          const e = err instanceof Error ? err : Error(String(err));
          logError("[FileBrowser] createDirectory failed", e);
          return { success: false, error: e.message };
        }
      }
      createDirectoryIOS(path) {
        const fm = frida_objc_bridge_default.classes.NSFileManager.defaultManager();
        const nsPath = frida_objc_bridge_default.classes.NSString.stringWithString_(path);
        const success = fm.createDirectoryAtPath_withIntermediateDirectories_attributes_error_(nsPath, true, NULL, NULL);
        if (success) {
          log(`[FileBrowser] Created directory: ${path}`);
          return { success: true, message: `Created directory: ${path}` };
        }
        return { success: false, error: `Failed to create directory: ${path}` };
      }
      createDirectoryAndroid(path) {
        let result2 = { success: false, error: "Java not available" };
        if (!frida_java_bridge_default.available)
          return result2;
        frida_java_bridge_default.performNow(() => {
          try {
            const File2 = frida_java_bridge_default.use("java.io.File");
            const dir = File2.$new(path);
            if (dir.mkdirs()) {
              log(`[FileBrowser] Created directory: ${path}`);
              result2 = { success: true, message: `Created directory: ${path}` };
            } else if (dir.exists()) {
              result2 = { success: true, message: `Directory already exists: ${path}` };
            } else {
              result2 = { success: false, error: `Failed to create directory: ${path}` };
            }
          } catch (err) {
            const e = err instanceof Error ? err : Error(String(err));
            result2 = { success: false, error: e.message };
          }
        });
        return result2;
      }
      // ─── Utilities ─────────────────────────────────────────────────────
      normalizePath(path) {
        if (path.length > 1 && path.endsWith("/")) {
          path = path.slice(0, -1);
        }
        if (path.startsWith("file://")) {
          path = path.replace("file://", "");
        }
        return path;
      }
      patternToRegex(pattern) {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
        return new RegExp(escaped, "i");
      }
      formatSize(bytes) {
        if (bytes === 0)
          return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
      }
      guessMimeType(fileName) {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        const types2 = {
          "txt": "text/plain",
          "json": "application/json",
          "xml": "application/xml",
          "plist": "application/x-plist",
          "html": "text/html",
          "css": "text/css",
          "js": "application/javascript",
          "png": "image/png",
          "jpg": "image/jpeg",
          "jpeg": "image/jpeg",
          "gif": "image/gif",
          "svg": "image/svg+xml",
          "pdf": "application/pdf",
          "zip": "application/zip",
          "db": "application/x-sqlite3",
          "sqlite": "application/x-sqlite3",
          "sqlite3": "application/x-sqlite3",
          "realm": "application/x-realm",
          "ipa": "application/x-ios-app",
          "apk": "application/vnd.android.package-archive",
          "dex": "application/x-dex",
          "so": "application/x-sharedlib",
          "dylib": "application/x-mach-binary",
          "bin": "application/octet-stream"
        };
        return types2[ext] || "application/octet-stream";
      }
    };
  }
});

// agent/index.ts
var require_index = __commonJS({
  "agent/index.ts"(exports, module) {
    init_node_globals();
    init_logger();
    init_ModuleManager();
    init_AndroidInfoModule();
    init_UtilsModule();
    init_ClassEnumerationModule();
    init_SSLPinning();
    init_IPC();
    init_iOSInfoModule();
    init_URLScheme();
    init_PasteboardMonitor();
    init_DarwinNotificationMonitor();
    init_AppGroupMonitor();
    init_iOSDecryptModule();
    init_FileBrowserModule();
    init_Platform();
    send("\u{1F680} Leviathan Agent (Modular Test) starting...");
    var managerInstance = null;
    var agentState = {
      manager: null,
      platform: "unknown",
      initialized: false
    };
    function initializeCore() {
      const manager2 = ModuleManager.getInstance();
      agentState.manager = manager2;
      managerInstance = manager2;
      agentState.platform = PlatformDetector.detect();
      log(`Platform detected: ${agentState.platform}`);
      return manager2;
    }
    function registerCrossPlatformModules(manager2) {
      if (PlatformDetector.isKnown()) {
        log("Registering cross-platform modules...");
        manager2.registerModule(new UtilsModule());
        manager2.registerModule(new ClassEnumerationModule());
        manager2.registerModule(new FileBrowserModule());
        log("Cross-platform modules registered successfully");
      }
    }
    function registerPlatformModules(manager2) {
      if (PlatformDetector.isAndroid()) {
        log("Registering Android modules...");
        manager2.registerModule(new AndroidInfoModule());
        manager2.registerModule(new AndroidSSLPinningModule());
        manager2.registerModule(new AndroidIPCModule());
      } else if (PlatformDetector.isIOS()) {
        log("Registering iOS modules...");
        manager2.registerModule(new iOSInfoModule());
        manager2.registerModule(new URLSchemeMonitor());
        manager2.registerModule(new PasteboardMonitor());
        manager2.registerModule(new DarwinNotificationMonitor());
        manager2.registerModule(new AppGroupMonitor());
        manager2.registerModule(new iOSDecryptModule());
      } else {
        log("Unknown platform - skipping platform-specific modules");
      }
    }
    function createUtilityFunctions(manager) {
      return {
        evaluate: (name, code) => {
          try {
            log(`Evaluating: ${name}`);
            const result = eval(code);
            return {
              success: true,
              result,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            };
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return {
              success: false,
              error: errorMsg,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
        },
        debugInfo: () => {
          const status = manager.getSystemStatus();
          return {
            success: true,
            data: {
              platform: agentState.platform,
              ...status,
              rpcFunctions: Object.keys(rpc.exports),
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          };
        },
        test: () => ({
          success: true,
          message: "Modular agent is working!",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        startIPCMonitoring: () => {
          const results = {};
          const monitors = [
            "startURLSchemeMonitor",
            "startPasteboardMonitor",
            "startDarwinNotificationMonitor",
            "startAppGroupMonitor"
          ];
          for (const name2 of monitors) {
            try {
              const fn = globalThis[name2];
              if (typeof fn === "function") {
                results[name2] = fn();
              } else {
                results[name2] = { success: false, error: `${name2} not available` };
              }
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              results[name2] = { success: false, error: errorMsg };
            }
          }
          return {
            success: true,
            message: "IPC monitoring started",
            results,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        },
        stopIPCMonitoring: () => {
          const results = {};
          const monitors = [
            "stopURLSchemeMonitor",
            "stopPasteboardMonitor",
            "stopDarwinNotificationMonitor",
            "stopAppGroupMonitor"
          ];
          for (const name2 of monitors) {
            try {
              const fn = globalThis[name2];
              if (typeof fn === "function") {
                results[name2] = fn();
              } else {
                results[name2] = { success: false, error: `${name2} not available` };
              }
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              results[name2] = { success: false, error: errorMsg };
            }
          }
          return {
            success: true,
            message: "IPC monitoring stopped",
            results,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      };
    }
    function setupRPCExports(manager2) {
      const moduleExports = manager2.getRPCExports();
      const utilityFunctions = createUtilityFunctions(manager2);
      rpc.exports = {
        ...moduleExports,
        ...utilityFunctions
      };
      log(`Module exports: ${Object.keys(moduleExports).join(", ")}`);
      log(`Total RPC exports: ${Object.keys(rpc.exports).length}`);
      log(`Available functions: ${Object.keys(rpc.exports).join(", ")}`);
    }
    function notifySuccess() {
      send("\u2705 Agent initialized successfully");
      send({
        type: "ready",
        exports: Object.keys(rpc.exports),
        platform: agentState.platform,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    function createFallbackExports(errorMsg) {
      rpc.exports = {
        error: () => ({
          success: false,
          message: "Agent failed to initialize",
          error: errorMsg,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        debugInfo: () => ({
          success: false,
          error: errorMsg,
          platform: agentState.platform,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      };
    }
    async function initializeAgent() {
      try {
        log("Initializing modular agent...");
        const manager2 = initializeCore();
        registerCrossPlatformModules(manager2);
        registerPlatformModules(manager2);
        log("Initializing all modules...");
        await manager2.initialize();
        setupRPCExports(manager2);
        agentState.initialized = true;
        notifySuccess();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStr = `\u274C Agent initialization failed: ${errorMsg}`;
        send(errorStr);
        log(errorStr);
        createFallbackExports(errorMsg);
      }
    }
    if (typeof process_default !== "undefined" && process_default.on) {
      process_default.on("uncaughtException", (error) => {
        log(`Uncaught exception: ${error.message}`);
        send({ type: "error", payload: error.message });
      });
      process_default.on("unhandledRejection", (reason, promise) => {
        const reasonStr = reason instanceof Error ? reason.message : String(reason);
        log(`Unhandled rejection at: ${promise}, reason: ${reasonStr}`);
        send({ type: "error", payload: reasonStr });
      });
    }
    initializeAgent().catch((error) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`Fatal error during initialization: ${errorMsg}`);
      send({ type: "fatal", payload: errorMsg });
    });
  }
});
export default require_index();
