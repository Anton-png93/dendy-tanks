const socket = io();

socket.on("connect", () => {
  myId = socket.id;
  console.log("MY SOCKET ID:", myId);
});

const otherPlayers = new Map();
let myId = null;

// храним жизни игроков (для отрисовки/логики)
if (!window.__NET) window.__NET = { others: new Map() };
window.__NET.lives = new Map();


function getMyTank() {
  return window.__MY_PLAYER;
}

function setOtherTankState(id, data) {
  if (!window.__NET) window.__NET = { others: new Map() };
  window.__NET.others.set(id, {
    x: data.x,
    y: data.y,
    dir: data.dir ?? 0,
    size: 26,
  });
}

socket.on("players_init", (players) => {

  if (!myId) myId = socket.id;

  // сервер дал мой spawn -> просто сохраняем, применит index.html (один раз)
  const me = players[myId];
  if (me) {
    window.__NET_ME_SPAWN = me;
  }

  // остальные игроки
  for (const id in players) {
    if (id === myId) continue;
    otherPlayers.set(id, players[id]);
    setOtherTankState(id, players[id]);
  }

  console.log("INIT players:", players);
});

socket.on("me_spawn", (me) => {
  if (!me) return;

  console.log("ME SPAWN FROM SERVER:", me);

  // сохраняем, если index.html захочет применить позже
  window.__NET_ME_SPAWN = me;

  // применяем сразу, если игрок уже создан
  if (window.__PLAYER_START) {
    window.__PLAYER_START.x = me.x;
    window.__PLAYER_START.y = me.y;
  }

  if (window.__MY_PLAYER) {
    window.__MY_PLAYER.x = me.x;
    window.__MY_PLAYER.y = me.y;
    window.__MY_PLAYER.dir = me.dir ?? 0;
  }
});

socket.on("player_joined", (payload) => {
  if (!payload?.id) return;
  if (payload.id === myId) return;

  const data = payload.data || { x: 0, y: 0, dir: 0 };
  otherPlayers.set(payload.id, data);
  setOtherTankState(payload.id, data);

  console.log("JOIN:", payload.id);
});

socket.on("player_update", (payload) => {
  if (!payload?.id) return;
  if (payload.id === myId) return;

  otherPlayers.set(payload.id, payload.data);
  setOtherTankState(payload.id, payload.data);
});

socket.on("player_left", (id) => {
  otherPlayers.delete(id);
  if (window.__NET) window.__NET.others.delete(id);
  console.log("LEFT:", id);
});

// index.html будет вызывать это при выстреле
window.__NET_SHOOT = (bullet) => {
  socket.emit("player_shot", bullet);
};

// index.html будет вызывать это при разрушении кирпича
window.__NET_BRICK_HIT = (payload) => {
  socket.emit("brick_hit", payload);
};

// index.html будет вызывать это когда В ТЕБЯ попали
window.__NET_I_GOT_HIT = (byId) => {
  socket.emit("i_got_hit", { by: byId });
};

// отправка своего танка на сервер
setInterval(() => {
  const t = getMyTank();
  if (!t) return;

  const data = { x: t.x, y: t.y, dir: t.dir };
  socket.emit("player_update", data);
}, 50);
// ====== receive shot from other player ======
socket.on("player_shot", (payload) => {
  if (!payload?.id) return;
  if (payload.id === myId) return;

  const b = payload.bullet;
  if (!b) return;

  // создаём пулю "другого игрока" локально
  window.__NET.enemyShots.push({
    x: b.x, y: b.y,
    dx: b.dx, dy: b.dy,
    size: 6,
    ownerId: payload.id
  });
});
// получаем разрушение кирпича от другого игрока
socket.on("brick_hit", (payload) => {
  if (!payload) return;
  // index.html должен иметь функцию applyBrickHitNet
  if (window.applyBrickHitNet) window.applyBrickHitNet(payload);
});

// получаем обновление жизней (кому-то попали)
socket.on("player_lives", (payload) => {
  if (!payload?.id) return;
  window.__NET.lives.set(payload.id, payload.lives);

  // если это Я — обновим локальные жизни (index.html должен держать playerLives)
  if (payload.id === myId && typeof window.setMyLives === "function") {
    window.setMyLives(payload.lives);
  }
});