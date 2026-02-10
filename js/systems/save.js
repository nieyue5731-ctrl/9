
    <!-- ========================= MODULE: systems/save ========================= -->
    
        class SaveSystem {
            static KEY = 'terraria_ultra_save_v1';
            constructor(game) {
                this.game = game;
                this.seed = null;
                this.diff = new Map(); // key "x,y" -> blockId
                this._autosaveAcc = 0;
                this._disabled = false;
            }

            static hasSave() {
                try { return !!localStorage.getItem(SaveSystem.KEY); } catch { return false; }
            }
            static clear() {
                try { localStorage.removeItem(SaveSystem.KEY); } catch { }
            }
            static load() {
                try {
                    const raw = localStorage.getItem(SaveSystem.KEY);
                    if (!raw) return null;
                    
                    // 检查数据大小
                    if (raw.length > 10 * 1024 * 1024) { // 10MB限制
                        console.error('[SaveSystem] Save data too large');
                        return null;
                    }
                    
                    const data = JSON.parse(raw);
                    
                    // 验证基本结构
                    if (!data || typeof data !== 'object' || data.v !== 1) {
                        console.warn('[SaveSystem] Invalid save format');
                        return null;
                    }
                    
                    // 验证必需字段
                    const requiredFields = ['ts', 'seed', 'player', 'w', 'h'];
                    for (const field of requiredFields) {
                        if (!(field in data)) {
                            console.warn('[SaveSystem] Missing required field:', field);
                            return null;
                        }
                    }
                    
                    // 解码 diffs（支持旧版数组 & 新版 RLE）
                    const diff = new Map();
                    const diffs = data.diffs;

                    // 旧版：["x_y_id", ...]
                    if (Array.isArray(diffs)) {
                        for (const s of diffs) {
                            if (typeof s !== 'string') continue;
                            const parts = s.split('_');
                            if (parts.length !== 3) continue;
                            const x = parseInt(parts[0], 36);
                            const y = parseInt(parts[1], 36);
                            const id = parseInt(parts[2], 36);
                            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(id)) continue;
                            diff.set(x + ',' + y, id);
                        }
                    }
                    // 新版：{ fmt:'rle1', w, data:[ 'r<start>_<len>_<id>', ... ] }
                    else if (diffs && typeof diffs === 'object' && diffs.fmt === 'rle1' && Array.isArray(diffs.data)) {
                        const fallbackW = (Number.isFinite(data.w) ? (data.w | 0) : ((typeof CONFIG !== 'undefined' && CONFIG && Number.isFinite(CONFIG.WORLD_WIDTH)) ? (CONFIG.WORLD_WIDTH | 0) : 0));
                        const w = Number.isFinite(diffs.w) ? (diffs.w | 0) : fallbackW;
                        if (!Number.isFinite(w) || w <= 0) return null;
                        
                        // 限制diff条目数
                        let totalEntries = 0;
                        const MAX_DIFF_ENTRIES = 100000;
                        
                        for (const token of diffs.data) {
                            if (typeof token !== 'string') continue;
                            const t = token.charAt(0) === 'r' ? token.slice(1) : token;
                            const parts = t.split('_');
                            if (parts.length !== 3) continue;
                            const start = parseInt(parts[0], 36);
                            const len = parseInt(parts[1], 36);
                            const id = parseInt(parts[2], 36);
                            if (!Number.isFinite(start) || !Number.isFinite(len) || !Number.isFinite(id) || len <= 0) continue;

                            // 防御：避免异常存档导致长循环
                            const maxLen = Math.min(len, 20000);
                            for (let i = 0; i < maxLen; i++) {
                                if (totalEntries >= MAX_DIFF_ENTRIES) {
                                    console.warn('[SaveSystem] Diff entries limit reached');
                                    break;
                                }
                                const idx = start + i;
                                const x = idx % w;
                                const y = (idx / w) | 0;
                                diff.set(x + ',' + y, id);
                                totalEntries++;
                            }
                        }
                    }

                    data._diffMap = diff;
                    return data;
                } catch (e) {
                    console.error('[SaveSystem] Load error:', e);
                    return null;
                }
            }
            static _encodeDiff(diffMap, worldW) {
                const fallbackW = (typeof CONFIG !== 'undefined' && CONFIG && Number.isFinite(CONFIG.WORLD_WIDTH)) ? (CONFIG.WORLD_WIDTH | 0) : 0;
                const w = Number.isFinite(worldW) ? (worldW | 0) : fallbackW;
                if (!Number.isFinite(w) || w <= 0) return { fmt: 'rle1', w: (fallbackW || 0), data: [] };

                // RLE：按线性索引排序，将连续且相同的 blockId 合并为一条记录
                const entries = [];
                for (const [k, id] of diffMap.entries()) {
                    const [x, y] = k.split(',').map(n => parseInt(n, 10));
                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(id)) continue;
                    entries.push([y * w + x, id]);
                }
                entries.sort((a, b) => a[0] - b[0]);

                const out = [];
                for (let i = 0; i < entries.length;) {
                    const start = entries[i][0];
                    const id = entries[i][1];
                    let len = 1;
                    while (i + len < entries.length && entries[i + len][1] === id && entries[i + len][0] === start + len) len++;
                    out.push('r' + start.toString(36) + '_' + len.toString(36) + '_' + id.toString(36));
                    i += len;
                }

                return { fmt: 'rle1', w, data: out };
            }

            static async promptStartIfNeeded() {
                const has = SaveSystem.hasSave();
                if (!has) return { mode: 'new', save: null };
                const overlay = document.getElementById('save-prompt-overlay');
                const btnC = document.getElementById('save-prompt-continue');
                const btnN = document.getElementById('save-prompt-new');
                const btnX = document.getElementById('save-prompt-close');

                if (!overlay || !btnC || !btnN) return { mode: 'new', save: null };

                return await new Promise((resolve) => {
                    const done = (mode) => {
                        overlay.classList.remove('show');
                        overlay.setAttribute('aria-hidden', 'true');
                        btnC.removeEventListener('click', onC);
                        btnN.removeEventListener('click', onN);
                        btnX && btnX.removeEventListener('click', onX);
                        let loaded = null;
                        if (mode === 'continue') {
                            loaded = SaveSystem.load();
                            if (!loaded) {
                                try { if (typeof Toast !== 'undefined' && Toast && Toast.show) Toast.show('⚠️ 存档损坏或不兼容：已开始新世界', 2600); } catch { }
                                try { SaveSystem.clear(); } catch { }
                                mode = 'new';
                            }
                        }
                        resolve({ mode, save: loaded });
                    };
                    const onC = () => done('continue');
                    const onN = () => done('new');
                    const onX = () => done('new');
                    overlay.classList.add('show');
                    overlay.setAttribute('aria-hidden', 'false');
                    btnC.addEventListener('click', onC);
                    btnN.addEventListener('click', onN);
                    if (btnX) btnX.addEventListener('click', onX);
                });
