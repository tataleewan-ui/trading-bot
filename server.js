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

// 5 สินทรัพย์หลักสำหรับเทรดสั้น M15
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

// 35 หุ้นผู้นำตลาดสหรัฐฯ
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
let sentCandlesCache = {};
let lastAlertTimestampPerTicker = {};
let marketRadar = {};
let latestPlanBySymbol = {};
let broadMarketCache = [];
let lastScanTime = null;
let lastBroadScanTime = null;
let telegramEnabled = true;

// ==========================================
// 1. ระบบตรวจเวลาตลาดเปิด-ปิดจริง 100% (Market Hours Blocker)
// ==========================================
function isMarketOpen(symbol) {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = อาทิตย์, 1 = จันทร์, ..., 6 = เสาร์
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  // 1) ตลาดทองคำ (Forex/Gold)
  // เปิด จันทร์ 05:00 น. ถึง เสาร์ 04:00 น. เวลาไทย (เสาร์-อาทิตย์ปิด 100%)
  if (symbol === 'XAU/USD') {
    if (day === 6) return false;
    if (day === 0 && utcMins < 22 * 60) return false;
    if (day === 5 && utcMins >= 21 * 60) return false;
    if (utcMins >= 21 * 60 && utcMins < 22 * 60) return false;
    return true;
  }

  if (symbol === 'BTC/USD') return true;

  // 2) ตลาดหุ้นสหรัฐฯ (NYSE & NASDAQ: QQQ, NVDA, AAPL, SPY, etc.)
  // เวลาเทรดจริง: จันทร์-ศุกร์ 20:30 - 03:00 น. หรือ 21:30 - 04:00 น. ตามเวลาไทย
  // วันเสาร์-อาทิตย์ และเวลากลางวันของไทย (เช่น บ่ายสี่โมง) = ตลาดหุ้นสหรัฐฯ ปิด 100%!
  if (day === 0 || day === 6) return false;
  if (utcMins < 13 * 60 + 30 || utcMins >= 21 * 60) {
    return false; // นอกเวลาทำการ ปิด 100%!
  }
  return true;
}

function getMarketStatusInfo(symbol) {
  const open = isMarketOpen(symbol);
  if (open) {
    return {
      isOpen: true,
      badgeText: '🟢 กำลังซื้อขายสด (Market Open)',
      note: 'ตลาดเปิดทำการอยู่ ณ ขณะนี้'
    };
  }
  if (symbol === 'XAU/USD') {
    return {
      isOpen: false,
      badgeText: '⏸️ ตลาดทองคำปิดพัก',
      note: 'ตลาด Forex/Gold ปิดทำการช่วงสุดสัปดาห์'
    };
  }
  return {
    isOpen: false,
    badgeText: '⏸️ ตลาดหุ้นสหรัฐฯ ปิด (เปิด 20:30 น.)',
    note: 'ตลาดหุ้นสหรัฐฯ ปิดทำการ (ราคาที่เห็นคือราคาปิดตลาดล่าสุดเมื่อคืน)'
  };
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
    tr.push(Math.max(h - l, Math.abs(h -
