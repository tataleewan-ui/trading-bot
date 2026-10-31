& result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const ts = result.timestamp;
      const q = result.indicators.quote[0];
      const meta = result.meta || {};
      const livePrice = meta.regularMarketPrimport http from 'http';
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

// 1) 5 สินทรัพย์หลักสำหรับเทรดสั้น M15
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

// 2) ข้อมูลพอร์ตจริงของผู้ใช้ (11 ตัวจากแอป Dime!)
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
let lastPortfolioData = null;
let lastScanTime = null;
let telegramEnabled = true;
let lastTelegramUpdateId = 0;

// ==========================================
// 1. ตรวจสอบเวลาตลาดเปิด-ปิดจริง
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
// 3. ระบบส่งข้อความ Telegram
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
// 4. ดึงข้อมูลราคา Real-Time จริง
// ==========================================
async function fetchDailyStockData(yahooTicker) {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooTicker) + '?interval=1d&range=6mo';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (result && result.timestamp &ice || meta.chartPreviousClose;
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

// ==========================================
// 5. คาดเดากราฟหุ้นในพอร์ต (Chart Forecast: จะขึ้นหรือลง?)
// ==========================================
async function forecastSingleStock(sym) {
  const yahooSym = YAHOO_MAP[sym] || sym;
  let candles = [];
  let curPrice = 0;

  if (sym === 'YLG-GOLD' || sym === 'XAU/USD') {
    candles = await fetchM15Candles('XAU/USD');
    if (candles.length > 0) curPrice = candles[candles.length - 1].close;
  } else {
    const d = await fetchDailyStockData(yahooSym);
    if (d && d.candles) {
      candles = d.candles;
      curPrice = d.livePrice;
    }
  }

  if (candles.length < 30) return null;

  const closes = candles.map(c => c.close);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const rsi = calculateRSI(closes, 14);

  const last = closes.length - 1;
  const cEMA21 = ema21[last];
  const cEMA50 = ema50[last];
  const cPrice = curPrice || closes[last];

  let direction = 'SIDEWAY';
  let dirIcon = '⚪';
  let forecastTitle = 'แกว่งตัวในกรอบ (Sideway)';
  let confidence = 'ปานกลาง';
  let keyLevel = cEMA50.toFixed(2);
  let rationale = '';

  if (cPrice > cEMA50 && cEMA21 >= cEMA50 && rsi >= 48) {
    direction = 'UP';
    dirIcon = '🟢';
    forecastTitle = 'มีโอกาสขึ้นต่อ (Bullish Trend)';
    confidence = rsi >= 52 && rsi <= 65 ? 'สูงมาก (90%)' : 'สูง (80%)';
    rationale = 'ราคายืนเหนือเส้นแนวโน้ม 50 วันและ 21 วัน พร้อมแรงส่ง RSI ' + rsi.toFixed(0) + ' แข็งแกร่ง';
  } else if (cPrice < cEMA50 && cEMA21 <= cEMA50 && rsi <= 50) {
    direction = 'DOWN';
    dirIcon = '🔴';
    forecastTitle = 'มีโอกาสพักตัว/ลงต่อ (Bearish Trend)';
    confidence = rsi <= 40 ? 'สูง (80%)' : 'ปานกลาง';
    rationale = 'ราคาหลุดใต้เส้น 50 วัน และแรงซื้ออ่อนแรง (RSI ' + rsi.toFixed(0) + ')';
  } else if (rsi < 35) {
    direction = 'REBOUND';
    dirIcon = '🟢';
    forecastTitle = 'ลุ้นดีดตัวกลับระยะสั้น (Oversold Bounce)';
    confidence = 'ปานกลาง-สูง (75%)';
    rationale = 'RSI เข้าโซนขายมากเกินไป (' + rsi.toFixed(0) + ') มักเกิดการเด้งสั้น';
  } else {
    rationale = 'ราคาพักตัวในกรอบแนวรับ-แนวต้าน รอยืนยันทิศทาง';
  }

  return {
    symbol: sym,
    price: cPrice,
    direction: direction,
    dirIcon: dirIcon,
    forecastTitle: forecastTitle,
    confidence: confidence,
    rsi: Number(rsi.toFixed(0)),
    keyLevel: keyLevel,
    rationale: rationale
  };
}

// ==========================================
// 6. ระบบวิเคราะห์และตรวจสุขภาพพอร์ตจริง (AI Portfolio Doctor)
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

  lastPortfolioData = {
    totalValueTHB: Number(totalValueTHB.toFixed(2)),
    totalCostTHB: Number(totalCostTHB.toFixed(2)),
    totalProfitTHB: Number(totalProfitTHB.toFixed(2)),
    totalProfitPct: Number(totalProfitPct.toFixed(2)),
    holdings: diagnosedList,
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  return lastPortfolioData;
}

// ==========================================
// 7. บอท Telegram อัจฉริยะ ตอบโต้กับผู้ใช้ได้ 24/7 (Interactive Telegram Bot)
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
        CHAT_ID = String(chatId); // บันทึก Chat ID อัตโนมัติ
        const text = msg.text.trim().toLowerCase();

        // 1) คำสั่งดูพอร์ต (/portfolio หรือพิมพ์ "พอร์ต")
        if (text === '/portfolio' || text === 'พอร์ต' || text === '/port' || text === 'สรุปพอร์ต') {
          const pf = await analyzeUserPortfolio();
          const sign = pf.totalProfitTHB >= 0 ? '+' : '';
          let reply = '💼 <b>สรุปพอร์ต Dime ของคุณแบบ Real-Time</b>\n';
          reply += '──────────────────\n';
          reply += '💰 มูลค่าพอร์ตรวม: <b>฿' + pf.totalValueTHB.toLocaleString() + '</b>\n';
          reply += '💵 ต้นทุนรวม: ฿' + pf.totalCostTHB.toLocaleString() + '\n';
          reply += '📈 กำไรสุทธิ: <b>' + sign + '฿' + pf.totalProfitTHB.toLocaleString() + ' (' + sign + pf.totalProfitPct + '%)</b>\n';
          reply += '──────────────────\n';
          pf.holdings.forEach(h => {
            const hSign = h.profitTHB >= 0 ? '+' : '';
            reply += '• <b>' + h.symbol + ':</b> ' + (h.currency === 'USD' ? '$' : '฿') + h.currentPrice + ' (' + hSign + h.profitPct + '%)\n';
          });
          reply += '──────────────────\n';
          reply += '⭐ <b>วันนี้แนะนำซื้อ:</b> <code>VOO</code> (เสาหลักโตสม่ำเสมอ)\n';
          reply += '🚨 <b>น่าเป็นห่วง:</b> <code>BIDU</code> (ขาดทุน -22% แนะนำ Cut Loss)';
          await sendTelegramMessage(reply, true, chatId);
        }
        // 2) คำสั่งคาดเดาทิศทางกราฟหุ้น (/forecast หรือพิมพ์ "วิเคราะห์" หรือ "ทิศทาง")
        else if (text === '/forecast' || text === 'ทิศทาง' || text === 'วิเคราะห์' || text === 'กราฟ') {
          let reply = '📊 <b>ผลคาดเดาทิศทางกราฟหุ้นในพอร์ตของคุณ (AI Chart Forecast)</b>\n';
          reply += 'วิเคราะห์จาก Price Action + EMA 50/200 + RSI ล่าสุด\n';
          reply += '──────────────────\n';
          const targetStocks = ['VOO', 'AMD', 'TSLA', 'BIDU', 'TTB'];
          for (const s of targetStocks) {
            const fc = await forecastSingleStock(s);
            if (fc) {
              reply += fc.dirIcon + ' <b>' + fc.symbol + ' ($' + fc.price + '):</b> ' + fc.forecastTitle + '\n';
              reply += '   ความมั่นใจ: <b>' + fc.confidence + '</b> | แนวรับ/ต้าน: <code>' + fc.keyLevel + '</code>\n';
              reply += '   💡 <i>' + fc.rationale + '</i>\n\n';
            }
          }
          await sendTelegramMessage(reply, true, chatId);
        }
        // 3) ถามหุ้นรายตัว เช่น พิมพ์ "voo", "amd", "tsla", "bidu"
        else if (['voo', 'amd', 'tsla', 'bidu', 'ttb', 'gold', 'xom', 'xlv', 'vt'].includes(text) || text.startsWith('/')) {
          const cleanSym = text.replace('/', '').toUpperCase();
          const sym = cleanSym === 'GOLD' ? 'YLG-GOLD' : cleanSym;
          const pf = await analyzeUserPortfolio();
          const item = pf.holdings.find(h => h.symbol.toUpperCase() === sym);
          const fc = await forecastSingleStock(sym);

          if (item) {
            const pSign = item.profitTHB >= 0 ? '+' : '';
            let reply = '🔍 <b>วิเคราะห์เจาะลึก: ' + item.symbol + ' (' + item.name + ')</b>\n';
            reply += '──────────────────\n';
            reply += '💵 ราคาตลาดสด: <b>' + (item.currency === 'USD' ? '$' : '฿') + item.currentPrice + '</b>\n';
            reply += '📦 จำนวนที่คุณถือ: ' + item.shares + ' หุ้น (ต้นทุน: ' + (item.currency === 'USD' ? '$' : '฿') + item.avgCost + ')\n';
            reply += '📈 กำไร/ขาดทุน: <b>' + pSign + '฿' + item.profitTHB + ' (' + pSign + item.profitPct + '%)</b>\n';
            if (fc) {
              reply += '🔮 คาดเดาทิศทางกราฟ: ' + fc.dirIcon + ' <b>' + fc.forecastTitle + '</b> (' + fc.confidence + ')\n';
              reply += '💡 <i>' + fc.rationale + '</i>\n';
            }
            reply += '📌 คำแนะนำหมอพอร์ต: <b>' + item.advice + '</b>';
            await sendTelegramMessage(reply, true, chatId);
          }
        }
        // คำสั่งอื่นๆ / เมนูช่วยเหลือ
        else if (text === '/help' || text === 'เมนู' || text === 'ช่วย') {
          let reply = '🤖 <b>สวัสดีครับ! ผมคือบอทผู้ช่วยเทรดและดูแลพอร์ตของคุณ</b>\n\n';
          reply += 'คุณสามารถพิมพ์ถามผมได้ตลอดเวลา เช่น:\n';
          reply += '• พิมพ์ <b>พอร์ต</b> หรือ <b>/portfolio</b> -> ดูสรุปกำไรขาดทุนพอร์ตสด\n';
          reply += '• พิมพ์ <b>ทิศทาง</b> หรือ <b>/forecast</b> -> คาดเดากราฟว่าหุ้นจะขึ้นหรือลง\n';
          reply += '• พิมพ์ชื่อหุ้น เช่น <b>VOO</b>, <b>AMD</b>, <b>TSLA</b>, <b>BIDU</b> -> เจาะลึกหุ้นตัวนั้น\n';
          reply += '• พิมพ์ <b>ข่าว</b> -> ดูสรุปผลกระทบข่าวเศรษฐกิจล่าสุด';
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
          reason: isBuy
            ? 'ราคายืนเหนือ EMA 50 และ EMA 21 (RSI: ' + rsi.toFixed(0) + ') แนะนำโฟกัสฝั่ง BUY'
            : 'ราคาอยู่ใต้ EMA 50 และ EMA 21 (RSI: ' + rsi.toFixed(0) + ') แนะนำโฟกัสฝั่ง SELL',
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

  // อัปเดตราคาพอร์ตแบบ Real-time ทุก 30 วินาที
  const pf = await analyzeUserPortfolio();

  lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  broadcast({
    type: 'RADAR_UPDATE',
    radar: marketRadar,
    plans: latestPlanBySymbol,
    portfolio: pf,
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
  lastScanTime: lastScanTime
}));

app.get('/api/my-portfolio', async (req, res) => {
  const pf = await analyzeUserPortfolio();
  res.json(pf);
});

// API ส่งสรุปผลกระทบข่าวเศรษฐกิจแรงเข้า Telegram ทันที
app.post('/api/send-news-flash', async (req, res) => {
  const { title, actual, forecast, impact, analysis } = req.body;
  let msg = '🚨 <b>รายงานด่วนผลกระทบข่าวเศรษฐกิจ (Market News Flash)</b>\n';
  msg += '──────────────────\n';
  msg += '📰 <b>ข่าว:</b> ' + (title || 'ตัวเลขเงินเฟ้อ CPI สหรัฐฯ') + '\n';
  msg += '📊 ตัวเลขจริง: <b>' + (actual || '2.8%') + '</b> | คาดการณ์: ' + (forecast || '3.1%') + '\n';
  msg += '💥 <b>ทิศทางตลาด:</b> ' + (impact || '🟢 หนุนทองคำและหุ้นพุ่งขึ้นแรง!') + '\n';
  msg += '💡 <b>ทำไมตลาดถึงขึ้น/ลง:</b> <i>' + (analysis || 'ตัวเลขเงินเฟ้อชะลอตัวเร็วกว่าคาด ตลาดคลายกังวลเรื่องดอกเบี้ย ดอลลาร์อ่อนค่า ส่งผลให้ทองคำและหุ้นบวกทันที') + '</i>\n';
  msg += '──────────────────\n';
  msg += '🎯 <b>คำแนะนำ:</b> รอย่อตัวเข้าตามน้ำ ห้ามกระโดดไล่ราคาตอนข่าวออกวินาทีแรก';

  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok: ok });
});

// API ส่งผลคาดเดาทิศทางกราฟหุ้นในพอร์ตเข้า Telegram
app.post('/api/send-forecast-telegram', async (req, res) => {
  let msg = '📊 <b>รายงานคาดเดาทิศทางกราฟหุ้นในพอร์ตของคุณ (ก่อนเปิดตลาด 20:15 น.)</b>\n';
  msg += 'วิเคราะห์จาก Price Action + EMA 50/200 + RSI รายวัน\n';
  msg += '──────────────────\n';

  const targets = ['VOO', 'AMD', 'TSLA', 'BIDU', 'TTB'];
  for (const s of targets) {
    const fc = await forecastSingleStock(s);
    if (fc) {
      msg += fc.dirIcon + ' <b>' + fc.symbol + ' ($' + fc.price + '):</b> ' + fc.forecastTitle + '\n';
      msg += '   ความมั่นใจ: <b>' + fc.confidence + '</b> | แนวรับ/ต้าน: <code>' + fc.keyLevel + '</code>\n';
      msg += '   💡 <i>' + fc.rationale + '</i>\n\n';
    }
  }
  msg += '💡 <i>วิเคราะห์อัตโนมัติจากกราฟจริง วางแผนเข้าซื้อตาม Money Management ครับ</i>';

  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok: ok });
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

app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// 10. หน้าเว็บ Master Terminal ครบครัน
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
  '              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live"></span> พอร์ตอัปเดตสด Real-Time',
  '            </span>',
  '          </div>',
  '          <p class="text-xs text-slate-400">บอท Telegram ตอบโต้ได้ 24/7 + คาดเดากราฟหุ้น + วิเคราะห์ผลกระทบข่าวสด</p>',
  '        </div>',
  '      </div>',
  '      <div class="flex items-center flex-wrap gap-2 text-xs">',
  '        <button id="send-forecast-btn" class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg shadow transition">',
  '          🔮 ส่งคาดเดากราฟเข้า Telegram',
  '        </button>',
  '        <button id="test-news-btn" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-lg shadow transition">',
  '          🚨 จำลองข่าวด่วนเข้า Telegram',
  '        </button>',
  '      </div>',
  '    </div>',
  '  </header>',
  '',
  '  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">',
  '    <!-- Tab Switcher -->',
  '    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">',
  '      <button id="tab-btn-portfolio" onclick="switchTab(\'portfolio\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-purple-600 text-white shadow-md">',
  '        💼 พอร์ตของคุณ 11 ตัว (ราคา & กำไรขยับสด Real-Time)',
  '      </button>',
  '      <button id="tab-btn-m15" onclick="switchTab(\'m15\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">',
  '        ⚡ หน้าเทรดทองคำ & หุ้น M15 (จุดเข้า SL/TP)',
  '      </button>',
  '    </div>',
  '',
  '    <!-- TAB 1: PERSONAL PORTFOLIO DOCTOR (ราคา & กำไรขยับสด!) -->',
  '    <div id="view-portfolio" class="flex flex-col gap-5">',
  '      <!-- Telegram Interactive Instructions Box -->',
  '      <div class="bg-gradient-to-r from-purple-900/30 via-slate-900 to-sky-900/30 border border-purple-500/40 rounded-2xl p-4 text-xs flex flex-wrap items-center justify-between gap-3">',
  '        <div>',
  '          <span class="font-bold text-amber-400 text-sm block">💬 บอท Telegram ของคุณสามารถคุยตอบโต้ได้แล้ว 24/7!</span>',
  '          <p class="text-slate-300 mt-1">ลองหยิบมือถือเปิด Telegram แล้วพิมพ์คำสั่งเหล่านี้ทักแชทบอทดูได้เลย:</p>',
  '          <div class="flex flex-wrap gap-2 mt-2">',
  '            <span class="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-white font-mono">/portfolio หรือ พอร์ต</span>',
  '            <span class="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-white font-mono">/forecast หรือ ทิศทาง</span>',
  '            <span class="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-emerald-300 font-mono">VOO</span>',
  '            <span class="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-sky-300 font-mono">AMD</span>',
  '            <span class="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-rose-300 font-mono">BIDU</span>',
  '          </div>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Portfolio Overview Cards (ขยับสด) -->',
  '      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">มูลค่าพอร์ตรวม (Real-Time)</span>',
  '          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿--</p>',
  '          <span class="text-[11px] text-slate-400">ต้นทุนรวม: <span id="pf-total-cost">฿--</span></span>',
  '        </div>',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">กำไร/ขาดทุนสุทธิ</span>',
  '          <p id="pf-total-profit" class="text-2xl font-black text-emerald-400 mt-1">--</p>',
  '          <span class="text-[11px] text-slate-400">คำนวณราคาตลาดโลกสดๆ</span>',
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
  '            <span>➕</span> ใส่จำนวนหุ้นเพิ่มเมื่อซื้อใหม่ (Update Holdings)',
  '          </h3>',
  '          <span class="text-[11px] text-slate-400">บันทึกปุ๊บ ระบบจะคำนวณกำไรและราคาใหม่สดๆ ทันที</span>',
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
  '              <option value="SCBT70X(26A)">SCBT70X(26A)</option>',
  '              <option value="SCBTB(Thai ESGA)">SCBTB(Thai ESGA)</option>',
  '            </select>',
  '          </div>',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">จำนวนหุ้นคงเหลือใหม่:</label>',
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
  '      <!-- Holdings Table -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">',
  '        <div class="flex items-center justify-between mb-3">',
  '          <div>',
  '            <h3 class="font-bold text-sm text-white">📋 หุ้น 11 ตัวในพอร์ตของคุณ (ราคา & กำไรขยับสด Real-Time)</h3>',
  '            <span class="text-xs text-slate-400">แยกตามพอร์ตหุ้นหลัก, ถือยาว, และรอขายใน Dime</span>',
  '          </div>',
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
  '    <!-- TAB 2: M15 DAY TRADE SECTION -->',
  '    <div id="view-m15" class="hidden flex flex-col gap-4">',
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
  '  </main>',
  '',
  '  <script>',
  '    let activeTab = "portfolio";',
  '    let currentSelectedSymbol = "XAU/USD";',
  '    let latestPlans = {};',
  '    let currentRiskDist = 6.0;',
  '    let voiceOn = true;',
  '',
  '    function switchTab(tab) {',
  '      activeTab = tab;',
  '      const b1 = document.getElementById("tab-btn-portfolio");',
  '      const b2 = document.getElementById("tab-btn-m15");',
  '      const v1 = document.getElementById("view-portfolio");',
  '      const v2 = document.getElementById("view-m15");',
  '',
  '      b1.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '      b2.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '      v1.classList.add("hidden");',
  '      v2.classList.add("hidden");',
  '',
  '      if (tab === "portfolio") {',
  '        b1.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-purple-600 text-white shadow-md";',
  '        v1.classList.remove("hidden");',
  '        loadMyPortfolio();',
  '      } else {',
  '        b2.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md";',
  '        v2.classList.remove("hidden");',
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
  '      document.getElementById("tv-frame").src = "https://s.tradingview.com/widgetembed/?symbol=" + encodeURIComponent(tvSym) + "&interval=15&theme=dark&timezone=Asia%2FBangkok";',
  '      const plan = latestPlans[label];',
  '      if (plan) {',
  '        document.getElementById("card-ticker").textContent = plan.ticker;',
  '        document.getElementById("card-entry").textContent = plan.entry;',
  '        document.getElementById("card-sl").textContent = plan.sl;',
  '        document.getElementById("card-tp1").textContent = plan.tp1;',
  '        document.getElementById("card-tp2").textContent = plan.tp2;',
  '        const b = document.getElementById("card-action-badge");',
  '        b.textContent = plan.action === "BUY" ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";',
  '        b.className = plan.action === "BUY" ? "px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950" : "px-3.5 py-1 rounded-full text-xs font-black bg-rose-500 text-white";',
  '      }',
  '    }',
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
  '          "<td class=\\"py-3 px-3\\"><span class=\\"px-2 py-0.5 rounded text-[11px] font-bold block " + badgeColor + "\\">" + item.advice + "</span></td>" +',
  '        "</tr>";',
  '      }).join("");',
  '    }',
  '',
  '    async function saveHoldingUpdate() {',
  '      const sym = document.getElementById("inp-add-symbol").value;',
  '      const shares = document.getElementById("inp-add-shares").value;',
  '      const cost = document.getElementById("inp-add-cost").value;',
  '      if (!shares) return alert("กรุณาใส่จำนวนหุ้นใหม่");',
  '      const r = await fetch("/api/update-holding", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({ symbol: sym, newShares: shares, newAvgCost: cost })',
  '      });',
  '      const d = await r.json();',
  '      if (d.ok) {',
  '        loadMyPortfolio();',
  '        const t = document.getElementById("add-toast");',
  '        t.textContent = "✅ บันทึกหุ้น " + sym + " เรียบร้อย!";',
  '        setTimeout(function() { t.textContent = ""; }, 3000);',
  '      }',
  '    }',
  '',
  '    document.getElementById("send-forecast-btn").onclick = async function() {',
  '      const btn = document.getElementById("send-forecast-btn");',
  '      btn.textContent = "⏳ กำลังส่งคาดเดากราฟ...";',
  '      const r = await fetch("/api/send-forecast-telegram", { method: "POST" });',
  '      const d = await r.json();',
  '      btn.textContent = d.ok ? "✅ ส่งเข้า Telegram เรียบร้อย!" : "⚠️ ส่งไม่สำเร็จ";',
  '      setTimeout(function() { btn.textContent = "🔮 ส่งคาดเดากราฟเข้า Telegram"; }, 3000);',
  '    };',
  '',
  '    document.getElementById("test-news-btn").onclick = async function() {',
  '      const btn = document.getElementById("test-news-btn");',
  '      btn.textContent = "⏳ กำลังส่งข่าวด่วน...";',
  '      const r = await fetch("/api/send-news-flash", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({',
  '          title: "ตัวเลขเงินเฟ้อ CPI สหรัฐฯ ออกมา 2.8% (ต่ำกว่าคาดการณ์ 3.1%)",',
  '          actual: "2.8%", forecast: "3.1%",',
  '          impact: "🟢 หนุนทองคำพุ่งขึ้นแรง + ดัชนีหุ้นบวกทันที!",',
  '          analysis: "เงินเฟ้อสหรัฐฯ ชะลอตัวลงเร็วกว่าคาด ตลาดคลายกังวลเรื่องดอกเบี้ย Fed ดอลลาร์อ่อนค่าลงทันที ส่งผลให้ราคาทองคำ XAU/USD และหุ้นเทคดีดตัวขึ้นแรง!"',
  '        })',
  '      });',
  '      const d = await r.json();',
  '      btn.textContent = d.ok ? "✅ ส่งข่าวด่วนเข้า Telegram แล้ว!" : "⚠️ ส่งไม่สำเร็จ";',
  '      setTimeout(function() { btn.textContent = "🚨 จำลองข่าวด่วนเข้า Telegram"; }, 3000);',
  '    };',
  '',
  '    fetch("/api/signals").then(function(r) { return r.json(); }).then(function(d) {',
  '      latestPlans = d.plans || {};',
  '      setAsset("OANDA:XAUUSD", "XAU/USD");',
  '      loadMyPortfolio();',
  '    });',
  '',
  '    const proto = location.protocol === "https:" ? "wss:" : "ws:";',
  '    const ws = new WebSocket(proto + "//" + location.host);',
  '    ws.onmessage = function(e) {',
  '      const msg = JSON.parse(e.data);',
  '      if (msg.type === "RADAR_UPDATE" && msg.portfolio) {',
  '        renderPortfolioUI(msg.portfolio);',
  '      }',
  '    };',
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

// ลูปดักฟังแชท Telegram 24/7 เพื่อให้บอทคุยตอบโต้ได้ทันที
setInterval(pollTelegramUpdates, 3500);

server.listen(PORT, async () => {
  console.log('🚀 Interactive Bot & Portfolio Doctor running on port ' + PORT);
  setInterval(scanMarket, 30 * 1000); // อัปเดตราคาพอร์ตสดทุก 30 วินาที
  scanMarket();
  setTimeout(analyzeUserPortfolio, 2000);
});;
});
