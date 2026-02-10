                const sy = (typeof input.targetY === 'number') ? input.targetY : input.mouseY;

                const safeSX = Number.isFinite(sx) ? sx : (p.cx() - cam.x);
                const safeSY = Number.isFinite(sy) ? sy : (p.cy() - cam.y);

                const worldX = safeSX + cam.x;
                const worldY = safeSY + cam.y;

                let tileX = Math.floor(worldX / ts);
                let tileY = Math.floor(worldY / ts);
                if (this.isMobile && this.settings && this.settings.aimAssist) {
                    tileX = Math.floor((worldX + ts * 0.5) / ts);
                    tileY = Math.floor((worldY + ts * 0.5) / ts);
                }
                const dx = worldX - this.player.cx();
                const dy = worldY - this.player.cy();
                const reachPx = CONFIG.REACH_DISTANCE * CONFIG.TILE_SIZE;
                const inRange = (dx * dx + dy * dy) <= (reachPx * reachPx);

                if (tileX >= 0 && tileX < this.world.w && tileY >= 0 && tileY < this.world.h) {
                    this.renderer.renderHighlight(tileX, tileY, cam, inRange);
                }
                // 后期增强（在所有主体绘制完成后执行）
                if (this.renderer && this.renderer.postProcess) this.renderer.postProcess(this.timeOfDay);
                const minimapVisible = !(window.TU && window.TU.MINIMAP_VISIBLE === false);
                if (this.settings.minimap && minimapVisible) {
                    this.minimap.update();
                    if (this.minimap && typeof this.minimap.render === 'function') this.minimap.render(p.x, p.y);
                    else if (this.minimap && typeof this.minimap.renderPlayer === 'function') this.minimap.renderPlayer(p.x, p.y);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                     启动
        // ═══════════════════════════════════════════════════════════════════════════════

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { Game });

    


                            <!-- ========================= SECTION: Patches & Consolidation Layer ========================= -->

                            <!-- ========================= PATCH: experience_optimized_v2 ========================= -->
                            
                                (() => {
                                    const TU = window.TU || {};
                                    (function () {
                                        const __p = ({
                                            id: 'experience_optimized_v2',
                                            order: 10,
                                            description: "交互/渲染体验优化（v2）",
                                            apply: () => {
                                                const TU = window.TU || {};
                                                const Game = TU.Game;
                                                const Renderer = TU.Renderer;
                                                const TouchController = TU.TouchController;

                                                // ───────────────────── Crosshair UX (移动端默认显示时避免左上角“悬空”) ─────────────────────
                                                try {
                                                    const style = document.createElement('style');
                                                    style.id = 'patch-crosshair-style';
                                                    style.textContent = `
            /* 默认隐藏（用 opacity 控制，不影响布局；兼容原有 display:block 的媒体查询） */
            #crosshair {
              opacity: 0;
              transform: scale(0.9);
              transition: opacity 140ms ease, transform 140ms ease;
            }
            #crosshair.crosshair-active { opacity: 1; transform: scale(1); }
            #crosshair.crosshair-idle { opacity: 0.55; transform: scale(0.95); }
          `;
                                                    document.head.appendChild(style);
                                                } catch { }

                                                // ───────────────────────── Patch TouchController：多指更稳 + 自适应摇杆半径 ─────────────────────────
                                                if (TouchController && TouchController.prototype) {
                                                    TouchController.prototype._init = function () {
                                                        const joystickEl = document.getElementById('joystick');
                                                        const thumbEl = document.getElementById('joystick-thumb');
                                                        const crosshairEl = document.getElementById('crosshair');

                                                        const canvas = this.game && this.game.canvas;

                                                        // 兼容：缺少关键节点则直接返回
                                                        if (!joystickEl || !thumbEl || !canvas) return;

                                                        // 让浏览器知道这里不会滚动（减少一些浏览器的触控延迟）
                                                        try { canvas.style.touchAction = 'none'; } catch { }
                                                        try { joystickEl.style.touchAction = 'none'; } catch { }

                                                        // 十字准星：默认透明，第一次设定目标后才显示
                                                        if (crosshairEl) {
                                                            crosshairEl.classList.remove('crosshair-active', 'crosshair-idle');
                                                        }

                                                        // 安全区（防误触）：根据 UI 实际位置动态计算
                                                        const safeRects = [];
                                                        const expandRect = (r, m) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m });
                                                        const hitRect = (r, x, y) => (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);

                                                        const refreshSafeZones = () => {
                                                            safeRects.length = 0;

                                                            // joystick 安全区
                                                            try {
                                                                const jr = joystickEl.getBoundingClientRect();
                                                                const m = Math.max(18, jr.width * 0.18);
                                                                safeRects.push(expandRect(jr, m));

                                                                // 同步摇杆最大位移：跟随 joystick 尺寸
                                                                this._joyMaxDist = Math.max(30, Math.min(90, jr.width * 0.35));
                                                            } catch {
                                                                this._joyMaxDist = 50;
                                                            }

                                                            // action buttons 安全区
                                                            try {
                                                                const act = document.querySelector('.action-buttons');
                                                                if (act) {
                                                                    const ar = act.getBoundingClientRect();
                                                                    safeRects.push(expandRect(ar, 18));
                                                                }
                                                            } catch { }

                                                            // jump button 安全区
                                                            try {
                                                                const jc = document.querySelector('.jump-container');
                                                                if (jc) {
                                                                    const r = jc.getBoundingClientRect();
                                                                    safeRects.push(expandRect(r, 18));
                                                                }
                                                            } catch { }

                                                            // minimap 安全区（防止在边缘误触到画布瞄准）
                                                            try {
                                                                const mm = document.getElementById('minimap');
                                                                if (mm && mm.offsetParent !== null) {
                                                                    const r = mm.getBoundingClientRect();
                                                                    safeRects.push(expandRect(r, 14));
                                                                }
                                                            } catch { }
                                                        };

                                                        this._refreshSafeZones = refreshSafeZones;
                                                        refreshSafeZones();
                                                        window.addEventListener('resize', refreshSafeZones, { passive: true });
                                                        window.addEventListener('orientationchange', refreshSafeZones, { passive: true });

                                                        const findTouch = (touchList, id) => {
                                                            if (!touchList) return null;
                                                            for (let i = 0; i < touchList.length; i++) {
                                                                const t = touchList[i];
                                                                if (t && t.identifier === id) return t;
                                                            }
                                                            return null;
                                                        };

                                                        const inSafeZone = (x, y) => {
                                                            for (let i = 0; i < safeRects.length; i++) {
                                                                if (hitRect(safeRects[i], x, y)) return true;
                                                            }
                                                            return false;
                                                        };

                                                        // ── Joystick：绑定自己的 touchId，避免与准星/按钮互相抢
                                                        this.joystick.touchId = null;

                                                        joystickEl.addEventListener('touchstart', (e) => {
                                                            // 防止页面滑动/缩放
                                                            e.preventDefault();

                                                            // 已经有 joystick touch 在控制时，不抢占
                                                            if (this.joystick.touchId !== null) return;

                                                            const t = e.changedTouches && e.changedTouches[0];
                                                            if (!t) return;

                                                            this.joystick.touchId = t.identifier;
                                                            this.joystick.active = true;

                                                            // joystick 基准点：固定在底座中心
                                                            const rect = joystickEl.getBoundingClientRect();
                                                            this.joystick.startX = rect.left + rect.width / 2;
                                                            this.joystick.startY = rect.top + rect.height / 2;

                                                            this._updateJoystick(t.clientX, t.clientY, thumbEl);
                                                        }, { passive: false });

                                                        joystickEl.addEventListener('touchmove', (e) => {
                                                            e.preventDefault();
                                                            if (!this.joystick.active || this.joystick.touchId === null) return;

                                                            const t = findTouch(e.touches, this.joystick.touchId) || findTouch(e.changedTouches, this.joystick.touchId);
                                                            if (!t) return;

                                                            this._updateJoystick(t.clientX, t.clientY, thumbEl);
                                                        }, { passive: false });

                                                        const endJoy = (e) => {
                                                            e.preventDefault();
                                                            if (this.joystick.touchId === null) return;

                                                            // 只有结束了 joystick 自己的 touch 才归零
                                                            const ended = findTouch(e.changedTouches, this.joystick.touchId);
                                                            if (!ended) return;

                                                            this.joystick.active = false;
                                                            this.joystick.touchId = null;
                                                            this.joystick.dx = 0;
                                                            this.joystick.dy = 0;
                                                            thumbEl.style.transform = 'translate(-50%, -50%)';
                                                        };

                                                        joystickEl.addEventListener('touchend', endJoy, { passive: false });
                                                        joystickEl.addEventListener('touchcancel', endJoy, { passive: false });

                                                        // ── Buttons：沿用原有逻辑
                                                        this._setupButton('btn-jump', 'jump');
                                                        this._setupButton('btn-mine', 'mine');
                                                        this._setupButton('btn-place', 'place');

                                                        // ── Crosshair：允许“设定一次目标后松手继续挖/放”
                                                        const setCrosshairState = (state) => {
                                                            if (!crosshairEl) return;
                                                            crosshairEl.classList.toggle('crosshair-active', state === 'active');
                                                            crosshairEl.classList.toggle('crosshair-idle', state === 'idle');
                                                            if (state === 'hidden') crosshairEl.classList.remove('crosshair-active', 'crosshair-idle');
                                                        };

                                                        canvas.addEventListener('touchstart', (e) => {
                                                            // 阻止双指缩放/滚动（尤其 iOS）
                                                            e.preventDefault();

                                                            if (!e.changedTouches) return;

                                                            // 如果当前没有正在拖动的准星，就从新 touch 中挑一个合适的
                                                            if (this.targetTouchId === null) {
                                                                for (let i = 0; i < e.changedTouches.length; i++) {
                                                                    const t = e.changedTouches[i];
                                                                    if (!t) continue;

                                                                    // 过滤掉靠近摇杆/按钮/小地图的触点，防误触
                                                                    if (inSafeZone(t.clientX, t.clientY)) continue;

                                                                    this.targetTouchId = t.identifier;
                                                                    if (crosshairEl) {
                                                                        this._updateCrosshair(t.clientX, t.clientY, crosshairEl);
                                                                        // 第一次设定目标：开启 hasTarget
                                                                        this.crosshair.visible = true;
                                                                        setCrosshairState('active');
                                                                    }
                                                                    break;
                                                                }
                                                            } else {
                                                                // 已在拖动：不抢占
                                                            }
                                                        }, { passive: false });

                                                        canvas.addEventListener('touchmove', (e) => {
                                                            e.preventDefault();
                                                            if (this.targetTouchId === null) return;

                                                            const t = findTouch(e.touches, this.targetTouchId) || findTouch(e.changedTouches, this.targetTouchId);
                                                            if (!t || !crosshairEl) return;

                                                            this._updateCrosshair(t.clientX, t.clientY, crosshairEl);
                                                            // 正在拖动时保持 active
                                                            if (this.crosshair.visible) setCrosshairState('active');
                                                        }, { passive: false });

                                                        const endCross = (e) => {
                                                            e.preventDefault();
                                                            if (this.targetTouchId === null) return;

                                                            const ended = findTouch(e.changedTouches, this.targetTouchId);
                                                            if (!ended) return;

                                                            this.targetTouchId = null;
                                                            // 松手后：保留目标点，但变为 idle（更不遮挡）
                                                            if (this.crosshair.visible) setCrosshairState('idle');
                                                        };

                                                        canvas.addEventListener('touchend', endCross, { passive: false });
                                                        canvas.addEventListener('touchcancel', endCross, { passive: false });
                                                    };

                                                    // 自适应摇杆半径（maxDist 与 UI 尺寸匹配）
                                                    TouchController.prototype._updateJoystick = function (tx, ty, thumbEl) {
                                                        let dx = tx - this.joystick.startX;
                                                        let dy = ty - this.joystick.startY;

                                                        const maxDist = (typeof this._joyMaxDist === 'number' && isFinite(this._joyMaxDist)) ? this._joyMaxDist : 50;
                                                        const dist = Math.sqrt(dx * dx + dy * dy);

                                                        if (dist > maxDist) {
                                                            dx = dx / dist * maxDist;
                                                            dy = dy / dist * maxDist;
                                                        }

                                                        this.joystick.dx = dx / maxDist;
                                                        this.joystick.dy = dy / maxDist;

                                                        thumbEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                                                    };

                                                    // Crosshair：只做坐标更新（与原逻辑兼容）
                                                    TouchController.prototype._updateCrosshair = function (x, y, el) {
                                                        this.crosshair.x = x;
                                                        this.crosshair.y = y;
                                                        // 40x40
                                                        el.style.left = (x - 20) + 'px';
                                                        el.style.top = (y - 20) + 'px';
                                                    };
                                                }

                                                // ───────────────────────── Patch Renderer：缓存天空渐变 + 星星更省 + 视差降采样 ─────────────────────────
                                                if (Renderer && Renderer.prototype) {
                                                    const origResize = Renderer.prototype.resize;
                                                    Renderer.prototype.resize = function () {
                                                        origResize.call(this);
                                                        // 尺寸变化时清空缓存
                                                        this._skyGrad = null;
                                                        this._skyBucket = -1;
                                                        this._skyGradH = 0;

                                                        this._stars = null;
                                                        this._starsW = 0;
                                                        this._starsH = 0;
                                                        this._starsCount = 0;

                                                        this._parallaxGrad = null;
                                                        this._parallaxGradH = 0;
                                                    };

                                                    Renderer.prototype._ensureStars = function () {
                                                        const want = (this.lowPower ? 40 : 80);
                                                        if (this._stars && this._starsCount === want && this._starsW === this.w && this._starsH === this.h) return;
