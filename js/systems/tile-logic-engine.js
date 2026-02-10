                                                if (y > 0) scheduleLogic(idx(x, y - 1));
                                                if (y + 1 < this.h) scheduleLogic(idx(x, y + 1));
                                            };

                                            const isWire = (id) => id === IDS.WIRE_OFF || id === IDS.WIRE_ON;
                                            const isSwitch = (id) => id === IDS.SWITCH_OFF || id === IDS.SWITCH_ON;
                                            const isSource = (id) => id === IDS.SWITCH_ON;
                                            const isLamp = (id) => id === IDS.LAMP_OFF || id === IDS.LAMP_ON;
                                            const isConductor = (id) => isWire(id) || isSwitch(id);

                                            const canWaterEnterTile = (id) => (id === AIR || id === WATER);

                                            const setTile = (i, newId, changes) => {
                                                const old = tiles[i];
                                                if (old === newId) return false;
                                                tiles[i] = newId;
                                                changes.push(i, old, newId);
                                                const x = (i / this.h) | 0;
                                                const y = i - x * this.h;
                                                scheduleWaterAround(x, y);
                                                scheduleLogicAround(x, y);
                                                return true;
                                            };

                                            const ensureWaterTile = (i, changes) => {
                                                if (water[i] > 0) {
                                                    if (tiles[i] !== WATER) setTile(i, WATER, changes);
                                                } else {
                                                    if (tiles[i] === WATER) setTile(i, AIR, changes);
                                                }
                                            };

                                            const waterTick = (i, changes) => {
                                                waterMark[i] = 0;
                                                if (!inRegionIndex(i)) return;

                                                let a = water[i] | 0;
                                                if (a <= 0) return;

                                                const tid = tiles[i];
                                                if (tid !== WATER && tid !== AIR) { water[i] = 0; return; }

                                                const x = (i / this.h) | 0;
                                                const y = i - x * this.h;

                                                if (y + 1 < this.h) {
                                                    const d = i + 1;
                                                    const dt = tiles[d];
                                                    if (canWaterEnterTile(dt)) {
                                                        const b = water[d] | 0;
                                                        const space = MAX - b;
                                                        if (space > 0) {
                                                            const mv = a < space ? a : space;
                                                            water[i] = a - mv;
                                                            water[d] = b + mv;
                                                            a = water[i] | 0;

                                                            ensureWaterTile(i, changes);
                                                            ensureWaterTile(d, changes);

                                                            scheduleWater(d);
                                                            scheduleWater(i);
                                                            scheduleWaterAround(x, y);
                                                            scheduleWaterAround(x, y + 1);
                                                        }
                                                    }
                                                }

                                                if (a <= 0) return;

                                                const flowSide = (n) => {
                                                    const nt = tiles[n];
                                                    if (!canWaterEnterTile(nt)) return;
                                                    const nb = water[n] | 0;
                                                    const diff = a - nb;
                                                    if (diff <= 1) return;
                                                    let mv = diff >> 1;
                                                    if (mv < 1) mv = 1;
                                                    const space = MAX - nb;
                                                    if (mv > space) mv = space;
                                                    if (mv <= 0) return;

                                                    water[i] = (water[i] | 0) - mv;
                                                    water[n] = nb + mv;
                                                    a = water[i] | 0;

                                                    ensureWaterTile(i, changes);
                                                    ensureWaterTile(n, changes);

                                                    scheduleWater(n);
                                                    scheduleWater(i);
                                                };

                                                if (x > 0) flowSide(i - this.h);
                                                if (x + 1 < this.w) flowSide(i + this.h);
                                            };

                                            // logic BFS bookkeeping
                                            let vis = new Uint32Array(N);
                                            let stamp = 1;

                                            const lampShouldOn = (iLamp) => {
                                                const x = (iLamp / this.h) | 0;
                                                const y = iLamp - x * this.h;
                                                if (x > 0) { const t = tiles[iLamp - this.h]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
                                                if (x + 1 < this.w) { const t = tiles[iLamp + this.h]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
                                                if (y > 0) { const t = tiles[iLamp - 1]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
                                                if (y + 1 < this.h) { const t = tiles[iLamp + 1]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
                                                return false;
                                            };

                                            const updateLampAt = (iLamp, changes) => {
                                                const t = tiles[iLamp];
                                                if (!isLamp(t)) return;
                                                const want = lampShouldOn(iLamp) ? IDS.LAMP_ON : IDS.LAMP_OFF;
                                                if (t !== want) setTile(iLamp, want, changes);
                                            };

                                            const logicRecomputeFromSeed = (seed, changes) => {
                                                logicMark[seed] = 0;

                                                stamp = (stamp + 1) >>> 0;
                                                if (stamp === 0) { stamp = 1; vis.fill(0); }

                                                const starts = [];
                                                const sid = tiles[seed];
                                                if (isConductor(sid)) starts.push(seed);
                                                else {
                                                    const x = (seed / this.h) | 0;
                                                    const y = seed - x * this.h;
                                                    if (x > 0) { const n = seed - this.h; if (isConductor(tiles[n])) starts.push(n); }
                                                    if (x + 1 < this.w) { const n = seed + this.h; if (isConductor(tiles[n])) starts.push(n); }
                                                    if (y > 0) { const n = seed - 1; if (isConductor(tiles[n])) starts.push(n); }
                                                    if (y + 1 < this.h) { const n = seed + 1; if (isConductor(tiles[n])) starts.push(n); }
                                                    if (isLamp(sid)) updateLampAt(seed, changes);
                                                }
                                                if (!starts.length) return;

                                                const q = [];
                                                const comp = [];
                                                let powered = false;

                                                for (let si = 0; si < starts.length; si++) {
                                                    const s = starts[si];
                                                    if (vis[s] === stamp) continue;
                                                    vis[s] = stamp;
                                                    q.push(s);

                                                    while (q.length) {
                                                        const i = q.pop();
                                                        const t = tiles[i];
                                                        if (!isConductor(t)) continue;

                                                        comp.push(i);
                                                        if (isSource(t)) powered = true;

                                                        const x = (i / this.h) | 0;
                                                        const y = i - x * this.h;

                                                        if (x > 0) { const n = i - this.h; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }
                                                        if (x + 1 < this.w) { const n = i + this.h; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }
                                                        if (y > 0) { const n = i - 1; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }
                                                        if (y + 1 < this.h) { const n = i + 1; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }

                                                        if (comp.length > 12000) break;
                                                    }
                                                    if (comp.length > 12000) break;
                                                }

                                                const wantWire = powered ? IDS.WIRE_ON : IDS.WIRE_OFF;

                                                for (let i = 0; i < comp.length; i++) {
                                                    const p = comp[i];
                                                    const t = tiles[p];
                                                    if (isWire(t) && t !== wantWire) setTile(p, wantWire, changes);
                                                }

                                                for (let i = 0; i < comp.length; i++) {
                                                    const p = comp[i];
                                                    const x = (p / this.h) | 0;
                                                    const y = p - x * this.h;
                                                    if (x > 0) updateLampAt(p - this.h, changes);
                                                    if (x + 1 < this.w) updateLampAt(p + this.h, changes);
                                                    if (y > 0) updateLampAt(p - 1, changes);
                                                    if (y + 1 < this.h) updateLampAt(p + 1, changes);
                                                }
                                            };

                                            const primeRegion = () => {
                                                if (!region.set) return;
                                                for (let x = region.x0; x <= region.x1; x++) {
                                                    const base = x * this.h;
                                                    for (let y = region.y0; y <= region.y1; y++) {
                                                        const i = base + y;
                                                        if (water[i] > 0) scheduleWater(i);
                                                        const t = tiles[i];
                                                        if (t === IDS.SWITCH_ON || isWire(t) || isLamp(t)) scheduleLogic(i);
                                                    }
                                                }
                                            };

                                            // store fallback state
                                            this._idle = {
                                                tiles, water, waterMark, waterQ,
                                                logicMark, logicQ,
                                                region,
                                                idx, scheduleWaterAround, scheduleLogicAround,
                                                setTile, primeRegion,
                                                waterTick, logicRecomputeFromSeed,
                                                perfLevel: 'high',
                                                WATER, AIR
                                            };

                                            const step = (deadline) => {
                                                if (!this._enabled || !this._idle) return;

                                                const st = this._idle;
                                                const changes = [];

                                                const waterBudget = (st.perfLevel === 'low') ? 220 : 520;
                                                const logicBudget = 1;

                                                let ops = 0;
                                                while (ops < waterBudget && st.waterQ.length && (deadline.timeRemaining() > 1 || deadline.didTimeout)) {
                                                    const i = st.waterQ.pop();
                                                    st.waterTick(i, changes);
                                                    ops++;
                                                }

                                                let lops = 0;
                                                while (lops < logicBudget && st.logicQ.length && (deadline.timeRemaining() > 1 || deadline.didTimeout)) {
                                                    const i = st.logicQ.pop();
                                                    st.logicRecomputeFromSeed(i, changes);
                                                    lops++;
                                                }

                                                if (changes.length) {
                                                    this.pending.push({ arr: new Int32Array(changes), pos: 0 });
                                                    this._scheduleApply();
                                                }

                                                ric(step, { timeout: 50 });
                                            };

                                            ric(step, { timeout: 50 });
                                        }

                                        notifyTileWrite(x, y, newId) {
                                            if (!this._enabled) return;

                                            if (this.worker) {
                                                try { this.worker.postMessage({ type: 'tileWrite', x: x | 0, y: y | 0, id: newId | 0 }); } catch { }
                                                return;
                                            }

                                            if (!this._idle) return;
                                            const st = this._idle;

                                            const idx = (x | 0) * this.h + (y | 0);
                                            const old = st.tiles[idx];
                                            st.tiles[idx] = newId | 0;

                                            if (newId === st.WATER) st.water[idx] = 8;
                                            if (old === st.WATER && newId !== st.WATER) st.water[idx] = 0;

                                            st.scheduleWaterAround(x, y);
                                            st.scheduleLogicAround(x, y);
                                        }

                                        onFrame(dt) {
                                            // 防御性参数检查
                                            if (typeof dt !== 'number' || dt < 0) {
                                                console.warn(`[TileLogicEngine.onFrame] Invalid dt: ${dt}`);
                                                dt = 16.67;
                                            }

                                            if (!this._enabled) return;

                                            // 防御性：检查game和world
                                            if (!this.game || !this.game.world) {
                                                console.warn('[TileLogicEngine.onFrame] Game/World not available');
                                                return;
                                            }

                                            const now = performance.now();

                                            if (this.worker) {
                                                if (now - this._lastRegionSent > 250) {
                                                    this._lastRegionSent = now;
                                                    try {
                                                        const px = (this.game.player.x / CFG.TILE_SIZE) | 0;
                                                        const py = (this.game.player.y / CFG.TILE_SIZE) | 0;
                                                        this.worker.postMessage({ type: 'region', cx: px, cy: py, rx: 60, ry: 45 });
                                                    } catch { }
                                                }

                                                const lvl = (this.game._perf && this.game._perf.level) ? this.game._perf.level : 'high';
                                                if (lvl !== this._lastPerfSent) {
                                                    this._lastPerfSent = lvl;
                                                    try { this.worker.postMessage({ type: 'perf', level: lvl }); } catch { }
                                                }
                                                return;
                                            }

                                            // idle fallback: update region & perf
                                            if (this._idle && (now - this._lastRegionSent > 350)) {
                                                this._lastRegionSent = now;
                                                const st = this._idle;

                                                const px = (this.game.player.x / CFG.TILE_SIZE) | 0;
                                                const py = (this.game.player.y / CFG.TILE_SIZE) | 0;
                                                const rx = 60, ry = 45;

                                                const x0 = Math.max(0, px - rx);
                                                const x1 = Math.min(this.w - 1, px + rx);
                                                const y0 = Math.max(0, py - ry);
                                                const y1 = Math.min(this.h - 1, py + ry);

                                                const key = x0 + ',' + y0 + ',' + x1 + ',' + y1;
                                                if (key !== st.region.key) {
                                                    st.region.key = key;
                                                    st.region.x0 = x0; st.region.x1 = x1; st.region.y0 = y0; st.region.y1 = y1; st.region.set = true;
                                                    st.primeRegion();
                                                } else {
                                                    st.region.set = true;
                                                }

                                                const lvl = (this.game._perf && this.game._perf.level) ? this.game._perf.level : 'high';
                                                st.perfLevel = lvl;
                                            }
                                        }

                                        _scheduleApply() {
                                            if (this._applyScheduled) return;
                                            this._applyScheduled = true;
                                            ric((deadline) => this._applyPending(deadline), { timeout: 50 });
                                        }

                                        _applyPending(deadline) {
                                            // 防御性参数检查
                                            if (!deadline) {
                                                console.warn('[TileLogicEngine._applyPending] No deadline provided');
                                                deadline = { timeRemaining: () => 16, didTimeout: false };
                                            }

                                            this._applyScheduled = false;
                                            if (!this.pending || !this.pending.length) return;

                                            // 防御性：检查game和world
                                            if (!this.game || !this.game.world) {
                                                console.warn('[TileLogicEngine._applyPending] Game/World not available');
                                                return;
                                            }

                                            const game = this.game;
                                            const world = this.world;
                                            const renderer = game && game.renderer;

                                            let any = false;
                                            let lightSeeds = [];
                                            const maxLightSeeds = 16;

                                            const maxOps = 1600;
                                            let ops = 0;

                                            while (this.pending.length && (deadline.timeRemaining() > 2 || deadline.didTimeout) && ops < maxOps) {
                                                const cur = this.pending[0];
                                                const arr = cur.arr;

                                                while (cur.pos < arr.length && ops < maxOps) {
                                                    const idx = arr[cur.pos++];
                                                    const expectOld = arr[cur.pos++];
                                                    const newId = arr[cur.pos++];

                                                    const x = (idx / this.h) | 0;
                                                    const y = idx - x * this.h;
                                                    if (x < 0 || y < 0 || x >= this.w || y >= this.h) { ops++; continue; }

                                                    const col = world.tiles[x];
                                                    const oldMain = col[y];
                                                    if (oldMain !== expectOld) { ops++; continue; } // stale -> ignore

                                                    col[y] = newId;
                                                    any = true;

                                                    try { renderer && renderer.invalidateTile && renderer.invalidateTile(x, y); } catch { }

                                                    if (BL) {
                                                        const blOld = BL[expectOld] | 0;
                                                        const blNew = BL[newId] | 0;
                                                        if (blOld !== blNew && lightSeeds.length < maxLightSeeds) lightSeeds.push([x, y]);
                                                    }

                                                    this._minimapDirty = true;

                                                    ops++;
                                                }

                                                if (cur.pos >= arr.length) this.pending.shift();
                                                else break;
                                            }

                                            if (any) {
                                                if (lightSeeds.length && game && game._deferLightUpdate) {
                                                    for (let i = 0; i < lightSeeds.length; i++) {
                                                        const p = lightSeeds[i];
                                                        try { game._deferLightUpdate(p[0], p[1]); } catch { }
                                                    }
                                                }

                                                const now = performance.now();
                                                if (this._minimapDirty && (now - this._lastMinimapFlush > 600)) {
                                                    this._minimapDirty = false;
                                                    this._lastMinimapFlush = now;
                                                    try { game._deferMinimapUpdate && game._deferMinimapUpdate(); } catch { }
                                                }
                                            }

                                            if (this.pending.length) this._scheduleApply();
                                        }

                                        static _workerSource() {
                                            return `/* TileLogic Worker v12 */
(() => {
  let W = 0, H = 0;
  let tiles = null;
  let water = null;
  let solid = null;

  let AIR = 0, WATER = 27;
  let IDS = null;

  const region = { x0: 0, y0: 0, x1: -1, y1: -1, set: false };
  let lastRegionKey = '';
  let perfLevel = 'high';
  const MAX = 8;

  const waterQ = [];
  let waterMark = null;
  const logicQ = [];
  let logicMark = null;
function scheduleLogic(i) {
    if (!logicMark) return;
    if (!inRegionIndex(i)) return;
    if (logicMark[i]) return;
    logicMark[i] = 1;
    logicQ.push(i);
  }

  function scheduleLogicAround(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    scheduleLogic(idx(x, y));
    if (x > 0) scheduleLogic(idx(x - 1, y));
    if (x + 1 < W) scheduleLogic(idx(x + 1, y));
    if (y > 0) scheduleLogic(idx(x, y - 1));
    if (y + 1 < H) scheduleLogic(idx(x, y + 1));
  }

  function setTile(i, newId, changes) {
    const old = tiles[i];
    if (old === newId) return false;
    tiles[i] = newId;
    changes.push(i, old, newId);
    const x = (i / H) | 0;
    const y = i - x * H;
    scheduleWaterAround(x, y);
    scheduleLogicAround(x, y);
    return true;
  }

  function ensureWaterTile(i, changes) {
    if (water[i] > 0) {
      if (tiles[i] !== WATER) setTile(i, WATER, changes);
    } else {
      if (tiles[i] === WATER) setTile(i, AIR, changes);
    }
  }

  function waterTick(i, changes) {
    waterMark[i] = 0;
    if (!inRegionIndex(i)) return;

    let a = water[i] | 0;
    if (a <= 0) return;

    const tid = tiles[i];
    if (tid !== WATER && tid !== AIR) { water[i] = 0; return; }

    const x = (i / H) | 0;
    const y = i - x * H;

    if (y + 1 < H) {
      const d = i + 1;
      const dt = tiles[d];
      if (canWaterEnterTile(dt)) {
        const b = water[d] | 0;
        const space = MAX - b;
        if (space > 0) {
          const mv = a < space ? a : space;
          water[i] = a - mv;
          water[d] = b + mv;
          a = water[i] | 0;

          ensureWaterTile(i, changes);
          ensureWaterTile(d, changes);

          scheduleWater(d);
          scheduleWater(i);
          scheduleWaterAround(x, y);
          scheduleWaterAround(x, y + 1);
        }
      }
    }

    if (a <= 0) return;

    function flowSide(n) {
      const nt = tiles[n];
      if (!canWaterEnterTile(nt)) return;
      const nb = water[n] | 0;
      const diff = a - nb;
      if (diff <= 1) return;
      let mv = diff >> 1;
      if (mv < 1) mv = 1;
      const space = MAX - nb;
      if (mv > space) mv = space;
      if (mv <= 0) return;

      water[i] = (water[i] | 0) - mv;
      water[n] = nb + mv;
      a = water[i] | 0;

      ensureWaterTile(i, changes);
      ensureWaterTile(n, changes);

      scheduleWater(n);
      scheduleWater(i);
    }

    if (x > 0) flowSide(i - H);
    if (x + 1 < W) flowSide(i + H);
  }

  let vis = null;
  let stamp = 1;
  function ensureVis() {
    const N = W * H;
    if (!vis || vis.length !== N) vis = new Uint32Array(N);
  }

  function lampShouldOn(iLamp) {
    const x = (iLamp / H) | 0;
    const y = iLamp - x * H;
    if (x > 0) { const t = tiles[iLamp - H]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
    if (x + 1 < W) { const t = tiles[iLamp + H]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
    if (y > 0) { const t = tiles[iLamp - 1]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
    if (y + 1 < H) { const t = tiles[iLamp + 1]; if (t === IDS.WIRE_ON || t === IDS.SWITCH_ON) return true; }
    return false;
  }

  function updateLampAt(iLamp, changes) {
    const t = tiles[iLamp];
    if (!(t === IDS.LAMP_OFF || t === IDS.LAMP_ON)) return;
    const want = lampShouldOn(iLamp) ? IDS.LAMP_ON : IDS.LAMP_OFF;
    if (t !== want) setTile(iLamp, want, changes);
  }

  function logicRecomputeFromSeed(seed, changes) {
    logicMark[seed] = 0;

    ensureVis();
    stamp = (stamp + 1) >>> 0;
    if (stamp === 0) { stamp = 1; vis.fill(0); }

    const starts = [];
    const sid = tiles[seed];
    if (isConductor(sid)) starts.push(seed);
    else {
      const x = (seed / H) | 0;
      const y = seed - x * H;
      if (x > 0) { const n = seed - H; if (isConductor(tiles[n])) starts.push(n); }
      if (x + 1 < W) { const n = seed + H; if (isConductor(tiles[n])) starts.push(n); }
      if (y > 0) { const n = seed - 1; if (isConductor(tiles[n])) starts.push(n); }
      if (y + 1 < H) { const n = seed + 1; if (isConductor(tiles[n])) starts.push(n); }
      if (isLamp(sid)) updateLampAt(seed, changes);
    }
    if (!starts.length) return;

    const q = [];
    const comp = [];
    let powered = false;

    for (let si = 0; si < starts.length; si++) {
      const s = starts[si];
      if (vis[s] === stamp) continue;
      vis[s] = stamp;
      q.push(s);

      while (q.length) {
        const i = q.pop();
        const t = tiles[i];
        if (!isConductor(t)) continue;

        comp.push(i);
        if (isSource(t)) powered = true;

        const x = (i / H) | 0;
        const y = i - x * H;

        if (x > 0) { const n = i - H; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }
        if (x + 1 < W) { const n = i + H; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }
        if (y > 0) { const n = i - 1; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }
        if (y + 1 < H) { const n = i + 1; if (vis[n] !== stamp && isConductor(tiles[n])) { vis[n] = stamp; q.push(n); } }

        if (comp.length > 12000) break;
      }
      if (comp.length > 12000) break;
    }

    const wantWire = powered ? IDS.WIRE_ON : IDS.WIRE_OFF;
    for (let i = 0; i < comp.length; i++) {
      const p = comp[i];
      const t = tiles[p];
      if (isWire(t) && t !== wantWire) setTile(p, wantWire, changes);
    }

    for (let i = 0; i < comp.length; i++) {
      const p = comp[i];
      const x = (p / H) | 0;
      const y = p - x * H;
      if (x > 0) updateLampAt(p - H, changes);
      if (x + 1 < W) updateLampAt(p + H, changes);
      if (y > 0) updateLampAt(p - 1, changes);
      if (y + 1 < H) updateLampAt(p + 1, changes);
    }
  }

  function primeRegionWork() {
    if (!region.set) return;
    for (let x = region.x0; x <= region.x1; x++) {
      const base = x * H;
      for (let y = region.y0; y <= region.y1; y++) {
        const i = base + y;
        if (water[i] > 0) scheduleWater(i);
        const t = tiles[i];
        if (t === IDS.SWITCH_ON || isWire(t) || isLamp(t)) scheduleLogic(i);
      }
    }
  }

  function step() {
    const changes = [];

    const waterBudget = (perfLevel === 'low') ? 350 : 900;
    for (let ops = 0; ops < waterBudget && waterQ.length; ops++) {
      waterTick(waterQ.pop(), changes);
    }

    const logicBudget = 1;
    for (let ops = 0; ops < logicBudget && logicQ.length; ops++) {
      logicRecomputeFromSeed(logicQ.pop(), changes);
    }

    if (changes.length) {
      const buf = new Int32Array(changes);
      postMessage({ type: 'changes', buf: buf.buffer }, [buf.buffer]);
    }

    const tickMs = (perfLevel === 'low') ? 55 : 35;
    setTimeout(step, tickMs);
  }

  onmessage = (e) => {
    const m = e.data;
    if (!m || !m.type) return;

    switch (m.type) {
      case 'init': {
        W = m.w | 0;
        H = m.h | 0;
        IDS = m.ids;
        AIR = (m.blocks && (m.blocks.AIR | 0) >= 0) ? (m.blocks.AIR | 0) : 0;
        WATER = (m.blocks && (m.blocks.WATER | 0) >= 0) ? (m.blocks.WATER | 0) : 27;

        tiles = new Uint8Array(m.tiles);
        solid = new Uint8Array(m.solid);

        const N = W * H;
        water = new Uint8Array(N);
        waterMark = new Uint8Array(N);
        logicMark = new Uint8Array(N);
        ensureVis();

        for (let i = 0; i < N; i++) if (tiles[i] === WATER) water[i] = MAX;

        step();
        break;
      }

      case 'tileWrite': {
        if (!tiles) return;
        const x = m.x | 0;
        const y = m.y | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) return;

        const i = idx(x, y);
        const newId = m.id | 0;
        const oldId = tiles[i];
        tiles[i] = newId;

        if (newId === WATER) {
          water[i] = MAX;
          scheduleWaterAround(x, y);
        } else if (oldId === WATER && newId !== WATER) {
          water[i] = 0;
          scheduleWaterAround(x, y);
        }

        scheduleLogicAround(x, y);
        break;
      }

      case 'region': {
        const cx = m.cx | 0, cy = m.cy | 0;
        const rx = m.rx | 0, ry = m.ry | 0;

        const x0 = Math.max(0, cx - rx);
        const x1 = Math.min(W - 1, cx + rx);
        const y0 = Math.max(0, cy - ry);
        const y1 = Math.min(H - 1, cy + ry);

        const key = x0 + ',' + y0 + ',' + x1 + ',' + y1;
        if (key !== lastRegionKey) {
          lastRegionKey = key;
          region.x0 = x0; region.x1 = x1; region.y0 = y0; region.y1 = y1; region.set = true;
          primeRegionWork();
        } else {
          region.set = true;
        }
        break;
      }

      case 'perf': {
        perfLevel = m.level || 'high';
        break;
      }
      default: {
        console.warn('[Worker] Unknown message type: ' + m.type);
        break;
      }
    }
  };
})();`;
                                        }
                                    }

                                    TU.TileLogicEngine = TileLogicEngine;

                                    // ─────────────────────────────────────────────────────────────
                                    // 6) Hook into game lifecycle + markTile
                                    // ─────────────────────────────────────────────────────────────
                                    function attachToGame(game) {
                                        if (!game || !game.world || !game.player) return;
                                        if (game.tileLogic) return;

                                        try {
                                            game.tileLogic = new TileLogicEngine(game);
                                        } catch (e) {
                                            console.warn('TileLogicEngine attach failed', e);
                                            return;
                                        }

                                        // starter items (idempotent)
                                        try {
                                            const inv = game.player.inventory;
                                            if (!inv || !inv.push) return;
                                            const has = (id) => inv.some(it => it && it.id === id);
                                            if (!has(IDS.WIRE_OFF)) inv.push({ id: IDS.WIRE_OFF, name: '逻辑线', count: 48 });
                                            if (!has(IDS.SWITCH_OFF)) inv.push({ id: IDS.SWITCH_OFF, name: '开关', count: 6 });
                                            if (!has(IDS.LAMP_OFF)) inv.push({ id: IDS.LAMP_OFF, name: '逻辑灯', count: 12 });
                                            game._deferHotbarUpdate && game._deferHotbarUpdate();
                                        } catch { }
                                    }

                                    // Patch Game.init + Game.update
                                    try {
                                        const GameClass = (typeof Game !== 'undefined') ? Game : (TU.Game || null);
                                        if (GameClass && GameClass.prototype && !GameClass.prototype.__logicV12InitPatched) {
                                            GameClass.prototype.__logicV12InitPatched = true;

                                            const _init = GameClass.prototype.init;
                                            GameClass.prototype.init = async function () {
                                                await _init.call(this);
                                                try { attachToGame(this); } catch { }
                                            };

                                            const _update = GameClass.prototype.update;
                                            GameClass.prototype.update = function (dt) {
                                                const r = _update.call(this, dt);
                                                try { this.tileLogic && this.tileLogic.onFrame && this.tileLogic.onFrame(dt); } catch { }
                                                return r;
