import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://trading-bot-lnf1.onrender.com';
const API_KEY = process.env.TWELVE_DATA_API_KEY || '480e1387e8fe4675b44e831a47a9721a';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9089609371:AAFyPRrun1KIafdD3J1ii2WmymjxJrTFR-E';
let CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];
const YAHOO_MAP = {
  'XAU/USD': 'GC=F',
  'QQQ': 'QQQ',
  'NVDA': 'NVDA',
  'AAPL': 'AAPL',
  'SPY': 'SPY'
};

app.use(cors());
app.use(express.json());

let signalHistory = [];
let lastAlertCandleTime = {};
let marketRadar = {};
let latestPlanBySymbol = {};
let lastScanTime = null;
let hasSentStartupAlert = false;

// ==========================================
// 1. คลังฟังก์ชันคำนวณ Indicator ระดับสถาบัน
// ==========================================
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateATR(candles, period = 14) {
  if (candles.length < 2) return candles[0] ? candles[0].close * 0.002 : 2.0;
  let tr = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const recent = tr.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / Math.max(1, recent.length);
}

function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let ag = gains / period;
  let al = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - (100 / (1 + (ag / al)));
}

function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = prices.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, hist };
}

function calculateBollingerBands(prices, period = 20, mult = 2.0) {
  const slice = prices.slice(-period);
  const mean = slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length);
  const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, slice.length);
  const stdDev = Math.sqrt(variance);
  return {
    middle: mean,
    upper: mean + mult * stdDev,
    lower: mean - mult * stdDev
  };
}

// ==========================================
// 2. ระบบค้นหา Chat ID อัตโนมัติ + ส่งเข้า Telegram
// ==========================================
async function resolveTelegramChatId() {
  if (CHAT_ID) return CHAT_ID;
  if (!BOT_TOKEN) return '';
  try {
    const res = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates');
    const data = await res.json();
    if (data.ok && data.result && data.result.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const msg = data.result[i].message || data.result[i].channel_post;
        if (msg && msg.chat && msg.chat.id) {
          CHAT_ID = String(msg.chat.id);
          console.log('Auto-detected Telegram CHAT_ID:', CHAT_ID);
          return CHAT_ID;
        }
      }
    }
  } catch (e) {
    console.error('Auto-detect Chat ID error:', e.message);
  }
  return '';
}

async function sendTelegramMessage(text) {
  const targetChatId = await resolveTelegramChatId();
  if (!BOT_TOKEN || !targetChatId) {
    console.warn('Telegram skipped: CHAT_ID not found yet. Please send /start to your Telegram bot.');
    return false;
  }
  try {
    const tgUrl = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
    const res = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: targetChatId, text: text, parse_mode: 'HTML' })
    });
    const out = await res.json();
    return Boolean(out.ok);
  } catch (err) {
    console.error('Telegram Error:', err.message);
    return false;
  }
}

function formatTelegramSignalMessage(sig, prefixTitle) {
  const isBuy = sig.action === 'BUY';
  const starStr = '⭐'.repeat(sig.stars || 4);
  return (
    (isBuy ? '🟢' : '🔴') + ' <b>' + (prefixTitle || 'สัญญาณเทรด M15') + ': ' + sig.ticker + '</b>\n' +
    '──────────────────\n' +
    '🧠 <b>เข้าด้วย:</b> ' + sig.strategy + '\n' +
    '📌 <b>เหตุผล:</b> <i>' + sig.reason + '</i>\n' +
    '📊 <b>คำสั่ง:</b> ' + (isBuy ? 'BUY (เปิดออเดอร์ซื้อ)' : 'SELL (เปิดออเดอร์ขาย)') + '\n' +
    '🔥 <b>ความมั่นใจ:</b> ' + starStr + '\n' +
    '💵 <b>ราคาเข้า (Entry):</b> <code>' + sig.entry + '</code> <i>(แตะเพื่อคัดลอก)</i>\n' +
    '🛑 <b>Stop Loss (SL):</b> <code>' + sig.sl + '</code> (ระยะ ~$' + sig.risk + ')\n' +
    '🎯 <b>TP1 (ปิด 50%):</b> <code>' + sig.tp1 + '</code> (RR 1:1.5)\n' +
    '🚀 <b>TP2 (รันเทรนด์):</b> <code>' + sig.tp2 + '</code> (RR 1:2.5)\n' +
    '📈 <b>RSI (14):</b> ' + sig.rsi + ' | ⏰ <b>เวลา:</b> ' + sig.time + ' น.\n' +
    '──────────────────\n' +
    '💡 <i>แตะที่ตัวเลขราคาในข้อความนี้เพื่อ Copy ไปวางใน MT4/MT5 ได้ทันที!</i>'
  );
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// ==========================================
// 3. ระบบดึงกราฟ M15 แบบไม่มีวันโควต้าเต็ม (Yahoo Finance + Binance + TwelveData)
// ==========================================
async function fetchM15Candles(sym) {
  // 1) ลองดึงจาก Yahoo Finance ก่อน (ฟรี ไม่จำกัดโควต้ารายวัน ไม่ติดบล็อก 800 ครั้ง/วัน)
  try {
    const ySym = YAHOO_MAP[sym] || sym;
    const yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ySym) + '?interval=15m&range=5d';
    const res = await fetch(yUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (result && result.timestamp && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const ts = result.timestamp;
      const q = result.indicators.quote[0];
      let candles = [];
      for (let i = 0; i < ts.length; i++) {
        if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
          candles.push({
            datetime: new Date(ts[i] * 1000).toISOString(),
            timeLabel: new Date(ts[i] * 1000).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
            open: Number(q.open[i]),
            high: Number(q.high[i]),
            low: Number(q.low[i]),
            close: Number(q.close[i])
          });
        }
      }
      if (candles.length >= 60) return candles.slice(-100);
    }
  } catch (e) {
    console.warn('Yahoo fetch fallback for ' + sym + ':', e.message);
  }

  // 2) ถ้าเป็นทองคำ XAU/USD ลองดึงจาก Binance PAXGUSDT (ราคาทองคำแท้ Real-time 24/7 ฟรีไม่จำกัด)
  if (sym === 'XAU/USD') {
    try {
      const bUrl = 'https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=100';
      const res = await fetch(bUrl);
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length >= 60) {
        return rows.map(r => ({
          datetime: new Date(r[0]).toISOString(),
          timeLabel: new Date(r[0]).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
          open: parseFloat(r[1]),
          high: parseFloat(r[2]),
          low: parseFloat(r[3]),
          close: parseFloat(r[4])
        }));
      }
    } catch (e) {
      console.warn('Binance gold fallback error:', e.message);
    }
  }

  // 3) สำรองสุดท้ายด้วย Twelve Data API
  if (API_KEY) {
    try {
      const tUrl = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(sym) + '&interval=15min&outputsize=100&apikey=' + API_KEY;
      const res = await fetch(tUrl);
      const data = await res.json();
      if (data.values && data.values.length >= 60) {
        return data.values.reverse().map(v => ({
          datetime: v.datetime,
          timeLabel: v.datetime.slice(11, 16),
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close)
        }));
      }
    } catch (e) {
      console.warn('TwelveData fallback error:', e.message);
    }
  }
  return [];
}

// ==========================================
// 4. ตรวจจับทั้ง 4 สูตร + สร้างแผนจุดเข้าประจำสินทรัพย์ทุกตัว (ไม่ปล่อยว่าง!)
// ==========================================
function evaluateCandleAtIndex(candles, idx, ticker) {
  if (idx < 50) return null;
  const sub = candles.slice(0, idx + 1);
  const closes = sub.map(c => c.close);
  const highs = sub.map(c => c.high);
  const lows = sub.map(c => c.low);

  const ema50 = calculateEMA(closes, 50);
  const ema21 = calculateEMA(closes, 21);
  const ema9 = calculateEMA(closes, 9);
  const atr = calculateATR(sub, 14);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes, 20, 2.0);
  const prevBb = calculateBollingerBands(closes.slice(0, -1), 20, 2.0);

  const last = sub.length - 1;
  const cur = sub[last];
  const prev = sub[last - 1];

  const curClose = closes[last];
  const prevClose = closes[last - 1];
  const curEMA50 = ema50[last];
  const curEMA21 = ema21[last];
  const prevEMA21 = ema21[last - 1];
  const curEMA9 = ema9[last];
  const prevEMA9 = ema9[last - 1];
  const curHist = macd.hist[last];
  const prevHist = macd.hist[last - 1];
  const candleBody = Math.abs(cur.close - cur.open);

  let matchedAction = null;
  let strategyName = '';
  let strategyReason = '';
  let stars = 4;
  let slMultiplier = 1.4;

  // สูตร 1: Trend Pullback & Bounce (ย่อรับ/เด้งต้านตามเทรนด์ EMA21 / EMA50)
  const touchedEMA21Buy = (prev.low <= prevEMA21 * 1.001 || cur.low <= curEMA21 * 1.001) && curClose > curEMA21;
  const touchedEMA21Sell = (prev.high >= prevEMA21 * 0.999 || cur.high >= curEMA21 * 0.999) && curClose < curEMA21;
  const s1Buy = curClose > curEMA50 && touchedEMA21Buy && cur.close >= cur.open && rsi >= 44 && rsi <= 70;
  const s1Sell = curClose < curEMA50 && touchedEMA21Sell && cur.close <= cur.open && rsi <= 56 && rsi >= 30;

  // สูตร 2: EMA 9/21 Crossover + MACD Momentum (จุดตัดเปลี่ยนรอบเทรนด์เร็ว)
  const s2Buy = prevEMA9 <= prevEMA21 && curEMA9 > curEMA21 && curHist >= prevHist && rsi >= 48;
  const s2Sell = prevEMA9 >= prevEMA21 && curEMA9 < curEMA21 && curHist <= prevHist && rsi <= 52;

  // สูตร 3: Momentum Breakout (เบรกกรอบ 6 แท่ง + MACD เร่งตัว)
  const recent6High = Math.max(...highs.slice(last - 6, last));
  const recent6Low = Math.min(...lows.slice(last - 6, last));
  const s3Buy = curClose > recent6High && candleBody >= atr * 0.45 && curHist > 0;
  const s3Sell = curClose < recent6Low && candleBody >= atr * 0.45 && curHist < 0;

  // สูตร 4: BB + RSI Reversal (กลับตัวจากขอบ Bollinger Band / RSI โซนสุดซอย)
  const s4Buy = (prev.low <= prevBb.lower * 1.001 || cur.low <= bb.lower * 1.001 || rsi <= 38) && cur.close > cur.open;
  const s4Sell = (prev.high >= prevBb.upper * 0.999 || cur.high >= bb.upper * 0.999 || rsi >= 62) && cur.close < cur.open;

  if (s1Buy || s1Sell) {
    matchedAction = s1Buy ? 'BUY' : 'SELL';
    strategyName = 'สูตร 1: Trend Pullback (ย่อตามเทรนด์)';
    strategyReason = 'ราคาย่อทดสอบแนวรับ/แนวต้าน EMA 21 ในเทรนด์หลัก EMA 50 แล้วดีดกลับพร้อมแรงส่ง RSI';
    stars = 5;
    slMultiplier = 1.4;
  } else if (s2Buy || s2Sell) {
    matchedAction = s2Buy ? 'BUY' : 'SELL';
    strategyName = 'สูตร 2: EMA 9/21 Cross + MACD (จุดตัดต้นเทรนด์)';
    strategyReason = 'เส้นเร็ว EMA 9 ตัดผ่าน EMA 21 พร้อม MACD เร่งตัว ยืนยันการเปลี่ยนรอบเทรนด์ M15';
    stars = 5;
    slMultiplier = 1.5;
  } else if (s3Buy || s3Sell) {
    matchedAction = s3Buy ? 'BUY' : 'SELL';
    strategyName = 'สูตร 3: Momentum Breakout (เบรกกรอบราคา)';
    strategyReason = 'แท่งเทียน M15 พุ่งทะลุกรอบ High/Low ก่อนหน้าด้วยเนื้อแท่งเต็มพลังและ MACD หนุน';
    stars = 4;
    slMultiplier = 1.5;
  } else if (s4Buy || s4Sell) {
    matchedAction = s4Buy ? 'BUY' : 'SELL';
    strategyName = 'สูตร 4: BB + RSI Reversal (ดักกลับตัวโซนสุดซอย)';
    strategyReason = 'ราคาแตะขอบ Bollinger Band / RSI โซนสุดโต่ง แล้วเกิดแท่งเทียนกลับตัวดึงกลับสำเร็จ';
    stars = 4;
    slMultiplier = 1.3;
  }

  if (!matchedAction) return null;

  const isBuy = matchedAction === 'BUY';
  const slDist = Math.max(atr * slMultiplier, curClose * 0.0015);

  return {
    id: 'sig_' + ticker + '_' + cur.datetime,
    datetime: cur.datetime,
    ticker: ticker,
    action: matchedAction,
    strategy: strategyName,
    reason: strategyReason,
    timeframe: '15m',
    entry: Number(curClose.toFixed(2)),
    sl: Number((isBuy ? curClose - slDist : curClose + slDist).toFixed(2)),
    tp1: Number((isBuy ? curClose + slDist * 1.5 : curClose - slDist * 1.5).toFixed(2)),
    tp2: Number((isBuy ? curClose + slDist * 2.5 : curClose - slDist * 2.5).toFixed(2)),
    risk: Number(slDist.toFixed(2)),
    rsi: Number(rsi.toFixed(1)),
    stars: stars,
    status: 'OPEN',
    time: cur.timeLabel || new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
  };
}

// สร้างแผนจุดเข้าปัจจุบัน (Live Actionable Trade Plan) สำหรับทุกสินทรัพย์ เพื่อให้หน้าเว็บแสดงจุดเข้าทันทีไม่ต้องรอ!
function buildInstantTradePlan(candles, ticker) {
  const closes = candles.map(c => c.close);
  const ema50 = calculateEMA(closes, 50);
  const ema21 = calculateEMA(closes, 21);
  const ema9 = calculateEMA(closes, 9);
  const atr = calculateATR(candles, 14);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);

  const last = candles.length - 1;
  const curClose = closes[last];
  const curEMA50 = ema50[last];
  const curEMA21 = ema21[last];
  const curEMA9 = ema9[last];
  const curHist = macd.hist[last];

  // ตัดสินทิศทางที่ได้เปรียบที่สุดในแท่งปัจจุบัน
  let bullishScore = 0;
  if (curClose > curEMA50) bullishScore++;
  if (curEMA9 >= curEMA21) bullishScore++;
  if (curHist >= 0) bullishScore++;
  if (rsi >= 50) bullishScore++;

  const isBuy = bullishScore >= 2;
  const slDist = Math.max(atr * 1.4, curClose * 0.0015);
  const trendLabel = curClose > curEMA50 ? 'BULL' : 'BEAR';

  return {
    id: 'plan_' + ticker,
    ticker: ticker,
    action: isBuy ? 'BUY' : 'SELL',
    strategy: isBuy ? 'แผนเกาะเทรนด์ขาขึ้น (M15 Active Setup)' : 'แผนเกาะเทรนด์ขาลง (M15 Active Setup)',
    reason: isBuy
      ? 'ราคาเคลื่อนไหวเหนือแนวโน้มหลัก (EMA21: ' + curEMA21.toFixed(2) + ', RSI: ' + rsi.toFixed(0) + ') แนะนำโฟกัสฝั่ง BUY'
      : 'ราคาเคลื่อนไหวใต้แนวโน้มหลัก (EMA21: ' + curEMA21.toFixed(2) + ', RSI: ' + rsi.toFixed(0) + ') แนะนำโฟกัสฝั่ง SELL',
    timeframe: '15m',
    entry: Number(curClose.toFixed(2)),
    sl: Number((isBuy ? curClose - slDist : curClose + slDist).toFixed(2)),
    tp1: Number((isBuy ? curClose + slDist * 1.5 : curClose - slDist * 1.5).toFixed(2)),
    tp2: Number((isBuy ? curClose + slDist * 2.5 : curClose - slDist * 2.5).toFixed(2)),
    risk: Number(slDist.toFixed(2)),
    rsi: Number(rsi.toFixed(1)),
    stars: bullishScore === 4 || bullishScore === 0 ? 5 : 4,
    trend: trendLabel,
    status: 'ACTIVE_PLAN',
    time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
  };
}

// ==========================================
// 5. ตรวจสอบสถานะออเดอร์ชน TP1 / TP2 / SL
// ==========================================
async function checkActiveSignalsStatus(symbol, currentPrice) {
  for (let sig of signalHistory) {
    if (sig.ticker === symbol && (sig.status === 'OPEN' || sig.status === 'HIT_TP1')) {
      const isBuy = sig.action === 'BUY';

      if ((isBuy && currentPrice >= sig.tp2) || (!isBuy && currentPrice <= sig.tp2)) {
        sig.status = 'HIT_TP2';
        broadcast({ type: 'UPDATE_SIGNAL', data: sig });
        await sendTelegramMessage(
          '🚀 <b>ชนะเต็มเป้า TP2! (' + sig.ticker + ')</b>\n' +
          'สูตร: ' + sig.strategy + '\n' +
          'ออเดอร์ ' + sig.action + ' วิ่งชนเป้า TP2 ที่ราคา <code>' + currentPrice + '</code> เรียบร้อยแล้ว (+2.5R) 🎉'
        );
      } else if (sig.status === 'OPEN' && ((isBuy && currentPrice >= sig.tp1) || (!isBuy && currentPrice <= sig.tp1))) {
        sig.status = 'HIT_TP1';
        broadcast({ type: 'UPDATE_SIGNAL', data: sig });
        await sendTelegramMessage(
          '🎯 <b>ชนเป้า TP1 แล้ว! (' + sig.ticker + ')</b>\n' +
          'สูตร: ' + sig.strategy + '\n' +
          'ออเดอร์ ' + sig.action + ' แตะราคา <code>' + currentPrice + '</code> (+1.5R)\n' +
          '💡 <i>แนะนำ: แบ่งปิดกำไร 50% และเลื่อน SL มาที่ราคาเข้า (<code>' + sig.entry + '</code>) เพื่อกันทุนทันที!</i>'
        );
      } else if ((isBuy && currentPrice <= sig.sl) || (!isBuy && currentPrice >= sig.sl)) {
        sig.status = sig.status === 'HIT_TP1' ? 'CLOSED_BE' : 'HIT_SL';
        broadcast({ type: 'UPDATE_SIGNAL', data: sig });
        await sendTelegramMessage(
          '🛑 <b>อัปเดตสถานะ (' + sig.ticker + '):</b> ราคาแตะจุด SL ที่ <code>' + currentPrice + '</code> ปิดออเดอร์ตามแผนควบคุมความเสี่ยง'
        );
      }
    }
  }
}

// ==========================================
// 6. ลูปสแกนตลาด + ย้อนหลัง 25 แท่งตอนเปิดเครื่องเพื่อแสดงจุดเข้าทันที!
// ==========================================
async function scanMarket() {
  for (const sym of SYMBOLS) {
    try {
      const candles = await fetchM15Candles(sym);
      if (candles && candles.length >= 60) {
        const latestPrice = candles[candles.length - 1].close;

        // 1) สร้างแผนจุดเข้าปัจจุบันประจำสินทรัพย์นี้ทันที (ไม่ปล่อยให้หน้าเว็บขึ้น --)
        const livePlan = buildInstantTradePlan(candles, sym);
        latestPlanBySymbol[sym] = livePlan;

        marketRadar[sym] = {
          ticker: sym,
          price: livePlan.entry,
          rsi: livePlan.rsi,
          trend: livePlan.trend,
          action: livePlan.action,
          sl: livePlan.sl,
          tp1: livePlan.tp1,
          tp2: livePlan.tp2,
          watchNote: livePlan.action + ' @ ' + livePlan.entry + ' (SL ' + livePlan.sl + ')'
        };

        // 2) ถ้าระบบเพิ่งเริ่มและยังไม่มีประวัติสัญญาณของสินทรัพย์นี้ ให้สแกนย้อนหลัง 20 แท่งล่าสุดเพื่อดึงสัญญาณที่เกิดจริงมาโชว์ทันที
        const hasHistoryForSym = signalHistory.some(s => s.ticker === sym);
        if (!hasHistoryForSym) {
          for (let idx = candles.length - 20; idx < candles.length - 1; idx++) {
            const pastSig = evaluateCandleAtIndex(candles, idx, sym);
            if (pastSig) {
              // เช็คว่าสัญญาณย้อนหลังชน TP หรือ SL ไปหรือยัง
              for (let k = idx + 1; k < candles.length; k++) {
                const c = candles[k];
                const isBuy = pastSig.action === 'BUY';
                if ((isBuy && c.high >= pastSig.tp2) || (!isBuy && c.low <= pastSig.tp2)) {
                  pastSig.status = 'HIT_TP2';
                  break;
                } else if ((isBuy && c.high >= pastSig.tp1) || (!isBuy && c.low <= pastSig.tp1)) {
                  pastSig.status = 'HIT_TP1';
                } else if ((isBuy && c.low <= pastSig.sl) || (!isBuy && c.high >= pastSig.sl)) {
                  pastSig.status = pastSig.status === 'HIT_TP1' ? 'CLOSED_BE' : 'HIT_SL';
                  break;
                }
              }
              signalHistory.unshift(pastSig);
              lastAlertCandleTime[sym] = pastSig.datetime;
            }
          }
        }

        await checkActiveSignalsStatus(sym, latestPrice);

        // 3) เช็คแท่งปัจจุบันล่าสุดเพื่อยิงแจ้งเตือนสด
        const lastIdx = candles.length - 1;
        const curCandle = candles[lastIdx];
        if (lastAlertCandleTime[sym] !== curCandle.datetime) {
          const newSig = evaluateCandleAtIndex(candles, lastIdx, sym);
          if (newSig) {
            lastAlertCandleTime[sym] = curCandle.datetime;
            signalHistory.unshift(newSig);
            if (signalHistory.length > 50) signalHistory.pop();
            broadcast({ type: 'NEW_SIGNAL', data: newSig });
            await sendTelegramMessage(formatTelegramSignalMessage(newSig, 'สัญญาณเทรด M15 ใหม่'));
          }
        }
      }
    } catch (e) {
      console.error('Scan error:', sym, e.message);
    }
  }

  // เรียงลำดับสัญญาณล่าสุดขึ้นบนสุด
  signalHistory = signalHistory.slice(0, 40);

  // ส่งแจ้งเตือนสรุปจุดเข้าล่าสุดเข้า Telegram ทันทีที่เปิดเซิร์ฟเวอร์ครั้งแรก (เพื่อให้ผู้ใช้รู้ว่าระบบพร้อมและเห็นจุดเข้าทันที)
  if (!hasSentStartupAlert && (signalHistory.length > 0 || latestPlanBySymbol['XAU/USD'])) {
    hasSentStartupAlert = true;
    const firstTarget = signalHistory[0] || latestPlanBySymbol['XAU/USD'];
    if (firstTarget) {
      await sendTelegramMessage(formatTelegramSignalMessage(firstTarget, 'สรุปจุดเข้า M15 ล่าสุดทันทีที่เปิดระบบ'));
    }
  }

  lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  broadcast({
    type: 'RADAR_UPDATE',
    radar: marketRadar,
    plans: latestPlanBySymbol,
    signals: signalHistory,
    lastScanTime: lastScanTime
  });
}

// ปุ่มกดส่งแผนเทรดของสินทรัพย์ที่กำลังดูอยู่เข้า Telegram ทันที
app.post('/api/test-telegram', async (req, res) => {
  const sym = (req.body && req.body.symbol) || 'XAU/USD';
  const target = latestPlanBySymbol[sym] || signalHistory[0];
  let ok = false;
  if (target) {
    ok = await sendTelegramMessage(formatTelegramSignalMessage(target, 'แผนจุดเข้า M15 ปัจจุบัน'));
  } else {
    ok = await sendTelegramMessage('✅ <b>เชื่อมต่อ Telegram สำเร็จ!</b> ระบบกำลังดึงข้อมูลกราฟ M15 ครับ');
  }
  res.json({ ok: ok, chatIdConfigured: Boolean(CHAT_ID) });
});

app.post('/api/scan-now', async (req, res) => {
  await scanMarket();
  res.json({
    ok: true,
    radar: marketRadar,
    plans: latestPlanBySymbol,
    signals: signalHistory,
    lastScanTime: lastScanTime
  });
});

app.get('/api/signals', (req, res) => res.json({
  signals: signalHistory,
  radar: marketRadar,
  plans: latestPlanBySymbol,
  lastScanTime: lastScanTime
}));

app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// 7. หน้าเว็บ Ultimate 4-Strategy Pro Dashboard (แสดงจุดเข้าทันทีทุกสินทรัพย์!)
// ==========================================
const HTML_PAGE = [
  '<!DOCTYPE html>',
  '<html lang="th" class="dark">',
  '<head>',
  '  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '  <title>M15 4-Strategy Pro Trading Terminal</title>',
  '  <script src="https://cdn.tailwindcss.com"></script>',
  '  <style>',
  '    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");',
  '    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }',
  '    .copy-card { cursor: pointer; transition: all 0.15s ease; }',
  '    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }',
  '    .copy-card:active { transform: scale(0.98); }',
  '  </style>',
  '</head>',
  '<body class="min-h-screen flex flex-col">',
  '  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 py-3">',
  '    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">',
  '      <div class="flex items-center gap-3">',
  '        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">⚡</div>',
  '        <div>',
  '          <div class="flex items-center gap-2">',
  '            <h1 class="font-bold text-base text-white">M15 Multi-Strategy Pro Terminal</h1>',
  '            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">🟢 โชว์จุดเข้าสดทุกตลาด 24/7</span>',
  '            <span id="last-scan-badge" class="text-[11px] text-slate-400 hidden sm:inline">อัปเดตล่าสุด: --:--</span>',
  '          </div>',
  '          <p class="text-xs text-slate-400" id="session-text">กำลังตรวจสอบโซนเวลาตลาดโลก...</p>',
  '        </div>',
  '      </div>',
  '      <div class="flex items-center flex-wrap gap-2 text-xs">',
  '        <div class="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">',
  '          🕒 แท่ง 15m ปิดใน: <span id="timer" class="font-mono font-bold text-amber-400">--:--</span>',
  '        </div>',
  '        <button id="scan-now-btn" class="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold px-3 py-1.5 rounded-lg transition">🔍 สแกนเดี๋ยวนี้</button>',
  '        <button id="voice-btn" class="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700">🗣️ เสียงพูดไทย: เปิด</button>',
  '        <button id="test-tg-btn" class="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition">📲 ส่งแผนจุดเข้านี้เข้า Telegram</button>',
  '      </div>',
  '    </div>',
  '  </header>',
  '',
  '  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-4">',
  '    <!-- Live 5-Asset Radar Bar (Click to view instant Entry/SL/TP for any asset) -->',
  '    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5" id="radar-grid">',
  '      <div onclick="setAsset(\'OANDA:XAUUSD\',\'XAU/USD\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border-2 border-amber-500/60 rounded-xl p-3 transition">',
  '        <div class="flex items-center justify-between"><span class="font-bold text-xs text-amber-400">🥇 XAU/USD</span><span id="rad-trend-XAU/USD" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">กำลังโหลด...</span></div>',
  '        <div class="flex items-baseline justify-between mt-1"><span id="rad-price-XAU/USD" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-XAU/USD" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        <p id="rad-note-XAU/USD" class="text-[10px] text-amber-300/90 mt-1 truncate">คลิกเพื่อดูจุดเข้า/SL/TP</p>',
  '      </div>',
  '      <div onclick="setAsset(\'NASDAQ:QQQ\',\'QQQ\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '        <div class="flex items-center justify-between"><span class="font-bold text-xs text-sky-400">📊 NASDAQ (QQQ)</span><span id="rad-trend-QQQ" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">กำลังโหลด...</span></div>',
  '        <div class="flex items-baseline justify-between mt-1"><span id="rad-price-QQQ" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-QQQ" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        <p id="rad-note-QQQ" class="text-[10px] text-slate-400 mt-1 truncate">คลิกเพื่อดูจุดเข้า/SL/TP</p>',
  '      </div>',
  '      <div onclick="setAsset(\'NASDAQ:NVDA\',\'NVDA\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '        <div class="flex items-center justify-between"><span class="font-bold text-xs text-emerald-400">⚡ NVDA</span><span id="rad-trend-NVDA" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">กำลังโหลด...</span></div>',
  '        <div class="flex items-baseline justify-between mt-1"><span id="rad-price-NVDA" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-NVDA" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        <p id="rad-note-NVDA" class="text-[10px] text-slate-400 mt-1 truncate">คลิกเพื่อดูจุดเข้า/SL/TP</p>',
  '      </div>',
  '      <div onclick="setAsset(\'NASDAQ:AAPL\',\'AAPL\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '        <div class="flex items-center justify-between"><span class="font-bold text-xs text-slate-200">🍏 AAPL</span><span id="rad-trend-AAPL" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">กำลังโหลด...</span></div>',
  '        <div class="flex items-baseline justify-between mt-1"><span id="rad-price-AAPL" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-AAPL" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        <p id="rad-note-AAPL" class="text-[10px] text-slate-400 mt-1 truncate">คลิกเพื่อดูจุดเข้า/SL/TP</p>',
  '      </div>',
  '      <div onclick="setAsset(\'AMEX:SPY\',\'SPY\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '        <div class="flex items-center justify-between"><span class="font-bold text-xs text-indigo-400">🇺🇸 SPY (S&P500)</span><span id="rad-trend-SPY" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">กำลังโหลด...</span></div>',
  '        <div class="flex items-baseline justify-between mt-1"><span id="rad-price-SPY" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-SPY" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        <p id="rad-note-SPY" class="text-[10px] text-slate-400 mt-1 truncate">คลิกเพื่อดูจุดเข้า/SL/TP</p>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- Main Grid -->',
  '    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">',
  '      <div class="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[530px] shadow-lg flex flex-col">',
  '        <div class="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs bg-slate-950/50">',
  '          <span id="chart-label" class="font-bold text-amber-400">📈 กราฟปัจจุบัน: XAU/USD (ทองคำ • 15 นาที)</span>',
  '          <span class="text-slate-400">คลิกการ์ดด้านบนเพื่อสลับดูแผนจุดเข้าของสินทรัพย์อื่น</span>',
  '        </div>',
  '        <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full flex-1 border-0"></iframe>',
  '      </div>',
  '',
  '      <div class="lg:col-span-4 flex flex-col gap-4">',
  '        <!-- Active Signal Card -->',
  '        <div class="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-xl">',
  '          <div class="flex items-center justify-between border-b border-slate-800 pb-3">',
  '            <div>',
  '              <div class="flex items-center gap-2">',
  '                <span class="text-[11px] font-semibold text-emerald-400 uppercase">แผนจุดเข้าปัจจุบัน (M15)</span>',
  '                <span id="sig-stars" class="text-xs text-amber-400">⭐⭐⭐⭐⭐</span>',
  '              </div>',
  '              <h3 id="sig-ticker" class="text-lg font-bold text-white mt-0.5">กำลังดึงจุดเข้า XAU/USD...</h3>',
  '            </div>',
  '            <span id="sig-badge" class="px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300">LOADING</span>',
  '          </div>',
  '          <!-- Strategy Badge & Reason -->',
  '          <div class="mt-2.5 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs">',
  '            <p id="sig-strategy" class="font-bold text-amber-400">🧠 กำลังคำนวณจุดเข้า/SL/TP จากกราฟจริง...</p>',
  '            <p id="sig-reason" class="text-[11px] text-slate-300 mt-0.5">รอสักครู่ ระบบกำลังสแกนแท่งเทียน M15</p>',
  '          </div>',
  '          <p class="text-[11px] text-sky-400 mt-2.5 flex items-center justify-between">',
  '            <span>👆 คลิกที่กล่องตัวเลขเพื่อ Copy ราคาไปวางในแอปเทรด</span>',
  '            <span id="copy-toast" class="text-emerald-400 font-bold"></span>',
  '          </p>',
  '          <div class="grid grid-cols-2 gap-2.5 my-2.5 text-xs">',
  '            <div onclick="copyPrice(\'sig-entry\',\'ราคาเข้า\')" class="copy-card bg-slate-800/80 p-3 rounded-xl border border-slate-700">',
  '              <div class="flex justify-between"><span class="text-slate-400">💵 จุดเข้า (Entry)</span><span class="text-[10px] text-slate-400">📋 Copy</span></div>',
  '              <p id="sig-entry" class="text-lg font-extrabold text-white font-mono mt-0.5">--</p>',
  '              <span class="text-[10px] text-slate-400">เข้าที่ราคาตลาด</span>',
  '            </div>',
  '            <div onclick="copyPrice(\'sig-sl\',\'Stop Loss\')" class="copy-card bg-rose-950/30 p-3 rounded-xl border border-rose-800/50">',
  '              <div class="flex justify-between"><span class="text-rose-300">🛑 Stop Loss</span><span class="text-[10px] text-rose-300">📋 Copy</span></div>',
  '              <p id="sig-sl" class="text-lg font-extrabold text-rose-400 font-mono mt-0.5">--</p>',
  '              <span id="Preview-sl-usd" class="text-[10px] text-rose-400 font-semibold">เสี่ยง: -$10.00</span>',
  '            </div>',
  '            <div onclick="copyPrice(\'sig-tp1\',\'TP1\')" class="copy-card bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">',
  '              <div class="flex justify-between"><span class="text-emerald-300">🎯 TP1 (ปิดครึ่งนึง)</span><span class="text-[10px] text-emerald-300">📋 Copy</span></div>',
  '              <p id="sig-tp1" class="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">--</p>',
  '              <span id="Preview-tp1-usd" class="text-[10px] text-emerald-400 font-semibold">กำไร: +$15.00</span>',
  '            </div>',
  '            <div onclick="copyPrice(\'sig-tp2\',\'TP2\')" class="copy-card bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">',
  '              <div class="flex justify-between"><span class="text-teal-300">🚀 TP2 (เป้าหลัก)</span><span class="text-[10px] text-teal-300">📋 Copy</span></div>',
  '              <p id="sig-tp2" class="text-lg font-extrabold text-teal-300 font-mono mt-0.5">--</p>',
  '              <span id="Preview-tp2-usd" class="text-[10px] text-teal-300 font-semibold">กำไร: +$25.00</span>',
  '            </div>',
  '          </div>',
  '        </div>',
  '',
  '        <!-- Smart Lot Calculator -->',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs">',
  '          <div class="flex items-center justify-between mb-2">',
  '            <h4 class="font-bold text-amber-400">🧮 คำนวณขนาด Lot อัตโนมัติ</h4>',
  '            <span class="text-[10px] text-slate-400">จำค่าอัตโนมัติ</span>',
  '          </div>',
  '          <div class="grid grid-cols-2 gap-2 mb-2">',
  '            <div>',
  '              <label class="text-slate-400">ทุนในพอร์ต ($):</label>',
  '              <input type="number" id="inp-bal" value="1000" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-white mt-1">',
  '            </div>',
  '            <div>',
  '              <label class="text-slate-400">ความเสี่ยงต่อไม้:</label>',
  '              <select id="inp-risk" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-white mt-1">',
  '                <option value="0.5">0.5% (เซฟสุดๆ)</option>',
  '                <option value="1" selected>1.0% (แนะนำ)</option>',
  '                <option value="2">2.0% (มาตรฐาน)</option>',
  '              </select>',
  '            </div>',
  '          </div>',
  '          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between mt-2">',
  '            <div>',
  '              <span class="text-slate-400 block">ขนาด Lot ที่ควรออก:</span>',
  '              <span id="risk-usd" class="text-[11px] text-rose-400">ถ้าแพ้เสียแค่ $10.00</span>',
  '            </div>',
  '            <span id="out-lot" class="text-xl font-black text-emerald-400 font-mono">0.02 Lot</span>',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- Signal History Table -->',
  '    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">',
  '      <div class="flex items-center justify-between mb-3">',
  '        <h3 class="font-bold text-sm text-white">📋 ประวัติสัญญาณจาก 4 สูตรหลัก (คลิกที่แถวเพื่อดูรายละเอียดบนการ์ด)</h3>',
  '        <span id="stat-summary" class="text-xs text-emerald-400 font-bold">ชนะ 0 | แพ้ 0</span>',
  '      </div>',
  '      <div class="overflow-x-auto">',
  '        <table class="w-full text-left text-xs font-mono">',
  '          <thead>',
  '            <tr class="border-b border-slate-800 text-slate-400">',
  '              <th class="py-2 px-3">เวลา</th><th class="py-2 px-3">สินทรัพย์</th><th class="py-2 px-3">คำสั่ง</th>',
  '              <th class="py-2 px-3">สูตรที่ใช้</th><th class="py-2 px-3">ราคาเข้า</th><th class="py-2 px-3">SL</th><th class="py-2 px-3">TP1 / TP2</th><th class="py-2 px-3">สถานะ</th>',
  '            </tr>',
  '          </thead>',
  '          <tbody id="history-tbody" class="divide-y divide-slate-800/60">',
  '            <tr><td colspan="8" class="py-4 text-center text-slate-500">กำลังดึงประวัติสัญญาณจากกราฟ M15...</td></tr>',
  '          </tbody>',
  '        </table>',
  '      </div>',
  '    </div>',
  '  </main>',
  '',
  '  <script>',
  '    let voiceOn = true;',
  '    let currentRiskDist = 6.0;',
  '    let selectedSymbol = "XAU/USD";',
  '    let latestPlans = {};',
  '    let allSignals = [];',
  '',
  '    if (localStorage.getItem("saved_bal")) document.getElementById("inp-bal").value = localStorage.getItem("saved_bal");',
  '    if (localStorage.getItem("saved_risk")) document.getElementById("inp-risk").value = localStorage.getItem("saved_risk");',
  '',
  '    function playAlertVoice(sig) {',
  '      if (!voiceOn) return;',
  '      try {',
  '        const ctx = new (window.AudioContext || window.webkitAudioContext)();',
  '        const osc = ctx.createOscillator(), g = ctx.createGain();',
  '        osc.connect(g); g.connect(ctx.destination);',
  '        const isBuy = sig.action === "BUY";',
  '        osc.frequency.setValueAtTime(isBuy ? 523.25 : 440, ctx.currentTime);',
  '        osc.frequency.exponentialRampToValueAtTime(isBuy ? 1046.5 : 330, ctx.currentTime + 0.35);',
  '        g.gain.setValueAtTime(0.3, ctx.currentTime);',
  '        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);',
  '        osc.start(); osc.stop(ctx.currentTime + 0.5);',
  '        if ("speechSynthesis" in window) {',
  '          const utter = new SpeechSynthesisUtterance("สัญญาณใหม่ " + (isBuy ? "ซื้อ " : "ขาย ") + sig.ticker + " ที่ราคา " + sig.entry);',
  '          utter.lang = "th-TH";',
  '          window.speechSynthesis.speak(utter);',
  '        }',
  '      } catch(e){}',
  '    }',
  '',
  '    function copyPrice(elId, label) {',
  '      const val = document.getElementById(elId).textContent;',
  '      if (!val || val === "--") return;',
  '      navigator.clipboard.writeText(val);',
  '      const t = document.getElementById("copy-toast");',
  '      t.textContent = "✅ คัดลอก " + label + " (" + val + ") แล้ว!";',
  '      setTimeout(function() { t.textContent = ""; }, 2500);',
  '    }',
  '',
  '    document.getElementById("voice-btn").onclick = function() {',
  '      voiceOn = !voiceOn;',
  '      document.getElementById("voice-btn").textContent = voiceOn ? "🗣️ เสียงพูดไทย: เปิด" : "🔇 เสียงพูดไทย: ปิด";',
  '    };',
  '',
  '    document.getElementById("test-tg-btn").onclick = async function() {',
  '      const btn = document.getElementById("test-tg-btn");',
  '      btn.textContent = "⏳ กำลังส่งเข้า Telegram...";',
  '      const r = await fetch("/api/test-telegram", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({ symbol: selectedSymbol })',
  '      });',
  '      const d = await r.json();',
  '      if (d.ok) {',
  '        btn.textContent = "✅ ส่งแผนจุดเข้าเข้า Telegram แล้ว!";',
  '      } else {',
  '        btn.textContent = "⚠️ กรุณาทักแชทบอทใน Telegram ก่อน 1 ครั้ง";',
  '      }',
  '      setTimeout(function() { btn.textContent = "📲 ส่งแผนจุดเข้านี้เข้า Telegram"; }, 3500);',
  '    };',
  '',
  '    document.getElementById("scan-now-btn").onclick = async function() {',
  '      const btn = document.getElementById("scan-now-btn");',
  '      btn.textContent = "⏳ กำลังสแกน 4 สูตร...";',
  '      const r = await fetch("/api/scan-now", { method: "POST" });',
  '      const d = await r.json();',
  '      latestPlans = d.plans || {};',
  '      allSignals = d.signals || [];',
  '      updateRadarUI(d.radar, d.lastScanTime);',
  '      showCardForSymbol(selectedSymbol);',
  '      renderSignalsTable(allSignals);',
  '      btn.textContent = "✅ สแกนเสร็จแล้ว!";',
  '      setTimeout(function() { btn.textContent = "🔍 สแกนเดี๋ยวนี้"; }, 2000);',
  '    };',
  '',
  '    function setAsset(tvSym, label) {',
  '      selectedSymbol = label;',
  '      document.getElementById("chart-label").textContent = "📈 กราฟปัจจุบัน: " + label + " (15 นาที)";',
  '      document.getElementById("tv-frame").src = "https://s.tradingview.com/widgetembed/?symbol=" + encodeURIComponent(tvSym) + "&interval=15&theme=dark&timezone=Asia%2FBangkok";',
  '      showCardForSymbol(label);',
  '    }',
  '',
  '    function showCardForSymbol(sym) {',
  '      // หาจากสัญญาณที่เพิ่งเกิดของสินทรัพย์นี้ หรือใช้แผนจุดเข้าปัจจุบัน (Active Plan)',
  '      const item = latestPlans[sym] || allSignals.find(function(x) { return x.ticker === sym; }) || allSignals[0];',
  '      if (!item) return;',
  '      displaySignalOnCard(item);',
  '    }',
  '',
  '    function displaySignalOnCard(item) {',
  '      const isBuy = item.action === "BUY";',
  '      currentRiskDist = item.risk || Math.abs(item.entry - item.sl) || 6.0;',
  '      calcLot();',
  '      document.getElementById("sig-ticker").textContent = item.ticker + " (15m)";',
  '      document.getElementById("sig-stars").textContent = "⭐".repeat(item.stars || 4);',
  '      document.getElementById("sig-strategy").textContent = "🧠 " + (item.strategy || "สูตรมาตรฐาน M15");',
  '      document.getElementById("sig-reason").textContent = "📌 " + (item.reason || "คำนวณจาก EMA + RSI + ATR ล่าสุด");',
  '      const badge = document.getElementById("sig-badge");',
  '      badge.textContent = isBuy ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";',
  '      badge.className = "px-3.5 py-1 rounded-full text-xs font-black " + (isBuy ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white");',
  '      document.getElementById("sig-entry").textContent = item.entry;',
  '      document.getElementById("sig-sl").textContent = item.sl;',
  '      document.getElementById("sig-tp1").textContent = item.tp1;',
  '      document.getElementById("sig-tp2").textContent = item.tp2;',
  '    }',
  '',
  '    function calcLot() {',
  '      const bal = parseFloat(document.getElementById("inp-bal").value) || 0;',
  '      const riskPct = parseFloat(document.getElementById("inp-risk").value) || 1;',
  '      localStorage.setItem("saved_bal", bal);',
  '      localStorage.setItem("saved_risk", riskPct);',
  '      const riskUsd = bal * (riskPct / 100);',
  '      document.getElementById("risk-usd").textContent = "ถ้าชน SL เสียแค่ -$" + riskUsd.toFixed(2);',
  '      document.getElementById("Preview-sl-usd").textContent = "เสี่ยง: -$" + riskUsd.toFixed(2);',
  '      document.getElementById("Preview-tp1-usd").textContent = "กำไร: +$" + (riskUsd * 1.5).toFixed(2);',
  '      document.getElementById("Preview-tp2-usd").textContent = "กำไร: +$" + (riskUsd * 2.5).toFixed(2);',
  '      const lot = Math.max(0.01, riskUsd / (currentRiskDist * 100)).toFixed(2);',
  '      document.getElementById("out-lot").textContent = lot + " Lot";',
  '    }',
  '    document.getElementById("inp-bal").oninput = calcLot;',
  '    document.getElementById("inp-risk").onchange = calcLot;',
  '    calcLot();',
  '',
  '    function updateSession() {',
  '      const hr = new Date().getUTCHours();',
  '      let s = "🌏 ตลาดเอเชีย (Asian Session) - เหมาะกับสูตร 4 (BB+RSI ดักกลับตัว)";',
  '      if (hr >= 7 && hr < 13) s = "🇬🇧 ตลาดลอนดอน (London Session) - เหมาะกับสูตร 1 & 2 (เกาะเทรนด์ทองคำ)";',
  '      else if (hr >= 13 && hr < 21) s = "🇺🇸 ตลาดนิวยอร์ก (US Session) - วิ่งแรงสุด! ทั้ง 4 สูตรทำงานเต็มกำลัง";',
  '      document.getElementById("session-text").textContent = s;',
  '    }',
  '    updateSession();',
  '',
  '    setInterval(function() {',
  '      const now = new Date();',
  '      const m = 14 - (now.getMinutes() % 15), s = 59 - now.getSeconds();',
  '      document.getElementById("timer").textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");',
  '    }, 1000);',
  '',
  '    function updateRadarUI(radar, scanTime) {',
  '      if (scanTime) document.getElementById("last-scan-badge").textContent = "อัปเดตล่าสุด: " + scanTime;',
  '      if (!radar) return;',
  '      Object.keys(radar).forEach(function(sym) {',
  '        const item = radar[sym];',
  '        const pEl = document.getElementById("rad-price-" + sym);',
  '        const rEl = document.getElementById("rad-rsi-" + sym);',
  '        const tEl = document.getElementById("rad-trend-" + sym);',
  '        const nEl = document.getElementById("rad-note-" + sym);',
  '        if (pEl) pEl.textContent = item.price;',
  '        if (rEl) rEl.textContent = "RSI " + item.rsi;',
  '        if (nEl) nEl.textContent = "🎯 " + (item.watchNote || "");',
  '        if (tEl) {',
  '          if (item.action === "BUY") { tEl.textContent = "🟢 แผน BUY"; tEl.className = "text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold"; }',
  '          else { tEl.textContent = "🔴 แผน SELL"; tEl.className = "text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold"; }',
  '        }',
  '      });',
  '    }',
  '',
  '    function renderSignalsTable(list) {',
  '      if (!list || list.length === 0) return;',
  '      let wins = 0, losses = 0;',
  '      list.forEach(function(x) {',
  '        if (x.status === "HIT_TP1" || x.status === "HIT_TP2" || x.status === "CLOSED_BE") wins++;',
  '        else if (x.status === "HIT_SL") losses++;',
  '      });',
  '      document.getElementById("stat-summary").textContent = "ชนะ " + wins + " | แพ้ " + losses + " (รวม " + list.length + " สัญญาณ)";',
  '',
  '      const tbody = document.getElementById("history-tbody");',
  '      tbody.innerHTML = list.map(function(item, idx) {',
  '        const cls = item.action === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400";',
  '        const stCls = item.status.indexOf("TP") !== -1 ? "text-emerald-400" : item.status === "HIT_SL" ? "text-rose-400" : "text-amber-300";',
  '        return "<tr onclick=\\"displaySignalOnCard(allSignals[" + idx + "])\\" class=\\"cursor-pointer hover:bg-slate-800/60 transition\\">" +',
  '          "<td class=\\"py-2.5 px-3 text-slate-400\\">" + item.time + "</td>" +',
  '          "<td class=\\"py-2.5 px-3 font-bold text-white\\">" + item.ticker + "</td>" +',
  '          "<td class=\\"py-2.5 px-3\\"><span class=\\"px-2 py-0.5 rounded font-bold " + cls + "\\">" + item.action + "</span></td>" +',
  '          "<td class=\\"py-2.5 px-3 text-amber-300\\">" + (item.strategy || "-") + "</td>" +',
  '          "<td class=\\"py-2.5 px-3\\">" + item.entry + "</td>" +',
  '          "<td class=\\"py-2.5 px-3 text-rose-400\\">" + item.sl + "</td>" +',
  '          "<td class=\\"py-2.5 px-3 text-emerald-400\\">" + item.tp1 + " / " + item.tp2 + "</td>" +',
  '          "<td class=\\"py-2.5 px-3 font-bold " + stCls + "\\">" + item.status + "</td>" +',
  '        "</tr>";',
  '      }).join("");',
  '    }',
  '',
  '    fetch("/api/signals").then(function(r) { return r.json(); }).then(function(d) {',
  '      latestPlans = d.plans || {};',
  '      allSignals = d.signals || [];',
  '      updateRadarUI(d.radar, d.lastScanTime);',
  '      showCardForSymbol(selectedSymbol);',
  '      renderSignalsTable(allSignals);',
  '    });',
  '',
  '    const proto = location.protocol === "https:" ? "wss:" : "ws:";',
  '    const ws = new WebSocket(proto + "//" + location.host);',
  '    ws.onmessage = function(e) {',
  '      const msg = JSON.parse(e.data);',
  '      if (msg.type === "RADAR_UPDATE") {',
  '        latestPlans = msg.plans || latestPlans;',
  '        allSignals = msg.signals || allSignals;',
  '        updateRadarUI(msg.radar, msg.lastScanTime);',
  '        showCardForSymbol(selectedSymbol);',
  '        renderSignalsTable(allSignals);',
  '      } else if (msg.type === "NEW_SIGNAL" || msg.type === "UPDATE_SIGNAL") {',
  '        fetch("/api/signals").then(function(r) { return r.json(); }).then(function(d) {',
  '          latestPlans = d.plans || {};',
  '          allSignals = d.signals || [];',
  '          updateRadarUI(d.radar, d.lastScanTime);',
  '          displaySignalOnCard(msg.data);',
  '          renderSignalsTable(allSignals);',
  '        });',
  '        if (msg.type === "NEW_SIGNAL") {',
  '          playAlertVoice(msg.data);',
  '          document.title = (msg.data.action === "BUY" ? "🟢 BUY " : "🔴 SELL ") + msg.data.ticker + "!";',
  '        }',
  '      }',
  '    };',
  '  </script>',
  '</body>',
  '</html>'
].join('\n');

app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

// 8. ระบบ Anti-Sleep กระตุ้นเซิร์ฟเวอร์ตัวเองทุก 10 นาที ไม่ให้ Render หลับ
setInterval(() => {
  fetch(APP_URL + '/api/ping').catch(() => {});
}, 10 * 60 * 1000);

server.listen(PORT, () => {
  console.log('🚀 Ultimate 4-Strategy M15 Pro Terminal running on port ' + PORT);
  setInterval(scanMarket, 60 * 1000);
  scanMarket();
});
