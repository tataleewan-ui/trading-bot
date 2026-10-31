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

// 1) สินทรัพย์หลักสำหรับเทรดสั้นแท่ง 15 นาที
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

// 2) คลังหุ้นสหรัฐฯ 35 ตัวแทนทุกอุตสาหกรรม (Broad Market Screener)
const BROAD_MARKET_UNIVERSE = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', yahoo: 'NVDA', sector: 'AI & Semiconductor' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', yahoo: 'AMD', sector: 'AI & Semiconductor' },
  { symbol: 'AVGO', name: 'Broadcom Inc', yahoo: 'AVGO', sector: 'AI & Semiconductor' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', yahoo: 'TSM', sector: 'AI & Semiconductor' },
  { symbol: 'QCOM', name: 'Qualcomm Inc', yahoo: 'QCOM', sector: 'AI & Semiconductor' },
  { symbol: 'AAPL', name: 'Apple Inc', yahoo: 'AAPL', sector: 'Big Tech' },
  { symbol: 'MSFT', name: 'Microsoft Corp', yahoo: 'MSFT', sector: 'Big Tech' },
  { symbol: 'AMZN', name: 'Amazon.com', yahoo: 'AMZN', sector: 'Big Tech' },
  { symbol: 'GOOGL', name: 'Alphabet Google', yahoo: 'GOOGL', sector: 'Big Tech' },
  { symbol: 'META', name: 'Meta Platforms', yahoo: 'META', sector: 'Big Tech' },
  { symbol: 'TSLA', name: 'Tesla Inc', yahoo: 'TSLA', sector: 'EV & Tech' },
  { symbol: 'NFLX', name: 'Netflix Inc', yahoo: 'NFLX', sector: 'Big Tech' },
  { symbol: 'PLTR', name: 'Palantir Technologies', yahoo: 'PLTR', sector: 'Software & AI' },
  { symbol: 'CRM', name: 'Salesforce Inc', yahoo: 'CRM', sector: 'Software & AI' },
  { symbol: 'ADBE', name: 'Adobe Inc', yahoo: 'ADBE', sector: 'Software & AI' },
  { symbol: 'JPM', name: 'JPMorgan Chase', yahoo: 'JPM', sector: 'Finance & Banking' },
  { symbol: 'BAC', name: 'Bank of America', yahoo: 'BAC', sector: 'Finance & Banking' },
  { symbol: 'V', name: 'Visa Inc', yahoo: 'V', sector: 'Finance & Banking' },
  { symbol: 'MA', name: 'Mastercard Inc', yahoo: 'MA', sector: 'Finance & Banking' },
  { symbol: 'LLY', name: 'Eli Lilly and Co (ยาลดน้ำหนัก)', yahoo: 'LLY', sector: 'Healthcare' },
  { symbol: 'NVO', name: 'Novo Nordisk (Ozempic)', yahoo: 'NVO', sector: 'Healthcare' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', yahoo: 'JNJ', sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth Group', yahoo: 'UNH', sector: 'Healthcare' },
  { symbol: 'WMT', name: 'Walmart Inc', yahoo: 'WMT', sector: 'Consumer & Retail' },
  { symbol: 'COST', name: 'Costco Wholesale', yahoo: 'COST', sector: 'Consumer & Retail' },
  { symbol: 'KO', name: 'Coca-Cola Company', yahoo: 'KO', sector: 'Consumer & Retail' },
  { symbol: 'MCD', name: "McDonald's Corp", yahoo: 'MCD', sector: 'Consumer & Retail' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp', yahoo: 'XOM', sector: 'Energy & Industrial' },
  { symbol: 'CVX', name: 'Chevron Corp', yahoo: 'CVX', sector: 'Energy & Industrial' },
  { symbol: 'CAT', name: 'Caterpillar Inc', yahoo: 'CAT', sector: 'Energy & Industrial' },
  { symbol: 'BA', name: 'Boeing Co', yahoo: 'BA', sector: 'Energy & Industrial' },
  { symbol: 'QQQ', name: 'Invesco NASDAQ 100 ETF', yahoo: 'QQQ', sector: 'Index ETF' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', yahoo: 'SPY', sector: 'Index ETF' },
  { symbol: 'XAU/USD', name: 'Gold (ทองคำแท่ง)', yahoo: 'GC=F', sector: 'Precious Metals' },
  { symbol: 'BTC/USD', name: 'Bitcoin (คริปโต)', yahoo: 'BTC-USD', sector: 'Crypto' }
];

// 3) ข้อมูลพอร์ตจริงของผู้ใช้ (11 ตัวจากแอป Dime!)
let userHoldings = [
  { id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', shares: 0.0470292, avgCostUSD: 655.55, category: 'หุ้นหลัก', currency: 'USD' },
  { id: 'ttb', symbol: 'TTB', name: 'ธนาคารทหารไทยธนชาต', shares: 162, avgCostTHB: 1.9222, category: 'หุ้นหลัก', currency: 'THB' },
  { id: 'amd', symbol: 'AMD', name: 'Advanced Micro Devices', shares: 0.0150027, avgCostUSD: 537.2349, category: 'หุ้นหลัก', currency: 'USD' },
  { id: 'scbt70x', symbol: 'SCBT70X(26A)', name: 'กองทุน SCB ตราสารหนี้/ผสม', shares: 197.1798, avgCostTHB: 11.9506, category: 'ถือยาว', currency: 'THB' },
  { id: 'gold', symbol: 'YLG-GOLD', name: 'ออมทองคำแท่ง (YLG Gold)', shares: 0.001423, avgCostUSD: 4223.25, category: 'ถือยาว', currency: 'USD' },
  { id: 'xlv', symbol: 'XLV', name: 'Health Care Select Sector SPDR', shares: 0.0293492, avgCostUSD: 159.1185, category: 'ถือยาว', currency: 'USD' },
  { id: 'vt', symbol: 'VT', name: 'Vanguard Total World Stock ETF', shares: 0.0299761, avgCostUSD: 154.79, category: 'ถือยาว', currency: 'USD' },
  { id: 'scbtb', symbol: 'SCBTB(Thai ESGA)', name: 'กองทุนหุ้นไทย ESG', shares: 234.2616, avgCostTHB: 10.8870, category: 'รอขาย', currency: 'THB' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla Inc', shares: 0.0192567, avgCostUSD: 395.1880, category: 'รอขาย', currency: 'USD' },
  { id: 'bidu', symbol: 'BIDU', name: 'Baidu Inc ADR (หุ้นเทคจีน)', shares: 0.0462888, avgCostUSD: 110.61, category: 'รอขาย', currency: 'USD' },
  { id: 'xom', symbol: 'XOM', name: 'Exxon Mobil Corp', shares: 0.0299, avgCostUSD: 100.26, category: 'รอขาย', currency: 'USD' }
];

const YAHOO_MAP = {
  'XAU/USD': 'GC=F',
  'QQQ': 'QQQ',
  'NVDA': 'NVDA',
  'AAPL': 'AAPL',
  'SPY': 'SPY',
  'VOO': 'VOO',
  'AMD': 'AMD',
  'XLV': 'XLV',
  'VT': 'VT',
  'TSLA': 'TSLA',
  'BIDU': 'BIDU',
  'XOM': 'XOM',
  'TTB': 'TTB.BK'
};

app.use(cors());
app.use(express.json());

let signalHistory = [];
let sentCandlesCache = {};
let lastAlertTimestampPerTicker = {};
let marketRadar = {};
let latestPlanBySymbol = {};
let broadMarketCache = [];
let lastScanTime = null;
let lastBroadScanTime = null;
let telegramEnabled = true;

// ==========================================
// 1. ตรวจสอบเวลาตลาดเปิด-ปิดจริง 100%
// ==========================================
function isMarketOpen(symbol) {
  const now = new Date();
  const day = now.getUTCDay();
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (symbol === 'XAU/USD' || symbol === 'YLG-GOLD') {
    if (day === 6) return false;
    if (day === 0 && utcMins < 22 * 60) return false;
    if (day === 5 && utcMins >= 21 * 60) return false;
    if (utcMins >= 21 * 60 && utcMins < 22 * 60) return false;
    return true;
  }
  if (symbol === 'BTC/USD') return true;

  if (symbol === 'TTB' || symbol.includes('SCB')) {
    if (day === 0 || day === 6) return false;
    const bkkMins = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes();
    return (bkkMins >= 10 * 60 && bkkMins <= 12 * 60 + 30) || (bkkMins >= 14 * 60 + 30 && bkkMins <= 16 * 60 + 40);
  }

  // หุ้นสหรัฐฯ (จันทร์-ศุกร์ 20:30 - 03:00 / 21:30 - 04:00 เวลาไทย)
  if (day === 0 || day === 6) return false;
  if (utcMins < 13 * 60 + 30 || utcMins >= 21 * 60) return false;
  return true;
}

function getMarketStatusInfo(symbol) {
  const open = isMarketOpen(symbol);
  if (open) return { isOpen: true, badgeText: '🟢 ตลาดเปิด' };
  if (symbol === 'XAU/USD') return { isOpen: false, badgeText: '⏸️ ตลาดทองปิดพัก' };
  return { isOpen: false, badgeText: '⏸️ ตลาดปิด (เปิด 20:30 น.)' };
}

// ==========================================
// 2. คลังคำนวณ Indicator
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
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - (100 / (1 + (ag / al)));
}

// ==========================================
// 3. ระบบส่ง Telegram
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
          return CHAT_ID;
        }
      }
    }
  } catch (e) {
    console.error('Auto-detect Chat ID error:', e.message);
  }
  return '';
}

async function sendTelegramMessage(text, force = false) {
  if (!telegramEnabled && !force) return false;
  const targetChatId = await resolveTelegramChatId();
  if (!BOT_TOKEN || !targetChatId) return false;
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

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// ==========================================
// 4. ดึงราคา Real-Time จริงจากตลาดโลก
// ==========================================
async function fetchM15Candles(sym) {
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
      console.warn('Binance gold error:', e.message);
    }
  }

  try {
    const ySym = YAHOO_MAP[sym] || sym;
    const yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ySym) + '?interval=15m&range=5d';
    const res = await fetch(yUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (result && result.timestamp && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const ts = result.timestamp;
      const q = result.indicators.quote[0];
      const realPrice = result.meta && result.meta.regularMarketPrice;
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
      if (candles.length > 0 && realPrice) candles[candles.length - 1].close = realPrice;
      if (candles.length >= 60) return candles.slice(-100);
    }
  } catch (e) {
    console.warn('Yahoo fetch M15 error:', e.message);
  }
  return [];
}

async function fetchDailyStockData(yahooTicker) {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooTicker) + '?interval=1d&range=6mo';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (result && result.timestamp && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const ts = result.timestamp;
      const q = result.indicators.quote[0];
      const meta = result.meta || {};
      const livePrice = meta.regularMarketPrice || meta.chartPreviousClose;
      const prevClose = meta.chartPreviousClose || meta.previousClose || livePrice;
      const changePct = prevClose ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;

      let candles = [];
      for (let i = 0; i < ts.length; i++) {
        if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
          candles.push({
            date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
            open: Number(q.open[i]),
            high: Number(q.high[i]),
            low: Number(q.low[i]),
            close: Number(q.close[i])
          });
        }
      }
      return { candles: candles, livePrice: Number(livePrice.toFixed(2)), changePct: changePct };
    }
  } catch (e) {
    console.warn('Daily candles error for ' + yahooTicker, e.message);
  }
  return null;
}

// ==========================================
// 5. วิเคราะห์ Quant หุ้นก้นหลุมรอบเดือน
// ==========================================
function evaluateStockQuant(candles, livePrice, changePct, symbol, name, sector) {
  if (!candles || candles.length < 40) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const curPrice = livePrice || closes[closes.length - 1];
  const ema50 = calculateEMA(closes, 50);
  const ema200 = closes.length >= 200 ? calculateEMA(closes, 200) : calculateEMA(closes, closes.length);
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(candles, 14);

  const last = closes.length - 1;
  const curEMA50 = ema50[last];
  const curEMA200 = ema200[last];

  const monthBars = candles.slice(-22);
  const monthlyHigh = Math.max(...monthBars.map(b => b.high));
  const monthlyLow = Math.min(...monthBars.map(b => b.low));
  const dipFromHighPct = Number((((monthlyHigh - curPrice) / monthlyHigh) * 100).toFixed(1));
  const distFromLowPct = Number((((curPrice - monthlyLow) / monthlyLow) * 100).toFixed(1));

  let score = 40;
  let reasons = [];

  if (curPrice > curEMA200 && curEMA50 >= curEMA200) {
    score += 25;
    reasons.push('เทรนด์ใหญ่ Super Trend ขาขึ้น (50 วันเหนือ 200 วัน)');
  }
  if (curPrice >= curEMA50) {
    score += 10;
    reasons.push('ราคายืนเหนือเส้น 50 วัน');
  }
  if (distFromLowPct <= 3.5 && dipFromHighPct >= 4.0) {
    score += 25;
    reasons.push('🔥 ราคาแตะโซนต่ำสุดรอบเดือน (ห่างก้นหลุม +' + distFromLowPct + '%)');
  } else if (distFromLowPct <= 7.0) {
    score += 15;
    reasons.push('ย่อตัวใกล้ฐานแนวรับรอบเดือน');
  }
  if (rsi >= 38 && rsi <= 50) {
    score += 20;
    reasons.push('RSI (' + rsi.toFixed(0) + ') โซนสะสมพลัง Golden Dip');
  }

  let verdict = 'HOLD';
  let badgeText = '⚪ ถือ / รอย่อตัว';
  let verdictClass = 'bg-slate-800 text-slate-300';
  let actionGuide = 'ราคายังอยู่กลางทาง ควรรอให้ย่อตัวลงมาใกล้แนวรับก้นหลุมรอบเดือนก่อนเข้าซื้อ';

  const buyZoneLow = Number(Math.max(monthlyLow, curPrice - atr * 0.7).toFixed(2));
  const buyZoneHigh = Number(curPrice.toFixed(2));
  const slPrice = Number((Math.min(monthlyLow, curPrice) - atr * 1.5).toFixed(2));
  const tp1Price = Number((curPrice + atr * 2.2).toFixed(2));
  const tp2Price = Number((curPrice + atr * 4.2).toFixed(2));
  const upsidePercent = Number((((tp2Price - curPrice) / curPrice) * 100).toFixed(1));

  if (distFromLowPct <= 4.0 && score >= 75) {
    verdict = 'BUY_NOW';
    badgeText = '🛒 จังหวะช้อนซื้อก้นหลุมรอบเดือน (Golden Dip Buy)';
    verdictClass = 'bg-emerald-500 text-slate-950 font-black animate-pulse';
    actionGuide = 'ราคาลงมาแตะแนวรับต่ำสุดของเดือนแล้ว เข้าซื้อสะสมได้ทันที วาง SL ใต้ Low เดือน';
  } else if (distFromLowPct <= 7.0 && score >= 60) {
    verdict = 'BUY_DIP';
    badgeText = '🟢 ทยอยแบ่งไม้เข้าซื้อ (Buy on Dip)';
    verdictClass = 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40';
    actionGuide = 'ย่อตัวได้เปรียบ แนะนำแบ่งเข้า 2 ไม้ในโซนราคาที่แนะนำ';
  } else if (rsi >= 68 || curPrice >= tp1Price) {
    verdict = 'TAKE_PROFIT';
    badgeText = '🎯 โซนรอขายทำกำไร (Take Profit Zone)';
    verdictClass = 'bg-amber-500 text-slate-950 font-black';
    actionGuide = 'ราคาขึ้นมาชนเป้าทำกำไรแล้ว แนะนำแบ่งปิดทำกำไร 50% แล้วเลื่อน SL มากันทุน';
  }

  return {
    symbol: symbol,
    name: name || symbol,
    sector: sector || 'US Market',
    price: curPrice,
    changePct: changePct,
    monthlyLow: monthlyLow,
    monthlyHigh: monthlyHigh,
    distFromLowPct: distFromLowPct,
    score: Math.min(99, Math.max(30, score)),
    verdict: verdict,
    badgeText: badgeText,
    verdictClass: verdictClass,
    actionGuide: actionGuide,
    buyZone: buyZoneLow + ' - ' + buyZoneHigh,
    sl: slPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    upside: upsidePercent,
    reason: reasons.join(' • ')
  };
}

async function scanBroadMarketUniverse() {
  let list = [];
  for (const item of BROAD_MARKET_UNIVERSE) {
    try {
      const data = await fetchDailyStockData(item.yahoo);
      if (data && data.candles) {
        const res = evaluateStockQuant(data.candles, data.livePrice, data.changePct, item.symbol, item.name, item.sector);
        if (res) list.push(res);
      }
    } catch (e) {}
  }
  list.sort((a, b) => b.score - a.score);
  broadMarketCache = list;
  lastBroadScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
  return list;
}

// ==========================================
// 6. วิเคราะห์พอร์ตของคุณ (AI Portfolio Doctor)
// ==========================================
async function analyzeUserPortfolio() {
  const USD_TO_THB = 33.42;
  let diagnosedList = [];
  let totalValueTHB = 0;
  let totalCostTHB = 0;

  for (let item of userHoldings) {
    let currentPrice = item.currency === 'USD' ? item.avgCostUSD : item.avgCostTHB;
    const yahooSym = YAHOO_MAP[item.symbol];

    if (item.symbol === 'YLG-GOLD') {
      try {
        const bPrice = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').then(r => r.json());
        if (bPrice && bPrice.price) currentPrice = parseFloat(bPrice.price);
      } catch (e) {}
    } else if (yahooSym) {
      const d = await fetchDailyStockData(yahooSym);
      if (d && d.livePrice) currentPrice = d.livePrice;
    }

    let valueTHB = 0, costTHB = 0;
    if (item.currency === 'USD') {
      costTHB = item.shares * item.avgCostUSD * USD_TO_THB;
      valueTHB = item.shares * currentPrice * USD_TO_THB;
    } else {
      costTHB = item.shares * item.avgCostTHB;
      valueTHB = item.shares * currentPrice;
    }

    const profitTHB = valueTHB - costTHB;
    const profitPct = costTHB > 0 ? (profitTHB / costTHB) * 100 : 0;
    totalValueTHB += valueTHB;
    totalCostTHB += costTHB;

    let healthStatus = 'GOOD', actionVerdict = 'HOLD', diagnosis = '', advice = '';
    if (item.symbol === 'BIDU') {
      healthStatus = 'ALARM';
      actionVerdict = 'CONSIDER_CUT';
      diagnosis = '🚨 หุ้นน่าเป็นห่วงที่สุดในพอร์ต! ขาดทุน -22% และเทรนด์เทคจีนอ่อนแรง';
      advice = 'แนะนำทยอย Cut Loss หรือเปลี่ยนเงินไปสมทบ VOO';
    } else if (item.symbol === 'VOO' || item.symbol === 'VT') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'BUY_MORE';
      diagnosis = '⭐ เสาหลักที่ดีที่สุดของพอร์ต เติบโตตามดัชนีหุ้นโลกและสหรัฐฯ';
      advice = 'วันนี้ตัวนี้น่าซื้อสะสม (DCA) เพิ่มที่สุด ควรถือให้เป็น 50%+ ของพอร์ต';
    } else if (item.symbol === 'TTB') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'HOLD_DIVIDEND';
      diagnosis = '🏆 กำไรสูงสุดในพอร์ต (+48%) รับเงินปันผลสม่ำเสมอ';
      advice = 'ถือรับปันผลต่อไปได้สบายๆ ต้นทุนต่ำ';
    } else if (item.symbol === 'AMD') {
      healthStatus = 'GOOD';
      actionVerdict = 'HOLD_GROWTH';
      diagnosis = '🟢 กำไรเติบโตดี (+13%) ได้รับอานิสงส์จากกระแส AI & ชิป';
      advice = 'ถือรันเทรนด์ต่อได้ อุตสาหกรรมชิปยังโตได้อีก';
    } else if (item.symbol === 'TSLA') {
      healthStatus = 'WATCH';
      actionVerdict = 'WAIT_REBOUND';
      diagnosis = '⚠️ ย่อตัวติดลบเล็กน้อย (-3%)';
      advice = 'อยู่ในพอร์ตรอขาย ถ้าราคาดีดตัวกลับมาบวกแนะนำแบ่งปิดกำไร';
    } else if (item.symbol.includes('SCBTB')) {
      healthStatus = 'WATCH';
      actionVerdict = 'HOLD_OR_SWITCH';
      diagnosis = '⚠️ กองทุนหุ้นไทย ESG ขาดทุน -4.8%';
      advice = 'หากเด้งขึ้นมาเท่าทุน พิจารณาย้ายเงินไปใส่ VOO';
    } else {
      healthStatus = 'NEUTRAL';
      actionVerdict = 'HOLD';
      diagnosis = '⚪ พอร์ตกระจายความเสี่ยง (กองทุนตราสารหนี้ & ทองคำ)';
      advice = 'ถือเป็นเกราะป้องกันความผันผวนของพอร์ต';
    }

    diagnosedList.push({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      category: item.category,
      currency: item.currency,
      shares: item.shares,
      avgCost: item.currency === 'USD' ? item.avgCostUSD : item.avgCostTHB,
      currentPrice: Number(currentPrice.toFixed(2)),
      valueTHB: Number(valueTHB.toFixed(2)),
      costTHB: Number(costTHB.toFixed(2)),
      profitTHB: Number(profitTHB.toFixed(2)),
      profitPct: Number(profitPct.toFixed(2)),
      healthStatus: healthStatus,
      actionVerdict: actionVerdict,
      diagnosis: diagnosis,
      advice: advice
    });
  }

  const totalProfitTHB = totalValueTHB - totalCostTHB;
  const totalProfitPct = totalCostTHB > 0 ? (totalProfitTHB / totalCostTHB) * 100 : 0;

  return {
    totalValueTHB: Number(totalValueTHB.toFixed(2)),
    totalCostTHB: Number(totalCostTHB.toFixed(2)),
    totalProfitTHB: Number(totalProfitTHB.toFixed(2)),
    totalProfitPct: Number(totalProfitPct.toFixed(2)),
    holdings: diagnosedList,
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  };
}

// ==========================================
// 7. ลูปสแกน M15 ประจำ
// ==========================================
async function scanMarket() {
  const now = Date.now();

  for (const sym of M15_SYMBOLS) {
    try {
      const mktOpen = isMarketOpen(sym);
      const candles = await fetchM15Candles(sym);
      if (candles && candles.length >= 60) {
        const closes = candles.map(c => c.close);
        const ema50 = calculateEMA(closes, 50);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(candles, 14);
        const rsi = calculateRSI(closes, 14);

        const last = candles.length - 1;
        const curPrice = closes[last];
        const isBuy = curPrice > ema50[last];
        const slDist = Math.max(atr * 1.4, curPrice * 0.0015);

        const mktStatus = getMarketStatusInfo(sym);

        const livePlan = {
          id: 'plan_' + sym,
          ticker: sym,
          action: isBuy ? 'BUY' : 'SELL',
          strategy: isBuy ? 'สูตร 1: เกาะเทรนด์ขาขึ้น (M15 Trend Pullback)' : 'สูตร 1: เกาะเทรนด์ขาลง (M15 Trend Follow)',
          reason: isBuy
            ? 'ราคายืนเหนือ EMA 50 และ EMA 21 (RSI: ' + rsi.toFixed(0) + ') แนะนำโฟกัสฝั่ง BUY'
            : 'ราคาอยู่ใต้ EMA 50 และ EMA 21 (RSI: ' + rsi.toFixed(0) + ') แนะนำโฟกัสฝั่ง SELL',
          timeframe: '15m',
          entry: Number(curPrice.toFixed(2)),
          sl: Number((isBuy ? curPrice - slDist : curPrice + slDist).toFixed(2)),
          tp1: Number((isBuy ? curPrice + slDist * 1.5 : curPrice - slDist * 1.5).toFixed(2)),
          tp2: Number((isBuy ? curPrice + slDist * 2.5 : curPrice - slDist * 2.5).toFixed(2)),
          risk: Number(slDist.toFixed(2)),
          rsi: Number(rsi.toFixed(1)),
          stars: 5,
          status: 'ACTIVE_PLAN',
          time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
        };
        latestPlanBySymbol[sym] = livePlan;

        marketRadar[sym] = {
          ticker: sym,
          price: livePlan.entry,
          rsi: livePlan.rsi,
          trend: isBuy ? 'BULL' : 'BEAR',
          action: livePlan.action,
          sl: livePlan.sl,
          tp1: livePlan.tp1,
          tp2: livePlan.tp2,
          isOpen: mktStatus.isOpen,
          statusText: mktStatus.badgeText
        };

        // ถ้าตลาดปิด ไม่ส่ง Telegram
        if (!mktOpen) continue;

        const curCandle = candles[last];
        const candleKey = sym + '_' + curCandle.datetime;
        const isCooldownPassed = now - (lastAlertTimestampPerTicker[sym] || 0) > 45 * 60 * 1000;

        if (!sentCandlesCache[candleKey] && isCooldownPassed) {
          const prevClose = closes[last - 1];
          const curEMA21 = ema21[last];
          const prevEMA21 = ema21[last - 1];
          const isTriggerBuy = curPrice > ema50[last] && prevClose <= prevEMA21 && curPrice > curEMA21 && rsi >= 46 && rsi <= 68;
          const isTriggerSell = curPrice < ema50[last] && prevClose >= prevEMA21 && curPrice < curEMA21 && rsi <= 54 && rsi >= 32;

          if (isTriggerBuy || isTriggerSell) {
            sentCandlesCache[candleKey] = true;
            lastAlertTimestampPerTicker[sym] = now;
            const newSig = {
              id: 'sig_' + Date.now(),
              ticker: sym,
              action: isTriggerBuy ? 'BUY' : 'SELL',
              strategy: isTriggerBuy ? 'สูตร 1: ย่อซื้อตามเทรนด์ขาขึ้น (Trend Pullback)' : 'สูตร 1: เด้งขายตามเทรนด์ขาลง (Trend Follow)',
              entry: livePlan.entry,
              sl: livePlan.sl,
              tp1: livePlan.tp1,
              tp2: livePlan.tp2,
              risk: livePlan.risk,
              rsi: livePlan.rsi,
              time: curCandle.timeLabel || livePlan.time,
              status: 'OPEN'
            };
            signalHistory.unshift(newSig);
            broadcast({ type: 'NEW_SIGNAL', data: newSig });

            const msg =
              (isTriggerBuy ? '🟢' : '🔴') + ' <b>สัญญาณเทรด M15 ใหม่: ' + newSig.ticker + '</b>\n' +
              '──────────────────\n' +
              '📊 <b>คำสั่ง:</b> ' + (isTriggerBuy ? 'BUY (เปิดออเดอร์ซื้อ)' : 'SELL (เปิดออเดอร์ขาย)') + '\n' +
              '💵 <b>ราคาเข้า:</b> <code>' + newSig.entry + '</code>\n' +
              '🛑 <b>Stop Loss:</b> <code>' + newSig.sl + '</code> (ระยะ ~$' + newSig.risk + ')\n' +
              '🎯 <b>เป้า 1 (TP1):</b> <code>' + newSig.tp1 + '</code>\n' +
              '🚀 <b>เป้า 2 (TP2):</b> <code>' + newSig.tp2 + '</code>\n' +
              '💡 <i>ตลาดเปิดทำการปกติ เข้าออเดอร์ตาม Money Management</i>';
            await sendTelegramMessage(msg);
          }
        }
      }
    } catch (e) {
      console.error('Scan error:', sym, e.message);
    }
  }

  lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  broadcast({
    type: 'RADAR_UPDATE',
    radar: marketRadar,
    plans: latestPlanBySymbol,
    lastScanTime: lastScanTime
  });
}

// ==========================================
// 8. API Endpoints
// ==========================================
app.get('/api/signals', (req, res) => res.json({
  signals: signalHistory,
  radar: marketRadar,
  plans: latestPlanBySymbol,
  broad: broadMarketCache,
  telegramEnabled: telegramEnabled,
  lastScanTime: lastScanTime
}));

app.get('/api/broad-market', async (req, res) => {
  if (broadMarketCache.length === 0) await scanBroadMarketUniverse();
  res.json({ updatedAt: lastBroadScanTime, stocks: broadMarketCache });
});

app.get('/api/analyze-stock', async (req, res) => {
  const sym = (req.query.symbol || '').toUpperCase().trim();
  if (!sym) return res.status(400).json({ error: 'กรุณาระบุชื่อย่อหุ้น' });
  try {
    const data = await fetchDailyStockData(sym);
    if (!data || !data.candles || data.candles.length < 40) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลราคาหุ้น ' + sym });
    }
    const result = evaluateStockQuant(data.candles, data.livePrice, data.changePct, sym, sym + ' Inc', 'US Market');
    res.json({ ok: true, stock: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/my-portfolio', async (req, res) => {
  const analysis = await analyzeUserPortfolio();
  res.json(analysis);
});

app.post('/api/update-holding', async (req, res) => {
  const { symbol, newShares, newAvgCost, category } = req.body;
  if (!symbol || newShares == null) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });

  const existing = userHoldings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
  if (existing) {
    existing.shares = parseFloat(newShares);
    if (newAvgCost != null && parseFloat(newAvgCost) > 0) {
      if (existing.currency === 'USD') existing.avgCostUSD = parseFloat(newAvgCost);
      else existing.avgCostTHB = parseFloat(newAvgCost);
    }
    if (category) existing.category = category;
  } else {
    userHoldings.push({
      id: 'h_' + Date.now(),
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      shares: parseFloat(newShares),
      avgCostUSD: parseFloat(newAvgCost) || 100,
      category: category || 'หุ้นหลัก',
      currency: 'USD'
    });
  }

  const updatedAnalysis = await analyzeUserPortfolio();
  broadcast({ type: 'PORTFOLIO_UPDATED', portfolio: updatedAnalysis });
  res.json({ ok: true, portfolio: updatedAnalysis });
});

app.post('/api/send-portfolio-telegram', async (req, res) => {
  const data = await analyzeUserPortfolio();
  let msg = '📊 <b>รายงานตรวจสุขภาพพอร์ตของคุณ (Dime Portfolio Doctor)</b>\n';
  msg += 'มูลค่าพอร์ตรวม: <b>฿' + data.totalValueTHB.toLocaleString() + '</b> (' + (data.totalProfitPct >= 0 ? '+' : '') + data.totalProfitPct + '%)\n';
  msg += '──────────────────\n';
  msg += '⭐ <b>ตัวที่ควรซื้อสะสม (BUY):</b> <code>VOO</code> (เสาหลักโตสม่ำเสมอ)\n';
  msg += '🚨 <b>ตัวที่น่าเป็นห่วงที่สุด:</b> <code>BIDU</code> (ขาดทุน -22% แนะนำ Cut Loss/สลับตัว)\n';
  msg += '🏆 <b>ตัวที่ทำกำไรสูงสุด:</b> <code>TTB</code> (+48.8% ถือรับปันผล)\n';
  msg += '💡 <b>คำแนะนำวันนี้:</b> เน้นเติมเงินเข้า VOO และลดการกระจายตัวเล็กๆ ลง\n';
  msg += '──────────────────\n';

  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok: ok });
});

app.post('/api/test-telegram', async (req, res) => {
  const sym = (req.body && req.body.symbol) || 'XAU/USD';
  const target = latestPlanBySymbol[sym] || signalHistory[0];
  let ok = false;
  if (target) {
    const isBuy = target.action === 'BUY';
    const text =
      (isBuy ? '🟢' : '🔴') + ' <b>แผนจุดเข้า M15: ' + target.ticker + '</b>\n' +
      '💵 ราคาเข้า: <code>' + target.entry + '</code> | 🛑 SL: <code>' + target.sl + '</code> | 🎯 TP: <code>' + target.tp1 + '</code>';
    ok = await sendTelegramMessage(text, true);
  }
  res.json({ ok: ok });
});

app.post('/api/toggle-telegram', (req, res) => {
  telegramEnabled = !telegramEnabled;
  res.json({ ok: true, telegramEnabled: telegramEnabled });
});

app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// 9. หน้าเว็บ All-in-One Master Terminal (รวมครบทั้ง 3 หน้าจอในที่เดียว!)
// ==========================================
const HTML_PAGE = [
  '<!DOCTYPE html>',
  '<html lang="th" class="dark">',
  '<head>',
  '  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '  <title>M15 Pro Trading Terminal & Personal Portfolio Doctor</title>',
  '  <script src="https://cdn.tailwindcss.com"></script>',
  '  <style>',
  '    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");',
  '    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }',
  '    .copy-card { cursor: pointer; transition: all 0.15s ease; }',
  '    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }',
  '    .copy-card:active { transform: scale(0.98); }',
  '    @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }',
  '    .pulse-live { animation: pulse-subtle 2s infinite; }',
  '  </style>',
  '</head>',
  '<body class="min-h-screen flex flex-col">',
  '  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 py-3">',
  '    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">',
  '      <div class="flex items-center gap-3">',
  '        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-purple-600 to-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">⚡</div>',
  '        <div>',
  '          <div class="flex items-center gap-2">',
  '            <h1 class="font-bold text-base text-white">M15 Trading Terminal & Portfolio Doctor</h1>',
  '            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">',
  '              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live"></span> REALTIME LIVE',
  '            </span>',
  '          </div>',
  '          <p class="text-xs text-slate-400">ระบบบอกจุดเข้า BUY/SELL สด, ตรวจสุขภาพพอร์ต Dime จริง, และสแกนหุ้นเด่นทั้งตลาด</p>',
  '        </div>',
  '      </div>',
  '      <div class="flex items-center flex-wrap gap-2 text-xs">',
  '        <div class="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">',
  '          🕒 แท่ง 15m ปิดใน: <span id="timer" class="font-mono font-bold text-amber-400">--:--</span>',
  '        </div>',
  '        <button id="voice-btn" class="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700">🗣️ เสียงพูด: เปิด</button>',
  '        <button id="tg-test-btn" class="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition">📲 ส่งแผนเข้า Telegram</button>',
  '      </div>',
  '    </div>',
  '  </header>',
  '',
  '  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">',
  '    <!-- 3-Tab Master Navigation Bar -->',
  '    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">',
  '      <button id="tab-btn-m15" onclick="switchTab(\'m15\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md">',
  '        ⚡ หน้าเทรดหลัก: จุดเข้า BUY/SELL แท่ง 15 นาที (M15 Terminal)',
  '      </button>',
  '      <button id="tab-btn-portfolio" onclick="switchTab(\'portfolio\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">',
  '        💼 พอร์ตหุ้นของคุณ 11 ตัว & หมอตรวจสุขภาพ (My Portfolio Doctor)',
  '      </button>',
  '      <button id="tab-btn-broad" onclick="switchTab(\'broad\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">',
  '        🌍 สแกนหุ้นเด่นทั้งตลาด & ค้นหาหุ้นทุกตัว (Stock Screener)',
  '      </button>',
  '    </div>',
  '',
  '    <!-- TAB 1: M15 PRO TRADING TERMINAL (หน้าเทรดหลักครบชุดตามที่ทำไว้แต่แรก!) -->',
  '    <div id="view-m15" class="flex flex-col gap-4">',
  '      <!-- 5-Asset Live Radar Bar with Status & Price -->',
  '      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5" id="radar-grid">',
  '        <div onclick="setAsset(\'OANDA:XAUUSD\',\'XAU/USD\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border-2 border-amber-500/80 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-amber-400">🥇 XAU/USD (ทองคำ)</span><span id="rad-status-XAU/USD" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">🟢 ตลาดเปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-XAU/USD" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-XAU/USD" class="text-[10px] text-slate-400">RSI --</span></div>',
  '          <p class="text-[10px] text-amber-300 mt-1 truncate">คลิกเพื่อดูจุดเข้า/SL/TP</p>',
  '        </div>',
  '        <div onclick="setAsset(\'NASDAQ:QQQ\',\'QQQ\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-sky-400">📊 NASDAQ (QQQ)</span><span id="rad-status-QQQ" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-QQQ" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-QQQ" class="text-[10px] text-slate-400">RSI --</span></div>',
  '          <p class="text-[10px] text-slate-400 mt-1 truncate">เปิด 20:30 น.</p>',
  '        </div>',
  '        <div onclick="setAsset(\'NASDAQ:NVDA\',\'NVDA\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-emerald-400">⚡ NVDA (Nvidia)</span><span id="rad-status-NVDA" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-NVDA" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-NVDA" class="text-[10px] text-slate-400">RSI --</span></div>',
  '          <p class="text-[10px] text-slate-400 mt-1 truncate">เปิด 20:30 น.</p>',
  '        </div>',
  '        <div onclick="setAsset(\'NASDAQ:AAPL\',\'AAPL\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-slate-200">🍏 AAPL (Apple)</span><span id="rad-status-AAPL" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-AAPL" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-AAPL" class="text-[10px] text-slate-400">RSI --</span></div>',
  '          <p class="text-[10px] text-slate-400 mt-1 truncate">เปิด 20:30 น.</p>',
  '        </div>',
  '        <div onclick="setAsset(\'AMEX:SPY\',\'SPY\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-indigo-400">🇺🇸 SPY (S&P 500)</span><span id="rad-status-SPY" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-SPY" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-SPY" class="text-[10px] text-slate-400">RSI --</span></div>',
  '          <p class="text-[10px] text-slate-400 mt-1 truncate">เปิด 20:30 น.</p>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Chart & Main Signal Card -->',
  '      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">',
  '        <!-- Chart (8 cols) -->',
  '        <div class="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[540px] shadow-lg flex flex-col">',
  '          <div class="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs bg-slate-950/60">',
  '            <span id="chart-label" class="font-bold text-amber-400">📈 กราฟปัจจุบัน: XAU/USD (ทองคำ • 15 นาที)</span>',
  '            <div class="flex items-center gap-2">',
  '              <span id="market-open-badge" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">🟢 ตลาดเปิดทำการ</span>',
  '              <button onclick="document.getElementById(\'tv-frame\').src=document.getElementById(\'tv-frame\').src" class="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800">🔄 รีเฟรชกราฟ</button>',
  '            </div>',
  '          </div>',
  '          <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full flex-1 border-0"></iframe>',
  '        </div>',
  '',
  '        <!-- Prominent Active Signal Card (4 cols) -->',
  '        <div class="lg:col-span-4 flex flex-col gap-4">',
  '          <div class="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">',
  '            <div>',
  '              <div class="flex items-center justify-between border-b border-slate-800 pb-3">',
  '                <div>',
  '                  <span class="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">สัญญาณเทรด M15 ล่าสุด</span>',
  '                  <h3 id="card-ticker" class="text-lg font-black text-white mt-0.5">XAU/USD (Gold)</h3>',
  '                </div>',
  '                <span id="card-action-badge" class="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md">🟢 BUY (ซื้อ)</span>',
  '              </div>',
  '',
  '              <div class="mt-2.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs">',
  '                <p id="card-strategy" class="font-bold text-amber-400">🧠 สูตร 1: เกาะเทรนด์ขาขึ้น (M15 Setup)</p>',
  '                <p id="card-reason" class="text-[11px] text-slate-300 mt-0.5">ราคายืนเหนือ EMA 50 และ EMA 21 แนะนำโฟกัสฝั่ง BUY</p>',
  '              </div>',
  '',
  '              <p class="text-[11px] text-sky-400 mt-2.5 flex items-center justify-between">',
  '                <span>👆 คลิกที่กล่องตัวเลขเพื่อ Copy ราคาไปวางใน MT4/MT5</span>',
  '                <span id="copy-toast" class="text-emerald-400 font-bold"></span>',
  '              </p>',
  '',
  '              <!-- Price Grid -->',
  '              <div class="grid grid-cols-2 gap-2.5 my-2.5 text-xs font-mono">',
  '                <div onclick="copyText(\'card-entry\',\'ราคาเข้า\')" class="copy-card bg-slate-800/80 p-3 rounded-xl border border-slate-700">',
  '                  <div class="flex justify-between"><span class="text-slate-400 font-sans">💵 จุดเข้า (Entry)</span><span class="text-[10px] text-slate-400">📋 Copy</span></div>',
  '                  <p id="card-entry" class="text-lg font-extrabold text-white mt-0.5">--</p>',
  '                  <span class="text-[10px] text-slate-400 font-sans">ราคาตลาดปัจจุบัน</span>',
  '                </div>',
  '                <div onclick="copyText(\'card-sl\',\'Stop Loss\')" class="copy-card bg-rose-950/30 p-3 rounded-xl border border-rose-800/50">',
  '                  <div class="flex justify-between"><span class="text-rose-300 font-sans">🛑 Stop Loss</span><span class="text-[10px] text-rose-300">📋 Copy</span></div>',
  '                  <p id="card-sl" class="text-lg font-extrabold text-rose-400 mt-0.5">--</p>',
  '                  <span id="card-sl-usd" class="text-[10px] text-rose-400 font-sans font-semibold">เสี่ยง: -$10.00</span>',
  '                </div>',
  '                <div onclick="copyText(\'card-tp1\',\'TP1\')" class="copy-card bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">',
  '                  <div class="flex justify-between"><span class="text-emerald-300 font-sans">🎯 TP1 (ปิด 50%)</span><span class="text-[10px] text-emerald-300">📋 Copy</span></div>',
  '                  <p id="card-tp1" class="text-lg font-extrabold text-emerald-400 mt-0.5">--</p>',
  '                  <span id="card-tp1-usd" class="text-[10px] text-emerald-400 font-sans font-semibold">กำไร: +$15.00</span>',
  '                </div>',
  '                <div onclick="copyText(\'card-tp2\',\'TP2\')" class="copy-card bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">',
  '                  <div class="flex justify-between"><span class="text-teal-300 font-sans">🚀 TP2 (เป้าหลัก)</span><span class="text-[10px] text-teal-300">📋 Copy</span></div>',
  '                  <p id="card-tp2" class="text-lg font-extrabold text-teal-300 mt-0.5">--</p>',
  '                  <span id="card-tp2-usd" class="text-[10px] text-teal-300 font-sans font-semibold">กำไร: +$25.00</span>',
  '                </div>',
  '              </div>',
  '            </div>',
  '          </div>',
  '',
  '          <!-- Smart Lot Size Calculator -->',
  '          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs">',
  '            <div class="flex items-center justify-between mb-2">',
  '              <h4 class="font-bold text-amber-400">🧮 คำนวณขนาด Lot ปลอดภัย</h4>',
  '              <span class="text-[10px] text-slate-400">จำค่าอัตโนมัติ</span>',
  '            </div>',
  '            <div class="grid grid-cols-2 gap-2 mb-2">',
  '              <div>',
  '                <label class="text-slate-400">ทุนในพอร์ต ($):</label>',
  '                <input type="number" id="inp-bal" value="1000" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-white mt-1">',
  '              </div>',
  '              <div>',
  '                <label class="text-slate-400">ความเสี่ยงต่อไม้:</label>',
  '                <select id="inp-risk" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-white mt-1">',
  '                  <option value="0.5">0.5% (เซฟสุดๆ)</option>',
  '                  <option value="1" selected>1.0% (แนะนำ)</option>',
  '                  <option value="2">2.0% (มาตรฐาน)</option>',
  '                </select>',
  '              </div>',
  '            </div>',
  '            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between mt-2">',
  '              <div>',
  '                <span class="text-slate-400 block">ขนาด Lot ที่ควรออก:</span>',
  '                <span id="risk-usd" class="text-[11px] text-rose-400">ถ้าแพ้เสียแค่ $10.00</span>',
  '              </div>',
  '              <span id="out-lot" class="text-xl font-black text-emerald-400 font-mono">0.02 Lot</span>',
  '            </div>',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- TAB 2: PERSONAL PORTFOLIO DOCTOR (พอร์ตหุ้นจริง 11 ตัวของคุณ) -->',
  '    <div id="view-portfolio" class="hidden flex flex-col gap-5">',
  '      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">มูลค่าพอร์ตรวม (THB)</span>',
  '          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿--</p>',
  '          <span class="text-[11px] text-slate-400">ต้นทุน: <span id="pf-total-cost">฿--</span></span>',
  '        </div>',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">กำไร/ขาดทุนรวม</span>',
  '          <p id="pf-total-profit" class="text-2xl font-black text-emerald-400 mt-1">--</p>',
  '          <span class="text-[11px] text-slate-400">ผลตอบแทนรวมทั้งพอร์ต</span>',
  '        </div>',
  '        <div class="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-4">',
  '          <span class="text-xs text-rose-300 font-bold block">🚨 หุ้นที่น่าเป็นห่วงที่สุด</span>',
  '          <p class="text-xl font-black text-rose-400 mt-1">BIDU (-22.8%)</p>',
  '          <span class="text-[11px] text-rose-300/80">เทคจีนติดลบหนัก แนะนำลดความเสี่ยง</span>',
  '        </div>',
  '        <div class="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4">',
  '          <span class="text-xs text-emerald-300 font-bold block">⭐ วันนี้ควรซื้อเพิ่มตัวไหน?</span>',
  '          <p class="text-xl font-black text-emerald-400 mt-1">VOO (S&P 500)</p>',
  '          <span class="text-[11px] text-emerald-300/80">เสาหลักพอร์ต เติบโตแข็งแกร่งที่สุด</span>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Form: Add or Update Holdings -->',
  '      <div class="bg-slate-900 border-2 border-purple-500/40 rounded-2xl p-4 shadow-xl">',
  '        <div class="flex items-center justify-between mb-2">',
  '          <h3 class="font-bold text-sm text-purple-300 flex items-center gap-2">',
  '            <span>➕</span> บันทึกจำนวนหุ้นเพิ่มเมื่อซื้อใหม่ (Update Holdings)',
  '          </h3>',
  '          <span class="text-[11px] text-slate-400">บันทึกแล้วระบบจะคำนวณกำไร/ขาดทุนใหม่ทันที</span>',
  '        </div>',
  '        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">เลือกหุ้นที่คุณซื้อ:</label>',
  '            <select id="inp-add-symbol" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-bold text-white focus:outline-none focus:border-purple-400">',
  '              <option value="VOO">VOO (Vanguard S&P 500)</option>',
  '              <option value="TTB">TTB (ธนาคารทหารไทยธนชาต)</option>',
  '              <option value="AMD">AMD (Advanced Micro Devices)</option>',
  '              <option value="VT">VT (Vanguard World)</option>',
  '              <option value="XLV">XLV (Healthcare ETF)</option>',
  '              <option value="TSLA">TSLA (Tesla)</option>',
  '              <option value="XOM">XOM (Exxon Mobil)</option>',
  '              <option value="BIDU">BIDU (Baidu)</option>',
  '              <option value="YLG-GOLD">YLG-GOLD (ทองคำ)</option>',
  '              <option value="SCBT70X(26A)">SCBT70X(26A) (กองทุน SCB)</option>',
  '              <option value="SCBTB(Thai ESGA)">SCBTB(Thai ESGA)</option>',
  '            </select>',
  '          </div>',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">จำนวนหุ้นคงเหลือทั้งหมด:</label>',
  '            <input type="number" step="any" id="inp-add-shares" placeholder="เช่น 0.05 หรือ 200" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono text-white focus:outline-none focus:border-purple-400">',
  '          </div>',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">ต้นทุนเฉลี่ยใหม่ (USD หรือ บาท):</label>',
  '            <input type="number" step="any" id="inp-add-cost" placeholder="ต้นทุนเฉลี่ยต่อหุ้น" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono text-white focus:outline-none focus:border-purple-400">',
  '          </div>',
  '          <div class="flex items-end">',
  '            <button onclick="saveHoldingUpdate()" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition shadow-md">',
  '              💾 บันทึกจำนวนหุ้นลงพอร์ต',
  '            </button>',
  '          </div>',
  '        </div>',
  '        <p id="add-toast" class="text-xs text-emerald-400 font-bold mt-2 text-center h-4"></p>',
  '      </div>',
  '',
  '      <!-- Holdings Table & Diagnosis -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">',
  '        <div class="flex items-center justify-between mb-3">',
  '          <div>',
  '            <h3 class="font-bold text-sm text-white">📋 รายการหุ้นทั้งหมดในพอร์ตของคุณ (ตรวจสุขภาพ & คำแนะนำ)</h3>',
  '            <span class="text-xs text-slate-400">แยกตามพอร์ตหุ้นหลัก, ถือยาว, และรอขาย</span>',
  '          </div>',
  '          <button onclick="loadMyPortfolio()" class="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3 py-1.5 rounded-lg border border-slate-700">🔄 รีเฟรชราคาพอร์ต</button>',
  '        </div>',
  '        <div class="overflow-x-auto">',
  '          <table class="w-full text-left text-xs font-mono">',
  '            <thead>',
  '              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">',
  '                <th class="py-3 px-3">หมวด</th>',
  '                <th class="py-3 px-3">ชื่อสินทรัพย์</th>',
  '                <th class="py-3 px-3">จำนวนหุ้น</th>',
  '                <th class="py-3 px-3">ต้นทุนเฉลี่ย</th>',
  '                <th class="py-3 px-3">ราคาตลาดสด</th>',
  '                <th class="py-3 px-3">มูลค่าปัจจุบัน</th>',
  '                <th class="py-3 px-3">กำไร/ขาดทุน</th>',
  '                <th class="py-3 px-3 font-sans">สถานะ & คำแนะนำ</th>',
  '              </tr>',
  '            </thead>',
  '            <tbody id="pf-tbody" class="divide-y divide-slate-800/60 font-sans">',
  '              <tr><td colspan="8" class="py-6 text-center text-slate-500">กำลังดึงข้อมูลพอร์ตของคุณ...</td></tr>',
  '            </tbody>',
  '          </table>',
  '        </div>',
  '      </div>',
  '',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs space-y-2 leading-relaxed">',
  '        <h4 class="font-bold text-sm text-amber-400 flex items-center gap-1.5">',
  '          <span>🧠</span> คำแนะนำจากหมอพอร์ต (Portfolio Optimization):',
  '        </h4>',
  '        <p class="text-slate-300">1. <b>พอร์ตกระจายตัวมากเกินไปเทียบกับเงินทุน:</b> เงินทุนรวม ~7,700 บาท แต่ถือถึง 11 ตัว ทำให้กำไรต่อตัวไม่เต็มเม็ดเต็มหน่วย</p>',
  '        <p class="text-slate-300">2. <b>สูตรพอร์ตเศรษฐีที่แนะนำ:</b> แบ่งเงิน <b>60-70% อัดเข้า VOO (S&P 500)</b> เป็นแกนหลัก แล้วเลือกถือหุ้นเทคโตไวเพียง 1-2 ตัว (เช่น AMD หรือ TSLA) + ออมทองคำ 10%</p>',
  '        <p class="text-slate-300">3. <b>จัดการตัวแดง:</b> <code>BIDU</code> ขาดทุนหนัก -22% แนะนำหยุดเติมเงิน และหากเด้งขึ้นมาควรเปลี่ยนเป็น VOO ส่วน <code>TTB</code> ถือรับปันผลต่อไปได้ดี</p>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- TAB 3: BROAD MARKET STOCK SCREENER & SEARCH -->',
  '    <div id="view-broad" class="hidden flex flex-col gap-5">',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">',
  '        <div class="flex-1 min-w-[280px]">',
  '          <label class="text-xs font-bold text-amber-400 block mb-1">🔍 วิเคราะห์หุ้นตัวไหนก็ได้ทั่วโลก (พิมพ์ชื่อย่อ เช่น TSLA, PLTR, COIN, DIS, BABA):</label>',
  '          <div class="flex items-center gap-2">',
  '            <input type="text" id="inp-stock-search" placeholder="พิมพ์ชื่อย่อหุ้น เช่น NVDA หรือ TSLA" class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono uppercase text-white focus:outline-none focus:border-amber-400">',
  '            <button onclick="searchSingleStock()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-md">',
  '              วิเคราะห์จุดช้อนซื้อทันที',
  '            </button>',
  '          </div>',
  '        </div>',
  '      </div>',
  '',
  '      <div id="search-result-card" class="hidden bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl">',
  '        <div class="flex items-center justify-between border-b border-slate-800 pb-3">',
  '          <div>',
  '            <span class="text-xs font-black text-amber-400 uppercase">ผลการวิเคราะห์เจาะลึก</span>',
  '            <h3 id="res-sym" class="text-2xl font-black text-white mt-0.5">--</h3>',
  '          </div>',
  '          <span id="res-verdict" class="px-3.5 py-1.5 rounded-full text-xs font-black">--</span>',
  '        </div>',
  '        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs font-mono">',
  '          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800"><span class="text-slate-400 font-sans">ราคาตลาดปัจจุบัน:</span><p id="res-price" class="text-base font-bold text-white mt-1">--</p></div>',
  '          <div class="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/40"><span class="text-emerald-400 font-sans font-bold">🛒 โซนควรเข้าซื้อ:</span><p id="res-buyzone" class="text-base font-bold text-emerald-300 mt-1">--</p></div>',
  '          <div class="bg-teal-950/30 p-3 rounded-xl border border-teal-800/40"><span class="text-teal-400 font-sans font-bold">🎯 เป้าทำกำไร (1-3 เดือน):</span><p id="res-target" class="text-base font-bold text-teal-300 mt-1">--</p></div>',
  '          <div class="bg-rose-950/30 p-3 rounded-xl border border-rose-800/40"><span class="text-rose-400 font-sans">🛑 จุด Stop Loss:</span><p id="res-sl" class="text-base font-bold text-rose-400 mt-1">--</p></div>',
  '        </div>',
  '        <p id="res-reason" class="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 italic">--</p>',
  '      </div>',
  '',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">',
  '        <div class="flex items-center justify-between mb-3">',
  '          <div>',
  '            <h3 class="font-bold text-sm text-white">📊 ผลการจัดอันดับความน่าซื้อทั้งตลาดหุ้นสหรัฐฯ (35+ หุ้นผู้นำทุกกลุ่ม)</h3>',
  '            <span class="text-[11px] text-slate-400">คำนวณจากราคา Real-Time จริง + Trend 50/200 วัน + RSI + ส่วนลดย่อตัว</span>',
  '          </div>',
  '          <button onclick="loadBroadMarket()" class="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3 py-1.5 rounded-lg border border-amber-500/30">🔄 รีเฟรชข้อมูล</button>',
  '        </div>',
  '        <div class="overflow-x-auto">',
  '          <table class="w-full text-left text-xs font-mono">',
  '            <thead>',
  '              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">',
  '                <th class="py-3 px-3">อันดับ</th>',
  '                <th class="py-3 px-3">หุ้น / สินทรัพย์</th>',
  '                <th class="py-3 px-3">คำแนะนำ</th>',
  '                <th class="py-3 px-3">คะแนน</th>',
  '                <th class="py-3 px-3">ราคาจริง</th>',
  '                <th class="py-3 px-3">โซนควรเข้าซื้อ</th>',
  '                <th class="py-3 px-3">Stop Loss</th>',
  '                <th class="py-3 px-3">เป้าทำกำไร</th>',
  '                <th class="py-3 px-3">อัพไซด์ (%)</th>',
  '              </tr>',
  '            </thead>',
  '            <tbody id="broad-tbody" class="divide-y divide-slate-800/60 font-sans">',
  '              <tr><td colspan="9" class="py-6 text-center text-slate-500">กำลังสแกนวิเคราะห์ราคาจริงทั้งตลาด...</td></tr>',
  '            </tbody>',
  '          </table>',
  '        </div>',
  '      </div>',
  '    </div>',
  '  </main>',
  '',
  '  <script>',
  '    let activeTab = "m15";',
  '    let currentSelectedSymbol = "XAU/USD";',
  '    let latestPlans = {};',
  '    let broadMarketList = [];',
  '    let currentRiskDist = 6.0;',
  '    let voiceOn = true;',
  '',
  '    if (localStorage.getItem("saved_bal")) document.getElementById("inp-bal").value = localStorage.getItem("saved_bal");',
  '    if (localStorage.getItem("saved_risk")) document.getElementById("inp-risk").value = localStorage.getItem("saved_risk");',
  '',
  '    function switchTab(tab) {',
  '      activeTab = tab;',
  '      const b1 = document.getElementById("tab-btn-m15");',
  '      const b2 = document.getElementById("tab-btn-portfolio");',
  '      const b3 = document.getElementById("tab-btn-broad");',
  '      const v1 = document.getElementById("view-m15");',
  '      const v2 = document.getElementById("view-portfolio");',
  '      const v3 = document.getElementById("view-broad");',
  '',
  '      b1.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '      b2.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '      b3.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '      v1.classList.add("hidden");',
  '      v2.classList.add("hidden");',
  '      v3.classList.add("hidden");',
  '',
  '      if (tab === "m15") {',
  '        b1.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md";',
  '        v1.classList.remove("hidden");',
  '      } else if (tab === "portfolio") {',
  '        b2.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-purple-600 text-white shadow-md";',
  '        v2.classList.remove("hidden");',
  '        loadMyPortfolio();',
  '      } else {',
  '        b3.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md";',
  '        v3.classList.remove("hidden");',
  '        if (broadMarketList.length === 0) loadBroadMarket();',
  '      }',
  '    }',
  '',
  '    function copyText(id, label) {',
  '      const txt = document.getElementById(id).textContent;',
  '      if (!txt || txt === "--") return;',
  '      navigator.clipboard.writeText(txt);',
  '      const el = document.getElementById("copy-toast");',
  '      el.textContent = "✅ คัดลอก " + label + " (" + txt + ") แล้ว!";',
  '      setTimeout(function() { el.textContent = ""; }, 2500);',
  '    }',
  '',
  '    function setAsset(tvSym, label) {',
  '      currentSelectedSymbol = label;',
  '      document.getElementById("chart-label").textContent = "📈 กราฟปัจจุบัน: " + label + " (15 นาที)";',
  '      document.getElementById("tv-frame").src = "https://s.tradingview.com/widgetembed/?symbol=" + encodeURIComponent(tvSym) + "&interval=15&theme=dark&timezone=Asia%2FBangkok";',
  '      const plan = latestPlans[label];',
  '      if (plan) {',
  '        document.getElementById("card-ticker").textContent = plan.ticker;',
  '        document.getElementById("card-entry").textContent = plan.entry;',
  '        document.getElementById("card-sl").textContent = plan.sl;',
  '        document.getElementById("card-tp1").textContent = plan.tp1;',
  '        document.getElementById("card-tp2").textContent = plan.tp2;',
  '        document.getElementById("card-strategy").textContent = "🧠 " + plan.strategy;',
  '        document.getElementById("card-reason").textContent = "📌 " + plan.reason;',
  '        const b = document.getElementById("card-action-badge");',
  '        b.textContent = plan.action === "BUY" ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";',
  '        b.className = plan.action === "BUY" ? "px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md" : "px-3.5 py-1 rounded-full text-xs font-black bg-rose-500 text-white shadow-md";',
  '        currentRiskDist = plan.risk || 6.0;',
  '        calcLot();',
  '      }',
  '    }',
  '',
  '    function calcLot() {',
  '      const bal = parseFloat(document.getElementById("inp-bal").value) || 0;',
  '      const riskPct = parseFloat(document.getElementById("inp-risk").value) || 1;',
  '      localStorage.setItem("saved_bal", bal);',
  '      localStorage.setItem("saved_risk", riskPct);',
  '      const riskUsd = bal * (riskPct / 100);',
  '      document.getElementById("risk-usd").textContent = "ถ้าชน SL เสียแค่ -$" + riskUsd.toFixed(2);',
  '      document.getElementById("card-sl-usd").textContent = "เสี่ยง: -$" + riskUsd.toFixed(2);',
  '      document.getElementById("card-tp1-usd").textContent = "กำไร: +$" + (riskUsd * 1.5).toFixed(2);',
  '      document.getElementById("card-tp2-usd").textContent = "กำไร: +$" + (riskUsd * 2.5).toFixed(2);',
  '      const lot = Math.max(0.01, riskUsd / (currentRiskDist * 100)).toFixed(2);',
  '      document.getElementById("out-lot").textContent = lot + " Lot";',
  '    }',
  '    document.getElementById("inp-bal").oninput = calcLot;',
  '    document.getElementById("inp-risk").onchange = calcLot;',
  '    calcLot();',
  '',
  '    document.getElementById("voice-btn").onclick = function() {',
  '      voiceOn = !voiceOn;',
  '      document.getElementById("voice-btn").textContent = voiceOn ? "🗣️ เสียงพูด: เปิด" : "🔇 เสียงพูด: ปิด";',
  '    };',
  '',
  '    document.getElementById("tg-test-btn").onclick = async function() {',
  '      const btn = document.getElementById("tg-test-btn");',
  '      btn.textContent = "⏳ กำลังส่งเข้า Telegram...";',
  '      const r = await fetch("/api/test-telegram", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({ symbol: currentSelectedSymbol })',
  '      });',
  '      const d = await r.json();',
  '      btn.textContent = d.ok ? "✅ ส่งเข้า Telegram แล้ว!" : "⚠️ ส่งไม่สำเร็จ";',
  '      setTimeout(function() { btn.textContent = "📲 ส่งแผนเข้า Telegram"; }, 3500);',
  '    };',
  '',
  '    async function loadMyPortfolio() {',
  '      const r = await fetch("/api/my-portfolio");',
  '      const data = await r.json();',
  '      if (!data) return;',
  '      document.getElementById("pf-total-val").textContent = "฿" + data.totalValueTHB.toLocaleString();',
  '      document.getElementById("pf-total-cost").textContent = "฿" + data.totalCostTHB.toLocaleString();',
  '      const sign = data.totalProfitTHB >= 0 ? "+" : "";',
  '      const pColor = data.totalProfitTHB >= 0 ? "text-emerald-400" : "text-rose-400";',
  '      document.getElementById("pf-total-profit").textContent = sign + "฿" + data.totalProfitTHB.toLocaleString() + " (" + sign + data.totalProfitPct + "%)";',
  '      document.getElementById("pf-total-profit").className = "text-2xl font-black mt-1 " + pColor;',
  '',
  '      const tbody = document.getElementById("pf-tbody");',
  '      tbody.innerHTML = data.holdings.map(function(item) {',
  '        const pCls = item.profitTHB >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";',
  '        const pSign = item.profitTHB >= 0 ? "+" : "";',
  '        const badgeColor = item.healthStatus === "ALARM" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : item.healthStatus === "EXCELLENT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-300";',
  '        return "<tr class=\\"hover:bg-slate-800/50 transition\\">" +',
  '          "<td class=\\"py-3 px-3\\"><span class=\\"text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold\\">" + item.category + "</span></td>" +',
  '          "<td class=\\"py-3 px-3\\"><b class=\\"text-white text-sm\\">" + item.symbol + "</b><span class=\\"text-slate-400 text-xs block\\">" + item.name + "</span></td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-white font-bold\\">" + item.shares + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-slate-300\\">" + (item.currency===\'USD\'?\'$\':\'฿\') + item.avgCost + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-white font-bold\\">" + (item.currency===\'USD\'?\'$\':\'฿\') + item.currentPrice + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-white\\">฿" + item.valueTHB.toLocaleString() + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono " + pCls + "\\">" + pSign + "฿" + item.profitTHB + " (" + pSign + item.profitPct + "%)</td>" +',
  '          "<td class=\\"py-3 px-3\\">" +',
  '            "<span class=\\"px-2 py-0.5 rounded text-[11px] font-bold block mb-1 " + badgeColor + "\\">" + item.advice + "</span>" +',
  '            "<span class=\\"text-[11px] text-slate-400 block\\">" + item.diagnosis + "</span>" +',
  '          "</td>" +',
  '        "</tr>";',
  '      }).join("");',
  '    }',
  '',
  '    async function saveHoldingUpdate() {',
  '      const sym = document.getElementById("inp-add-symbol").value;',
  '      const shares = document.getElementById("inp-add-shares").value;',
  '      const cost = document.getElementById("inp-add-cost").value;',
  '      if (!shares) return alert("กรุณาใส่จำนวนหุ้นคงเหลือใหม่");',
  '      const r = await fetch("/api/update-holding", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({ symbol: sym, newShares: shares, newAvgCost: cost })',
  '      });',
  '      const d = await r.json();',
  '      if (d.ok) {',
  '        loadMyPortfolio();',
  '        const t = document.getElementById("add-toast");',
  '        t.textContent = "✅ บันทึกจำนวนหุ้น " + sym + " เรียบร้อยแล้ว!";',
  '        setTimeout(function() { t.textContent = ""; }, 3000);',
  '      }',
  '    }',
  '',
  '    async function loadBroadMarket() {',
  '      const r = await fetch("/api/broad-market");',
  '      const d = await r.json();',
  '      broadMarketList = d.stocks || [];',
  '      const tbody = document.getElementById("broad-tbody");',
  '      tbody.innerHTML = broadMarketList.map(function(item, idx) {',
  '        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : ("#" + (idx + 1));',
  '        return "<tr class=\\"hover:bg-slate-800/60 transition\\">" +',
  '          "<td class=\\"py-3 px-3 font-bold text-amber-400\\">" + medal + "</td>" +',
  '          "<td class=\\"py-3 px-3\\"><b class=\\"text-white text-sm\\">" + item.symbol + "</b><span class=\\"text-slate-400 text-xs block\\">" + item.sector + "</span></td>" +',
  '          "<td class=\\"py-3 px-3\\"><span class=\\"px-2.5 py-0.5 rounded text-[11px] " + item.verdictClass + "\\">" + item.badgeText + "</span></td>" +',
  '          "<td class=\\"py-3 px-3 font-mono font-bold text-emerald-400\\">" + item.score + " / 100</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono font-bold text-white\\">$" + item.price + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono font-bold text-emerald-300\\">$" + item.buyZone + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-rose-400\\">$" + item.sl + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-teal-300 font-bold\\">$" + item.tp2 + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono font-black text-emerald-400\\">+" + item.upside + "%</td>" +',
  '        "</tr>";',
  '      }).join("");',
  '    }',
  '',
  '    async function searchSingleStock() {',
  '      const sym = document.getElementById("inp-stock-search").value.trim().toUpperCase();',
  '      if (!sym) return alert("กรุณาพิมพ์ชื่อย่อหุ้น");',
  '      const card = document.getElementById("search-result-card");',
  '      card.classList.remove("hidden");',
  '      document.getElementById("res-sym").textContent = "กำลังดึงราคาจริงของ " + sym + "...";',
  '      try {',
  '        const r = await fetch("/api/analyze-stock?symbol=" + encodeURIComponent(sym));',
  '        const d = await r.json();',
  '        if (d.ok && d.stock) {',
  '          const s = d.stock;',
  '          document.getElementById("res-sym").textContent = s.symbol + " (คะแนน " + s.score + "/100)";',
  '          const b = document.getElementById("res-verdict");',
  '          b.textContent = s.badgeText;',
  '          b.className = "px-3.5 py-1.5 rounded-full text-xs font-black " + s.verdictClass;',
  '          document.getElementById("res-price").textContent = "$" + s.price;',
  '          document.getElementById("res-buyzone").textContent = "$" + s.buyZone;',
  '          document.getElementById("res-target").textContent = "$" + s.tp2 + " (+" + s.upside + "%)";',
  '          document.getElementById("res-sl").textContent = "$" + s.sl;',
  '          document.getElementById("res-reason").textContent = "💡 " + s.reason;',
  '        } else {',
  '          alert(d.error || "ไม่พบข้อมูลหุ้น");',
  '          card.classList.add("hidden");',
  '        }',
  '      } catch(e) {',
  '        alert("เกิดข้อผิดพลาดในการดึงข้อมูล");',
  '        card.classList.add("hidden");',
  '      }',
  '    }',
  '',
  '    setInterval(function() {',
  '      const now = new Date();',
  '      const m = 14 - (now.getMinutes() % 15), s = 59 - now.getSeconds();',
  '      document.getElementById("timer").textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");',
  '    }, 1000);',
  '',
  '    function updateRadarUI(radar) {',
  '      if (!radar) return;',
  '      Object.keys(radar).forEach(function(sym) {',
  '        const item = radar[sym];',
  '        const pEl = document.getElementById("rad-price-" + sym);',
  '        const rEl = document.getElementById("rad-rsi-" + sym);',
  '        const sEl = document.getElementById("rad-status-" + sym);',
  '        if (pEl) pEl.textContent = item.price;',
  '        if (rEl) rEl.textContent = "RSI " + item.rsi;',
  '        if (sEl) {',
  '          sEl.textContent = item.isOpen ? "🟢 ตลาดเปิด" : "⏸️ ตลาดปิด";',
  '          sEl.className = item.isOpen ? "text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold" : "text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400";',
  '        }',
  '      });',
  '    }',
  '',
  '    fetch("/api/signals").then(function(r) { return r.json(); }).then(function(d) {',
  '      latestPlans = d.plans || {};',
  '      updateRadarUI(d.radar);',
  '      setAsset("OANDA:XAUUSD", "XAU/USD");',
  '    });',
  '',
  '    const proto = location.protocol === "https:" ? "wss:" : "ws:";',
  '    const ws = new WebSocket(proto + "//" + location.host);',
  '    ws.onmessage = function(e) {',
  '      const msg = JSON.parse(e.data);',
  '      if (msg.type === "RADAR_UPDATE") {',
  '        latestPlans = msg.plans || latestPlans;',
  '        updateRadarUI(msg.radar);',
  '      }',
  '    };',
  '  </script>',
  '</body>',
  '</html>'
].join('\n');

app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

// 10. ระบบ Anti-Sleep
setInterval(() => {
  fetch(APP_URL + '/api/ping').catch(() => {});
}, 10 * 60 * 1000);

server.listen(PORT, async () => {
  console.log('🚀 All-in-One Master Terminal running on port ' + PORT);
  setInterval(scanMarket, 60 * 1000);
  scanMarket();
  setTimeout(scanBroadMarketUniverse, 3000);
});
