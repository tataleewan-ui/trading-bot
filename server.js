ช่วยอัปเดตไฟล์ `server.js` ให้เป็นเวอร์ชัน Ultimate All-in-One M15 Pro Trading System โดยใช้โค้ดด้านล่างนี้ทั้งหมด แล้ว Commit & Push ขึ้น GitHub ทันที:

```javascript
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
const APP_URL = process.env.RENDER_EXTERNAL_URL || '[https://trading-bot-lnf1.onrender.com](https://trading-bot-lnf1.onrender.com)';
const API_KEY = process.env.TWELVE_DATA_API_KEY || '480e1387e8fe4675b44e831a47a9721a';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9089609371:AAFyPRrun1KIafdD3J1ii2WmymjxJrTFR-E';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

app.use(cors());
app.use(express.json());

let signalHistory = [];
let lastAlertCandleTime = {}; // ป้องกันการส่งสัญญาณซ้ำในแท่งเทียนเดิม
let latestPrices = {};

// 1. ฟังก์ชันคำนวณ Indicator (EMA, ATR, RSI)
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateATR(candles, period = 14) {
  let tr = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const recent = tr.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / period;
}

function calculateRSI(prices, period = 14) {
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

// 2. ส่งข้อความเข้า Telegram Bot
async function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`[https://api.telegram.org/bot$](https://api.telegram.org/bot$){BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Telegram Error:', err.message);
  }
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// 3. ตรวจสอบว่าออเดอร์ที่เปิดอยู่ชน TP หรือ SL หรือยัง
async function checkActiveSignalsStatus(symbol, currentPrice) {
  for (let sig of signalHistory) {
    if (sig.ticker === symbol && (sig.status === 'OPEN' || sig.status === 'HIT_TP1')) {
      const isBuy = sig.action === 'BUY';

      // เช็กชน TP2
      if ((isBuy && currentPrice >= sig.tp2) || (!isBuy && currentPrice <= sig.tp2)) {
        sig.status = 'HIT_TP2';
        broadcast({ type: 'UPDATE_SIGNAL', data: sig });
        await sendTelegramMessage(`🚀 <b>ชนะเต็มเป้า TP2! (${sig.ticker})</b>\nออเดอร์ ${sig.action} วิ่งชนเป้า TP2 ที่ราคา <code>${currentPrice}</code> เรียบร้อยแล้ว (+2.5R) 🎉`);
      }
      // เช็กชน TP1
      else if (sig.status === 'OPEN' && ((isBuy && currentPrice >= sig.tp1) || (!isBuy && currentPrice <= sig.tp1))) {
        sig.status = 'HIT_TP1';
        broadcast({ type: 'UPDATE_SIGNAL', data: sig });
        await sendTelegramMessage(`🎯 <b>ชนเป้า TP1 แล้ว! (${sig.ticker})</b>\nออเดอร์ ${sig.action} แตะราคา <code>${currentPrice}</code> (+1.5R)\n💡 <i>แนะนำ: แบ่งปิดกำไร 50% และเลื่อน SL มาที่ราคาเข้า (${sig.entry}) เพื่อกันทุนทันที!</i>`);
      }
      // เช็กชน SL
      else if ((isBuy && currentPrice <= sig.sl) || (!isBuy && currentPrice >= sig.sl)) {
        sig.status = sig.status === 'HIT_TP1' ? 'CLOSED_BE' : 'HIT_SL';
        broadcast({ type: 'UPDATE_SIGNAL', data: sig });
        await sendTelegramMessage(`🛑 <b>อัปเดตสถานะ (${sig.ticker}):</b> ราคาแตะจุด SL ที่ <code>${currentPrice}</code> ปิดออเดอร์ตามแผนควบคุมความเสี่ยง`);
      }
    }
  }
}

// 4. วิเคราะห์จุดเข้า BUY และ SELL แท่ง 15 นาที
function analyzeMarket(candles, ticker) {
  if (candles.length < 60) return null;
  const closes = candles.map(c => c.close);
  const ema50 = calculateEMA(closes, 50);
  const ema21 = calculateEMA(closes, 21);
  const atr = calculateATR(candles, 14);
  const rsi = calculateRSI(closes, 14);

  const last = candles.length - 1;
  const curCandle = candles[last];
  const prevCandle = candles[last - 1];

  // ป้องกันการแจ้งเตือนซ้ำในแท่งเทียนเวลาเดียวกัน
  if (lastAlertCandleTime[ticker] === curCandle.datetime) return null;

  const curClose = closes[last], prevClose = closes[last - 1];
  const curEMA50 = ema50[last], curEMA21 = ema21[last], prevEMA21 = ema21[last - 1];

  // เงื่อนไข BUY & SELL
  const isBuy = curClose > curEMA50 && (prevClose <= prevEMA21 || prevCandle.low <= prevEMA21) && curClose > curEMA21 && rsi >= 45 && rsi <= 68;
  const isSell = curClose < curEMA50 && (prevClose >= prevEMA21 || prevCandle.high >= prevEMA21) && curClose < curEMA21 && rsi <= 55 && rsi >= 32;

  const slDist = Math.max(atr * 1.5, curClose * 0.0015);

  if (isBuy || isSell) {
    lastAlertCandleTime[ticker] = curCandle.datetime;
    const action = isBuy ? 'BUY' : 'SELL';
    return {
      id: "sig_" + Date.now(),
      ticker,
      action,
      timeframe: '15m',
      entry: Number(curClose.toFixed(2)),
      sl: Number((isBuy ? curClose - slDist : curClose + slDist).toFixed(2)),
      tp1: Number((isBuy ? curClose + slDist * 1.5 : curClose - slDist * 1.5).toFixed(2)),
      tp2: Number((isBuy ? curClose + slDist * 2.5 : curClose - slDist * 2.5).toFixed(2)),
      risk: Number(slDist.toFixed(2)),
      rsi: Number(rsi.toFixed(1)),
      status: 'OPEN',
      time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
    };
  }
  return null;
}

// 5. ลูปสแกนตลาดอัตโนมัติ
async function scanMarket() {
  if (!API_KEY) return;
  for (const sym of SYMBOLS) {
    try {
      const url = `[https://api.twelvedata.com/time_series?symbol=$](https://api.twelvedata.com/time_series?symbol=$){encodeURIComponent(sym)}&interval=15min&outputsize=100&apikey=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.values && data.values.length > 0) {
        const candles = data.values.reverse().map(v => ({
          datetime: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close)
        }));
        const latestPrice = candles[candles.length - 1].close;
        latestPrices[sym] = latestPrice;

        await checkActiveSignalsStatus(sym, latestPrice);

        const sig = analyzeMarket(candles, sym);
        if (sig) {
          signalHistory.unshift(sig);
          if (signalHistory.length > 50) signalHistory.pop();
          broadcast({ type: 'NEW_SIGNAL', data: sig });

          const isBuy = sig.action === 'BUY';
          const msg = `
${isBuy ? '🟢' : '🔴'} <b>สัญญาณเทรด M15: ${sig.ticker}</b>
──────────────────
📊 <b>คำสั่ง:</b> ${isBuy ? 'BUY (เปิดออเดอร์ซื้อ)' : 'SELL (เปิดออเดอร์ขาย)'}
💵 <b>ราคาเข้า (Entry):</b> <code>${sig.entry}</code>
🛑 <b>Stop Loss (SL):</b> <code>${sig.sl}</code> (ระยะ ~$${sig.risk})
🎯 <b>เป้า 1 (TP1):</b> <code>${sig.tp1}</code> (RR 1:1.5 - ปิด 50%)
🎯 <b>เป้า 2 (TP2):</b> <code>${sig.tp2}</code> (RR 1:2.5 - รันเทรนด์)
📈 <b>RSI (14):</b> ${sig.rsi} | ⏰ <b>เวลา:</b> ${sig.time} น.
──────────────────
💡 <i>ตั้ง SL ทันทีหลังเข้า เมื่อชน TP1 ระบบจะแจ้งเตือนให้เลื่อน SL บังทุน</i>`.trim();
          await sendTelegramMessage(msg);
        }
      }
    } catch (e) {
      console.error('Scan error:', sym, e.message);
    }
  }
}

// API สำหรับกดทดสอบส่งเข้า Telegram จากหน้าเว็บ
app.post('/api/test-telegram', async (req, res) => {
  await sendTelegramMessage(`✅ <b>ทดสอบการเชื่อมต่อสำเร็จ!</b>\nระบบ M15 Pro Trading Assistant ออนไลน์ 24/7 พร้อมส่งสัญญาณเข้ามือถือคุณแล้วครับ`);
  res.json({ ok: true });
});

app.get('/api/signals', (req, res) => res.json({ signals: signalHistory, prices: latestPrices }));
app.get('/api/ping', (req, res) => res.send('pong'));

// 6. หน้าเว็บ Ultimate Pro Dashboard
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M15 Ultimate Pro Trading Terminal</title>
  <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
  <style>
    @import url('[https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap)');
    body { font-family: 'Inter', sans-serif; background-color: #070a12; color: #f1f5f9; }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 py-3">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">⚡</div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-bold text-base text-white">M15 Ultimate Pro Terminal</h1>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">🟢 24/7 AUTO SCAN</span>
          </div>
          <p class="text-xs text-slate-400" id="session-text">กำลังตรวจสอบโซนเวลาตลาดโลก...</p>
        </div>
      </div>
      <div class="flex items-center flex-wrap gap-2 text-xs">
        <div class="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
          🕒 แท่ง 15m ปิดใน: <span id="timer" class="font-mono font-bold text-amber-400">--:--</span>
        </div>
        <button id="sound-btn" class="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700">🔊 เสียง: เปิด</button>
        <button id="test-tg-btn" class="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition">✈️ ทดสอบยิงเข้า Telegram</button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">
    <!-- Asset Bar & WinRate -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div class="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs text-slate-400 mr-1">เลือกกราฟ:</span>
          <button onclick="setAsset('OANDA:XAUUSD','XAU/USD')" class="asset-btn px-3 py-1.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950">🥇 XAU/USD (ทองคำ)</button>
          <button onclick="setAsset('NASDAQ:QQQ','QQQ')" class="asset-btn px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700">📊 NASDAQ (QQQ)</button>
          <button onclick="setAsset('NASDAQ:NVDA','NVDA')" class="asset-btn px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700">⚡ NVDA</button>
          <button onclick="setAsset('NASDAQ:AAPL','AAPL')" class="asset-btn px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700">🍏 AAPL</button>
          <button onclick="setAsset('AMEX:SPY','SPY')" class="asset-btn px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700">🇺🇸 SPY</button>
        </div>
        <span class="text-[11px] text-slate-400">สแกนอัตโนมัติทุก 1 นาที (EMA50 + EMA21 + RSI + ATR)</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 px-5 flex items-center justify-between">
        <div>
          <p class="text-xs text-slate-400">อัตราความแม่นยำ (Win Rate)</p>
          <p id="winrate-val" class="text-2xl font-black text-emerald-400">100%</p>
        </div>
        <div class="text-2xl">🏆</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div class="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[500px] shadow-lg">
        <iframe id="tv-frame" src="[https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok](https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok)" class="w-full h-full border-0"></iframe>
      </div>

      <div class="lg:col-span-4 flex flex-col gap-4">
        <!-- Active Signal Card -->
        <div class="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span class="text-[11px] font-semibold text-slate-400 uppercase">สถานะสัญญาณล่าสุด</span>
              <h3 id="sig-ticker" class="text-lg font-bold text-white mt-0.5">⏳ รอจังหวะเข้าเงื่อนไข...</h3>
            </div>
            <span id="sig-badge" class="px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300">WAITING</span>
          </div>
          <div class="grid grid-cols-2 gap-2.5 my-3.5 text-xs">
            <div class="bg-slate-800/70 p-3 rounded-xl"><span class="text-slate-400">💵 จุดเข้า (Entry):</span><p id="sig-entry" class="text-lg font-extrabold text-white font-mono mt-0.5">--</p></div>
            <div class="bg-rose-950/30 p-3 rounded-xl border border-rose-800/40"><span class="text-rose-300">🛑 Stop Loss:</span><p id="sig-sl" class="text-lg font-extrabold text-rose-400 font-mono mt-0.5">--</p></div>
            <div class="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/40"><span class="text-emerald-300">🎯 TP1 (ปิด 50%):</span><p id="sig-tp1" class="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">--</p></div>
            <div class="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/40"><span class="text-teal-300">🚀 TP2 (เป้าหลัก):</span><p id="sig-tp2" class="text-lg font-extrabold text-teal-300 font-mono mt-0.5">--</p></div>
          </div>
          <p id="sig-guide" class="text-xs text-slate-300 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
            💡 ระบบกำลังเฝ้ากราฟแท่ง 15 นาที เมื่อเข้าสูตรจะเด้งแจ้งเตือนพร้อมคำนวณ SL/TP ทันทีโดยไม่สุ่มมั่ว
          </p>
        </div>

        <!-- Smart Lot Calculator -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs">
          <h4 class="font-bold text-amber-400 mb-2.5">🧮 คำนวณขนาด Lot ปลอดภัยอัตโนมัติ</h4>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label class="text-slate-400">ทุนในพอร์ต ($):</label>
              <input type="number" id="inp-bal" value="1000" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-white mt-1">
            </div>
            <div>
              <label class="text-slate-400">ยอมเสี่ยง (% ต่อไม้):</label>
              <select id="inp-risk" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-white mt-1">
                <option value="1">1% (ปลอดภัยมาก)</option>
                <option value="2">2% (มาตรฐาน)</option>
              </select>
            </div>
          </div>
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between mt-2">
            <div>
              <span class="text-slate-400 block">ออกออเดอร์ขนาด:</span>
              <span id="risk-usd" class="text-[11px] text-rose-400">เสี่ยงสูงสุดไม่เกิน $10.00</span>
            </div>
            <span id="out-lot" class="text-xl font-black text-emerald-400 font-mono">0.02 Lot</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Signal History Table -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h3 class="font-bold text-sm text-white mb-3">📋 ประวัติสัญญาณที่ตรวจพบจริง (Live Signal Log)</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs font-mono">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400">
              <th class="py-2 px-3">เวลา</th><th class="py-2 px-3">สินทรัพย์</th><th class="py-2 px-3">คำสั่ง</th>
              <th class="py-2 px-3">ราคาเข้า</th><th class="py-2 px-3">SL</th><th class="py-2 px-3">TP1 / TP2</th><th class="py-2 px-3">สถานะ</th>
            </tr>
          </thead>
          <tbody id="history-tbody" class="divide-y divide-slate-800/60">
            <tr><td colspan="7" class="py-4 text-center text-slate-500">ยังไม่มีสัญญาณใหม่ตั้งแต่เริ่มเปิดเครื่อง รอระบบสแกนแท่ง 15 นาที...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    let soundOn = true;
    let currentRiskDist = 6.0;

    function playChime(isBuy) {
      if (!soundOn) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(isBuy ? 523.25 : 440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isBuy ? 1046.5 : 330, ctx.currentTime + 0.35);
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      } catch(e){}
    }

    document.getElementById('sound-btn').onclick = () => {
      soundOn = !soundOn;
      document.getElementById('sound-btn').textContent = soundOn ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
    };

    document.getElementById('test-tg-btn').onclick = async () => {
      const btn = document.getElementById('test-tg-btn');
      btn.textContent = '⏳ กำลังส่ง...';
      await fetch('/api/test-telegram', { method: 'POST' });
      btn.textContent = '✅ ส่งเข้า Telegram แล้ว!';
      setTimeout(() => btn.textContent = '✈️ ทดสอบยิงเข้า Telegram', 3000);
    };

    function setAsset(tvSym, label) {
      document.getElementById('tv-frame').src = '[https://s.tradingview.com/widgetembed/?symbol=](https://s.tradingview.com/widgetembed/?symbol=)' + encodeURIComponent(tvSym) + '&interval=15&theme=dark&timezone=Asia%2FBangkok';
    }

    function calcLot() {
      const bal = parseFloat(document.getElementById('inp-bal').value) || 0;
      const riskPct = parseFloat(document.getElementById('inp-risk').value) || 1;
      const riskUsd = bal * (riskPct / 100);
      document.getElementById('risk-usd').textContent = 'เสี่ยงสูงสุดไม่เกิน $' + riskUsd.toFixed(2);
      const lot = Math.max(0.01, riskUsd / (currentRiskDist * 100)).toFixed(2);
      document.getElementById('out-lot').textContent = lot + ' Lot';
    }
    document.getElementById('inp-bal').oninput = calcLot;
    document.getElementById('inp-risk').onchange = calcLot;
    calcLot();

    function updateSession() {
      const hr = new Date().getUTCHours();
      let s = '🌏 ตลาดเอเชีย (Asian Session) - ราคาแกว่งตัวในกรอบ';
      if (hr >= 7 && hr < 13) s = '🇬🇧 ตลาดลอนดอน (London Session) - ทองคำเริ่มวิ่งแรง';
      else if (hr >= 13 && hr < 21) s = '🇺🇸 ตลาดนิวยอร์ก (US Session) - ทองคำและหุ้นสหรัฐฯ วิ่งแรงที่สุด!';
      document.getElementById('session-text').textContent = s;
    }
    updateSession();

    setInterval(() => {
      const now = new Date();
      const m = 14 - (now.getMinutes() % 15), s = 59 - now.getSeconds();
      document.getElementById('timer').textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }, 1000);

    function renderSignals(list) {
      if (!list || list.length === 0) return;
      const latest = list[0];
      const isBuy = latest.action === 'BUY';
      currentRiskDist = latest.risk || 6.0;
      calcLot();

      document.getElementById('sig-ticker').textContent = latest.ticker + ' (15m)';
      const badge = document.getElementById('sig-badge');
      badge.textContent = isBuy ? '🟢 BUY (ซื้อ)' : '🔴 SELL (ขาย)';
      badge.className = 'px-3 py-1 rounded-full text-xs font-black ' + (isBuy ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white');
      document.getElementById('sig-entry').textContent = latest.entry;
      document.getElementById('sig-sl').textContent = latest.sl;
      document.getElementById('sig-tp1').textContent = latest.tp1;
      document.getElementById('sig-tp2').textContent = latest.tp2;

      const tbody = document.getElementById('history-tbody');
      tbody.innerHTML = list.map(item => \`
        <tr class="hover:bg-slate-800/40">
          <td class="py-2.5 px-3 text-slate-400">\${item.time}</td>
          <td class="py-2.5 px-3 font-bold text-white">\${item.ticker}</td>
          <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded font-bold \${item.action==='BUY'?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}">\${item.action}</span></td>
          <td class="py-2.5 px-3">\${item.entry}</td>
          <td class="py-2.5 px-3 text-rose-400">\${item.sl}</td>
          <td class="py-2.5 px-3 text-emerald-400">\${item.tp1} / \${item.tp2}</td>
          <td class="py-2.5 px-3 font-bold">\${item.status}</td>
        </tr>
      \`).join('');
    }

    fetch('/api/signals').then(r => r.json()).then(d => renderSignals(d.signals));

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(proto + '//' + location.host);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'NEW_SIGNAL' || msg.type === 'UPDATE_SIGNAL') {
        fetch('/api/signals').then(r => r.json()).then(d => renderSignals(d.signals));
        if (msg.type === 'NEW_SIGNAL') playChime(msg.data.action === 'BUY');
      }
    };
  </script>
</body>
</html>
  `);
});

// 7. ระบบ Anti-Sleep กระตุ้นเซิร์ฟเวอร์ตัวเองทุก 10 นาที ไม่ให้ Render หลับ
setInterval(() => {
  fetch(`${APP_URL}/api/ping`).catch(() => {});
}, 10 * 60 * 1000);

server.listen(PORT, () => {
  console.log('🚀 Ultimate M15 Pro Terminal running on port ' + PORT);
  setInterval(scanMarket, 60 * 1000);
  scanMarket();
});
