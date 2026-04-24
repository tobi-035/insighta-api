'use strict';

function uuidv7() {
  const now = BigInt(Date.now());
  const tsMsHigh = (now >> 16n) & 0xffffffffn;
  const tsMsLow  = now & 0xffffn;
  const randA    = BigInt(Math.floor(Math.random() * 0x1000));
  const randBHi  = BigInt(Math.floor(Math.random() * 0x40000000));
  const randBLo  = BigInt(Math.floor(Math.random() * 0x100000000));

  const h = n => n.toString(16).padStart(2, '0');

  const o0  = (tsMsHigh >> 24n) & 0xffn;
  const o1  = (tsMsHigh >> 16n) & 0xffn;
  const o2  = (tsMsHigh >>  8n) & 0xffn;
  const o3  =  tsMsHigh         & 0xffn;
  const o4  = (tsMsLow  >>  8n) & 0xffn;
  const o5  =  tsMsLow          & 0xffn;
  const o6  = (0x70n | (randA >> 8n)) & 0xffn;
  const o7  =  randA & 0xffn;
  const o8  = (0x80n | (randBHi >> 24n)) & 0xbfn;
  const o9  = (randBHi >> 16n) & 0xffn;
  const o10 = (randBHi >>  8n) & 0xffn;
  const o11 =  randBHi         & 0xffn;
  const o12 = (randBLo >> 24n) & 0xffn;
  const o13 = (randBLo >> 16n) & 0xffn;
  const o14 = (randBLo >>  8n) & 0xffn;
  const o15 =  randBLo         & 0xffn;

  return `${h(o0)}${h(o1)}${h(o2)}${h(o3)}-${h(o4)}${h(o5)}-${h(o6)}${h(o7)}-${h(o8)}${h(o9)}-${h(o10)}${h(o11)}${h(o12)}${h(o13)}${h(o14)}${h(o15)}`;
}

module.exports = { uuidv7 };
