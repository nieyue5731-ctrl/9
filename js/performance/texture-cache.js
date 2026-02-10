        // ═══════════════════ 纹理缓存优化 (防御性重构版) ═══════════════════
        // TextureCache: O(1) LRU using Map iteration order (delete+re-insert)
        const TextureCache = {
            _cache: new Map(),  // Map preserves insertion order; delete+set = move to end
            _maxSize: 200,
            _hitCount: 0,
            _missCount: 0,

            get(key) {
                if (key === undefined || key === null) return null;
                
                const val = this._cache.get(key);
                if (val !== undefined) {
                    this._hitCount++;
                    // O(1) LRU update: delete and re-insert moves key to end
                    this._cache.delete(key);
                    this._cache.set(key, val);
                    return val;
                }
                
                this._missCount++;
                return null;
            },

            set(key, value) {
                if (key === undefined || key === null) return;
                
                // Update existing: delete first to refresh insertion order
                if (this._cache.has(key)) {
                    this._cache.delete(key);
                    this._cache.set(key, value);
                    return;
                }

                // LRU eviction: Map.keys().next() gives oldest entry in O(1)
                while (this._cache.size >= this._maxSize) {
                    const oldest = this._cache.keys().next().value;
                    const cached = this._cache.get(oldest);
                    if (cached && cached.src) cached.src = '';
                    this._cache.delete(oldest);
                }

                this._cache.set(key, value);
            },
            
            getStats() {
                const total = this._hitCount + this._missCount;
                return {
                    size: this._cache.size,
                    maxSize: this._maxSize,
                    hits: this._hitCount,
                    misses: this._missCount,
                    hitRate: total > 0 ? (this._hitCount / total * 100).toFixed(2) + '%' : 'N/A'
                };
            },

            clear() {
                this._cache.forEach(texture => {
                    if (texture && texture.src) texture.src = '';
                });
                this._cache.clear();
                this._hitCount = 0;
                this._missCount = 0;
            }
        };
        window.TextureCache = TextureCache;

        // ═══════════════════ 批量渲染优化 ═══════════════════
        const BatchRenderer = {
            _batches: new Map(),
            _currentBatch: null,

            begin(ctx) {
                this._batches.clear();
                this._ctx = ctx;
            },

            addTile(texture, x, y, alpha = 1) {
                const key = texture.src || texture;
                if (!this._batches.has(key)) {
                    this._batches.set(key, []);
                }
                this._batches.get(key).push({ texture, x, y, alpha });
            },

            flush() {
                const ctx = this._ctx;
                if (!ctx) return;

                this._batches.forEach((tiles, key) => {
                    // 按alpha分组绘制
                    let currentAlpha = 1;
                    ctx.globalAlpha = 1;

                    for (const tile of tiles) {
                        if (tile.alpha !== currentAlpha) {
                            currentAlpha = tile.alpha;
                            ctx.globalAlpha = currentAlpha;
                        }
                        ctx.drawImage(tile.texture, tile.x, tile.y);
                    }
                });

                ctx.globalAlpha = 1;
                this._batches.clear();
            }
        };
        window.BatchRenderer = BatchRenderer;

        // ═══════════════════ 懒加载优化 ═══════════════════
        const LazyLoader = {
            _pending: new Map(),
            _loaded: new Set(),

            load(key, loader) {
                if (this._loaded.has(key)) {
                    return Promise.resolve();
                }
