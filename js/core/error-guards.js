                            <!-- ========================= PATCH: global error guards (stability) ========================= -->
                            
                                (() => {
                                    // 防止 toast 无限刷屏
                                    let lastAt = 0;
                                    let lastMsg = '';
                                    const safeToast = (msg) => {
                                        const now = Date.now();
                                        const m = String(msg || '未知错误');
                                        if (m === lastMsg && (now - lastAt) < 1500) return;
                                        lastAt = now;
                                        lastMsg = m;
                                        try { if (typeof Toast !== 'undefined' && Toast && Toast.show) Toast.show(m, 2600); }
                                        catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                    };

                                    window.addEventListener('error', (ev) => {
                                        try {
                                            const msg = ev && ev.message ? ev.message : '运行时错误';
                                            safeToast('⚠️ ' + msg);
                                            // 打印更完整的堆栈，方便排查
                                            if (ev && ev.error) console.error(ev.error);
                                            else console.error(ev);
                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                    });

                                    window.addEventListener('unhandledrejection', (ev) => {
                                        try {
                                            const r = ev && ev.reason;
                                            const msg = (r && (r.message || r.toString())) || '未处理的异步错误';
                                            safeToast('⚠️ ' + msg);
                                            console.error(r || ev);
                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                    });
                                })();
                            

                            <!-- ========================= PATCH: tu_perf_pack_v1 ========================= -->
                            
                                (() => {
                                    'use strict';
                                    const TU = window.TU = window.TU || {};

                                    // ------------------------------------------------------------
                                    // Lightweight Profiler (default OFF)
                                    // ------------------------------------------------------------
                                    const Profiler = TU.Profiler = TU.Profiler || (function () {
                                        const P = {
                                            enabled: false,
                                            frame: 0,
                                            _lastUI: 0,
                                            _uiInterval: 250, // ms
                                            _now: (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now(),
                                            _m: Object.create(null),
                                            _c: Object.create(null),
                                            _extra: Object.create(null),
                                            ui: null,

                                            beginFrame() {
                                                this.frame = (this.frame + 1) | 0;
                                                this._m.renderWorld = 0;
                                                this._m.updateLight = 0;
                                                this._m.workerApply = 0;
                                                this._c.renderWorld = 0;
                                                this._c.updateLight = 0;
                                                this._c.workerApply = 0;
                                                this._extra.workerChanges = 0;
                                            },

                                            add(name, dt, countInc = 1, extraKey = null, extraVal = 0) {
                                                if (!this.enabled) return;
                                                this._m[name] = (this._m[name] || 0) + dt;
                                                this._c[name] = (this._c[name] || 0) + countInc;
                                                if (extraKey) this._extra[extraKey] = (this._extra[extraKey] || 0) + extraVal;
                                            },

                                            ensureUI() {
                                                if (this.ui) return this.ui;
                                                const div = document.createElement('div');
                                                div.id = 'tu-profiler';
                                                div.style.cssText = [
                                                    'position:fixed',
                                                    'left:8px',
                                                    'top:8px',
                                                    'z-index:9999',
                                                    'padding:6px 8px',
                                                    'background:rgba(0,0,0,0.55)',
                                                    'color:#e8f0ff',
                                                    'font:12px/1.25 ui-monospace,Menlo,Consolas,monospace',
                                                    'border:1px solid rgba(255,255,255,0.18)',
                                                    'border-radius:6px',
                                                    'pointer-events:none',
                                                    'white-space:pre',
                                                    'image-rendering:pixelated'
                                                ].join(';');
                                                div.textContent = 'Profiler ON';
                                                document.body.appendChild(div);
                                                this.ui = div;
                                                return div;
                                            },

                                            setEnabled(v) {
                                                this.enabled = !!v;
                                                try {
                                                    if (this.enabled) this.ensureUI().style.display = 'block';
                                                    else if (this.ui) this.ui.style.display = 'none';
                                                    try { localStorage.setItem('tu_profiler_enabled', this.enabled ? '1' : '0'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            },

                                            toggle() { this.setEnabled(!this.enabled); },

                                            updateUI(game) {
                                                if (!this.enabled) return;
                                                const now = this._now();
                                                if (now - this._lastUI < this._uiInterval) return;
                                                this._lastUI = now;

                                                const fps = game && game.fps ? game.fps : 0;
                                                const rw = this._m.renderWorld || 0;
                                                const ul = this._m.updateLight || 0;
                                                const wa = this._m.workerApply || 0;
