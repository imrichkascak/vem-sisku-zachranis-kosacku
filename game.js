/*
 * Vem šišku, zachrániš kosačku
 * Pokojná záhradná simulácia – pozbieraj šišky spod ihličnatého stromu,
 * aby robotická kosačka mohla pokosiť trávnik.
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
  const CONE_W = 120, CONE_H = 152;

  function buildSprites() {
    coneSprite = makeConeSprite();
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
  const state = {
    phase: "intro", // intro | collecting | mowing | done
    day: 1,
    collectedTotal: 0,
    cones: [],
    particles: [],
    clouds: [],
    motes: [],
    mower: { x: 0, y: 0, dir: 1, wheel: 0, blink: 0, bob: 0 },
    mowed: 0,
    wind: 0,
    windTarget: 0,
    time: 0,
    started: false,
  };

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
      "Kosačka jazdí! ✨",
      "Trávnik ako zamat 🌱",
      "Kmotor by bol hrdý 👏",
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

  function updateMower(dt) {
    const m = state.mower;
    m.wheel += dt * (state.phase === "mowing" ? 14 : 0);
    m.blink -= dt;
    if (m.blink < 0) m.blink = rand(2, 5);

    if (state.phase === "mowing") {
      const speed = (layout.lawn.w + 160) / 3.4; // px/s -> ~3.4s pass
      m.x += speed * dt;
      // gentle vertical sway while mowing
      m.y = layout.home.y + Math.sin(state.time * 3) * 8;
      state.mowed = clamp((m.x) / (layout.lawn.w * 0.99), 0, 1);
      // grass clippings behind
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
    } else {
      m.bob = Math.sin(state.time * 2) * 3;
      m.x = layout.home.x;
      m.y = layout.home.y + m.bob;
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

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawSun();
    drawClouds();
    drawHills();
    drawLawn();
    drawTree(layout.tree2, 0.8);
    drawTree(layout.tree, 1);

    // cones sorted by depth (painter)
    const drawable = state.cones.filter((c) => c.state === "idle" || c.state === "drop");
    drawable.sort((a, b) => a.py - b.py);
    for (const c of drawable) drawCone(c);

    drawMower();
    drawMotes();

    // flying cones on top
    for (const c of state.cones) if (c.state === "flying") drawCone(c, true);

    drawParticles();
    drawVignette();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, layout.horizon + 60);
    g.addColorStop(0, "#aee0f2");
    g.addColorStop(0.45, "#d7eef0");
    g.addColorStop(1, "#fbeccb");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, layout.horizon + 60);
  }

  function drawSun() {
    const sx = W * 0.24, sy = layout.horizon * 0.42;
    const r = Math.min(W, H) * 0.18;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, "rgba(255,243,205,0.95)");
    g.addColorStop(0.4, "rgba(255,231,168,0.55)");
    g.addColorStop(1, "rgba(255,231,168,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, layout.horizon + 80);
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,248,225,0.9)";
    ctx.fill();
  }

  function drawClouds() {
    for (const c of state.clouds) {
      ctx.save();
      ctx.globalAlpha = c.o;
      ctx.fillStyle = "#ffffff";
      ctx.translate(c.x, c.y);
      ctx.scale(c.s, c.s);
      blob(0, 0, 40, 22);
      blob(34, 6, 30, 18);
      blob(-32, 8, 28, 16);
      blob(8, -12, 26, 18);
      ctx.restore();
    }
  }
  function blob(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHills() {
    ctx.save();
    ctx.fillStyle = "#a9d79a";
    ctx.beginPath();
    ctx.moveTo(0, layout.horizon);
    const baseY = layout.horizon;
    for (let x = 0; x <= W; x += 40) {
      const y = baseY - 26 - Math.sin(x * 0.006 + 1) * 22 - Math.sin(x * 0.013) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, layout.horizon);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawLawn() {
    const L = layout.lawn;
    const g = ctx.createLinearGradient(0, L.y, 0, H);
    g.addColorStop(0, "#7cc05f");
    g.addColorStop(1, "#4f9c47");
    ctx.fillStyle = g;
    ctx.fillRect(L.x, L.y, L.w, L.h);

    // subtle grass texture dashes
    ctx.save();
    ctx.strokeStyle = "rgba(40,90,40,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const ny = (i * 113 % 100) / 100;
      const x = ((i * 197) % W);
      const y = L.y + ny * L.h;
      const len = 4 + ny * 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - len);
      ctx.stroke();
    }
    ctx.restore();

    // mowed region overlay
    if (state.mowed > 0) {
      const mw = L.w * state.mowed;
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.x, L.y, mw, L.h);
      ctx.clip();
      const mg = ctx.createLinearGradient(0, L.y, 0, H);
      mg.addColorStop(0, "#8fce6e");
      mg.addColorStop(1, "#63b257");
      ctx.fillStyle = mg;
      ctx.fillRect(L.x, L.y, mw, L.h);
      // mow stripes
      ctx.globalAlpha = 0.5;
      const stripe = Math.max(26, L.h / 9);
      for (let y = L.y, i = 0; y < H; y += stripe, i++) {
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.10)" : "rgba(30,80,30,0.06)";
        ctx.fillRect(L.x, y, mw, stripe);
      }
      ctx.restore();
    }
  }

  function drawTree(t, alpha) {
    if (!t.h) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const sway = Math.sin(state.time * 0.8) * (4 + state.wind * 8);

    // trunk
    const trunkH = t.h * 0.14;
    const trunkW = t.h * 0.05;
    ctx.fillStyle = "#6b4a2f";
    ctx.beginPath();
    ctx.moveTo(t.x - trunkW / 2, t.y);
    ctx.lineTo(t.x + trunkW / 2, t.y);
    ctx.lineTo(t.x + trunkW * 0.35, t.y - trunkH);
    ctx.lineTo(t.x - trunkW * 0.35, t.y - trunkH);
    ctx.closePath();
    ctx.fill();

    // foliage tiers
    const tiers = 4;
    const top = t.y - trunkH - t.h * 0.82;
    const bottom = t.y - trunkH;
    const widest = t.h * 0.34;
    for (let i = tiers - 1; i >= 0; i--) {
      const f = i / (tiers - 1); // 0 bottom .. 1 top
      const cy = lerp(bottom, top, f);
      const ny = lerp(bottom, top, (i + 1) / (tiers - 1));
      const halfW = widest * (1 - f * 0.62);
      const tierSway = sway * (0.3 + f * 0.7);
      const tipX = t.x + tierSway;
      const dark = mix("#2f6b34", "#3f7d3d", f);
      const lite = mix("#4f9447", "#73b85f", f);
      const g = ctx.createLinearGradient(t.x - halfW, 0, t.x + halfW, 0);
      g.addColorStop(0, dark);
      g.addColorStop(0.5, lite);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tipX, ny);
      ctx.lineTo(t.x - halfW, cy + 6);
      ctx.quadraticCurveTo(t.x, cy - 4, t.x + halfW, cy + 6);
      ctx.closePath();
      ctx.fill();
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
    ctx.drawImage(coneSprite, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawMower() {
    const m = state.mower;
    const scale = clamp(Math.min(W, H) / 720, 0.66, 1.15);
    const bw = 92 * scale, bh = 56 * scale;
    const x = m.x, y = m.y;

    ctx.save();
    // shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#1f3a18";
    ctx.beginPath();
    ctx.ellipse(x, y + bh * 0.6, bw * 0.6, bh * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // wheels
    ctx.fillStyle = "#2c3530";
    roundRect(x - bw * 0.42, y + bh * 0.18, bw * 0.22, bh * 0.34, 6 * scale);
    ctx.fill();
    roundRect(x + bw * 0.2, y + bh * 0.18, bw * 0.22, bh * 0.34, 6 * scale);
    ctx.fill();

    // body
    const g = ctx.createLinearGradient(0, y - bh * 0.5, 0, y + bh * 0.5);
    g.addColorStop(0, "#7fe0c2");
    g.addColorStop(1, "#3fae8e");
    ctx.fillStyle = g;
    roundRect(x - bw / 2, y - bh / 2, bw, bh, 16 * scale);
    ctx.fill();

    // top dome
    ctx.fillStyle = "#9defcf";
    roundRect(x - bw * 0.32, y - bh * 0.62, bw * 0.64, bh * 0.4, 12 * scale);
    ctx.fill();

    // visor / eyes
    ctx.fillStyle = "#1d2b28";
    roundRect(x - bw * 0.26, y - bh * 0.16, bw * 0.52, bh * 0.32, 9 * scale);
    ctx.fill();
    const blinkOpen = m.blink > 0.12;
    ctx.fillStyle = blinkOpen ? "#aef7ff" : "#1d2b28";
    if (blinkOpen) {
      ctx.beginPath();
      ctx.arc(x - bw * 0.1, y, 4.5 * scale, 0, Math.PI * 2);
      ctx.arc(x + bw * 0.1, y, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // antenna
    ctx.strokeStyle = "#2c3530";
    ctx.lineWidth = 2.4 * scale;
    ctx.beginPath();
    ctx.moveTo(x + bw * 0.34, y - bh * 0.42);
    ctx.lineTo(x + bw * 0.42, y - bh * 0.82);
    ctx.stroke();
    ctx.fillStyle = "#e8743b";
    ctx.beginPath();
    ctx.arc(x + bw * 0.42, y - bh * 0.86, 4 * scale, 0, Math.PI * 2);
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

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(20,40,20,0.18)");
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
    if (state.phase === "intro") return;
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
    state.phase = "collecting";
    state.day = 1;
    spawnDay(1);
  }

  $start.addEventListener("click", startGame);

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
