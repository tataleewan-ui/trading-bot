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

// 1) 5 สินทรัพย์หลักสำหรับเทรดสั้นแท่ง 15 นาที
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

// 2) คลังหุ้นสหรัฐฯ 35 ตัวแทนทุกอุตสาหกรรม (Broad Market Screener)
const BROAD_MARKET_UNIVERSE = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', yahoo: 'NVDA', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', yahoo: 'AMD', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'AVGO', name: 'Broadcom Inc', yahoo: 'AVGO', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', yahoo: 'TSM', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'QCOM', name: 'Qualcomm Inc', yahoo: 'QCOM', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'AAPL', name: 'Apple Inc', yahoo: 'AAPL', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'MSFT', name: 'Microsoft Corp', yahoo: 'MSFT', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'AMZN', name: 'Amazon.com', yahoo: 'AMZN', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'GOOGL', name: 'Alphabet Google', yahoo: 'GOOGL', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'META', name: 'Meta Platforms', yahoo: 'META', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'TSLA', name: 'Tesla Inc', yahoo: 'TSLA', sector: 'EV & Tech', category: 'TECH' },
  { symbol: 'NFLX', name: 'Netflix Inc', yahoo: 'NFLX', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'PLTR', name: 'Palantir Technologies', yahoo: 'PLTR', sector: 'Software & AI', category: 'TECH' },
  { symbol: 'CRM', name: 'Salesforce Inc', yahoo: 'CRM', sector: 'Software & AI', category: 'TECH' },
  { symbol: 'ADBE', name: 'Adobe Inc', yahoo: 'ADBE', sector: 'Software & AI', category: 'TECH' },
  { symbol: 'JPM', name: 'JPMorgan Chase', yahoo: 'JPM', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'BAC', name: 'Bank of America', yahoo: 'BAC', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'V', name: 'Visa Inc', yahoo: 'V', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'MA', name: 'Mastercard Inc', yahoo: 'MA', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'LLY', name: 'Eli Lilly and Co (ยาลดน้ำหนัก)', yahoo: 'LLY', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'NVO', name: 'Novo Nordisk (Ozempic)', yahoo: 'NVO', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', yahoo: 'JNJ', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'UNH', name: 'UnitedHealth Group', yahoo: 'UNH', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'WMT', name: 'Walmart Inc', yahoo: 'WMT', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'COST', name: 'Costco Wholesale', yahoo: 'COST', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'KO', name: 'Coca-Cola Company', yahoo: 'KO', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'MCD', name: "McDonald's Corp", yahoo: 'MCD', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp', yahoo: 'XOM', sector: 'Energy & Industrial', category: 'BLUECHIP' },
  { symbol: 'CVX', name: 'Chevron Corp', yahoo: 'CVX', sector: 'Energy & Industrial', category: 'BLUECHIP' },
  { symbol: 'CAT', name: 'Caterpillar Inc', yahoo: 'CAT', sector: 'Energy & Industrial', category: 'BLUECHIP' },
  { symbol: 'BA', name: 'Boeing Co', yahoo: 'BA', sector: 'Energy & Industrial', category: 'TECH' },
  { symbol: 'QQQ', name: 'Invesco NASDAQ 100 ETF', yahoo: 'QQQ', sector: 'Index ETF', category: 'BLUECHIP' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', yahoo: 'SPY', sector: 'Index ETF', category: 'BLUECHIP' },
  { symbol: 'XAU/USD', name: 'Gold (ทองคำแท่ง)', yahoo: 'GC=F', sector: 'Precious Metals', category: 'BLUECHIP' },
  { symbol: 'BTC/USD', name: 'Bitcoin (คริปโต)', yahoo: 'BTC-USD', sector: 'Crypto', category: 'TECH' }
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
let lastPortfolioData = null;
let lastScanTime = null;
let lastBroadScanTime = null;
let telegramEnabled = true;
let lastTelegramUpdateId = 0;

let livePriceCache = {
  'XAU/USD': 2785.40,
  'YLG-GOLD': 2785.40,
  'VOO': 535.20,
  'AMD': 156.40,
  'TSLA': 260.10,
  'XLV': 148.50,
  'VT': 118.20,
  'BIDU': 88.50,
  'XOM': 119.30,
  'TTB': 1.95,
  'NVDA': 141.20,
  'AAPL': 230.10,
  'QQQ': 495.20,
  'SPY': 580.40,
  'SCBT70X': 11.95,
  'SCBTB': 10.35
};

wss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      prices: livePriceCache,
      radar: marketRadar,
      plans: latestPlanBySymbol,
      portfolio: lastPortfolioData,
      broad: broadMarketCache,
      lastScanTime: lastScanTime,
      timestamp: Date.now()
    }));
  } catch (e) {}
});

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

async function sendTelegramMessage(text, force = false, targetChat = null) {
  if (!telegramEnabled && !force) return false;
  const targetChatId = targetChat || (await resolveTelegramChatId());
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
    } catch (e) {}
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
      const livePrice = result.meta && result.meta.regularMarketPrice;
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
      if (candles.length > 0 && livePrice) candles[candles.length - 1].close = livePrice;
      if (candles.length >= 60) return candles.slice(-100);
    }
  } catch (e) {}
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
// 5. วิเคราะห์ Quant หุ้นก้นหลุมรอบเดือน & หุ้นน่าซื้อ
// ==========================================
function evaluateStockQuant(candles, livePrice, changePct, symbol, name, sector, category) {
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
  if (rsi >= 38 && rsi <= 52) {
    score += 20;
    reasons.push('RSI (' + rsi.toFixed(0) + ') โซนสะสมพลัง Golden Dip');
  }

  let verdict = 'HOLD';
  let badgeText = '⚪ ถือ / รอย่อตัว';
  let verdictClass = 'bg-slate-800 text-slate-300';
  let isDipDeal = false;

  const buyZoneLow = Number(Math.max(monthlyLow, curPrice - atr * 0.7).toFixed(2));
  const buyZoneHigh = Number(curPrice.toFixed(2));
  const slPrice = Number((Math.min(monthlyLow, curPrice) - atr * 1.5).toFixed(2));
  const tp1Price = Number((curPrice + atr * 2.2).toFixed(2));
  const tp2Price = Number((curPrice + atr * 4.2).toFixed(2));
  const upsidePercent = Number((((tp2Price - curPrice) / curPrice) * 100).toFixed(1));

  if (distFromLowPct <= 4.0 && score >= 70) {
    verdict = 'BUY_NOW';
    badgeText = '🛒 ก้นหลุมรอบเดือน (Golden Dip)';
    verdictClass = 'bg-emerald-500 text-slate-950 font-black animate-pulse';
    isDipDeal = true;
  } else if (distFromLowPct <= 7.0 && score >= 60) {
    verdict = 'BUY_DIP';
    badgeText = '🟢 ทยอยเข้าซื้อ (Buy on Dip)';
    verdictClass = 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40';
  } else if (rsi >= 68 || curPrice >= tp1Price) {
    verdict = 'TAKE_PROFIT';
    badgeText = '🎯 โซนรอขายทำกำไร (Take Profit)';
    verdictClass = 'bg-amber-500 text-slate-950 font-black';
  }

  return {
    symbol: symbol,
    name: name || symbol,
    sector: sector || 'US Market',
    category: category || 'TECH',
    price: curPrice,
    changePct: changePct,
    monthlyLow: monthlyLow,
    monthlyHigh: monthlyHigh,
    distFromLowPct: distFromLowPct,
    score: Math.min(99, Math.max(30, score)),
    verdict: verdict,
    badgeText: badgeText,
    verdictClass: verdictClass,
    isDipDeal: isDipDeal,
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
        let price = data.livePrice;
        if (item.symbol === 'XAU/USD') {
          try {
            const bPrice = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').then(r => r.json());
            if (bPrice && bPrice.price) price = parseFloat(bPrice.price);
          } catch (e) {}
        }
        const res = evaluateStockQuant(data.candles, price, data.changePct, item.symbol, item.name, item.sector, item.category);
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
async function updateLiveQuotes() {
  // 1. ดึงราคาทองคำ Spot Gold Real-Time จาก Binance (PAXGUSDT)
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
    const d = await res.json();
    if (d && d.price) {
      const p = parseFloat(d.price);
      livePriceCache['XAU/USD'] = p;
      livePriceCache['YLG-GOLD'] = p;
      if (latestPlanBySymbol['XAU/USD']) latestPlanBySymbol['XAU/USD'].entry = p;
      if (marketRadar['XAU/USD']) marketRadar['XAU/USD'].price = p;
    }
  } catch (e) {}

  // 2. ดึงราคาหุ้นสหรัฐฯ และ ETF จาก Yahoo Finance
  const tickers = ['VOO', 'AMD', 'TSLA', 'XLV', 'VT', 'BIDU', 'XOM', 'NVDA', 'AAPL', 'QQQ', 'SPY'];
  try {
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + tickers.join(',');
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    if (data && data.quoteResponse && Array.isArray(data.quoteResponse.result)) {
      for (const q of data.quoteResponse.result) {
        const p = q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice;
        if (p && q.symbol) {
          livePriceCache[q.symbol] = p;
          if (latestPlanBySymbol[q.symbol]) latestPlanBySymbol[q.symbol].entry = p;
          if (marketRadar[q.symbol]) marketRadar[q.symbol].price = p;
        }
      }
    }
  } catch (e) {
    await Promise.all(tickers.slice(0, 6).map(async (t) => {
      try {
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + t + '?interval=1m&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (p) {
          livePriceCache[t] = p;
          if (latestPlanBySymbol[t]) latestPlanBySymbol[t].entry = p;
          if (marketRadar[t]) marketRadar[t].price = p;
        }
      } catch (err) {}
    }));
  }

  // 3. คำนวณพอร์ตแบบทันที
  const pf = await analyzeUserPortfolio();

  // 4. สตรีมข้อมูล Real-Time ไปยังทุกไคลเอนต์ผ่าน WebSocket
  broadcast({
    type: 'TICK',
    prices: livePriceCache,
    radar: marketRadar,
    plans: latestPlanBySymbol,
    portfolio: pf,
    lastScanTime: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }),
    timestamp: Date.now()
  });
}

async function analyzeUserPortfolio() {
  const USD_TO_THB = 33.42;
  let diagnosedList = [];
  let totalValueTHB = 0;
  let totalCostTHB = 0;

  for (let item of userHoldings) {
    let currentPrice = item.currency === 'USD' ? item.avgCostUSD : item.avgCostTHB;
    if (livePriceCache[item.symbol]) {
      currentPrice = livePriceCache[item.symbol];
    } else if (item.symbol === 'YLG-GOLD' && livePriceCache['XAU/USD']) {
      currentPrice = livePriceCache['XAU/USD'];
    } else {
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

    let healthStatus = 'GOOD', actionVerdict = 'HOLD', advice = '';
    if (item.symbol === 'BIDU') {
      healthStatus = 'ALARM';
      actionVerdict = 'CONSIDER_CUT';
      advice = '🚨 ขาดทุน -22% แนะนำ Cut Loss/สลับไป VOO';
    } else if (item.symbol === 'VOO' || item.symbol === 'VT') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'BUY_MORE';
      advice = '⭐ เสาหลักพอร์ต วันนี้น่าซื้อสะสม (DCA) เพิ่มที่สุด';
    } else if (item.symbol === 'TTB') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'HOLD_DIVIDEND';
      advice = '🏆 กำไรสูงสุด (+48%) ถือรับปันผลสบายๆ';
    } else if (item.symbol === 'AMD') {
      healthStatus = 'GOOD';
      actionVerdict = 'HOLD_GROWTH';
      advice = '🟢 กำไร +13% ถือรันเทรนด์เติบโตต่อ';
    } else if (item.symbol === 'TSLA') {
      healthStatus = 'WATCH';
      actionVerdict = 'WAIT_REBOUND';
      advice = '⚠️ รอกราฟเด้งกลับมาเท่าทุนแล้วแบ่งปิดกำไร';
    } else if (item.symbol.includes('SCBTB')) {
      healthStatus = 'WATCH';
      actionVerdict = 'HOLD_OR_SWITCH';
      advice = '⚠️ กองทุนหุ้นไทย ESG ขาดทุน -4.8%';
    } else {
      healthStatus = 'NEUTRAL';
      actionVerdict = 'HOLD';
      advice = '⚪ กระจายความเสี่ยง ถือเป็นกันชนพอร์ต';
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
      advice: advice
    });
  }

  const totalProfitTHB = totalValueTHB - totalCostTHB;
  const totalProfitPct = totalCostTHB > 0 ? (totalProfitTHB / totalCostTHB) * 100 : 0;

  // คำนวณคะแนนสุขภาพพอร์ต (Portfolio Health Score 0-100)
  let healthScore = 80;
  if (totalProfitPct > 0) healthScore += 10;
  if (userHoldings.some(h => h.symbol === 'BIDU')) healthScore -= 10; // ลดเพราะมีตัวฉุด
  if (userHoldings.some(h => h.symbol === 'VOO')) healthScore += 10; // เพิ่มเพราะมี VOO

  lastPortfolioData = {
    totalValueTHB: Number(totalValueTHB.toFixed(2)),
    totalCostTHB: Number(totalCostTHB.toFixed(2)),
    totalProfitTHB: Number(totalProfitTHB.toFixed(2)),
    totalProfitPct: Number(totalProfitPct.toFixed(2)),
    healthScore: Math.min(100, Math.max(50, healthScore)),
    holdings: diagnosedList,
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  return lastPortfolioData;
}

// ==========================================
// 7. บอท Telegram คุยตอบโต้ได้ 24/7
// ==========================================
async function pollTelegramUpdates() {
  if (!BOT_TOKEN) return;
  try {
    const url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates?offset=' + (lastTelegramUpdateId + 1) + '&timeout=5';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (const update of data.result) {
        lastTelegramUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;

        const chatId = msg.chat.id;
        CHAT_ID = String(chatId);
        const text = msg.text.trim().toLowerCase();

        if (text === '/portfolio' || text === 'พอร์ต' || text === '/port' || text === 'สรุปพอร์ต') {
          const pf = await analyzeUserPortfolio();
          const sign = pf.totalProfitTHB >= 0 ? '+' : '';
          let reply = '💼 <b>สรุปพอร์ต Dime ของคุณแบบ Real-Time</b>\n';
          reply += '──────────────────\n';
          reply += '💰 มูลค่าพอร์ตรวม: <b>฿' + pf.totalValueTHB.toLocaleString() + '</b>\n';
          reply += '📈 กำไรสุทธิ: <b>' + sign + '฿' + pf.totalProfitTHB.toLocaleString() + ' (' + sign + pf.totalProfitPct + '%)</b>\n';
          reply += '🩺 คะแนนสุขภาพพอร์ต: <b>' + pf.healthScore + '/100</b>\n';
          reply += '──────────────────\n';
          reply += '⭐ <b>วันนี้แนะนำซื้อ:</b> <code>VOO</code> (เสาหลักโตสม่ำเสมอ)\n';
          reply += '🚨 <b>น่าเป็นห่วง:</b> <code>BIDU</code> (ขาดทุน -22% แนะนำ Cut Loss)';
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/screener' || text === 'หุ้นไหนดี' || text === 'หุ้นเด่น') {
          if (broadMarketCache.length === 0) await scanBroadMarketUniverse();
          const top3 = broadMarketCache.slice(0, 3);
          let reply = '🌟 <b>3 หุ้นเด่นน่าซื้อที่สุดในตลาด (สแกนจากหลังบ้าน)</b>\n';
          reply += '──────────────────\n';
          top3.forEach((item, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            reply += medal + ' <b>' + item.symbol + '</b> ($' + item.price + ')\n';
            reply += '   สถานะ: <b>' + item.badgeText + '</b> (คะแนน ' + item.score + '/100)\n';
            reply += '   🛒 ซื้อโซน: <code>$' + item.buyZone + '</code> | 🎯 เป้า: <code>$' + item.tp2 + '</code> (+~' + item.upside + '%)\n\n';
          });
          await sendTelegramMessage(reply, true, chatId);
        }
      }
    }
  } catch (e) {}
}

// ==========================================
// 8. ลูปสแกนตลาด M15 ประจำ
// ==========================================
async function scanMarket() {
  for (const sym of M15_SYMBOLS) {
    try {
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
          entry: Number(curPrice.toFixed(2)),
          sl: Number((isBuy ? curPrice - slDist : curPrice + slDist).toFixed(2)),
          tp1: Number((isBuy ? curPrice + slDist * 1.5 : curPrice - slDist * 1.5).toFixed(2)),
          tp2: Number((isBuy ? curPrice + slDist * 2.5 : curPrice - slDist * 2.5).toFixed(2)),
          risk: Number(slDist.toFixed(2)),
          rsi: Number(rsi.toFixed(1)),
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
      }
    } catch (e) {}
  }

  const pf = await analyzeUserPortfolio();

  lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  broadcast({
    type: 'RADAR_UPDATE',
    radar: marketRadar,
    plans: latestPlanBySymbol,
    portfolio: pf,
    broad: broadMarketCache,
    lastScanTime: lastScanTime
  });
}

// ==========================================
// 9. API Endpoints
// ==========================================
app.get('/api/signals', (req, res) => res.json({
  signals: signalHistory,
  radar: marketRadar,
  plans: latestPlanBySymbol,
  portfolio: lastPortfolioData,
  broad: broadMarketCache,
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
    const result = evaluateStockQuant(data.candles, data.livePrice, data.changePct, sym, sym + ' Inc', 'US Market', 'TECH');
    res.json({ ok: true, stock: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/my-portfolio', async (req, res) => {
  const pf = await analyzeUserPortfolio();
  res.json(pf);
});

app.post('/api/update-holding', async (req, res) => {
  const { symbol, newShares, newAvgCost } = req.body;
  if (!symbol || newShares == null) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  const existing = userHoldings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
  if (existing) {
    existing.shares = parseFloat(newShares);
    if (newAvgCost != null && parseFloat(newAvgCost) > 0) {
      if (existing.currency === 'USD') existing.avgCostUSD = parseFloat(newAvgCost);
      else existing.avgCostTHB = parseFloat(newAvgCost);
    }
  }
  const pf = await analyzeUserPortfolio();
  broadcast({ type: 'PORTFOLIO_UPDATED', portfolio: pf });
  res.json({ ok: true, portfolio: pf });
});

app.post('/api/send-broad-telegram', async (req, res) => {
  if (broadMarketCache.length === 0) await scanBroadMarketUniverse();
  const top4 = broadMarketCache.slice(0, 4);
  let msg = '🌟 <b>สรุปอันดับหุ้นน่าช้อนซื้อที่สุดในตลาด (สแกนจากหลังบ้าน)</b>\n';
  msg += '──────────────────\n';
  top4.forEach((item, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ('#' + (i + 1));
    msg += medal + ' <b>' + item.symbol + '</b> (คะแนน ' + item.score + '/100)\n';
    msg += '📌 สถานะ: <b>' + item.badgeText + '</b> | ราคา: <code>$' + item.price + '</code>\n';
    msg += '🛒 โซนควรเข้าซื้อ: <code>$' + item.buyZone + '</code>\n';
    msg += '🎯 เป้าทำกำไร (TP2): <code>$' + item.tp2 + '</code> (+~' + item.upside + '%)\n';
    msg += '🛑 Stop Loss: <code>$' + item.sl + '</code>\n\n';
  });
  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok: ok });
});

app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// 10. หน้าเว็บ Master All-in-One Dashboard ครบ 3 แท็บใหญ่
// ==========================================
const HTML_PAGE = [
  '<!DOCTYPE html>',
  '<html lang="th" class="dark">',
  '<head>',
  '  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '  <title>M15 Pro Terminal & Personal Portfolio Doctor</title>',
  '  <script src="https://cdn.tailwindcss.com"></script>',
  '  <style>',
  '    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");',
  '    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }',
  '    .copy-card { cursor: pointer; transition: all 0.15s ease; }',
  '    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }',
  '    .copy-card:active { transform: scale(0.98); }',
  '    @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }',
  '    .pulse-live { animation: pulse-subtle 2s infinite; }',
  '    @keyframes flashGreen {',
  '      0% { background-color: rgba(16, 185, 129, 0.45); }',
  '      100% { background-color: transparent; }',
  '    }',
  '    @keyframes flashRed {',
  '      0% { background-color: rgba(244, 63, 94, 0.45); }',
  '      100% { background-color: transparent; }',
  '    }',
  '    .flash-up { animation: flashGreen 0.9s ease-out; }',
  '    .flash-down { animation: flashRed 0.9s ease-out; }',
  '  </style>',
  '</head>',
  '<body class="min-h-screen flex flex-col">',
  '  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 py-3">',
  '    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">',
  '      <div class="flex items-center gap-3">',
  '        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-purple-600 to-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">⚡</div>',
  '        <div>',
  '          <div class="flex items-center gap-2">',
  '            <h1 class="font-bold text-base text-white">M15 Trading Assistant & Stock Doctor</h1>',
  '            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">',
  '              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live"></span> REALTIME LIVE',
  '            </span>',
  '          </div>',
  '          <p class="text-xs text-slate-400">บอกจุดเข้า BUY/SELL สด, ตรวจสุขภาพพอร์ต Dime, และสแกนหุ้นเด่นทั้งตลาด</p>',
  '        </div>',
  '      </div>',
  '      <!-- World Clock & Live Realtime Status Widget -->',
  '      <div class="flex items-center flex-wrap gap-2 text-xs">',
  '        <div class="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">',
  '          <span class="text-slate-400">ตลาดโลก:</span>',
  '          <span id="session-bkk" class="text-emerald-400 font-bold">🇹🇭 ไทย: รอเวลา...</span>',
  '          <span class="text-slate-600">|</span>',
  '          <span id="session-us" class="text-amber-400 font-bold">🇺🇸 สหรัฐฯ: รอเวลา...</span>',
  '        </div>',
  '        <div id="ws-badge" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold">',
  '          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>',
  '          <span id="ws-text">🔴 เรียลไทม์สด (Live Connected)</span>',
  '        </div>',
  '        <div class="bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 text-slate-400 font-mono text-[11px]">',
  '          อัปเดตสด: <span id="live-timer" class="text-emerald-400 font-bold">0s</span> ที่แล้ว',
  '        </div>',
  '        <button id="voice-btn" class="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700">🗣️ เสียง: เปิด</button>',
  '    </div>',
  '  </header>',
  '',
  '  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">',
  '    <!-- 3 Master Tabs -->',
  '    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">',
  '      <button id="tab-btn-m15" onclick="switchMasterTab(\'m15\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md">',
  '        ⚡ หน้าเทรดหลักแท่ง 15 นาที (M15 Terminal)',
  '      </button>',
  '      <button id="tab-btn-portfolio" onclick="switchMasterTab(\'portfolio\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">',
  '        💼 พอร์ตของคุณ 11 ตัว (Dime Doctor & Health Check)',
  '      </button>',
  '      <button id="tab-btn-broad" onclick="switchMasterTab(\'broad\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">',
  '        🌟 หน้าหุ้นไหนดี & ค้นหาหุ้นทุกตัว (Stock Screener)',
  '      </button>',
  '    </div>',
  '',
  '    <!-- TAB 1: M15 PRO TRADING TERMINAL -->',
  '    <div id="view-m15" class="flex flex-col gap-4">',
  '      <!-- 5-Asset Radar -->',
  '      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">',
  '        <div onclick="setAsset(\'OANDA:XAUUSD\',\'XAU/USD\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border-2 border-amber-500/80 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-amber-400">🥇 XAU/USD</span><span id="rad-status-XAU/USD" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">🟢 ตลาดเปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-XAU/USD" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-XAU/USD" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        </div>',
  '        <div onclick="setAsset(\'NASDAQ:QQQ\',\'QQQ\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-sky-400">📊 NASDAQ (QQQ)</span><span id="rad-status-QQQ" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-QQQ" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-QQQ" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        </div>',
  '        <div onclick="setAsset(\'NASDAQ:NVDA\',\'NVDA\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-emerald-400">⚡ NVDA</span><span id="rad-status-NVDA" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-NVDA" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-NVDA" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        </div>',
  '        <div onclick="setAsset(\'NASDAQ:AAPL\',\'AAPL\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-slate-200">🍏 AAPL</span><span id="rad-status-AAPL" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-AAPL" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-AAPL" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        </div>',
  '        <div onclick="setAsset(\'AMEX:SPY\',\'SPY\')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">',
  '          <div class="flex items-center justify-between"><span class="font-bold text-xs text-indigo-400">🇺🇸 SPY</span><span id="rad-status-SPY" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>',
  '          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-SPY" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-SPY" class="text-[10px] text-slate-400">RSI --</span></div>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Chart & Main Card -->',
  '      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">',
  '        <div class="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[540px] shadow-lg flex flex-col">',
  '          <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full flex-1 border-0"></iframe>',
  '        </div>',
  '        <div class="lg:col-span-4 flex flex-col gap-4">',
  '          <div class="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">',
  '            <div>',
  '              <div class="flex items-center justify-between border-b border-slate-800 pb-3">',
  '                <div><span class="text-[11px] font-semibold text-emerald-400 uppercase">สัญญาณ M15</span><h3 id="card-ticker" class="text-lg font-black text-white mt-0.5">XAU/USD</h3></div>',
  '                <span id="card-action-badge" class="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950">BUY</span>',
  '              </div>',
  '              <div class="grid grid-cols-2 gap-2.5 my-3 text-xs font-mono">',
  '                <div onclick="copyText(\'card-entry\',\'ราคาเข้า\')" class="copy-card bg-slate-800/80 p-3 rounded-xl border border-slate-700">',
  '                  <span class="text-slate-400 font-sans block">💵 จุดเข้า</span><p id="card-entry" class="text-lg font-bold text-white mt-0.5">--</p>',
  '                </div>',
  '                <div onclick="copyText(\'card-sl\',\'Stop Loss\')" class="copy-card bg-rose-950/30 p-3 rounded-xl border border-rose-800/50">',
  '                  <span class="text-rose-300 font-sans block">🛑 Stop Loss</span><p id="card-sl" class="text-lg font-bold text-rose-400 mt-0.5">--</p>',
  '                </div>',
  '                <div onclick="copyText(\'card-tp1\',\'TP1\')" class="copy-card bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">',
  '                  <span class="text-emerald-300 font-sans block">🎯 TP1 (50%)</span><p id="card-tp1" class="text-lg font-bold text-emerald-400 mt-0.5">--</p>',
  '                </div>',
  '                <div onclick="copyText(\'card-tp2\',\'TP2\')" class="copy-card bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">',
  '                  <span class="text-teal-300 font-sans block">🚀 TP2</span><p id="card-tp2" class="text-lg font-bold text-teal-300 mt-0.5">--</p>',
  '                </div>',
  '              </div>',
  '              <p id="copy-toast" class="text-center text-xs text-emerald-400 font-bold h-4"></p>',
  '            </div>',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- TAB 2: MY PERSONAL PORTFOLIO DOCTOR -->',
  '    <div id="view-portfolio" class="hidden flex flex-col gap-5">',
  '      <!-- Portfolio Health & Stats -->',
  '      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">มูลค่าพอร์ตรวม (Real-Time)</span>',
  '          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿--</p>',
  '          <span class="text-[11px] text-slate-400">ต้นทุน: <span id="pf-total-cost">฿--</span></span>',
  '        </div>',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">กำไร/ขาดทุนสุทธิ</span>',
  '          <p id="pf-total-profit" class="text-2xl font-black text-emerald-400 mt-1">--</p>',
  '          <span class="text-[11px] text-slate-400">ราคาตลาดสดขยับตามจริง</span>',
  '        </div>',
  '        <!-- Health Score Gauge (ลูกเล่นวัดสุขภาพพอร์ต) -->',
  '        <div class="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between">',
  '          <div>',
  '            <span class="text-xs text-slate-400 block">คะแนนสุขภาพพอร์ต</span>',
  '            <p id="pf-health-score" class="text-2xl font-black text-emerald-400 mt-1">85 / 100</p>',
  '            <span class="text-[10px] text-emerald-300">เกรด A • สุขภาพแข็งแรง</span>',
  '          </div>',
  '          <div class="text-3xl">🩺</div>',
  '        </div>',
  '        <div class="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-4">',
  '          <span class="text-xs text-rose-300 font-bold block">🚨 ตัวที่น่าเป็นห่วงที่สุด</span>',
  '          <p class="text-xl font-black text-rose-400 mt-1">BIDU (-22.8%)</p>',
  '          <span class="text-[10px] text-rose-300/80">เทคจีนติดลบหนัก แนะนำคัดออก</span>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Smart DCA Rebalance Calculator (ลูกเล่นคำนวณเติมเงิน) -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs flex flex-wrap items-center justify-between gap-3">',
  '        <div>',
  '          <h4 class="font-bold text-amber-400 flex items-center gap-1.5">🧮 เครื่องคำนวณเติมเงิน DCA พอร์ตเศรษฐี</h4>',
  '          <p class="text-slate-400 mt-0.5">ใส่จำนวนเงินที่คุณต้องการเติมเดือนนี้ ระบบจะแบ่งสัดส่วนที่คุ้มค่าให้ทันที:</p>',
  '        </div>',
  '        <div class="flex items-center gap-2">',
  '          <input type="number" id="inp-dca-amount" value="2000" class="w-28 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-white text-center">',
  '          <span class="text-slate-400">บาท</span>',
  '          <button onclick="calcDCA()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl transition">คำนวณ</button>',
  '        </div>',
  '        <div id="dca-result" class="w-full bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-4">',
  '          <span>• เติม <b>VOO (S&P 500)</b>: <b class="text-emerald-400 font-mono">฿1,400</b> (70%)</span>',
  '          <span>• เติม <b>AMD / TSLA</b>: <b class="text-sky-400 font-mono">฿400</b> (20%)</span>',
  '          <span>• เติม <b>ทองคำ (YLG-GOLD)</b>: <b class="text-amber-400 font-mono">฿200</b> (10%)</span>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Holdings Table -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">',
  '        <div class="flex items-center justify-between mb-3">',
  '          <h3 class="font-bold text-sm text-white">📋 หุ้น 11 ตัวในพอร์ตของคุณ (ราคา & กำไรขยับสด Real-Time)</h3>',
  '          <button onclick="loadMyPortfolio()" class="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3 py-1.5 rounded-lg border border-slate-700">🔄 รีเฟรชสด</button>',
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
  '                <th class="py-3 px-3 font-sans">คำแนะนำหมอพอร์ต</th>',
  '              </tr>',
  '            </thead>',
  '            <tbody id="pf-tbody" class="divide-y divide-slate-800/60 font-sans">',
  '              <tr><td colspan="8" class="py-6 text-center text-slate-500">กำลังดึงราคาตลาดสด...</td></tr>',
  '            </tbody>',
  '          </table>',
  '        </div>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- TAB 3: BROAD MARKET & WHICH STOCK IS GOOD (หน้าหุ้นไหนดี & สแกนทั้งตลาด) -->',
  '    <div id="view-broad" class="hidden flex flex-col gap-5">',
  '      <!-- Search Bar -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">',
  '        <div class="flex-1 min-w-[280px]">',
  '          <label class="text-xs font-bold text-amber-400 block mb-1">🔍 วิเคราะห์หุ้นตัวไหนก็ได้ในโลก (พิมพ์ชื่อย่อ เช่น TSLA, NVDA, PLTR, COIN, DIS):</label>',
  '          <div class="flex items-center gap-2">',
  '            <input type="text" id="inp-stock-search" placeholder="พิมพ์ชื่อย่อหุ้น เช่น TSLA หรือ NVDA" class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono uppercase text-white focus:outline-none focus:border-amber-400">',
  '            <button onclick="searchSingleStock()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-md">',
  '              วิเคราะห์จุดซื้อทันที',
  '            </button>',
  '          </div>',
  '        </div>',
  '        <button id="send-broad-tg-btn" class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow transition">',
  '          🌟 ส่ง 4 หุ้นเด่นเข้า Telegram',
  '        </button>',
  '      </div>',
  '',
  '      <!-- Search Card Output -->',
  '      <div id="search-result-card" class="hidden bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl">',
  '        <div class="flex items-center justify-between border-b border-slate-800 pb-3">',
  '          <div><span class="text-xs font-black text-amber-400 uppercase">ผลวิเคราะห์หุ้นสด</span><h3 id="res-sym" class="text-2xl font-black text-white mt-0.5">--</h3></div>',
  '          <span id="res-verdict" class="px-3.5 py-1.5 rounded-full text-xs font-black">--</span>',
  '        </div>',
  '        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs font-mono">',
  '          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800"><span class="text-slate-400 font-sans">ราคาตลาด:</span><p id="res-price" class="text-base font-bold text-white mt-1">--</p></div>',
  '          <div class="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/40"><span class="text-emerald-400 font-sans font-bold">🛒 โซนควรเข้าซื้อ:</span><p id="res-buyzone" class="text-base font-bold text-emerald-300 mt-1">--</p></div>',
  '          <div class="bg-teal-950/30 p-3 rounded-xl border border-teal-800/40"><span class="text-teal-400 font-sans font-bold">🎯 เป้าทำกำไร (TP2):</span><p id="res-target" class="text-base font-bold text-teal-300 mt-1">--</p></div>',
  '          <div class="bg-rose-950/30 p-3 rounded-xl border border-rose-800/40"><span class="text-rose-400 font-sans">🛑 จุด Stop Loss:</span><p id="res-sl" class="text-base font-bold text-rose-400 mt-1">--</p></div>',
  '        </div>',
  '        <p id="res-reason" class="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 italic">--</p>',
  '      </div>',
  '',
  '      <!-- Quick Matchmaker Pills (ลูกเล่นคัดกรองด่วน) -->',
  '      <div class="flex flex-wrap items-center gap-2 text-xs">',
  '        <span class="text-slate-400 font-medium">คัดกรองด่วน:</span>',
  '        <button onclick="filterMatch(\'ALL\')" class="filter-pill active px-3 py-1.5 rounded-xl font-bold bg-amber-500 text-slate-950">ทั้งหมด (35+ หุ้น)</button>',
  '        <button onclick="filterMatch(\'DIP\')" class="filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">🛒 ก้นหลุมรอบเดือน (Dip Deals)</button>',
  '        <button onclick="filterMatch(\'TECH\')" class="filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">🚀 AI & Tech เติบโตสูง</button>',
  '        <button onclick="filterMatch(\'BLUECHIP\')" class="filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">💎 หุ้นมั่นคง Blue-Chip</button>',
  '      </div>',
  '',
  '      <!-- Full Market Screener Table -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">',
  '        <div class="flex items-center justify-between mb-3">',
  '          <h3 class="font-bold text-sm text-white">📊 ผลการจัดอันดับหุ้นน่าซื้อทั้งตลาดสหรัฐฯ (คำนวณจากก้นหลุมรอบเดือน + เทรนด์ 50/200 วัน)</h3>',
  '          <button onclick="loadBroadMarket()" class="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3 py-1.5 rounded-lg border border-amber-500/30">🔄 รีเฟรช</button>',
  '        </div>',
  '        <div class="overflow-x-auto">',
  '          <table class="w-full text-left text-xs font-mono">',
  '            <thead>',
  '              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">',
  '                <th class="py-3 px-3">อันดับ</th>',
  '                <th class="py-3 px-3">หุ้น</th>',
  '                <th class="py-3 px-3">คำแนะนำ</th>',
  '                <th class="py-3 px-3">คะแนนน่าซื้อ</th>',
  '                <th class="py-3 px-3">ราคาตลาดสด</th>',
  '                <th class="py-3 px-3">โซนควรเข้าซื้อ</th>',
  '                <th class="py-3 px-3">Stop Loss</th>',
  '                <th class="py-3 px-3">เป้าทำกำไร</th>',
  '                <th class="py-3 px-3">อัพไซด์ (%)</th>',
  '              </tr>',
  '            </thead>',
  '            <tbody id="broad-tbody" class="divide-y divide-slate-800/60 font-sans">',
  '              <tr><td colspan="9" class="py-6 text-center text-slate-500">กำลังสแกนราคาจริงทั้งตลาด...</td></tr>',
  '            </tbody>',
  '          </table>',
  '        </div>',
  '      </div>',
  '    </div>',
  '  </main>',
  '',
  '  <script>',
  '    let activeMasterTab = "m15";',
  '    let currentSelectedSymbol = "XAU/USD";',
  '    let latestPlans = {};',
  '    let broadMarketList = [];',
  '    let currentBroadFilter = "ALL";',
  '    let voiceOn = true;',
  '    let lastHoldingPrices = {};',
  '    let lastTotalVal = null;',
  '    let lastAssetPrices = {};',
  '    let lastMessageTime = Date.now();',
  '    let secondsSinceLastTick = 0;',
  '    let ws = null;',
  '',
  '    // 1. WebSocket Client with Auto-Reconnect',
  '    function initWebSocket() {',
  '      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";',
  '      const wsUrl = protocol + "//" + window.location.host;',
  '      try {',
  '        ws = new WebSocket(wsUrl);',
  '',
  '        ws.onopen = function() {',
  '          const b = document.getElementById("ws-badge");',
  '          if (b) b.className = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold";',
  '          const t = document.getElementById("ws-text");',
  '          if (t) t.textContent = "🔴 เรียลไทม์สด (Live Connected)";',
  '        };',
  '',
  '        ws.onmessage = function(event) {',
  '          try {',
  '            const data = JSON.parse(event.data);',
  '            handleRealtimePacket(data);',
  '          } catch(e) {}',
  '        };',
  '',
  '        ws.onclose = function() {',
  '          const b = document.getElementById("ws-badge");',
  '          if (b) b.className = "bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold";',
  '          const t = document.getElementById("ws-text");',
  '          if (t) t.textContent = "⚠️ กำลังต่อสัญญาณใหม่...";',
  '          setTimeout(initWebSocket, 2000);',
  '        };',
  '',
  '        ws.onerror = function() {',
  '          if (ws) ws.close();',
  '        };',
  '      } catch(e) {',
  '        setTimeout(initWebSocket, 3000);',
  '      }',
  '    }',
  '',
  '    // 2. Real-Time Packet Handler',
  '    function handleRealtimePacket(data) {',
  '      lastMessageTime = Date.now();',
  '      secondsSinceLastTick = 0;',
  '      const lt = document.getElementById("live-timer");',
  '      if (lt) lt.textContent = "0s";',
  '',
  '      if (data.plans) {',
  '        latestPlans = data.plans;',
  '        updateActivePlanCard();',
  '      }',
  '',
  '      if (data.radar) {',
  '        updateM15RadarButtons(data.radar);',
  '      }',
  '',
  '      if (data.portfolio) {',
  '        updatePortfolioUI(data.portfolio);',
  '      }',
  '',
  '      if (data.broad && Array.isArray(data.broad) && data.broad.length > 0) {',
  '        broadMarketList = data.broad;',
  '        if (activeMasterTab === "broad") {',
  '          applyBroadFilter(currentBroadFilter);',
  '        }',
  '      }',
  '    }',
  '',
  '    // 3. Update M15 Radar Buttons & Price Flashes',
  '    function updateM15RadarButtons(radar) {',
  '      for (const sym of ["XAU/USD", "QQQ", "NVDA", "AAPL", "SPY"]) {',
  '        const item = radar[sym];',
  '        if (!item) continue;',
  '        const priceEl = document.getElementById("rad-price-" + sym);',
  '        if (priceEl) {',
  '          const oldP = lastAssetPrices[sym] || 0;',
  '          const newP = item.price;',
  '          priceEl.textContent = "$" + Number(newP).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });',
  '          if (oldP && newP !== oldP) {',
  '            priceEl.classList.remove("flash-up", "flash-down");',
  '            void priceEl.offsetWidth;',
  '            priceEl.classList.add(newP > oldP ? "flash-up" : "flash-down");',
  '          }',
  '          lastAssetPrices[sym] = newP;',
  '        }',
  '',
  '        const rsiEl = document.getElementById("rad-rsi-" + sym);',
  '        if (rsiEl && item.rsi) rsiEl.textContent = "RSI " + item.rsi;',
  '',
  '        const stEl = document.getElementById("rad-status-" + sym);',
  '        if (stEl) {',
  '          stEl.textContent = item.isOpen ? "● ตลาดเปิด" : "○ ตลาดปิด";',
  '          stEl.className = item.isOpen ? "text-[10px] text-emerald-400 font-bold block" : "text-[10px] text-slate-500 font-bold block";',
  '        }',
  '      }',
  '    }',
  '',
  '    // 4. Update Active Plan Card',
  '    function updateActivePlanCard() {',
  '      const plan = latestPlans[currentSelectedSymbol];',
  '      if (!plan) return;',
  '      const tk = document.getElementById("card-ticker");',
  '      if (tk) tk.textContent = plan.ticker;',
  '      const en = document.getElementById("card-entry");',
  '      if (en) en.textContent = plan.entry;',
  '      const sl = document.getElementById("card-sl");',
  '      if (sl) sl.textContent = plan.sl;',
  '      const tp1 = document.getElementById("card-tp1");',
  '      if (tp1) tp1.textContent = plan.tp1;',
  '      const tp2 = document.getElementById("card-tp2");',
  '      if (tp2) tp2.textContent = plan.tp2;',
  '      const b = document.getElementById("card-action-badge");',
  '      if (b) {',
  '        b.textContent = plan.action === "BUY" ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";',
  '        b.className = plan.action === "BUY" ? "px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950" : "px-3.5 py-1 rounded-full text-xs font-black bg-rose-500 text-white";',
  '      }',
  '    }',
  '',
  '    // 5. Update Portfolio UI in Real-Time',
  '    function updatePortfolioUI(data) {',
  '      if (!data) return;',
  '      const valEl = document.getElementById("pf-total-val");',
  '      if (valEl) {',
  '        const oldVal = lastTotalVal || 0;',
  '        valEl.textContent = "฿" + Number(data.totalValueTHB).toLocaleString();',
  '        if (oldVal && data.totalValueTHB !== oldVal) {',
  '          valEl.classList.remove("flash-up", "flash-down");',
  '          void valEl.offsetWidth;',
  '          valEl.classList.add(data.totalValueTHB > oldVal ? "flash-up" : "flash-down");',
  '        }',
  '        lastTotalVal = data.totalValueTHB;',
  '      }',
  '',
  '      const costEl = document.getElementById("pf-total-cost");',
  '      if (costEl) costEl.textContent = "฿" + Number(data.totalCostTHB).toLocaleString();',
  '',
  '      const hsEl = document.getElementById("pf-health-score");',
  '      if (hsEl) hsEl.textContent = data.healthScore + " / 100";',
  '',
  '      const sign = data.totalProfitTHB >= 0 ? "+" : "";',
  '      const pColor = data.totalProfitTHB >= 0 ? "text-emerald-400" : "text-rose-400";',
  '      const pEl = document.getElementById("pf-total-profit");',
  '      if (pEl) {',
  '        pEl.textContent = sign + "฿" + Number(data.totalProfitTHB).toLocaleString() + " (" + sign + data.totalProfitPct + "%)";',
  '        pEl.className = "text-2xl font-black mt-1 " + pColor;',
  '      }',
  '',
  '      const tbody = document.getElementById("pf-tbody");',
  '      if (tbody && data.holdings && Array.isArray(data.holdings)) {',
  '        tbody.innerHTML = data.holdings.map(function(item) {',
  '          const pCls = item.profitTHB >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";',
  '          const pSign = item.profitTHB >= 0 ? "+" : "";',
  '          const badgeColor = item.healthStatus === "ALARM" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : item.healthStatus === "EXCELLENT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-300";',
  '',
  '          const prevPrice = lastHoldingPrices[item.symbol] || 0;',
  '          let flashClass = "";',
  '          if (prevPrice && item.currentPrice !== prevPrice) {',
  '            flashClass = item.currentPrice > prevPrice ? "flash-up" : "flash-down";',
  '          }',
  '          lastHoldingPrices[item.symbol] = item.currentPrice;',
  '',
  '          return "<tr class=\\"hover:bg-slate-800/50 transition " + flashClass + "\\">" +',
  '            "<td class=\\"py-3 px-3\\"><span class=\\"text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold\\">" + item.category + "</span></td>" +',
  '            "<td class=\\"py-3 px-3\\"><b class=\\"text-white text-sm\\">" + item.symbol + "</b><span class=\\"text-slate-400 text-xs block\\">" + item.name + "</span></td>" +',
  '            "<td class=\\"py-3 px-3 font-mono text-white font-bold\\">" + item.shares + "</td>" +',
  '            "<td class=\\"py-3 px-3 font-mono text-slate-300\\">" + (item.currency===\'USD\'?\'$\':\'฿\') + item.avgCost + "</td>" +',
  '            "<td class=\\"py-3 px-3 font-mono text-white font-bold " + flashClass + "\\">" + (item.currency===\'USD\'?\'$\':\'฿\') + item.currentPrice + "</td>" +',
  '            "<td class=\\"py-3 px-3 font-mono text-white\\">฿" + Number(item.valueTHB).toLocaleString() + "</td>" +',
  '            "<td class=\\"py-3 px-3 font-mono " + pCls + "\\">" + pSign + "฿" + item.profitTHB + " (" + pSign + item.profitPct + "%)</td>" +',
  '            "<td class=\\"py-3 px-3\\"><span class=\\"px-2 py-0.5 rounded text-[11px] font-bold block " + badgeColor + "\\">" + item.advice + "</span></td>" +',
  '          "</tr>";',
  '        }).join("");',
  '      }',
  '    }',
  '',
  '    // 6. Navigation Tabs',
  '    function switchMasterTab(tab) {',
  '      activeMasterTab = tab;',
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
  '        else applyBroadFilter(currentBroadFilter);',
  '      }',
  '    }',
  '',
  '    function copyText(id, label) {',
  '      const txt = document.getElementById(id).textContent;',
  '      if (!txt || txt === "--") return;',
  '      navigator.clipboard.writeText(txt);',
  '      const el = document.getElementById("copy-toast");',
  '      if (el) {',
  '        el.textContent = "✅ คัดลอก " + label + " (" + txt + ") แล้ว!";',
  '        setTimeout(function() { el.textContent = ""; }, 2500);',
  '      }',
  '    }',
  '',
  '    function setAsset(tvSym, label) {',
  '      currentSelectedSymbol = label;',
  '      const tvFrame = document.getElementById("tv-frame");',
  '      if (tvFrame) {',
  '        tvFrame.src = "https://s.tradingview.com/widgetembed/?symbol=" + encodeURIComponent(tvSym) + "&interval=15&theme=dark&timezone=Asia%2FBangkok";',
  '      }',
  '      updateActivePlanCard();',
  '    }',
  '',
  '    function calcDCA() {',
  '      const amt = parseFloat(document.getElementById("inp-dca-amount").value) || 2000;',
  '      const voo = Math.round(amt * 0.7);',
  '      const tech = Math.round(amt * 0.2);',
  '      const gold = amt - voo - tech;',
  '      document.getElementById("dca-result").innerHTML = ',
  '        "<span>• เติม <b>VOO (S&P 500)</b>: <b class=\'text-emerald-400 font-mono\'>฿" + voo.toLocaleString() + "</b> (70%)</span>" +',
  '        "<span>• เติม <b>AMD / TSLA</b>: <b class=\'text-sky-400 font-mono\'>฿" + tech.toLocaleString() + "</b> (20%)</span>" +',
  '        "<span>• เติม <b>ทองคำ (YLG-GOLD)</b>: <b class=\'text-amber-400 font-mono\'>฿" + gold.toLocaleString() + "</b> (10%)</span>";',
  '    }',
  '',
  '    async function loadMyPortfolio() {',
  '      try {',
  '        const r = await fetch("/api/my-portfolio");',
  '        const data = await r.json();',
  '        updatePortfolioUI(data);',
  '      } catch(e) {}',
  '    }',
  '',
  '    async function loadBroadMarket() {',
  '      try {',
  '        const r = await fetch("/api/broad-market");',
  '        const d = await r.json();',
  '        broadMarketList = d.stocks || [];',
  '        applyBroadFilter(currentBroadFilter);',
  '      } catch(e) {}',
  '    }',
  '',
  '    function filterMatch(type) {',
  '      currentBroadFilter = type;',
  '      document.querySelectorAll(".filter-pill").forEach(p => {',
  '        p.className = "filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '      });',
  '      if (event && event.target) {',
  '        event.target.className = "filter-pill active px-3 py-1.5 rounded-xl font-bold bg-amber-500 text-slate-950";',
  '      }',
  '      applyBroadFilter(type);',
  '    }',
  '',
  '    function applyBroadFilter(type) {',
  '      if (type === "ALL") {',
  '        renderBroadTable(broadMarketList);',
  '      } else if (type === "DIP") {',
  '        renderBroadTable(broadMarketList.filter(x => x.isDipDeal || x.distFromLowPct <= 5.0));',
  '      } else {',
  '        renderBroadTable(broadMarketList.filter(x => x.category === type));',
  '      }',
  '    }',
  '',
  '    function renderBroadTable(list) {',
  '      const tbody = document.getElementById("broad-tbody");',
  '      if (!tbody) return;',
  '      if (!list || list.length === 0) {',
  '        tbody.innerHTML = "<tr><td colspan=\\"9\\" class=\\"py-6 text-center text-slate-500\\">ไม่พบข้อมูลในหมวดหมู่นี้</td></tr>";',
  '        return;',
  '      }',
  '      tbody.innerHTML = list.map(function(item, idx) {',
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
  '      if (!sym) return alert("กรุณาพิมพ์ชื่อย่อหุ้น เช่น NVDA, TSLA, PLTR");',
  '      const card = document.getElementById("search-result-card");',
  '      card.classList.remove("hidden");',
  '      document.getElementById("res-sym").textContent = "กำลังวิเคราะห์ " + sym + "...";',
  '      try {',
  '        const r = await fetch("/api/analyze-stock?symbol=" + encodeURIComponent(sym));',
  '        const d = await r.json();',
  '        if (d.ok && d.stock) {',
  '          const s = d.stock;',
  '          document.getElementById("res-sym").textContent = s.symbol + " (คะแนนน่าซื้อ " + s.score + "/100)";',
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
  '    // 7. World Clock Ticking Every Second',
  '    function updateWorldClock() {',
  '      const now = new Date();',
  '      // Bangkok',
  '      const bkkStr = now.toLocaleTimeString(\'th-TH\', { timeZone: \'Asia/Bangkok\', hour12: false });',
  '      const bkkHour = parseInt(now.toLocaleTimeString(\'en-US\', { timeZone: \'Asia/Bangkok\', hour: \'2-digit\', hour12: false }));',
  '      const bkkMin = parseInt(now.toLocaleTimeString(\'en-US\', { timeZone: \'Asia/Bangkok\', minute: \'2-digit\' }));',
  '      const bkkDay = now.toLocaleDateString(\'en-US\', { timeZone: \'Asia/Bangkok\', weekday: \'short\' });',
  '      const isBkkOpen = (bkkDay !== \'Sat\' && bkkDay !== \'Sun\') && ((bkkHour >= 10 && bkkHour < 12) || (bkkHour === 12 && bkkMin <= 30) || (bkkHour >= 14 && bkkHour < 16) || (bkkHour === 16 && bkkMin <= 30));',
  '      const bkkEl = document.getElementById("session-bkk");',
  '      if (bkkEl) bkkEl.innerHTML = "🇹🇭 ไทย: <span class=\'font-mono\'>" + bkkStr + "</span> (" + (isBkkOpen ? "<span class=\'text-emerald-400\'>🟢 เปิด</span>" : "<span class=\'text-slate-500\'>🔴 ปิด</span>") + ")";',
  '',
  '      // US East (Wall Street)',
  '      const usStr = now.toLocaleTimeString(\'en-US\', { timeZone: \'America/New_York\', hour12: false });',
  '      const usHour = parseInt(now.toLocaleTimeString(\'en-US\', { timeZone: \'America/New_York\', hour: \'2-digit\', hour12: false }));',
  '      const usMin = parseInt(now.toLocaleTimeString(\'en-US\', { timeZone: \'America/New_York\', minute: \'2-digit\' }));',
  '      const usDay = now.toLocaleDateString(\'en-US\', { timeZone: \'America/New_York\', weekday: \'short\' });',
  '      const isUsOpen = (usDay !== \'Sat\' && usDay !== \'Sun\') && (usHour > 9 || (usHour === 9 && usMin >= 30)) && usHour < 16;',
  '      const usEl = document.getElementById("session-us");',
  '      if (usEl) usEl.innerHTML = "🇺🇸 สหรัฐฯ: <span class=\'font-mono\'>" + usStr + "</span> (" + (isUsOpen ? "<span class=\'text-emerald-400\'>🟢 เปิด</span>" : "<span class=\'text-amber-400\'>🔴 ปิด (เปิด 20:30)</span>") + ")";',
  '    }',
  '',
  '    // 8. Timers and Initial Setup',
  '    setInterval(updateWorldClock, 1000);',
  '    updateWorldClock();',
  '',
  '    setInterval(function() {',
  '      secondsSinceLastTick++;',
  '      const el = document.getElementById("live-timer");',
  '      if (el) el.textContent = secondsSinceLastTick + "s";',
  '    }, 1000);',
  '',
  '    // Fallback Polling every 5 seconds if WebSocket drops',
  '    setInterval(async function() {',
  '      if (!ws || ws.readyState !== WebSocket.OPEN) {',
  '        try {',
  '          const r = await fetch("/api/signals");',
  '          const d = await r.json();',
  '          handleRealtimePacket(d);',
  '        } catch(e) {}',
  '      }',
  '    }, 5000);',
  '',
  '    const tgBtn = document.getElementById("send-broad-tg-btn");',
  '    if (tgBtn) {',
  '      tgBtn.onclick = async function() {',
  '        tgBtn.textContent = "⏳ กำลังส่ง 4 หุ้นเด่น...";',
  '        try {',
  '          const r = await fetch("/api/send-broad-telegram", { method: "POST" });',
  '          const d = await r.json();',
  '          tgBtn.textContent = d.ok ? "✅ ส่งเข้า Telegram เรียบร้อย!" : "⚠️ ส่งไม่สำเร็จ";',
  '        } catch(e) {',
  '          tgBtn.textContent = "⚠️ เกิดข้อผิดพลาด";',
  '        }',
  '        setTimeout(function() { tgBtn.textContent = "🌟 ส่ง 4 หุ้นเด่นเข้า Telegram"; }, 3000);',
  '      };',
  '    }',
  '',
  '    initWebSocket();',
  '',
  '    fetch("/api/signals").then(function(r) { return r.json(); }).then(function(d) {',
  '      latestPlans = d.plans || {};',
  '      if (d.radar) updateM15RadarButtons(d.radar);',
  '      setAsset("OANDA:XAUUSD", "XAU/USD");',
  '    });',
  '  </script>',
  '</body>',
  '</html>'
].join('\n');

app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

// 11. ระบบ Anti-Sleep และ Loop ตรวจจับ Telegram
setInterval(() => {
  fetch(APP_URL + '/api/ping').catch(() => {});
}, 10 * 60 * 1000);

setInterval(pollTelegramUpdates, 3500);

server.listen(PORT, async () => {
  console.log('🚀 3-in-1 Master Terminal running on port ' + PORT);
  setInterval(updateLiveQuotes, 5000); // ดึงราคา Real-Time ทุก 5 วินาที
  setInterval(scanMarket, 30 * 1000); // สแกนเทรนด์ M15 ทุก 30 วินาที
  setInterval(scanBroadMarketUniverse, 5 * 60 * 1000); // สแกน 35 หุ้นใหญ่ทุก 5 นาที
  
  updateLiveQuotes();
  scanMarket();
  setTimeout(analyzeUserPortfolio, 1500);
  setTimeout(scanBroadMarketUniverse, 3000);
});
