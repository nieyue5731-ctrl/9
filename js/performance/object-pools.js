        const ObjectPool = {
            _pools: new Map(),
            _typeCount: 0,
            MAX_TYPES: 100,
            MAX_POOL_SIZE: 500,
            
            get(type, factory) {
                // 验证类型参数
                if (typeof type !== 'string' || type.length === 0) {
                    console.warn('[ObjectPool] Invalid type parameter');
                    return factory();
                }
                
                let pool = this._pools.get(type);
                if (!pool) {
                    // 配额限制检查
                    if (this._typeCount >= this.MAX_TYPES) {
                        console.warn('[ObjectPool] Type quota exceeded');
                        return factory();
                    }
                    pool = [];
                    this._pools.set(type, pool);
                    this._typeCount++;
                }
                
                if (pool.length > 0) {
                    return pool.pop();
                }
                return factory();
            },
            
            release(type, obj) {
                // 验证参数
                if (!obj || typeof obj !== 'object') {
                    console.warn('[ObjectPool] Invalid object to release');
                    return;
                }
                
                if (typeof type !== 'string') {
                    console.warn('[ObjectPool] Invalid type for release');
                    return;
                }
                
                let pool = this._pools.get(type);
                if (!pool) {
                    if (this._typeCount >= this.MAX_TYPES) return;
                    pool = [];
                    this._pools.set(type, pool);
                    this._typeCount++;
                }
                
                if (pool.length < this.MAX_POOL_SIZE) {
                    pool.push(obj);
                }
            },
            
            clear(type) {
                if (type) {
                    if (this._pools.has(type)) {
                        this._pools.delete(type);
                        this._typeCount = Math.max(0, this._typeCount - 1);
                    }
                } else {
                    this._pools.clear();
                    this._typeCount = 0;
                }
            },
            
            getStats() {
                let totalObjects = 0;
                this._pools.forEach(pool => { totalObjects += pool.length; });
                return {
                    typeCount: this._typeCount,
                    totalObjects: totalObjects,
                    maxTypes: this.MAX_TYPES,
                    maxPoolSize: this.MAX_POOL_SIZE
                };
            }
        };
        window.ObjectPool = ObjectPool;

        // ═══════════════════ 向量池优化 (防御性重构版) ═══════════════════
        const VecPool = {
            _pool: [],
            _maxSize: 200,
            _releasedCount: 0,
            _acquiredCount: 0,
            
            get(x = 0, y = 0) {
                // 验证坐标参数
                const safeX = Number.isFinite(x) ? x : 0;
                const safeY = Number.isFinite(y) ? y : 0;
                
                this._acquiredCount++;
                
                if (this._pool.length > 0) {
                    const v = this._pool.pop();
                    if (v && typeof v === 'object') {
                        v.x = safeX;
                        v.y = safeY;
                        v._pooled = false; // mark as acquired
                        return v;
                    }
                }
                return { x: safeX, y: safeY, _pooled: false };
            },
            
            release(v) {
                // 严格验证
                if (!v || typeof v !== 'object') return;
                
                // 防止重复释放：use tag instead of O(n) includes()
                if (v._pooled) return;
                
                this._releasedCount++;
                
                if (this._pool.length < this._maxSize) {
                    v.x = 0;
                    v.y = 0;
                    v._pooled = true;
                    this._pool.push(v);
                }
            },
            
            getStats() {
                return {
                    poolSize: this._pool.length,
                    maxSize: this._maxSize,
                    acquired: this._acquiredCount,
                    released: this._releasedCount
                };
            },
            
            clear() {
                this._pool = [];
                this._acquiredCount = 0;
                this._releasedCount = 0;
            }
        };
        window.VecPool = VecPool;

        // ═══════════════════ 数组池优化 (防御性重构版) ═══════════════════
        const ArrayPool = {
            _pools: new Map(),
            _typeCount: 0,
            MAX_TYPES: 10,
            MAX_POOL_SIZE: 50,
            
            get(size = 0) {
                // 验证size参数
                const safeSize = Number.isInteger(size) && size >= 0 ? size : 0;
                const key = safeSize <= 16 ? 16 : safeSize <= 64 ? 64 : safeSize <= 256 ? 256 : 1024;
                
                let pool = this._pools.get(key);
                if (!pool) {
                    if (this._typeCount >= this.MAX_TYPES) {
                        console.warn('[ArrayPool] Type quota exceeded');
                        return new Array(safeSize);
                    }
                    pool = [];
                    this._pools.set(key, pool);
                    this._typeCount++;
                }
                
                if (pool.length > 0) {
                    const arr = pool.pop();
                    if (Array.isArray(arr)) {
                        arr.length = 0;
                        arr._pooled = false; // mark as acquired
                        return arr;
                    }
                }
                return new Array(safeSize);
            },
            
            release(arr) {
                // 严格验证
                if (!Array.isArray(arr)) {
                    console.warn('[ArrayPool] Attempted to release non-array');
                    return;
                }
                
                // 防止重复释放
                const len = arr.length;
                const key = len <= 16 ? 16 : len <= 64 ? 64 : len <= 256 ? 256 : 1024;
                let pool = this._pools.get(key);
                
                if (!pool) {
                    if (this._typeCount >= this.MAX_TYPES) return;
                    pool = [];
                    this._pools.set(key, pool);
                    this._typeCount++;
                }
                
                if (pool.length < this.MAX_POOL_SIZE) {
                    // Tag-based double-release prevention (O(1) vs O(n) includes)
                    if (arr._pooled) return;
                    arr._pooled = true;
                    arr.length = 0;
                    pool.push(arr);
                }
            },
            
            getStats() {
                let totalArrays = 0;
                this._pools.forEach(pool => { totalArrays += pool.length; });
                return {
                    typeCount: this._typeCount,
                    totalArrays: totalArrays,
                    maxTypes: this.MAX_TYPES,
                    maxPoolSize: this.MAX_POOL_SIZE
                };
            },
            
            clear() {
                this._pools.clear();
                this._typeCount = 0;
            }
        };
        window.ArrayPool = ArrayPool;

        // ═══════════════════ 内存优化工具 (防御性重构版) ═══════════════════
        const MemoryManager = {
            _lastCleanup: 0,
            _cleanupInterval: 30000, // 30秒清理一次
            _cleanupCount: 0,
            _maxCleanups: 10000, // 防止无限清理
            
            tick(now) {
                // 验证时间戳
                if (!Number.isFinite(now)) {
                    console.warn('[MemoryManager] Invalid timestamp');
                    return;
                }
                
                // 防止清理次数过多
                if (this._cleanupCount >= this._maxCleanups) {
                    return;
                }
                
                if (now - this._lastCleanup > this._cleanupInterval) {
                    this._lastCleanup = now;
                    this._cleanupCount++;
                    this.cleanup();
                }
            },

            cleanup() {
                try {
                    // 清理对象池中过多的对象
                    if (window.ObjectPool && window.ObjectPool._pools) {
                        window.ObjectPool._pools.forEach((pool, type) => {
                            if (Array.isArray(pool) && pool.length > 100) {
                                // 清理多余对象的引用
                                for (let i = 100; i < pool.length; i++) {
                                    const obj = pool[i];
                                    if (obj && typeof obj === 'object') {
                                        Object.keys(obj).forEach(key => { obj[key] = null; });
                                    }
                                }
                                pool.length = 100;
                            }
                        });
                    }
                    
                    if (window.VecPool && Array.isArray(window.VecPool._pool) && window.VecPool._pool.length > 100) {
                        window.VecPool._pool.length = 100;
                    }
                    
                    if (window.ArrayPool && window.ArrayPool._pools) {
                        window.ArrayPool._pools.forEach((pool) => {
                            if (Array.isArray(pool) && pool.length > 20) {
                                pool.length = 20;
                            }
                        });
                    }
                } catch (e) {
                    console.error('[MemoryManager] Cleanup error:', e);
                }
            },

            getStats() {
                const stats = {
                    objectPools: 0,
                    vecPool: 0,
                    arrayPools: 0,
                    cleanupCount: this._cleanupCount
                };
                
                try {
                    if (window.VecPool && Array.isArray(window.VecPool._pool)) {
                        stats.vecPool = window.VecPool._pool.length;
                    }
                    if (window.ObjectPool && window.ObjectPool._pools) {
                        window.ObjectPool._pools.forEach(pool => {
                            if (Array.isArray(pool)) stats.objectPools += pool.length;
                        });
                    }
                    if (window.ArrayPool && window.ArrayPool._pools) {
                        window.ArrayPool._pools.forEach(pool => {
                            if (Array.isArray(pool)) stats.arrayPools += pool.length;
                        });
                    }
                } catch (e) {
                    console.error('[MemoryManager] Stats error:', e);
                }
                
                return stats;
            },
            
            reset() {
                this._cleanupCount = 0;
                this._lastCleanup = 0;
            }
        };
        window.MemoryManager = MemoryManager;

