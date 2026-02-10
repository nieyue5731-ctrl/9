                            return;
                        }

                        // Ctrl/Cmd + S：保存（防止误触浏览器“保存网页”）
                        if (code === 'KeyS' && (e.ctrlKey || e.metaKey) && game.saveSystem) {
                            e.preventDefault(); e.stopPropagation();
                            game.audio && game.audio.play('ui');
                            game.saveSystem.save('manual');
                            return;
                        }

                        // O：设置（与 UI 按钮一致逻辑）
                        if (code === 'KeyO' && ux && ux.showOverlay && ux.settingsOverlay) {
                            e.preventDefault(); e.stopPropagation();
                            game.audio && game.audio.play('ui');
                            game._settingsReturnToPause = !!game.paused;
                            if (typeof syncSettingsControls === 'function') syncSettingsControls(game.settings);
                            game.paused = true;
                            ux.hideOverlay && ux.hideOverlay(ux.pauseOverlay);
                            ux.showOverlay(ux.settingsOverlay);
                            return;
                        }

                        // P：暂停/继续
                        if (code === 'KeyP' && ux && ux.setPaused) {
                            e.preventDefault(); e.stopPropagation();
                            game.audio && game.audio.play('ui');
                            ux.setPaused(!game.paused);
                            return;
                        }

                        // E：合成（暂停/面板打开时不触发）
                        if (code === 'KeyE' && game.crafting && !isGameBlocked && !(ux && ux.isSettingsOpen && ux.isSettingsOpen())) {
                            e.preventDefault(); e.stopPropagation();
                            if (game.inventoryUI && game.inventoryUI.isOpen) game.inventoryUI.close();
                            game.crafting.toggle();
                            return;
                        }

                        // B / I：背包（暂停/面板打开时不触发）
                        if ((code === 'KeyB' || code === 'KeyI') && game.inventoryUI && !isGameBlocked && !(ux && ux.isSettingsOpen && ux.isSettingsOpen())) {
                            e.preventDefault(); e.stopPropagation();
                            if (game.crafting && game.crafting.isOpen) game.crafting.close();
                            game.inventoryUI.toggle();
                            return;
                        }

                        // Esc：优先关闭“最上层”面板（help/settings/背包/合成），否则切换暂停
                        if (code === 'Escape') {
                            e.preventDefault(); e.stopPropagation();

                            if (ux && ux.isHelpOpen && ux.isHelpOpen()) {
                                ux.hideOverlay && ux.hideOverlay(ux.helpOverlay);
                                try { localStorage.setItem('terraria_ultra_help_seen_v1', '1'); } catch { }
                                return;
                            }
                            if (ux && ux.isSettingsOpen && ux.isSettingsOpen()) {
                                if (ux.closeSettings) ux.closeSettings();
                                else ux.hideOverlay && ux.hideOverlay(ux.settingsOverlay);
                                return;
                            }
                            if (game.inventoryUI && game.inventoryUI.isOpen) { game.inventoryUI.close(); return; }
                            if (game.crafting && game.crafting.isOpen) { game.crafting.close(); return; }

                            if (ux && ux.setPaused) {
                                game.audio && game.audio.play('ui');
                                ux.setPaused(!game.paused);
                                return;
                            }
                            game.paused = !game.paused;
                            return;
                        }
                    }

                };

                const onKeyUp = (e) => {

                    const code = e.code;

                    const modalOpen = (game.inventoryUI && game.inventoryUI.isOpen) || (game.crafting && game.crafting.isOpen) || game.paused || game._inputBlocked;
                    if (modalOpen) {
                        const isMoveKey = INPUT_KEYS.LEFT.has(code) || INPUT_KEYS.RIGHT.has(code) || INPUT_KEYS.JUMP.has(code) || INPUT_KEYS.SPRINT.has(code);
                        if (isMoveKey) { e.preventDefault(); }
                    }
                    if (INPUT_KEYS.LEFT.has(code)) game.input.left = false;
                    if (INPUT_KEYS.LEFT.has(code)) self._holdLeftMs = 0;

                    if (INPUT_KEYS.RIGHT.has(code)) game.input.right = false;
                    if (INPUT_KEYS.RIGHT.has(code)) self._holdRightMs = 0;

                    if (INPUT_KEYS.JUMP.has(code)) game.input.jump = false;

                    if (INPUT_KEYS.SPRINT.has(code)) game.input.sprint = false;

                    const handled = INPUT_KEYS.LEFT.has(code) || INPUT_KEYS.RIGHT.has(code) || INPUT_KEYS.JUMP.has(code) || INPUT_KEYS.SPRINT.has(code);
                    if (handled) e.preventDefault();
                };

                window.addEventListener('keydown', onKeyDown);

                window.addEventListener('keyup', onKeyUp);

                game.canvas.addEventListener('mousemove', (e) => {

                    game.input.mouseX = e.clientX;

                    game.input.mouseY = e.clientY;

                }, { passive: true });

                game.canvas.addEventListener('mousedown', (e) => {

                    if (e.button === MOUSE_BUTTON.LEFT) game.input.mouseLeft = true;

                    if (e.button === MOUSE_BUTTON.RIGHT) game.input.mouseRight = true;

                });

                game.canvas.addEventListener('mouseup', (e) => {

                    if (e.button === MOUSE_BUTTON.LEFT) game.input.mouseLeft = false;

                    if (e.button === MOUSE_BUTTON.RIGHT) game.input.mouseRight = false;

                });

                game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

                const fullscreenBtn = DOM.byId(UI_IDS.fullscreenBtn);

                if (fullscreenBtn) {

                    fullscreenBtn.addEventListener('click', (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const fm = window.TU && window.TU.FullscreenManager;
                        if (fm && typeof fm.toggle === 'function') {
                            fm.toggle();
                        } else {
                            if (document.fullscreenElement) document.exitFullscreen();
                            else document.documentElement.requestFullscreen();
                        }
                    });

                }

            }

            /**
             * Fixed-step tick to compute "hold A/D to sprint" without being affected by key repeat.
             * @param {number} dtMs
             */
            tick(dtMs) {
                const left = !!this.game.input.left;
                const right = !!this.game.input.right;

                // Only count hold when a single direction is pressed; switching direction resets.
                if (left && !right) this._holdLeftMs = Math.min(10000, (this._holdLeftMs || 0) + dtMs);
                else this._holdLeftMs = 0;

                if (right && !left) this._holdRightMs = Math.min(10000, (this._holdRightMs || 0) + dtMs);
                else this._holdRightMs = 0;

                const prev = !!this._holdSprint;
                let sprint = false;
                let dir = 0;
                if (this._holdLeftMs >= CONFIG.SPRINT_HOLD_MS) { sprint = true; dir = -1; }
                else if (this._holdRightMs >= CONFIG.SPRINT_HOLD_MS) { sprint = true; dir = 1; }

                this._holdSprint = sprint;
                this._holdDir = dir;
                this._holdJustStarted = (!prev && sprint);
            }

        }

        /**
         * InventorySystem
         * - 负责拾取入包（堆叠/空槽/扩容/满包日志）
         * - ⚠️ 行为保持与旧版 Game._addToInventory 完全一致（代码搬迁 + this→game 重定向）
         */

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { InputManager });

    

    <!-- ========================= SECTION: Core Systems ========================= -->

    <!-- ========================= MODULE: systems/inventory ========================= -->
    

        class InventorySystem {
            /** @param {Game} game */
            constructor(game) {
                this.game = game;
            }

            /**
             * @param {string} blockId
             * @param {number} [count=1]
             * @returns {boolean}
             */
            add(blockId, count = 1) {
                const game = this.game;

                const blockData = BLOCK_DATA[blockId];
                if (!blockData) return false;

                const MAX_INVENTORY_SIZE = INVENTORY_LIMITS.MAX_SIZE; // 最大背包容量（保持原值 36）
                const MAX_STACK_SIZE = INVENTORY_LIMITS.MAX_STACK;    // 单个物品堆叠上限（保持原值 999）

                let remaining = count;

                const refreshHotbar = () => {
                    // 保持原有行为：每次发生可见变更时即时刷新（但要容错，避免 UI 尚未初始化时报错）
                    try {
                        if (game && game.ui && typeof game.ui.buildHotbar === 'function') game.ui.buildHotbar();
                    } catch { }
                };

                // 1) 优先堆叠到已有同类物品
                for (let item of game.player.inventory) {
                    if (item.id === blockId && item.count < MAX_STACK_SIZE) {
                        const canAdd = Math.min(remaining, MAX_STACK_SIZE - item.count);
                        item.count += canAdd;
                        remaining -= canAdd;

                        if (remaining <= 0) {
                            refreshHotbar();
                            return true;
                        }
                    }
                }

                // 2) 填充空槽位（count 为 0 的格子），保留原逻辑：不覆盖镐子槽
                for (let item of game.player.inventory) {
                    if (item.count === 0 && item.id !== 'pickaxe') {
                        const canAdd = Math.min(remaining, MAX_STACK_SIZE);
                        item.id = blockId;
                        item.name = blockData.name;
                        item.count = canAdd;
                        remaining -= canAdd;

                        if (remaining <= 0) {
                            refreshHotbar();
                            return true;
                        }
                    }
                }

                // 3) 如果没有空槽位，尝试背包扩展（push 新槽位）
                while (remaining > 0 && game.player.inventory.length < MAX_INVENTORY_SIZE) {
                    const canAdd = Math.min(remaining, MAX_STACK_SIZE);
                    game.player.inventory.push({
                        id: blockId,
                        name: blockData.name,
                        count: canAdd
                    });
                    remaining -= canAdd;
                }

                // 4) 更新 UI（保持原逻辑：即使未完全拾取也刷新已变化部分）
                refreshHotbar();

                if (remaining <= 0) return true;

                // 5) 背包满：返回 false，让物品留在地上（保持原输出）
                try { Toast.show(`🎒 背包已满：${blockData.name} 未能全部拾取`, 1600); } catch { }
                return false;

            }
        }

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { InventorySystem });

    
