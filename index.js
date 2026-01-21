require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const TelegramBot = require("node-telegram-bot-api");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// раздаём public
app.use(express.static(path.join(__dirname, "public")));

// ---- ПАМЯТЬ ИГРОКОВ ----
const players = {}; // socketId -> { x, y, angle }

io.on("connection", (socket) => {
  console.log("CONNECT:", socket.id);

  // создаём игрока
  const spawnA = { x: 208, y: 368, dir: 0 }; // рядом со стартом твоего игрока
  const spawnB = { x: 110, y: 200, dir: 0 }; // чуть левее
  
  const ids = Object.keys(players);
  const baseSpawn = (ids.length === 0) ? { ...spawnA } : { ...spawnB };
 
  players[socket.id] = { ...baseSpawn, spawn: { ...baseSpawn }, lives: 3 };

  console.log("SPAWN FOR", socket.id, players[socket.id]);
  console.log("ALL PLAYERS NOW:", Object.fromEntries(Object.entries(players).map(([id,p]) => [id, {x:p.x,y:p.y,dir:p.dir,lives:p.lives}])) );

  // 1) новому игроку шлём всех игроков (включая его)
  socket.emit("players_init", players);
  socket.emit("me_spawn",
  players[socket.id]);

  // 2) всем остальным сообщаем что новый игрок вошёл
  socket.broadcast.emit("player_joined", {
    id: socket.id,
    data: players[socket.id],
  });

  // 3) получаем обновления позиции
  socket.on("player_update", (data) => {
    if (!players[socket.id]) return;
    if (typeof data?.x !== "number" || typeof data?.y !== "number") return;

    players[socket.id].x = data.x;
    players[socket.id].y = data.y;
    players[socket.id].dir = data.dir ?? 0;

    // index.html будет вызывать это при выстреле


    // рассылаем всем кроме отправителя
    socket.broadcast.emit("player_update", {
      id: socket.id,
      data: players[socket.id],
    });
  });

  // === ВЫСТРЕЛ ИГРОКА ===
socket.on("player_shot", (bullet) => {
  if (!players[socket.id]) return;
  if (!bullet) return;

  socket.broadcast.emit("player_shot", {
    id: socket.id,
    bullet,
  });
});

// === РАЗРУШЕНИЕ КИРПИЧА ===
socket.on("brick_hit", (payload) => {
  if (!payload) return;
  socket.broadcast.emit("brick_hit", payload);
});

// === ПОПАДАНИЕ В ИГРОКА ===
socket.on("player_hit", ({ targetId }) => {
  if (!players[socket.id]) return;
  if (!players[targetId]) return;

  players[targetId].lives = Math.max(
    0,
    (players[targetId].lives ?? 3) - 1
  );

  io.emit("player_lives", {
    id: targetId,
    lives: players[targetId].lives,
  });
});

  // 4) выход
  socket.on("disconnect", () => {
    console.log("DISCONNECT:", socket.id);
    delete players[socket.id];
    socket.broadcast.emit("player_left", socket.id);
    });
  });

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});

// ---------------- TELEGRAM BOT (POLLING) ----------------
const TG_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TG_TOKEN) {
  console.log("❌ TELEGRAM_TOKEN не найден в .env");
} else {
  const bot = new TelegramBot(TG_TOKEN, { polling: true });

  bot.on("polling_error", (err) => {
    console.log("❌ polling_error:", err?.message || err);
  });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const link = `http://localhost:${PORT}`;

    await bot.sendMessage(
      chatId,
      "Привет! Я бот игры Dendy Tanks.\n\n" +
      "Нажми /play чтобы получить ссылку на игру."
    );
  });

 bot.onText(/\/play/, (msg) => {
  const chatId = msg.chat.id;

  const url = "http://localhost:3000";

  const text =
    `Вот ссылка на игру:\n` +
    `<a href="${url}">${url}</a>\n\n` +
    `Открой её в браузере.\n` +
    `Чтобы увидеть 2 игроков — открой ссылку в двух вкладках/устройствах.`;

  bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
});


  console.log("✅ Telegram bot started (polling)");
}
