        // ═══════════════════ 事件优化工具 ═══════════════════
        const EventUtils = {
            throttle(fn, delay) {
                let last = 0;
                let timer = null;
                return function (...args) {
                    const now = Date.now();
                    if (now - last >= delay) {
                        last = now;
                        fn.apply(this, args);
                    } else if (!timer) {
                        timer = setTimeout(() => {
                            timer = null;
                            last = Date.now();
                            fn.apply(this, args);
                        }, delay - (now - last));
                    }
                };
            },

            debounce(fn, delay) {
                let timer = null;
                return function (...args) {
                    clearTimeout(timer);
                    timer = setTimeout(() => fn.apply(this, args), delay);
                };
            },

            // RAF节流 - 确保每帧最多执行一次 (防御性重构版)
            rafThrottle(fn) {
                // 验证函数参数
                if (typeof fn !== 'function') {
                    console.warn('[EventUtils.rafThrottle] Invalid function');
                    return () => {};
                }
                
                let scheduled = false;
                let lastArgs = null;
                let rafId = null;
                
                return function (...args) {
                    lastArgs = args;
                    if (!scheduled) {
                        scheduled = true;
                        rafId = requestAnimationFrame(() => {
                            scheduled = false;
                            rafId = null;
                            try {
                                fn.apply(this, lastArgs);
                            } catch (e) {
                                console.error('[EventUtils.rafThrottle] Callback error:', e);
                            }
                            lastArgs = null; // 清理引用
                        });
                    }
                };
            },
            
            // 带取消功能的throttle
            throttleCancellable(fn, delay) {
                if (typeof fn !== 'function') {
                    console.warn('[EventUtils.throttleCancellable] Invalid function');
                    return { call: () => {}, cancel: () => {} };
                }
                
                let last = 0;
                let timer = null;
                
                const call = function (...args) {
                    const now = Date.now();
                    if (now - last >= delay) {
                        last = now;
                        clearTimeout(timer);
                        timer = null;
                        try {
                            fn.apply(this, args);
                        } catch (e) {
                            console.error('[EventUtils.throttleCancellable] Error:', e);
                        }
                    } else if (!timer) {
                        timer = setTimeout(() => {
                            timer = null;
                            last = Date.now();
                            try {
                                fn.apply(this, args);
                            } catch (e) {
                                console.error('[EventUtils.throttleCancellable] Delayed error:', e);
                            }
                        }, delay - (now - last));
                    }
                };
                
                const cancel = () => {
                    clearTimeout(timer);
                    timer = null;
                    last = 0;
                };
                
                return { call, cancel };
            }
        };
        window.EventUtils = EventUtils;

        // ═══════════════════ 性能监控 (防御性重构版) ═══════════════════
        const PerfMonitor = {
            _samples: [],
            _maxSamples: 60,
            _lastFrame: 0,
            _frameCount: 0,
            _maxFrameCount: 1000000, // 防止溢出
            _errorCount: 0,
            _maxErrors: 100,

            frame(timestamp) {
                // 验证时间戳
                if (!Number.isFinite(timestamp)) {
                    this._errorCount++;
                    if (this._errorCount <= this._maxErrors) {
                        console.warn('[PerfMonitor] Invalid timestamp');
                    }
                    return;
                }
                
                // 防止溢出
                if (this._frameCount >= this._maxFrameCount) {
                    this.reset();
                }
                this._frameCount++;
                
                if (this._lastFrame) {
                    const delta = timestamp - this._lastFrame;
                    // 验证delta
                    if (delta > 0 && delta < 10000) { // 合理的帧时间范围
                        this._samples.push(delta);
                        if (this._samples.length > this._maxSamples) {
                            this._samples.shift();
                        }
                    }
                }
                this._lastFrame = timestamp;
            },
            
            reset() {
                this._samples = [];
                this._lastFrame = 0;
                this._frameCount = 0;
            },

            getAverageFPS() {
                if (!Array.isArray(this._samples) || this._samples.length === 0) return 60;
                
                try {
                    // 过滤异常值
                    const validSamples = this._samples.filter(s => s > 0 && s < 1000);
                    if (validSamples.length === 0) return 60;
                    
                    const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
                    return Math.max(1, Math.min(999, Math.round(1000 / avg)));
                } catch (e) {
                    console.error('[PerfMonitor] getAverageFPS error:', e);
                    return 60;
                }
            },

            getMinFPS() {
                if (!Array.isArray(this._samples) || this._samples.length === 0) return 60;
                
                try {
                    const validSamples = this._samples.filter(s => s > 0 && s < 1000);
                    if (validSamples.length === 0) return 60;
                    
                    const max = Math.max(...validSamples);
                    return Math.max(1, Math.min(999, Math.round(1000 / max)));
                } catch (e) {
                    console.error('[PerfMonitor] getMinFPS error:', e);
                    return 60;
                }
            },

            getFrameTimeStats() {
                if (!Array.isArray(this._samples) || this._samples.length === 0) {
                    return { avg: '16.67', min: '16.67', max: '16.67' };
                }
                
                try {
                    const validSamples = this._samples.filter(s => s > 0 && s < 1000);
                    if (validSamples.length === 0) return { avg: '16.67', min: '16.67', max: '16.67' };
                    
                    const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
                    return {
                        avg: avg.toFixed(2),
                        min: Math.min(...validSamples).toFixed(2),
                        max: Math.max(...validSamples).toFixed(2)
                    };
                } catch (e) {
                    console.error('[PerfMonitor] getFrameTimeStats error:', e);
                    return { avg: '16.67', min: '16.67', max: '16.67' };
                }
            }
        };
        window.PerfMonitor = PerfMonitor;
