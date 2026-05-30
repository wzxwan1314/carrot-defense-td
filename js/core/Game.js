class Game {
    constructor() {
        const canvasEl = document.getElementById('game-canvas');
        if (!canvasEl) {
            document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:40vh;">错误: 找不到 canvas 元素</h1>';
            return;
        }

        this.app = new PIXI.Application({
            width: CONFIG.GAME_WIDTH,
            height: CONFIG.GAME_HEIGHT,
            backgroundColor: 0x2d5a27,
            view: canvasEl,
            antialias: true,
            resolution: 1,
        });

        // Enable stage event system (required for PixiJS 7)
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);

        const canvas = this.app.view;
        canvas.style.width = CONFIG.GAME_WIDTH + 'px';
        canvas.style.height = CONFIG.GAME_HEIGHT + 'px';

        // State
        this.gameState = CONFIG.STATE_IDLE;
        this.gold = CONFIG.START_GOLD;
        this.lives = CONFIG.START_LIVES;
        this.currentLevel = 0;
        this.mapData = MAP_DATA;

        // Root container that camera wraps (persistent across levels)
        this.gameRoot = new PIXI.Container();

        // Camera wraps gameRoot (created once, not per level)
        this.camera = new Camera(
            this.gameRoot,
            CONFIG.GAME_WIDTH,
            CONFIG.GAME_HEIGHT
        );

        // Entity layers (persistent, added to gameRoot)
        this.entityLayer = new PIXI.Container();
        this.projectileLayer = new PIXI.Container();
        this.particleLayer = new PIXI.Container();
        this.gameRoot.addChild(this.entityLayer);
        this.gameRoot.addChild(this.projectileLayer);
        this.gameRoot.addChild(this.particleLayer);

        // Path debug overlay (persistent container, redrawn per level)
        this.pathDebugGfx = new PIXI.Graphics();
        this.gameRoot.addChild(this.pathDebugGfx);

        // Build initial level (fills in tilemap at index 0)
        this._buildLevel(0);

        // ──── Managers ────
        this.enemyManager = new EnemyManager(this.pathManager, {
            onEnemyReachEnd: (enemy) => this._onEnemyReachEnd(enemy),
            onEnemyDeath: (enemy) => this._onEnemyDeath(enemy),
        });
        this.entityLayer.addChild(this.enemyManager.container);

        this.waveManager = new WaveManager(WAVES, this.enemyManager, {
            onWaveStart: (i) => this._onWaveStart(i),
            onWaveComplete: (i) => this._onWaveComplete(i),
            onAllComplete: () => this._onAllWavesComplete(),
        });

        this.towerManager = new TowerManager(this);
        this.entityLayer.addChild(this.towerManager.container);
        this.projectileLayer.addChild(this.towerManager.projContainer);

        // Particles
        this.particleManager = new ParticleManager();
        this.particleLayer.addChild(this.particleManager.container);

        // Audio
        this.audio = new AudioManager();

        // Tower placement preview (on entity layer so it scrolls)
        this.previewGfx = new PIXI.Graphics();
        this.entityLayer.addChild(this.previewGfx);

        // ──── UI (fixed overlay, not affected by camera) ────
        this.uiLayer = new PIXI.Container();
        this.app.stage.addChild(this.camera.worldContainer);
        this.app.stage.addChild(this.uiLayer);

        this.hud = new HUD(this, {
            onSelectTower: (type) => this._selectTowerType(type),
        });
        this.uiLayer.addChild(this.hud.container);

        this.towerPanel = new TowerPanel(this, {
            onUpgrade: (tower) => this._upgradeTower(tower),
            onSell: (tower) => this._sellTower(tower),
            onClose: () => this._deselectTower(),
        });
        this.uiLayer.addChild(this.towerPanel.container);

        this.levelUI = new LevelUI(this);
        this.uiLayer.addChild(this.levelUI.container);

        // ──── Input ────
        this.camera.enableDrag(canvas);
        this._setupMouse(canvas);
        this._setupKeyboard();

        this._listeners = {};

        // Game loop
        this.app.ticker.add((delta) => this._update(delta));

        // Show level select
        this.levelUI.showLevelSelect();

        console.log('[Game] 初始化完成');
    }

    // ──── Level Management ────

    _buildLevel(levelIndex) {
        const level = LEVELS[levelIndex] || LEVELS[0];
        this.mapData.grid = level.grid;
        this.mapData.pathWaypoints = level.pathWaypoints;

        // Destroy old tilemap
        if (this.tilemapContainer) {
            this.gameRoot.removeChild(this.tilemapContainer);
            this.tilemapContainer.destroy({ children: true });
        }

        this.pathManager = new PathManager(this.mapData.pathWaypoints);
        this.tilemap = new Tilemap(this.mapData);
        this.tilemapContainer = this.tilemap.container;

        // Insert tilemap at index 0 (behind entity layers)
        this.gameRoot.addChildAt(this.tilemapContainer, 0);

        // Redraw debug path
        this.pathDebugGfx.clear();
        this.pathManager.draw(this.pathDebugGfx);
    }

    // ──── Update ────

    _update(delta) {
        const dt = delta / 60;

        if (this.gameState === CONFIG.STATE_PLAYING) {
            this.waveManager.update(dt);
            this.enemyManager.update(dt);
            this.towerManager.update(
                dt, this.enemyManager.enemies,
                this.audio, this.particleManager, this.camera
            );
            this.particleManager.update(dt);
            this.camera.updateShake(dt);
        }

        this.hud.update(
            this.gold, this.lives,
            this.waveManager.getCurrentWave(),
            this.waveManager.getTotalWaves(),
            this.gameState
        );

        // Sync tower panel
        if (this.towerPanel.isVisible() && this.towerPanel.tower) {
            const t = this.towerPanel.tower;
            if (!this.towerManager.towers.includes(t)) {
                this.towerPanel.hide();
            } else {
                this.towerPanel.show(t,
                    this.towerPanel.container.x, this.towerPanel.container.y);
            }
        }
    }

    // ──── Events ────

    _onEnemyReachEnd(enemy) {
        this.lives -= Math.ceil(enemy.maxHp / 80);
        this.audio.play('lifeloss');
        if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver();
        }
    }

    _onEnemyDeath(enemy) {
        this.gold += enemy.reward;
        this.particleManager.burst(
            enemy.container.x, enemy.container.y,
            enemy.config.color, 8, 80, 0.35, 3
        );
        this.particleManager.coin(enemy.container.x, enemy.container.y);
        this.audio.play('death');
    }

    _onWaveStart(index) {
        this.audio.play('wave');
    }

    _onWaveComplete(index) {
        // Could show wave complete message
    }

    _onAllWavesComplete() {
        if (this.gameState === CONFIG.STATE_PLAYING) {
            this.victory();
        }
    }

    // ──── Tower Input ────

    _selectTowerType(type) {
        if (this.towerManager.selectedType === type) {
            this.towerManager.selectedType = null;
            this.hud.setSelectedType(null);
            this.previewGfx.visible = false;
        } else {
            this.towerManager.selectedType = type;
            this.hud.setSelectedType(type);
            this.towerPanel.hide();
        }
    }

    _upgradeTower(tower) {
        if (this.towerManager.upgradeTower(tower)) {
            this.audio.play('upgrade');
        }
        this.towerPanel.show(tower,
            this.towerPanel.container.x, this.towerPanel.container.y);
    }

    _sellTower(tower) {
        this.towerManager.sellTower(tower);
        this.audio.play('sell');
        this.towerPanel.hide();
    }

    // ──── Mouse ────

    _setupMouse(canvas) {
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this._handleClick(e.clientX, e.clientY);
        });
        canvas.addEventListener('mousemove', (e) => {
            this._handleMove(e.clientX, e.clientY);
        });

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                this._handleClick(t.clientX, t.clientY);
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                this._handleMove(t.clientX, t.clientY);
            }
        }, { passive: true });
    }

    _handleClick(clientX, clientY) {
        const rect = this.app.view.getBoundingClientRect();
        const sp = {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
        const wp = this.camera.screenToWorld(sp.x, sp.y);
        const gc = this.mapData.pixelToGrid(wp.x, wp.y);

        // Click on tower panel?
        if (this.towerPanel.isVisible()) {
            const p = this.towerPanel.container;
            if (sp.x >= p.x && sp.x <= p.x + 180 &&
                sp.y >= p.y && sp.y <= p.y + 200) {
                return;
            }
            this.towerPanel.hide();
        }

        // Click on placed tower?
        const clickedTower = this.towerManager.towers.find(t =>
            t.col === gc.col && t.row === gc.row
        );
        if (clickedTower) {
            this.towerManager.selectedType = null;
            this.hud.setSelectedType(null);
            const sp2 = this._worldToScreen(clickedTower.cx, clickedTower.cy);
            this.towerPanel.show(clickedTower, sp2.x, sp2.y);
            return;
        }

        // Place tower?
        if (this.towerManager.selectedType) {
            if (this.towerManager.placeTower(
                this.towerManager.selectedType, gc.col, gc.row
            )) {
                this.audio.play('place');
            }
            return;
        }

        // Deselect
        this.towerManager.selectedType = null;
        this.hud.setSelectedType(null);
        this.towerPanel.hide();
    }

    _worldToScreen(wx, wy) {
        const cam = this.camera;
        return {
            x: wx * cam.zoom + cam.offsetX,
            y: wy * cam.zoom + cam.offsetY,
        };
    }

    _handleMove(clientX, clientY) {
        const rect = this.app.view.getBoundingClientRect();
        const sp = {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
        const wp = this.camera.screenToWorld(sp.x, sp.y);
        const gc = this.mapData.pixelToGrid(wp.x, wp.y);

        if (this.towerManager.selectedType) {
            this.previewGfx.visible = true;
            const canPlace = this.towerManager.canPlace(gc.col, gc.row);
            const px = gc.col * CONFIG.TILE_SIZE;
            const py = gc.row * CONFIG.TILE_SIZE;
            this.previewGfx.clear();
            this.previewGfx.beginFill(canPlace ? 0x00ff00 : 0xff0000, 0.3);
            this.previewGfx.drawRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
            this.previewGfx.endFill();
        } else {
            this.previewGfx.visible = false;
        }
    }

    // ──── Keyboard ────

    _setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            switch (e.key) {
                case ' ':
                    this.togglePause();
                    e.preventDefault();
                    break;
                case 'r':
                case 'R':
                    if (this.gameState === CONFIG.STATE_WIN ||
                        this.gameState === CONFIG.STATE_GAMEOVER) {
                        this.levelUI.hide();
                        this.startGame(this.currentLevel);
                    }
                    break;
                case 'Enter':
                    if (this.gameState === CONFIG.STATE_IDLE) {
                        this.levelUI.hide();
                        this.startGame(this.currentLevel);
                    }
                    break;
            }
        });
    }

    // ──── Public API ────

    startGame(levelIndex = 0) {
        this.currentLevel = levelIndex;
        this._buildLevel(levelIndex);

        // Reset managers
        this.enemyManager.pathManager = this.pathManager;
        this.enemyManager.clear();
        this.towerManager.clear();
        this.particleManager.clear();

        // Reset wave manager
        this.waveManager = new WaveManager(WAVES, this.enemyManager, {
            onWaveStart: (i) => this._onWaveStart(i),
            onWaveComplete: (i) => this._onWaveComplete(i),
            onAllComplete: () => this._onAllWavesComplete(),
        });
        this.waveManager.start();

        // Reset state
        this.gameState = CONFIG.STATE_PLAYING;
        this.gold = CONFIG.START_GOLD;
        this.lives = CONFIG.START_LIVES;
        this.towerPanel.hide();
        this.towerManager.selectedType = null;
        this.hud.setSelectedType(null);

        console.log('[Game] 开始关卡:', LEVELS[levelIndex].name);
        this.emit('gameStart');
    }

    togglePause() {
        if (this.gameState === CONFIG.STATE_PLAYING) {
            this.gameState = CONFIG.STATE_PAUSED;
            this.emit('pause');
        } else if (this.gameState === CONFIG.STATE_PAUSED) {
            this.gameState = CONFIG.STATE_PLAYING;
            this.emit('resume');
        }
    }

    gameOver() {
        if (this.gameState === CONFIG.STATE_GAMEOVER) return;
        this.gameState = CONFIG.STATE_GAMEOVER;
        this.audio.play('gameover');
        this.levelUI.showResult(false, this.currentLevel, this.lives, this.gold,
            this.waveManager.getCurrentWave());
        this.emit('gameOver');
    }

    victory() {
        if (this.gameState === CONFIG.STATE_WIN) return;
        this.gameState = CONFIG.STATE_WIN;
        this.audio.play('victory');
        this.levelUI.showResult(true, this.currentLevel, this.lives, this.gold,
            this.waveManager.getCurrentWave());
        this.emit('victory');
    }

    on(event, fn) {
        (this._listeners[event] ||= []).push(fn);
    }
    emit(event, ...args) {
        (this._listeners[event] || []).forEach(fn => fn(...args));
    }
}
