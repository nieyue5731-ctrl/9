                                                                var c3 = c1 + 1;
                                                                return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
                                                            }

                                                            // update：优先处理 pickup 动画
                                                            if (typeof DroppedItem.prototype.update === 'function') {
                                                                var _oldUpdate = DroppedItem.prototype.update;
                                                                DroppedItem.prototype.update = function (world, player, dt) {
                                                                    if (this._pickup && player) {
                                                                        var p = this._pickup;
                                                                        p.t += dt;

                                                                        var tt = p.t / p.dur;
                                                                        if (tt < 0) tt = 0;
                                                                        if (tt > 1) tt = 1;

                                                                        var e = easeOutBack(tt);

                                                                        var tx = (typeof player.cx === 'function') ? (player.cx() - this.w / 2) : (player.x - this.w / 2);
                                                                        var ty = (typeof player.cy === 'function') ? (player.cy() - this.h / 2) : (player.y - this.h / 2);

                                                                        var r = (1 - tt) * 18;
                                                                        var ang = p.phase + tt * Math.PI * 2.4;
                                                                        var ox = Math.cos(ang) * r;
                                                                        var oy = Math.sin(ang) * r * 0.6;

                                                                        this.x = p.sx + (tx - p.sx) * e + ox;
                                                                        this.y = p.sy + (ty - p.sy) * e + oy;

                                                                        this.rotation = tt * 0.6;

                                                                        this._pickupAlpha = 1 - tt;
                                                                        this._pickupScale = 1 - tt * 0.55;

                                                                        if (tt >= 1) return false;
                                                                        return true;
                                                                    }

                                                                    return _oldUpdate.call(this, world, player, dt);
                                                                };
                                                            }
                                                        }

                                                        if (!DroppedItemManager.prototype.__pickupAnimSafeV2MgrInstalled) {
                                                            DroppedItemManager.prototype.__pickupAnimSafeV2MgrInstalled = true;

                                                            // update：拾取时先触发 callback，再播放动画，动画结束后自然回收
                                                            if (typeof DroppedItemManager.prototype.update === 'function') {
                                                                var _oldMgrUpdate = DroppedItemManager.prototype.update;
                                                                DroppedItemManager.prototype.update = function (world, player, dt, addToInventoryCallback) {
                                                                    // 反向遍历，删除只做“置空”，保持原来的 _start/_holes 压缩策略
                                                                    for (var i = this.items.length - 1; i >= this._start; i--) {
                                                                        var item = this.items[i];
                                                                        if (!item) continue;

                                                                        var alive = item.update(world, player, dt);
                                                                        if (!alive) {
                                                                            this._release(item);
                                                                            this.items[i] = null;
                                                                            this._holes++;
                                                                            continue;
                                                                        }

                                                                        // 检测拾取（动画期间 canPickup 会返回 false）
                                                                        if (item.canPickup && item.canPickup(player)) {
                                                                            var picked = true;
                                                                            try { picked = addToInventoryCallback ? addToInventoryCallback(item.blockId, item.count) : true; } catch (_) { picked = true; }
                                                                            if (picked) {
                                                                                if (typeof item.startPickup === 'function') {
                                                                                    item.startPickup(player);
                                                                                } else {
                                                                                    // 兜底：没有动画函数就直接移除
                                                                                    this._release(item);
                                                                                    this.items[i] = null;
                                                                                    this._holes++;
                                                                                }
                                                                            }
                                                                        }
                                                                    }

                                                                    // 推进头指针（跳过前面的空洞）
                                                                    while (this._start < this.items.length && !this.items[this._start]) {
                                                                        this._start++;
                                                                        this._holes = Math.max(0, this._holes - 1);
                                                                    }

                                                                    // 需要时压缩，避免空洞过多导致遍历成本上升
                                                                    this._maybeCompact(false);
                                                                };
                                                            }

                                                            // render：拾取动画期间应用缩放/透明度，同时保留原“快消失闪烁 + 数量显示 + 发光”
                                                            if (typeof DroppedItemManager.prototype.render === 'function') {
                                                                var _oldMgrRender = DroppedItemManager.prototype.render;
                                                                DroppedItemManager.prototype.render = function (ctx, cam, textures, timeOfDay) {
                                                                    // 复制原渲染主干，增加 _pickupAlpha/_pickupScale
                                                                    var ts = CONFIG.TILE_SIZE;
                                                                    var now = (performance && performance.now) ? performance.now() : Date.now();
                                                                    var blinkPhase = Math.floor(now / 200) % 2;

                                                                    for (var i = this._start; i < this.items.length; i++) {
                                                                        var item = this.items[i];
                                                                        if (!item) continue;

                                                                        var sx = item.x - cam.x;
                                                                        var sy = item.y - cam.y;

                                                                        // 浮动效果（拾取动画中关闭 bob）
                                                                        var bob = item._pickup ? 0 : (Math.sin(now * 0.005 + item.bobOffset) * 3);

                                                                        // 闪烁效果（快消失时）
                                                                        if (!item._pickup && item.age > item.maxAge - 5000 && blinkPhase === 0) {
                                                                            continue;
                                                                        }

                                                                        var alpha = (typeof item._pickupAlpha === 'number') ? item._pickupAlpha : 1;
                                                                        var scale = (typeof item._pickupScale === 'number') ? item._pickupScale : 1;

                                                                        ctx.save();
                                                                        ctx.globalAlpha *= alpha;
                                                                        ctx.translate(sx + item.w / 2, sy + item.h / 2 + bob);
                                                                        ctx.rotate(item.rotation || 0);
                                                                        ctx.scale(scale, scale);

                                                                        // 发光效果（用查表避免每帧对象查找）
                                                                        var lightLv = BL ? (BL[item.blockId] | 0) : 0;
                                                                        if (lightLv > 0) {
                                                                            ctx.shadowColor = (BC && BC[item.blockId]) ? BC[item.blockId] : '#fff';
                                                                            ctx.shadowBlur = 15;
                                                                        } else {
                                                                            ctx.shadowColor = '#ffeaa7';
                                                                            ctx.shadowBlur = 8;
                                                                        }

                                                                        // 绘制物品
                                                                        var tex = textures && textures.get ? textures.get(item.blockId) : null;
                                                                        if (tex) {
                                                                            ctx.drawImage(tex, -item.w / 2, -item.h / 2, item.w, item.h);
                                                                        } else {
                                                                            // 后备渲染
                                                                            ctx.fillStyle = (BC && BC[item.blockId]) ? BC[item.blockId] : '#fff';
                                                                            ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
                                                                        }

                                                                        ctx.shadowBlur = 0;

                                                                        // 显示数量（如果大于1）
                                                                        if (item.count > 1) {
                                                                            ctx.fillStyle = '#ffeaa7';
                                                                            ctx.font = 'bold 8px Arial';
                                                                            ctx.textAlign = 'right';
                                                                            ctx.fillText(String(item.count), item.w / 2, item.h / 2);
                                                                        }

                                                                        ctx.restore();
                                                                    }
                                                                };
                                                            }
                                                        }
                                                    }
                                                })();
                                            }
                                        }); try { __p && __p.apply && __p.apply(); } catch (e) { console.warn('[TU merge] patch apply failed', __p && __p.id, e); }
                                    })();
                                })();
                            

                            <!-- ========================= PATCH: patch/script_35 ========================= -->
                            
                                /* =====================================================================
                                   v12: TileLogic Refactor (UpdateTick observer pattern) + Fluids + Logic
                                   - Water "pressure-ish" flow (down + side equalization)
                                   - Redstone-like power propagation (wire/switch/lamp)
                                   - Logic runs in Web Worker; main thread applies diffs in requestIdleCallback
                                   - If Worker is unavailable/blocked, falls back to requestIdleCallback simulation
                                ===================================================================== */
                                (() => {
                                    const TU = window.TU || (window.TU = {});
                                    if (TU.__tileLogicV12) return;
                                    TU.__tileLogicV12 = true;

                                    const CFG = (typeof CONFIG !== 'undefined') ? CONFIG : (TU.CONFIG || { TILE_SIZE: 16, REACH_DISTANCE: 6 });
                                    const B = (typeof BLOCK !== 'undefined') ? BLOCK : (TU.BLOCK || {});
                                    const BD = (typeof BLOCK_DATA !== 'undefined') ? BLOCK_DATA : (TU.BLOCK_DATA || {});
                                    const SOLID = (typeof BLOCK_SOLID !== 'undefined') ? BLOCK_SOLID : (TU.BLOCK_SOLID || new Uint8Array(256));
                                    const LIQ = (typeof BLOCK_LIQUID !== 'undefined') ? BLOCK_LIQUID : (TU.BLOCK_LIQUID || new Uint8Array(256));
                                    const TRANSP = (typeof BLOCK_TRANSPARENT !== 'undefined') ? BLOCK_TRANSPARENT : (TU.BLOCK_TRANSPARENT || new Uint8Array(256));
                                    const WALK = (typeof BLOCK_WALKABLE !== 'undefined') ? BLOCK_WALKABLE : (TU.BLOCK_WALKABLE || new Uint8Array(256));
                                    const BL = (typeof BLOCK_LIGHT !== 'undefined') ? BLOCK_LIGHT : null;
                                    const BH = (typeof BLOCK_HARDNESS !== 'undefined') ? BLOCK_HARDNESS : null;
                                    const BC = (typeof BLOCK_COLOR !== 'undefined') ? BLOCK_COLOR : null;
                                    const BCP = (typeof BLOCK_COLOR_PACKED !== 'undefined') ? BLOCK_COLOR_PACKED : null;
                                    const SD = (typeof SUN_DECAY !== 'undefined') ? SUN_DECAY : null;

                                    const IDS = {
                                        WIRE_OFF: 200,
                                        WIRE_ON: 201,
                                        SWITCH_OFF: 202,
                                        SWITCH_ON: 203,
                                        LAMP_OFF: 204,
                                        LAMP_ON: 205
                                    };
                                    TU.LOGIC_BLOCKS = IDS;

                                    // ─────────────────────────────────────────────────────────────
                                    // 1) Register new blocks into BLOCK_DATA + lookup tables
                                    // ─────────────────────────────────────────────────────────────
                                    function _hexToPacked(c) {
                                        try {
                                            if (typeof c === 'string' && c.length === 7 && c[0] === '#') {
                                                const r = parseInt(c.slice(1, 3), 16) | 0;
                                                const g = parseInt(c.slice(3, 5), 16) | 0;
                                                const b = parseInt(c.slice(5, 7), 16) | 0;
                                                return ((r << 16) | (g << 8) | b) >>> 0;
                                            }
                                        } catch { }
                                        return ((240 << 16) | (15 << 8) | 0) >>> 0;
                                    }

                                    function addBlock(id, def) {
                                        BD[id] = def;
                                        try { SOLID[id] = def.solid ? 1 : 0; } catch { }
                                        try { TRANSP[id] = def.transparent ? 1 : 0; } catch { }
                                        try { LIQ[id] = def.liquid ? 1 : 0; } catch { }
                                        try { if (BL) BL[id] = def.light ? (def.light | 0) : 0; } catch { }
                                        try { if (BH) BH[id] = def.hardness ? +def.hardness : 0; } catch { }
                                        try { if (BC) BC[id] = def.color; } catch { }
                                        try {
                                            if (SD) {
                                                const AIR = (B && B.AIR !== undefined) ? B.AIR : 0;
                                                let v = 0;
                                                if (def.solid && !def.transparent) v = 3;
                                                else if (def.transparent && id !== AIR) v = 1;
                                                SD[id] = v;
                                            }
                                        } catch { }
                                        try { if (BCP) BCP[id] = _hexToPacked(def.color); } catch { }
                                        try { if (WALK) WALK[id] = def.solid ? 0 : 1; } catch { }
                                    }

                                    function ensureBlocks() {
                                        if (BD[IDS.WIRE_OFF]) return; // already added
                                        addBlock(IDS.WIRE_OFF, { name: '逻辑线', solid: false, transparent: true, liquid: false, light: 0, hardness: 0.2, color: '#7f1d1d' });
                                        addBlock(IDS.WIRE_ON, { name: '逻辑线(通电)', solid: false, transparent: true, liquid: false, light: 0, hardness: 0.2, color: '#ff4d4d' });
                                        addBlock(IDS.SWITCH_OFF, { name: '开关', solid: false, transparent: true, liquid: false, light: 0, hardness: 0.4, color: '#8b5e3c' });
                                        addBlock(IDS.SWITCH_ON, { name: '开关(开启)', solid: false, transparent: true, liquid: false, light: 0, hardness: 0.4, color: '#d4a373' });

                                        // LAMP_ON: light>5 会进入 glow 绘制路径；数量通常不大。想更省就把 light <= 5。
                                        addBlock(IDS.LAMP_OFF, { name: '逻辑灯', solid: true, transparent: false, liquid: false, light: 0, hardness: 1.0, color: '#444444' });
                                        addBlock(IDS.LAMP_ON, { name: '逻辑灯(亮)', solid: true, transparent: false, liquid: false, light: 10, hardness: 1.0, color: '#ffe8a3' });
                                    }
                                    try { ensureBlocks(); } catch (e) { console.warn('ensureBlocks failed', e); }

                                    // ─────────────────────────────────────────────────────────────
                                    // 2) TextureGenerator: custom pixel art for logic blocks
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof TextureGenerator !== 'undefined' && TextureGenerator.prototype && !TextureGenerator.prototype.__logicV12Patched) {
                                            TextureGenerator.prototype.__logicV12Patched = true;
                                            const _old = TextureGenerator.prototype._drawPixelArt;

                                            TextureGenerator.prototype._drawPixelArt = function (ctx, id, data) {
                                                const s = (CFG && CFG.TILE_SIZE) ? CFG.TILE_SIZE : 16;

                                                if (id === IDS.WIRE_OFF || id === IDS.WIRE_ON) {
                                                    ctx.clearRect(0, 0, s, s);
                                                    const col = (id === IDS.WIRE_ON) ? '#ff4d4d' : '#7f1d1d';
                                                    ctx.fillStyle = col;
                                                    ctx.fillRect(0, (s / 2) | 0, s, 2);
                                                    ctx.fillRect((s / 2) | 0, 0, 2, s);
                                                    ctx.fillStyle = (id === IDS.WIRE_ON) ? '#ffd6d6' : '#3b0a0a';
                                                    ctx.fillRect(((s / 2) | 0) - 1, ((s / 2) | 0) - 1, 4, 4);
                                                    return;
                                                }

                                                if (id === IDS.SWITCH_OFF || id === IDS.SWITCH_ON) {
                                                    ctx.clearRect(0, 0, s, s);
                                                    ctx.fillStyle = '#5b3a29';
                                                    ctx.fillRect(3, 10, s - 6, 4);
                                                    ctx.fillStyle = '#2b1a12';
                                                    ctx.fillRect(3, 14, s - 6, 1);

                                                    const on = (id === IDS.SWITCH_ON);
                                                    ctx.fillStyle = '#c9a227';
                                                    if (on) {
                                                        ctx.fillRect(9, 4, 2, 8);
                                                        ctx.fillRect(8, 4, 4, 2);
                                                    } else {
                                                        ctx.fillRect(5, 6, 8, 2);
                                                        ctx.fillRect(11, 4, 2, 8);
                                                    }
                                                    ctx.fillStyle = on ? '#ffe08a' : '#d8c9a8';
                                                    ctx.fillRect(on ? 8 : 11, on ? 2 : 11, 4, 4);
                                                    return;
                                                }

                                                if (id === IDS.LAMP_OFF || id === IDS.LAMP_ON) {
                                                    const on = (id === IDS.LAMP_ON);
                                                    ctx.fillStyle = '#2f2f2f';
                                                    ctx.fillRect(0, 0, s, s);
                                                    ctx.fillStyle = '#3a3a3a';
                                                    ctx.fillRect(1, 1, s - 2, s - 2);
                                                    ctx.fillStyle = on ? '#ffe8a3' : '#555555';
                                                    ctx.fillRect(3, 3, s - 6, s - 6);
                                                    ctx.fillStyle = on ? '#fff6d6' : '#777777';
                                                    ctx.fillRect(4, 4, 3, 3);
                                                    ctx.fillStyle = on ? '#d8b54a' : '#333333';
                                                    ctx.fillRect(3, (s / 2) | 0, s - 6, 1);
                                                    ctx.fillRect((s / 2) | 0, 3, 1, s - 6);
                                                    return;
                                                }

                                                return _old.call(this, ctx, id, data);
                                            };
                                        }
                                    } catch (e) {
                                        console.warn('logic textures patch failed', e);
                                    }

                                    // ─────────────────────────────────────────────────────────────
                                    // 3) Recipes + starter items (idempotent)
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof RECIPES !== 'undefined' && RECIPES && !RECIPES.__logicV12Added) {
                                            RECIPES.__logicV12Added = true;
                                            RECIPES.push(
                                                { out: IDS.WIRE_OFF, count: 12, req: [{ id: B.IRON_ORE, count: 1 }], desc: '基础逻辑导线（传导电力）。' },
                                                { out: IDS.SWITCH_OFF, count: 1, req: [{ id: B.WOOD, count: 1 }, { id: IDS.WIRE_OFF, count: 2 }], desc: '开关：对准并“右键 + 镐”切换开/关。' },
                                                { out: IDS.LAMP_OFF, count: 1, req: [{ id: B.GLASS, count: 1 }, { id: IDS.WIRE_OFF, count: 2 }], desc: '逻辑灯：与通电导线相邻时点亮。' }
                                            );
                                        }
                                    } catch { }

                                    // ─────────────────────────────────────────────────────────────
                                    // 4) Drop remap: ON-state drops OFF-state
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof DroppedItemManager !== 'undefined' && DroppedItemManager.prototype && !DroppedItemManager.prototype.__logicV12DropPatch) {
                                            DroppedItemManager.prototype.__logicV12DropPatch = true;
                                            const _spawn = DroppedItemManager.prototype.spawn;
                                            DroppedItemManager.prototype.spawn = function (x, y, blockId, count) {
                                                if (blockId === IDS.WIRE_ON) blockId = IDS.WIRE_OFF;
                                                else if (blockId === IDS.SWITCH_ON) blockId = IDS.SWITCH_OFF;
                                                else if (blockId === IDS.LAMP_ON) blockId = IDS.LAMP_OFF;
                                                return _spawn.call(this, x, y, blockId, count);
                                            };
                                        }
                                    } catch { }

                                    // ─────────────────────────────────────────────────────────────
                                    // 5) TileLogicEngine: Worker-driven + idle apply
                                    // ─────────────────────────────────────────────────────────────
                                    const ric = (typeof requestIdleCallback !== 'undefined')
                                        ? requestIdleCallback.bind(window)
                                        : (cb, opts) => setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), (opts && opts.timeout) ? opts.timeout : 0);

                                    class TileLogicEngine {
                                        constructor(game) {
                                            this.game = game;
                                            this.world = game.world;
                                            this.w = this.world.w | 0;
                                            this.h = this.world.h | 0;

                                            this.worker = null;
                                            this.pending = []; // { arr:Int32Array, pos:number }
                                            this._applyScheduled = false;

                                            this._lastRegionSent = 0;
                                            this._lastPerfSent = '';
                                            this._minimapDirty = false;
                                            this._lastMinimapFlush = 0;
                                            this._enabled = true;

                                            this._idle = null; // fallback state
                                            this._initWorker();
                                        }

                                        _flattenTiles() {
                                            const out = new Uint8Array(this.w * this.h);
                                            for (let x = 0; x < this.w; x++) out.set(this.world.tiles[x], x * this.h);
                                            return out;
                                        }

                                        _initWorker() {
                                            if (typeof Worker === 'undefined') {
                                                console.warn('Worker not available; TileLogicEngine uses idle fallback');
                                                this._initIdleFallback();
                                                return;
                                            }

                                            const code = TileLogicEngine._workerSource();
                                            const blob = new Blob([code], { type: 'text/javascript' });
                                            const url = URL.createObjectURL(blob);

                                            let worker;
                                            try {
                                                worker = new Worker(url);
                                            } catch (e) {
                                                console.warn('Worker blocked; fallback to idle', e);
                                                try { URL.revokeObjectURL(url); } catch { }
                                                this._initIdleFallback();
                                                return;
                                            }

                                            try { URL.revokeObjectURL(url); } catch { }

                                            this.worker = worker;

                                            worker.onmessage = (e) => {
                                                const msg = e.data;
                                                if (!msg || !msg.type) return;
                                                if (msg.type === 'changes' && msg.buf) {
                                                    try {
                                                        const arr = new Int32Array(msg.buf);
                                                        this.pending.push({ arr, pos: 0 });
                                                        this._scheduleApply();
                                                    } catch { }
                                                }
                                            };

                                            worker.onerror = (e) => {
                                                console.warn('TileLogic worker error', e);
                                                try { worker.terminate(); } catch { }
                                                this.worker = null;
                                                this._initIdleFallback();
                                            };

                                            try {
                                                const tilesFlat = this._flattenTiles();
                                                const solidCopy = new Uint8Array(256);
                                                try { solidCopy.set(SOLID); } catch { }
                                                worker.postMessage({
                                                    type: 'init',
                                                    w: this.w,
                                                    h: this.h,
                                                    tiles: tilesFlat.buffer,
                                                    solid: solidCopy.buffer,
                                                    ids: IDS,
                                                    blocks: { AIR: (B && B.AIR !== undefined) ? B.AIR : 0, WATER: (B && B.WATER !== undefined) ? B.WATER : 27 }
                                                }, [tilesFlat.buffer, solidCopy.buffer]);
                                            } catch (e) {
                                                console.warn('TileLogic worker init failed', e);
                                            }
                                        }

                                        _initIdleFallback() {
                                            // Full idle fallback: water + logic, both processed during requestIdleCallback.
                                            const tiles = this._flattenTiles();
                                            const N = tiles.length;

                                            const WATER = (B && B.WATER !== undefined) ? B.WATER : 27;
                                            const AIR = (B && B.AIR !== undefined) ? B.AIR : 0;
                                            const MAX = 8;

                                            const water = new Uint8Array(N);
                                            for (let i = 0; i < N; i++) if (tiles[i] === WATER) water[i] = MAX;

                                            const waterMark = new Uint8Array(N);
                                            const waterQ = [];
                                            const logicMark = new Uint8Array(N);
                                            const logicQ = [];

                                            // Region limiter for main-thread fallback (protect FPS)
                                            const region = { x0: 0, y0: 0, x1: -1, y1: -1, set: false, key: '' };

                                            const inRegionIndex = (i) => {
                                                if (!region.set) return false;
                                                const x = (i / this.h) | 0;
                                                const y = i - x * this.h;
                                                return (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1);
                                            };

                                            const idx = (x, y) => x * this.h + y;

                                            const scheduleWater = (i) => {
                                                if (!inRegionIndex(i)) return;
                                                if (waterMark[i]) return;
                                                waterMark[i] = 1;
                                                waterQ.push(i);
                                            };
                                            const scheduleWaterAround = (x, y) => {
                                                if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
                                                scheduleWater(idx(x, y));
                                                if (x > 0) scheduleWater(idx(x - 1, y));
                                                if (x + 1 < this.w) scheduleWater(idx(x + 1, y));
                                                if (y > 0) scheduleWater(idx(x, y - 1));
                                                if (y + 1 < this.h) scheduleWater(idx(x, y + 1));
                                            };

                                            const scheduleLogic = (i) => {
                                                if (!inRegionIndex(i)) return;
                                                if (logicMark[i]) return;
                                                logicMark[i] = 1;
                                                logicQ.push(i);
                                            };
                                            const scheduleLogicAround = (x, y) => {
                                                if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
                                                scheduleLogic(idx(x, y));
                                                if (x > 0) scheduleLogic(idx(x - 1, y));
                                                if (x + 1 < this.w) scheduleLogic(idx(x + 1, y));
                                                if (y > 0) scheduleLogic(idx(x, y - 1));
