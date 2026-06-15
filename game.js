/*
 * Vem šišku, zachrániš sekačku
 * Pokojná záhradná simulácia – pozbieraj šišky spod ihličnatého stromu,
 * aby robotická sekačka mohla pokosiť trávnik.
 *
 * Čistá HTML5 canvas implementácia, bez závislostí.
 */
(() => {
  "use strict";

  // ---------- Canvas & DPR ----------
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  // ---------- DOM ----------
  const $count = document.getElementById("count");
  const $day = document.getElementById("day");
  const $remaining = document.getElementById("remaining");
  const $basket = document.getElementById("basket");
  const $toast = document.getElementById("toast");
  const $intro = document.getElementById("intro");
  const $start = document.getElementById("start");
  const $sound = document.getElementById("sound");
  const $health = document.getElementById("health");
  const $pips = Array.from($health.querySelectorAll(".pip"));
  const $over = document.getElementById("over");
  const $overText = document.getElementById("over-text");
  const $overDay = document.getElementById("over-day");
  const $overTotal = document.getElementById("over-total");
  const $retry = document.getElementById("retry");
  const $levels = document.getElementById("levels");
  const $levelBtns = $levels ? Array.from($levels.querySelectorAll(".level")) : [];

  // ---------- Difficulty ----------
  // speed = násobič rýchlosti lovenia sekačky, grace = ranná pauza navyše (s)
  const DIFFICULTIES = {
    beginner: { id: "beginner", label: "Začiatočník", speed: 0.6, grace: 1.2 },
    advanced: { id: "advanced", label: "Pokročilý", speed: 1.0, grace: 0 },
    expert: { id: "expert", label: "Expert (Vladimír)", speed: 1.55, grace: -0.6 },
  };
  const DEFAULT_DIFFICULTY = "advanced";

  // ---------- Helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Layout ----------
  const layout = {
    horizon: 0,
    lawn: { x: 0, y: 0, w: 0, h: 0 },
    tree: { x: 0, y: 0, h: 0 },
    tree2: { x: 0, y: 0, h: 0 },
    basket: { x: 60, y: 48 },
    home: { x: 0, y: 0 },
  };

  function computeLayout() {
    const portrait = H >= W;
    layout.horizon = H * (portrait ? 0.34 : 0.4);
    layout.lawn = { x: 0, y: layout.horizon, w: W, h: H - layout.horizon };

    const treeH = clamp(Math.min(W, H) * (portrait ? 0.62 : 0.72), 240, 620);
    layout.tree = { x: W * (portrait ? 0.68 : 0.8), y: layout.horizon + treeH * 0.06, h: treeH };
    layout.tree2 = { x: W * (portrait ? 0.14 : 0.12), y: layout.horizon + treeH * 0.04, h: treeH * 0.66 };

    layout.home = { x: W * 0.12, y: H - layout.lawn.h * 0.18 };

    const r = $basket.getBoundingClientRect();
    layout.basket = { x: r.left + r.width * 0.32, y: r.top + r.height * 0.5 };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout();
    buildSprites();
  }

  // ---------- Cone sprite (pre-rendered) ----------
  let coneSprite = null;
  let bgCanvas = null;
  const CONE_W = 120, CONE_H = 152;

  function buildSprites() {
    coneSprite = makeConeSprite();
    initDecor();
    bgCanvas = buildBackground();
  }

  function makeConeSprite() {
    const c = document.createElement("canvas");
    c.width = CONE_W * dpr;
    c.height = CONE_H * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);

    const cx = CONE_W / 2;
    const top = 16, bot = CONE_H - 14;
    const span = bot - top;
    const maxHalf = 44;
    const profile = (t) => Math.pow(Math.sin((Math.min(t, 0.94) / 0.94) * Math.PI), 0.6);

    const rows = 10;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const y = top + t * span;
      const half = maxHalf * profile(t);
      const sw = 17;
      const step = sw * 0.6;
      const n = Math.max(0, Math.round(half / step));
      // darker near top, warmer/lighter toward bottom
      const dark = mix("#4a2f18", "#7a4d27", t);
      const light = mix("#8a5a30", "#b9824a", t);
      for (let k = -n; k <= n; k++) {
        const off = (i % 2) * 0.5;
        const px = cx + (k + off) * step;
        if (Math.abs(px - cx) > half + 3) continue;
        drawPetal(g, px, y, sw, 19, dark, light);
      }
    }
    return c;
  }

  function drawPetal(g, x, y, w, h, dark, light) {
    g.save();
    g.translate(x, y);
    const grd = g.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
    grd.addColorStop(0, dark);
    grd.addColorStop(1, light);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-w / 2, -h * 0.32);
    g.quadraticCurveTo(-w / 2, h * 0.18, 0, h * 0.5);
    g.quadraticCurveTo(w / 2, h * 0.18, w / 2, -h * 0.32);
    g.quadraticCurveTo(0, -h * 0.62, -w / 2, -h * 0.32);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255,238,200,0.5)";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(-w * 0.3, h * 0.16);
    g.quadraticCurveTo(0, h * 0.48, w * 0.3, h * 0.16);
    g.stroke();
    g.restore();
  }

  function mix(a, b, t) {
    const ca = hexRgb(a), cb = hexRgb(b);
    const r = Math.round(lerp(ca[0], cb[0], t));
    const gg = Math.round(lerp(ca[1], cb[1], t));
    const bl = Math.round(lerp(ca[2], cb[2], t));
    return `rgb(${r},${gg},${bl})`;
  }
  function hexRgb(h) {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  // ---------- State ----------
  const MAX_DAMAGE = 3;

  const state = {
    phase: "intro", // intro | collecting | mowing | done | gameover
    day: 1,
    collectedTotal: 0,
    damage: 0, // koľko šišiek sekačka rozdrvila (3 = koniec)
    cones: [],
    particles: [],
    clouds: [],
    motes: [],
    tufts: [],
    birds: [],
    mower: { x: 0, y: 0, vx: 0, vy: 0, face: 1, dir: 1, wheel: 0, blink: 0, bob: 0, shake: 0, cooldown: 0 },
    mowed: 0,
    wind: 0,
    windTarget: 0,
    time: 0,
    started: false,
    difficulty: DEFAULT_DIFFICULTY,
  };

  const currentDiff = () => DIFFICULTIES[state.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];

  function selectDifficulty(id) {
    if (!DIFFICULTIES[id]) return;
    state.difficulty = id;
    for (const btn of $levelBtns) {
      const active = btn.dataset.level === id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    }
  }

  function coneScale(ny) {
    return lerp(0.5, 1.12, clamp(ny, 0, 1));
  }

  // ---------- Day setup ----------
  function spawnDay(day) {
    const count = Math.min(8 + day * 3, 30);
    state.cones = [];
    const tx = layout.tree.x, ty = layout.tree.y - layout.tree.h * 0.2;
    for (let i = 0; i < count; i++) {
      // scatter biased around the tree base across the lawn
      const spread = rand(0.06, 0.46);
      const side = Math.random() < 0.5 ? -1 : 1;
      let nx = (layout.tree.x / W) + side * spread + rand(-0.05, 0.05);
      nx = clamp(nx, 0.04, 0.96);
      const ny = rand(0.12, 0.95);
      const px = layout.lawn.x + nx * layout.lawn.w;
      const py = layout.lawn.y + ny * layout.lawn.h;
      const cone = {
        state: "drop",
        nx, ny,
        px: tx + rand(-30, 30),
        py: ty + rand(-20, 20),
        x0: tx + rand(-30, 30),
        y0: ty + rand(-20, 20),
        x1: px, y1: py,
        dropT: -rand(0, 1.6),
        dropDur: rand(0.7, 1.0),
        r: rand(0.85, 1.18),
        rot: rand(-0.5, 0.5),
        rotSpeed: rand(-0.4, 0.4),
        wobAmp: rand(0.04, 0.12),
        wobPhase: rand(0, Math.PI * 2),
        flyT: 0, flyDur: 0, fx0: 0, fy0: 0,
        spin: rand(2, 5) * (Math.random() < 0.5 ? -1 : 1),
      };
      cone.x0 = cone.px;
      cone.y0 = cone.py;
      state.cones.push(cone);
    }
    // sekačka začína deň doma a vyrazí loviť šišky
    state.mower.x = layout.home.x;
    state.mower.y = layout.home.y;
    state.mower.vx = 0;
    state.mower.vy = 0;
    // ranná pauza: sekačka chvíľu postojí (kým šišky dopadnú a hráč začne)
    state.mower.cooldown = Math.max(0.8, 2.6 + currentDiff().grace - (day - 1) * 0.2);
    updateHud();
  }

  function remainingCones() {
    return state.cones.filter((c) => c.state !== "gone").length;
  }

  function updateHud() {
    $count.textContent = state.collectedTotal;
    $day.textContent = "Deň " + state.day;
    const rem = remainingCones();
    $remaining.textContent = rem > 0 ? rem + " spod stromu" : "trávnik je čistý";
    $pips.forEach((pip, i) => pip.classList.toggle("lost", i < state.damage));
  }

  // ---------- Collecting ----------
  function collectCone(cone) {
    if (cone.state === "flying" || cone.state === "gone") return false;
    cone.state = "flying";
    cone.flyT = 0;
    cone.flyDur = rand(0.5, 0.7);
    cone.fx0 = cone.px;
    cone.fy0 = cone.py;
    cone.arc = rand(60, 130) + Math.abs(layout.basket.x - cone.px) * 0.08;
    burst(cone.px, cone.py, cone.r);
    playPop();
    updateHud();
    return true;
  }

  // sekačka prešla cez šišku – rozdrví ju a poškodí sa
  function crushCone(cone) {
    if (cone.state === "flying" || cone.state === "gone" || cone.state === "crush") return;
    cone.state = "crush";
    cone.crushT = 0;
    crushBurst(cone.px, cone.py, cone.r);
    state.damage += 1;
    state.mower.shake = 0.5;
    state.mower.cooldown = 1.0; // chvíľa pauzy – dáva hráčovi šancu zareagovať
    playThunk();
    flashHealth();
    updateHud();
    if (state.damage >= MAX_DAMAGE) {
      gameOver();
    }
  }

  function flashHealth() {
    $health.classList.remove("hit");
    void $health.offsetWidth;
    $health.classList.add("hit");
  }

  function crushBurst(x, y, r) {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 200);
      const needle = Math.random() < 0.45;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: -Math.abs(Math.sin(a)) * sp - rand(20, 70),
        life: 0,
        maxLife: rand(0.4, 0.9),
        size: needle ? rand(7, 13) : rand(3, 6),
        rot: rand(0, Math.PI),
        vr: rand(-10, 10),
        color: needle ? "#4f8f3e" : (Math.random() < 0.5 ? "#5e3a1f" : "#a06a38"),
        shape: needle ? "needle" : "fleck",
        grav: 360,
      });
    }
  }

  function gameOver() {
    state.phase = "gameover";
    $overDay.textContent = state.day;
    $overTotal.textContent = state.collectedTotal;
    $over.classList.add("show");
    playBreak();
  }

  function burst(x, y, r) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 150);
      const needle = Math.random() < 0.4;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(30, 90),
        life: 0,
        maxLife: rand(0.4, 0.8),
        size: needle ? rand(6, 11) : rand(2.5, 5),
        rot: rand(0, Math.PI),
        vr: rand(-8, 8),
        color: needle ? "#4f8f3e" : (Math.random() < 0.5 ? "#7a4d27" : "#b9824a"),
        shape: needle ? "needle" : "fleck",
        grav: 320,
      });
    }
  }

  function confetti() {
    const colors = ["#f2c14e", "#e8743b", "#6cbf63", "#4c9a48", "#fbf6e9", "#c45a3a"];
    for (let i = 0; i < 90; i++) {
      state.particles.push({
        x: rand(0, W),
        y: rand(-40, layout.horizon),
        vx: rand(-40, 40),
        vy: rand(40, 160),
        life: 0,
        maxLife: rand(1.4, 2.6),
        size: rand(5, 11),
        rot: rand(0, Math.PI * 2),
        vr: rand(-10, 10),
        color: colors[(Math.random() * colors.length) | 0],
        shape: "confetti",
        grav: 120,
      });
    }
  }

  // ---------- Mowing ----------
  function startMowing() {
    state.phase = "mowing";
    state.mowed = 0;
    state.mower.x = -80;
    state.mower.y = layout.home.y;
    state.mower.dir = 1;
    showToast("");
  }

  function finishDay() {
    state.phase = "done";
    confetti();
    playJingle();
    showToast(pickToast());
    setTimeout(() => {
      hideToast();
      state.day += 1;
      state.mowed = 0;
      state.phase = "collecting";
      spawnDay(state.day);
    }, 2400);
  }

  function pickToast() {
    const opts = [
      "Pokosené! 🌿",
      "Sekačka jazdí! ✨",
      "Trávnik ako zamat 🌱",
      "Vladimír by bol hrdý 👏",
    ];
    return opts[(Math.random() * opts.length) | 0];
  }

  let toastTimer = null;
  function showToast(text) {
    if (!text) { hideToast(); return; }
    $toast.textContent = text;
    $toast.classList.add("show");
    clearTimeout(toastTimer);
  }
  function hideToast() {
    $toast.classList.remove("show");
  }

  // ---------- Update ----------
  function update(dt) {
    state.time += dt;

    // wind drift
    if (Math.random() < 0.004) state.windTarget = rand(-1, 1);
    state.wind += (state.windTarget - state.wind) * Math.min(1, dt * 1.2);

    updateClouds(dt);
    updateMotes(dt);
    updateBirds(dt);

    // cones
    for (const c of state.cones) {
      if (c.state === "drop") {
        c.dropT += dt;
        if (c.dropT < 0) continue;
        const t = clamp(c.dropT / c.dropDur, 0, 1);
        const e = easeOutCubic(t);
        c.px = lerp(c.x0, c.x1, e);
        // parabola with a small bounce settle
        const fall = c.y1 - c.y0;
        const arc = -Math.sin(Math.min(t, 1) * Math.PI) * 30;
        c.py = lerp(c.y0, c.y1, e) + arc * (1 - t);
        c.rot += c.rotSpeed * dt * (1 - t);
        if (t >= 1) {
          c.state = "idle";
          c.px = c.x1; c.py = c.y1;
        }
      } else if (c.state === "idle") {
        const sc = coneScale(c.ny);
        c.px = layout.lawn.x + c.nx * layout.lawn.w;
        c.py = layout.lawn.y + c.ny * layout.lawn.h;
        c.rot = Math.sin(state.time * 1.3 + c.wobPhase) * c.wobAmp * (0.6 + Math.abs(state.wind));
      } else if (c.state === "flying") {
        c.flyT += dt;
        const t = clamp(c.flyT / c.flyDur, 0, 1);
        const e = easeInOutCubic(t);
        c.px = lerp(c.fx0, layout.basket.x, e);
        c.py = lerp(c.fy0, layout.basket.y, e) - Math.sin(t * Math.PI) * c.arc;
        c.rot += c.spin * dt;
        if (t >= 1) {
          c.state = "gone";
          state.collectedTotal += 1;
          bumpBasket();
          updateHud();
          checkCleared();
        }
      } else if (c.state === "crush") {
        c.crushT += dt;
        if (c.crushT >= 0.32) c.state = "gone";
      }
    }

    // particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { state.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }

    // mower
    updateMower(dt);
  }

  function checkCleared() {
    if (state.phase !== "collecting") return;
    if (remainingCones() === 0) {
      startMowing();
    }
  }

  function mowerSize() {
    return clamp(Math.min(W, H) / 720, 0.66, 1.15);
  }

  function nearestCone(x, y) {
    let best = null, bestD = Infinity;
    for (const c of state.cones) {
      if (c.state !== "idle" && c.state !== "drop") continue;
      const d = (c.px - x) ** 2 + (c.py - y) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function updateMower(dt) {
    const m = state.mower;
    if (m.shake > 0) m.shake = Math.max(0, m.shake - dt);
    m.blink -= dt;
    if (m.blink < 0) m.blink = rand(2, 5);

    if (state.phase === "mowing") {
      const speed = (layout.lawn.w + 160) / 3.4; // px/s -> ~3.4s prejazd
      m.x += speed * dt;
      m.face = 1;
      m.wheel += dt * 14;
      m.y = layout.home.y + Math.sin(state.time * 3) * 8;
      state.mowed = clamp(m.x / (layout.lawn.w * 0.99), 0, 1);
      if (Math.random() < 0.6) {
        state.particles.push({
          x: m.x - 30, y: m.y + 8,
          vx: rand(-90, -30), vy: rand(-60, -10),
          life: 0, maxLife: rand(0.4, 0.8),
          size: rand(5, 10), rot: rand(0, Math.PI), vr: rand(-6, 6),
          color: Math.random() < 0.5 ? "#7fc35f" : "#5aa84e",
          shape: "needle", grav: 260,
        });
      }
      if (m.x > layout.lawn.w + 80) finishDay();
      return;
    }

    if (state.phase === "collecting") {
      // po rozdrvení šišky chvíľu postojí (a trasie sa)
      if (m.cooldown > 0) {
        m.cooldown -= dt;
        return;
      }
      // pomaly sa plíži k najbližšej šiške a hrozí, že ju rozdrví
      const speed = Math.min(30 + (state.day - 1) * 7, 100) * currentDiff().speed;
      const target = nearestCone(m.x, m.y);
      if (target) {
        const dx = target.px - m.x;
        const dy = target.py - m.y;
        const dist = Math.hypot(dx, dy) || 1;
        m.vx = (dx / dist) * speed;
        m.vy = (dy / dist) * speed;
        m.x += m.vx * dt;
        m.y += m.vy * dt + Math.sin(state.time * 6) * 0.6;
        if (Math.abs(m.vx) > 4) m.face = m.vx > 0 ? 1 : -1;
        m.wheel += dt * (speed * 0.14);

        const reach = 64 * mowerSize();
        if (dist < reach) crushCone(target);
      }
      return;
    }

    // intro / done / gameover – sekačka stojí (alebo dymí) doma
    m.bob = Math.sin(state.time * 2) * 3;
    if (state.phase === "intro") {
      m.x = layout.home.x;
      m.y = layout.home.y + m.bob;
    }
    if (state.phase === "gameover" && Math.random() < 0.5) {
      // unikajúci dym z pokazenej sekačky
      state.particles.push({
        x: m.x + rand(-10, 10), y: m.y - 24,
        vx: rand(-12, 12), vy: rand(-50, -20),
        life: 0, maxLife: rand(0.7, 1.3),
        size: rand(8, 16), rot: 0, vr: 0,
        color: Math.random() < 0.5 ? "#6b6b6b" : "#9a9a9a",
        shape: "fleck", grav: -20,
      });
    }
  }

  // ---------- Atmosphere ----------
  function initAtmosphere() {
    state.clouds = [];
    for (let i = 0; i < 5; i++) {
      state.clouds.push({
        x: rand(0, W), y: rand(0.08, 0.34) * H,
        s: rand(0.6, 1.4), v: rand(4, 12), o: rand(0.5, 0.9),
      });
    }
    state.motes = [];
    for (let i = 0; i < 36; i++) {
      state.motes.push({
        x: rand(0, W), y: rand(0, H),
        r: rand(0.6, 2.2), v: rand(4, 18),
        a: rand(0, Math.PI * 2), o: rand(0.2, 0.7),
      });
    }
  }
  function updateClouds(dt) {
    for (const c of state.clouds) {
      c.x += c.v * dt;
      if (c.x - 160 * c.s > W) c.x = -160 * c.s;
    }
  }
  function updateMotes(dt) {
    for (const m of state.motes) {
      m.a += dt * 0.6;
      m.x += (m.v + state.wind * 30) * dt;
      m.y += Math.sin(m.a) * 6 * dt;
      if (m.x > W + 4) m.x = -4;
      if (m.x < -4) m.x = W + 4;
    }
  }
  function updateBirds(dt) {
    for (const b of state.birds) {
      b.x += b.v * dt;
      b.flap += dt * 6;
      if (b.x - 20 > W) { b.x = -20; b.y = rand(0.12, 0.3) * H; }
    }
  }

  // sun position (shared by glow + tree lighting)
  function sunPos() {
    return { x: W * 0.22, y: layout.horizon * 0.4, r: Math.min(W, H) * 0.2 };
  }

  // ---------- Decorative content (positions only; rebuilt on resize) ----------
  function initDecor() {
    // swaying grass tufts across the lawn (normalized lawn coords)
    state.tufts = [];
    const tuftCount = Math.round(clamp(W / 11, 48, 130));
    for (let i = 0; i < tuftCount; i++) {
      const ny = Math.pow(rand(0, 1), 0.85); // mierne viac dole
      const blades = [];
      const n = 3 + (Math.random() * 3 | 0);
      for (let b = 0; b < n; b++) {
        blades.push({
          a: rand(-0.5, 0.5),
          len: rand(0.7, 1.2),
          curve: rand(-0.4, 0.4),
          shade: rand(0, 1),
        });
      }
      state.tufts.push({
        nx: rand(-0.02, 1.02),
        ny,
        scale: rand(0.7, 1.25),
        phase: rand(0, Math.PI * 2),
        blades,
      });
    }
    // foreground framing grass pinned to the very bottom
    const fg = Math.round(clamp(W / 26, 16, 60));
    for (let i = 0; i < fg; i++) {
      const blades = [];
      const n = 4 + (Math.random() * 3 | 0);
      for (let b = 0; b < n; b++) {
        blades.push({ a: rand(-0.6, 0.6), len: rand(0.8, 1.3), curve: rand(-0.5, 0.5), shade: rand(0, 1) });
      }
      state.tufts.push({ nx: rand(-0.02, 1.02), ny: rand(1.0, 1.12), scale: rand(1.6, 2.8), phase: rand(0, Math.PI * 2), blades, fg: true });
    }

    state.birds = [];
    for (let i = 0; i < 3; i++) {
      state.birds.push({ x: rand(0, W), y: rand(0.12, 0.3) * H, v: rand(8, 16), s: rand(0.6, 1), flap: rand(0, Math.PI * 2) });
    }
  }

  // ---------- Static background, baked once per resize ----------
  function buildBackground() {
    const c = document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const hz = layout.horizon;

    // sky – golden-hour gradient
    const sky = g.createLinearGradient(0, 0, 0, hz + 40);
    sky.addColorStop(0, "#8fb7e0");
    sky.addColorStop(0.4, "#bcd4e4");
    sky.addColorStop(0.72, "#f2dec2");
    sky.addColorStop(1, "#fbe6c6");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hz + 40);

    // warm bloom around the sun
    const s = sunPos();
    let bloom = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.2);
    bloom.addColorStop(0, "rgba(255,240,205,0.7)");
    bloom.addColorStop(0.5, "rgba(255,226,170,0.22)");
    bloom.addColorStop(1, "rgba(255,226,170,0)");
    g.fillStyle = bloom;
    g.fillRect(0, 0, W, hz + 80);

    // distant hill layers, hazy & desaturated for depth
    const hills = [
      { col: "#bcd3b0", off: 0.04, amp: 0.05, freq: 0.004, ph: 0.5 },
      { col: "#a9cc9b", off: 0.085, amp: 0.07, freq: 0.006, ph: 2.1 },
      { col: "#8fbf82", off: 0.14, amp: 0.09, freq: 0.008, ph: 4.0 },
    ];
    for (const h of hills) {
      g.fillStyle = h.col;
      g.beginPath();
      g.moveTo(0, hz + 4);
      const base = hz - H * h.off;
      for (let x = 0; x <= W; x += 24) {
        const y = base - Math.sin(x * h.freq + h.ph) * H * h.amp - Math.sin(x * h.freq * 2.3) * H * h.amp * 0.3;
        g.lineTo(x, y);
      }
      g.lineTo(W, hz + 4);
      g.closePath();
      g.fill();
    }

    // distant conifer silhouettes on the far hill
    g.save();
    g.globalAlpha = 0.5;
    const farY = hz - H * 0.105;
    for (let i = 0; i < Math.round(W / 90); i++) {
      const x = (i + 0.5) * 90 + ((i * 53) % 40) - 20;
      const th = H * (0.05 + ((i * 37) % 30) / 600);
      g.fillStyle = i % 2 ? "#7fae74" : "#74a56a";
      drawMiniConifer(g, x, farY, th);
    }
    g.restore();

    // lawn base
    const L = layout.lawn;
    const grass = g.createLinearGradient(0, L.y, 0, H);
    grass.addColorStop(0, "#86c861");
    grass.addColorStop(0.5, "#67b251");
    grass.addColorStop(1, "#3f8f3d");
    g.fillStyle = grass;
    g.fillRect(L.x, L.y, L.w, L.h);

    // soft uneven patches for organic feel
    for (let i = 0; i < 26; i++) {
      const px = rand(0, W), py = L.y + rand(0, L.h);
      const r = rand(40, 150);
      const rg = g.createRadialGradient(px, py, 0, px, py, r);
      const light = Math.random() < 0.5;
      rg.addColorStop(0, light ? "rgba(180,224,140,0.18)" : "rgba(30,80,35,0.12)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    }

    // warm light wash near horizon on the grass
    const wash = g.createLinearGradient(0, L.y, 0, L.y + L.h * 0.4);
    wash.addColorStop(0, "rgba(255,236,180,0.28)");
    wash.addColorStop(1, "rgba(255,236,180,0)");
    g.fillStyle = wash;
    g.fillRect(0, L.y, W, L.h * 0.4);

    // fine grass texture
    g.strokeStyle = "rgba(28,70,28,0.07)";
    g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const ny = (i * 0.618) % 1;
      const x = (i * 167) % W;
      const y = L.y + Math.pow(ny, 0.8) * L.h;
      const len = 3 + ny * 9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rand(-1.5, 1.5), y - len);
      g.stroke();
    }

    // little flowers / clover scattered
    for (let i = 0; i < Math.round(W / 24); i++) {
      const x = rand(0, W);
      const ny = Math.pow(rand(0.05, 1), 0.9);
      const y = L.y + ny * L.h;
      drawFlower(g, x, y, 1.4 + ny * 3.4, ["#fff7e8", "#ffd9e2", "#fff0a8"][(i * 7) % 3]);
    }

    return c;
  }

  function drawMiniConifer(g, x, baseY, h) {
    const w = h * 0.5;
    g.beginPath();
    g.moveTo(x, baseY - h);
    g.lineTo(x - w * 0.5, baseY - h * 0.45);
    g.lineTo(x - w * 0.28, baseY - h * 0.45);
    g.lineTo(x - w * 0.5, baseY);
    g.lineTo(x + w * 0.5, baseY);
    g.lineTo(x + w * 0.28, baseY - h * 0.45);
    g.lineTo(x + w * 0.5, baseY - h * 0.45);
    g.closePath();
    g.fill();
  }

  function drawFlower(g, x, y, r, col) {
    g.save();
    g.translate(x, y);
    g.fillStyle = col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * r, Math.sin(a) * r, r * 0.7, r * 0.45, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#f2b441";
    g.beginPath();
    g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, W, H);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);

    drawSunGlow();
    drawClouds();
    drawBirds();
    drawMowedOverlay();

    // mid-ground grass behind the cones
    drawGrass(false);

    drawTree(layout.tree2, 0.82);
    drawTree(layout.tree, 1);

    // cones sorted by depth (painter)
    const drawable = state.cones.filter((c) => c.state === "idle" || c.state === "drop" || c.state === "crush");
    drawable.sort((a, b) => a.py - b.py);
    for (const c of drawable) drawCone(c);

    drawMower();
    drawMotes();

    // flying cones on top
    for (const c of state.cones) if (c.state === "flying") drawCone(c, true);

    drawParticles();

    // tall foreground grass frames the scene
    drawGrass(true);

    drawLightLeak();
    drawVignette();
  }

  function drawSunGlow() {
    const s = sunPos();
    // volumetric rays
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(s.x, s.y);
    ctx.rotate(state.time * 0.012);
    const rays = 12;
    for (let i = 0; i < rays; i++) {
      ctx.rotate((Math.PI * 2) / rays);
      const w = 0.06 + 0.03 * Math.sin(state.time * 0.7 + i);
      const len = s.r * (3.2 + 0.4 * Math.sin(state.time * 0.5 + i * 1.7));
      const grd = ctx.createLinearGradient(0, 0, len, 0);
      grd.addColorStop(0, "rgba(255,240,200,0.10)");
      grd.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, -len * w);
      ctx.lineTo(len, len * w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // sun disc with soft halo
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    halo.addColorStop(0, "rgba(255,250,232,0.95)");
    halo.addColorStop(0.35, "rgba(255,238,190,0.5)");
    halo.addColorStop(1, "rgba(255,238,190,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,252,240,0.95)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds() {
    for (const c of state.clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.s, c.s);
      // soft warm underside
      ctx.globalAlpha = c.o * 0.5;
      ctx.fillStyle = "#e9c9a3";
      cloudShape(0, 4);
      // bright top
      ctx.globalAlpha = c.o;
      ctx.fillStyle = "#fffaf2";
      cloudShape(0, 0);
      ctx.restore();
    }
  }
  function cloudShape(ox, oy) {
    blob(ox + 0, oy + 0, 42, 22);
    blob(ox + 36, oy + 6, 30, 18);
    blob(ox - 34, oy + 8, 28, 16);
    blob(ox + 8, oy - 13, 28, 19);
  }
  function blob(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBirds() {
    ctx.save();
    ctx.strokeStyle = "rgba(70,86,98,0.5)";
    ctx.lineWidth = 1.6;
    for (const b of state.birds) {
      const w = 7 * b.s;
      const flap = Math.sin(b.flap) * 3 * b.s;
      ctx.beginPath();
      ctx.moveTo(b.x - w, b.y);
      ctx.quadraticCurveTo(b.x - w * 0.4, b.y - flap - 2, b.x, b.y);
      ctx.quadraticCurveTo(b.x + w * 0.4, b.y - flap - 2, b.x + w, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMowedOverlay() {
    if (state.mowed <= 0) return;
    const L = layout.lawn;
    const mw = L.w * state.mowed;
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.x, L.y, mw, L.h);
    ctx.clip();
    const mg = ctx.createLinearGradient(0, L.y, 0, H);
    mg.addColorStop(0, "#9bd673");
    mg.addColorStop(1, "#5aa64f");
    ctx.fillStyle = mg;
    ctx.fillRect(L.x, L.y, mw, L.h);
    ctx.globalAlpha = 0.45;
    const stripe = Math.max(26, L.h / 10);
    for (let y = L.y, i = 0; y < H; y += stripe, i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.12)" : "rgba(25,70,28,0.07)";
      ctx.fillRect(L.x, y, mw, stripe);
    }
    // freshly-cut leading edge
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(mw - 3, L.y, 4, L.h);
    ctx.restore();
  }

  function drawGrass(foreground) {
    const L = layout.lawn;
    for (const t of state.tufts) {
      if (!!t.fg !== foreground) continue;
      const x = L.x + t.nx * L.w;
      const y = L.y + t.ny * L.h;
      const depth = clamp(t.ny, 0, 1);
      const sc = t.scale * lerp(0.6, 1.25, depth) * (Math.min(W, H) / 720);
      const sway = (Math.sin(state.time * 1.4 + t.phase) * 0.12) + state.wind * 0.18;
      drawTuft(x, y, sc, sway, t.blades, depth);
    }
  }
  function drawTuft(x, y, sc, sway, blades, depth) {
    ctx.save();
    ctx.translate(x, y);
    for (const bl of blades) {
      const len = 16 * bl.len * sc;
      const baseA = bl.a + sway;
      const tipX = Math.sin(baseA) * len + (bl.curve + sway) * len * 0.5;
      const tipY = -Math.cos(baseA) * len;
      const midX = Math.sin(baseA) * len * 0.5 + (bl.curve + sway) * len * 0.3;
      const midY = -Math.cos(baseA) * len * 0.5;
      const wBase = 2.4 * sc;
      const dark = mix("#3c7d36", "#2c5f2c", bl.shade);
      const lite = mix("#7cc35a", "#5aa84a", bl.shade);
      const grd = ctx.createLinearGradient(0, 0, tipX, tipY);
      grd.addColorStop(0, dark);
      grd.addColorStop(1, lite);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-wBase / 2, 0);
      ctx.quadraticCurveTo(midX - wBase * 0.2, midY, tipX, tipY);
      ctx.quadraticCurveTo(midX + wBase * 0.2, midY, wBase / 2, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTree(t, alpha) {
    if (!t.h) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const sway = Math.sin(state.time * 0.8 + t.x * 0.01) * (3 + state.wind * 7);
    const sun = sunPos();
    const lightDir = Math.sign(sun.x - t.x) || -1; // svetlo z ľavej (slnko)

    // ground contact shadow
    ctx.save();
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = "#15331a";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 4, t.h * 0.22, t.h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // trunk with shading
    const trunkH = t.h * 0.15;
    const trunkW = t.h * 0.055;
    const tg = ctx.createLinearGradient(t.x - trunkW / 2, 0, t.x + trunkW / 2, 0);
    tg.addColorStop(0, "#7a5736");
    tg.addColorStop(0.5, "#5e4026");
    tg.addColorStop(1, "#46301d");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(t.x - trunkW / 2, t.y);
    ctx.lineTo(t.x + trunkW / 2, t.y);
    ctx.lineTo(t.x + trunkW * 0.32, t.y - trunkH);
    ctx.lineTo(t.x - trunkW * 0.32, t.y - trunkH);
    ctx.closePath();
    ctx.fill();

    // foliage tiers with jagged bottoms + rim light
    const tiers = 6;
    const top = t.y - trunkH - t.h * 0.9;
    const bottom = t.y - trunkH + t.h * 0.02;
    const widest = t.h * 0.38;
    for (let i = tiers - 1; i >= 0; i--) {
      const f = i / (tiers - 1); // 0 bottom .. 1 top
      const cy = lerp(bottom, top, f);
      const nextY = lerp(bottom, top, Math.min(1, (i + 1.15) / (tiers - 1)));
      const halfW = widest * (1 - f * 0.66) * (0.55 + 0.45 * (1 - f * 0.2));
      const tierSway = sway * (0.25 + f * 0.85);
      const tipX = t.x + tierSway;
      const dark = mix("#214d24", "#2f6634", f);
      const lite = mix("#3f8a3e", "#6fb45a", f);
      const g = ctx.createLinearGradient(t.x - halfW, 0, t.x + halfW, 0);
      if (lightDir < 0) { g.addColorStop(0, lite); g.addColorStop(0.6, mix(dark, lite, 0.5)); g.addColorStop(1, dark); }
      else { g.addColorStop(0, dark); g.addColorStop(0.4, mix(dark, lite, 0.5)); g.addColorStop(1, lite); }
      ctx.fillStyle = g;

      // jagged skirt
      const baseY = cy + t.h * 0.05;
      const segs = 6;
      ctx.beginPath();
      ctx.moveTo(tipX, nextY);
      for (let sIdx = 0; sIdx <= segs; sIdx++) {
        const tt = sIdx / segs;
        const ex = lerp(t.x - halfW, t.x + halfW, tt) + tierSway * (1 - Math.abs(tt - 0.5) * 2) * 0.4;
        const notch = (sIdx % 2 === 0) ? 0 : -t.h * 0.03;
        ctx.lineTo(ex, baseY + notch);
      }
      ctx.closePath();
      ctx.fill();

      // sun-side rim highlight
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = "rgba(220,245,180,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tipX, nextY);
      ctx.lineTo(t.x + lightDir * halfW, baseY);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCone(c, fly) {
    if (!coneSprite) return;
    const sc = fly ? lerp(coneScale(c.ny), 0.7, 0.4) : coneScale(c.ny);
    const w = CONE_W * 0.42 * c.r * sc;
    const h = CONE_H * 0.42 * c.r * sc;

    // shadow on ground (not for flying)
    if (!fly && c.state !== "drop") {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#1f3a18";
      ctx.beginPath();
      ctx.ellipse(c.px, c.py + h * 0.42, w * 0.5, w * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(c.px, c.py);
    ctx.rotate(c.rot);
    if (fly) {
      ctx.globalAlpha = clamp(1 - c.flyT / c.flyDur * 0.2, 0.5, 1);
    }
    if (c.state === "crush") {
      const ct = clamp(c.crushT / 0.32, 0, 1);
      ctx.translate(0, h * 0.42 * ct);
      ctx.scale(1 + ct * 0.55, 1 - ct * 0.85);
      ctx.globalAlpha = 1 - ct;
    }
    ctx.drawImage(coneSprite, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawMower() {
    const m = state.mower;
    const scale = mowerSize();
    const bw = 92 * scale, bh = 56 * scale;
    const broken = state.phase === "gameover";
    const moving = state.phase === "collecting" && m.cooldown <= 0;

    // soft drop shadow on the ground
    ctx.save();
    const sg = ctx.createRadialGradient(m.x, m.y + bh * 0.62, 0, m.x, m.y + bh * 0.62, bw * 0.62);
    sg.addColorStop(0, "rgba(20,45,20,0.32)");
    sg.addColorStop(1, "rgba(20,45,20,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + bh * 0.62, bw * 0.62, bh * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const shx = m.shake > 0 ? Math.sin(state.time * 60) * 4 * m.shake : 0;
    ctx.translate(m.x + shx, m.y);
    if (broken) ctx.rotate(0.16);
    ctx.scale(m.face, 1);

    // wheels with spin
    for (const wx of [-bw * 0.31, bw * 0.31]) {
      ctx.save();
      ctx.translate(wx, bh * 0.42);
      ctx.fillStyle = "#222a27";
      ctx.beginPath();
      ctx.arc(0, 0, bh * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(m.wheel);
      ctx.strokeStyle = "rgba(150,160,156,0.6)";
      ctx.lineWidth = 1.6 * scale;
      for (let s = 0; s < 4; s++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, bh * 0.16);
        ctx.stroke();
      }
      ctx.restore();
    }

    // body
    const bodyTop = broken ? "#dfe5e1" : "#86e7cb";
    const bodyMid = broken ? "#b9c2bc" : "#48b793";
    const bodyBot = broken ? "#8b968f" : "#2f9a78";
    const g = ctx.createLinearGradient(0, -bh * 0.55, 0, bh * 0.55);
    g.addColorStop(0, bodyTop);
    g.addColorStop(0.55, bodyMid);
    g.addColorStop(1, bodyBot);
    ctx.fillStyle = g;
    roundRect(-bw / 2, -bh / 2, bw, bh, 18 * scale);
    ctx.fill();

    // glossy top highlight
    ctx.save();
    roundRect(-bw / 2, -bh / 2, bw, bh, 18 * scale);
    ctx.clip();
    const gloss = ctx.createLinearGradient(0, -bh * 0.5, 0, 0);
    gloss.addColorStop(0, "rgba(255,255,255,0.45)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh * 0.5);
    // side ambient shade
    const shade = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.12)");
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = shade;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    // panel line
    ctx.strokeStyle = "rgba(20,50,40,0.18)";
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.4, bh * 0.06);
    ctx.lineTo(bw * 0.4, bh * 0.06);
    ctx.stroke();

    // top dome
    ctx.fillStyle = broken ? "#eef2ef" : "#a6f0d6";
    roundRect(-bw * 0.3, -bh * 0.64, bw * 0.6, bh * 0.42, 13 * scale);
    ctx.fill();

    // status LED
    ctx.fillStyle = broken ? "#c0473a" : (moving ? "#ffcf3a" : "#7ff0a0");
    ctx.beginPath();
    ctx.arc(bw * 0.18, -bh * 0.46, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    // visor / eyes
    ctx.fillStyle = "#16241f";
    roundRect(-bw * 0.27, -bh * 0.18, bw * 0.54, bh * 0.34, 10 * scale);
    ctx.fill();
    // visor reflection
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRect(-bw * 0.24, -bh * 0.15, bw * 0.48, bh * 0.1, 6 * scale);
    ctx.fill();

    const blinkOpen = m.blink > 0.12 && !broken;
    if (broken) {
      ctx.strokeStyle = "#ff8a5a";
      ctx.lineWidth = 2.6 * scale;
      ctx.lineCap = "round";
      const ex = bw * 0.11, s = 4.5 * scale;
      for (const cx of [-ex, ex]) {
        ctx.beginPath();
        ctx.moveTo(cx - s, -s); ctx.lineTo(cx + s, s);
        ctx.moveTo(cx + s, -s); ctx.lineTo(cx - s, s);
        ctx.stroke();
      }
    } else if (blinkOpen) {
      for (const cx of [-bw * 0.11, bw * 0.11]) {
        const eg = ctx.createRadialGradient(cx, 0, 0, cx, 0, 7 * scale);
        eg.addColorStop(0, "#d8feff");
        eg.addColorStop(0.5, "#6fe0ff");
        eg.addColorStop(1, "rgba(111,224,255,0)");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(cx, 0, 7 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a1f1c";
        ctx.beginPath();
        ctx.arc(cx, 0, 2.3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // blink line
      ctx.strokeStyle = "#6fe0ff";
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.16, 0); ctx.lineTo(-bw * 0.06, 0);
      ctx.moveTo(bw * 0.06, 0); ctx.lineTo(bw * 0.16, 0);
      ctx.stroke();
    }

    // antenna
    ctx.strokeStyle = "#26302c";
    ctx.lineWidth = 2.4 * scale;
    ctx.lineCap = "round";
    const antWobble = Math.sin(state.time * 8) * 0.08 * (moving ? 1 : 0.3);
    ctx.beginPath();
    ctx.moveTo(bw * 0.32, -bh * 0.46);
    ctx.quadraticCurveTo(bw * 0.42, -bh * 0.74, bw * (0.42 + antWobble), -bh * 0.9);
    ctx.stroke();
    const tip = ctx.createRadialGradient(bw * (0.42 + antWobble), -bh * 0.94, 0, bw * (0.42 + antWobble), -bh * 0.94, 5 * scale);
    tip.addColorStop(0, "#ffd9a0");
    tip.addColorStop(1, "#e8743b");
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.arc(bw * (0.42 + antWobble), -bh * 0.94, 4.2 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawMotes() {
    ctx.save();
    for (const m of state.motes) {
      ctx.globalAlpha = m.o * (0.5 + 0.5 * Math.sin(m.a * 2));
      ctx.fillStyle = "#fff7da";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = clamp(1 - t, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "needle") {
        ctx.fillRect(-p.size / 2, -1, p.size, 2);
      } else if (p.shape === "confetti") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawLightLeak() {
    // warm glow bleeding in from the sun's corner
    const s = sunPos();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, Math.max(W, H) * 0.9);
    g.addColorStop(0, "rgba(255,224,160,0.16)");
    g.addColorStop(0.4, "rgba(255,210,150,0.05)");
    g.addColorStop(1, "rgba(255,210,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawVignette() {
    // cohesive warm-to-cool color grade
    const grade = ctx.createLinearGradient(0, 0, W, H);
    grade.addColorStop(0, "rgba(255,196,120,0.06)");
    grade.addColorStop(1, "rgba(20,40,70,0.10)");
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);

    const g = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(18,34,22,0.26)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Input ----------
  let pointerDown = false;
  let movedDist = 0;
  let lastPt = { x: 0, y: 0 };
  let collectedThisGesture = false;

  function pointerPos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function tryCollectAt(x, y, radius) {
    let hit = false;
    for (const c of state.cones) {
      if (c.state !== "idle" && c.state !== "drop") continue;
      const sc = coneScale(c.ny) * c.r;
      const rr = radius + 26 * sc;
      const dx = c.px - x, dy = (c.py) - y;
      if (dx * dx + dy * dy <= rr * rr) {
        if (collectCone(c)) hit = true;
      }
    }
    return hit;
  }

  function onDown(e) {
    if (state.phase !== "collecting") return;
    pointerDown = true;
    collectedThisGesture = false;
    movedDist = 0;
    const p = pointerPos(e);
    lastPt = p;
    if (tryCollectAt(p.x, p.y, 6)) collectedThisGesture = true;
  }
  function onMove(e) {
    if (!pointerDown) return;
    const p = pointerPos(e);
    movedDist += Math.hypot(p.x - lastPt.x, p.y - lastPt.y);
    lastPt = p;
    if (tryCollectAt(p.x, p.y, 30)) collectedThisGesture = true;
  }
  function onUp(e) {
    if (!pointerDown) return;
    pointerDown = false;
    if (!collectedThisGesture && movedDist < 12) {
      const p = pointerPos(e);
      // tap: collect nearest within generous radius
      let best = null, bestD = Infinity;
      for (const c of state.cones) {
        if (c.state !== "idle" && c.state !== "drop") continue;
        const d = Math.hypot(c.px - p.x, c.py - p.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      const sc = best ? coneScale(best.ny) * best.r : 1;
      if (best && bestD < 46 * sc + 14) collectCone(best);
    }
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", () => { pointerDown = false; });

  // ---------- Basket bump ----------
  function bumpBasket() {
    $basket.classList.remove("bump");
    void $basket.offsetWidth;
    $basket.classList.add("bump");
  }

  // ---------- Audio ----------
  let audioCtx = null;
  let soundOn = true;
  let combo = 0, comboTimer = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function playPop() {
    if (!soundOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    comboTimer = state.time;
    combo = Math.min(combo + 1, 12);
    const base = 380 + combo * 28;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(base, now);
    o.frequency.exponentialRampToValueAtTime(base * 1.7, now + 0.08);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.2);
  }

  function playThunk() {
    if (!soundOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.16);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.24);
  }

  function playBreak() {
    if (!soundOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [392, 311, 261, 196];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sawtooth";
      const t = now + i * 0.13;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.32);
    });
  }

  function playJingle() {
    if (!soundOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "triangle";
      const t = now + i * 0.11;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.34);
    });
  }

  $sound.addEventListener("click", () => {
    soundOn = !soundOn;
    $sound.setAttribute("aria-pressed", String(soundOn));
    $sound.querySelector("[data-on]").hidden = !soundOn;
    $sound.querySelector("[data-off]").hidden = soundOn;
    if (soundOn) ensureAudio();
  });

  // reset combo over time
  function tickCombo() {
    if (state.time - comboTimer > 0.6) combo = 0;
  }

  // ---------- Loop ----------
  let last = performance.now();
  let running = true;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (running) {
      update(dt);
      tickCombo();
    }
    render();
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    last = performance.now();
  });

  // ---------- Start ----------
  function startGame() {
    if (state.started) return;
    state.started = true;
    ensureAudio();
    $intro.classList.add("hide");
    resetRun();
    showToast("Úroveň: " + currentDiff().label);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2200);
  }

  function resetRun() {
    state.day = 1;
    state.collectedTotal = 0;
    state.damage = 0;
    state.particles.length = 0;
    state.mower.shake = 0;
    state.mower.cooldown = 0;
    state.mower.face = 1;
    state.phase = "collecting";
    spawnDay(1);
  }

  function restartGame() {
    $over.classList.remove("show");
    ensureAudio();
    resetRun();
  }

  $start.addEventListener("click", startGame);
  $retry.addEventListener("click", restartGame);
  for (const btn of $levelBtns) {
    btn.addEventListener("click", () => selectDifficulty(btn.dataset.level));
  }
  selectDifficulty(state.difficulty);

  // ---------- Boot ----------
  window.addEventListener("resize", () => {
    resize();
    // keep atmosphere proportional
    for (const c of state.clouds) c.y = clamp(c.y, 0, layout.horizon);
  });

  resize();
  initAtmosphere();
  updateHud();
  requestAnimationFrame(frame);
})();
