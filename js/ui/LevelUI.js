class LevelUI {
    constructor(game) {
        this.game = game;
        this.container = new PIXI.Container();
        this.container.eventMode = 'static';

        this._buildLevelSelect();
        this._buildResultScreen();

        // Show level select immediately on init
        this.selectContainer.visible = true;
        this.resultContainer.visible = false;
        this.container.visible = true;
    }

    // ──── Level Select ────

    _buildLevelSelect() {
        this.selectContainer = new PIXI.Container();
        this.selectContainer.visible = false;

        const w = CONFIG.GAME_WIDTH;
        const h = CONFIG.GAME_HEIGHT;

        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.75);
        bg.drawRect(0, 0, w, h);
        bg.endFill();
        this.selectContainer.addChild(bg);

        const title = new PIXI.Text('萝卜保卫战', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 42,
            fill: 0xffdd44,
            fontWeight: 'bold',
        });
        title.anchor = { x: 0.5, y: 0.5 };
        title.x = w / 2;
        title.y = 80;
        this.selectContainer.addChild(title);

        const subtitle = new PIXI.Text('选择关卡', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 16,
            fill: 0xaaaaaa,
        });
        subtitle.anchor = { x: 0.5, y: 0.5 };
        subtitle.x = w / 2;
        subtitle.y = 125;
        this.selectContainer.addChild(subtitle);

        const levels = LEVELS;
        const btnW = 220;
        const btnH = 70;
        const gap = 16;
        const totalH = levels.length * (btnH + gap);
        const startY = (h - totalH) / 2 + 50;

        this._levelButtons = [];

        levels.forEach((level, i) => {
            const y = startY + i * (btnH + gap);

            const btn = new PIXI.Container();
            btn.eventMode = 'static';
            btn.cursor = 'pointer';

            const unlocked = SaveSystem.isUnlocked(i);
            const stars = SaveSystem.getStars(i);

            const bg2 = new PIXI.Graphics();
            if (unlocked) {
                bg2.beginFill(0x334466, 0.9);
                bg2.lineStyle(2, 0x6688aa, 0.8);
            } else {
                bg2.beginFill(0x222233, 0.7);
                bg2.lineStyle(1, 0x444466, 0.5);
            }
            bg2.drawRoundedRect(0, 0, btnW, btnH, 10);
            bg2.endFill();
            btn.addChild(bg2);

            const nameText = new PIXI.Text(
                (unlocked ? '' : '? ') + level.name,
                {
                    fontFamily: '"Microsoft YaHei", sans-serif',
                    fontSize: 20,
                    fill: unlocked ? 0xffffff : 0x666666,
                    fontWeight: unlocked ? 'bold' : 'normal',
                }
            );
            nameText.x = 20;
            nameText.y = 12;
            btn.addChild(nameText);

            const infoText = new PIXI.Text(
                unlocked ? (level.waves + ' 波') : '未解锁',
                {
                    fontFamily: '"Microsoft YaHei", sans-serif',
                    fontSize: 13,
                    fill: unlocked ? 0x88aacc : 0x444444,
                }
            );
            infoText.x = 20;
            infoText.y = 44;
            btn.addChild(infoText);

            // Stars
            if (stars > 0) {
                const starText = new PIXI.Text(
                    '★'.repeat(stars) + '☆'.repeat(3 - stars),
                    {
                        fontFamily: 'sans-serif',
                        fontSize: 18,
                        fill: 0xffdd44,
                    }
                );
                starText.x = btnW - 80;
                starText.y = 12;
                btn.addChild(starText);
            }

            btn.x = w / 2 - btnW / 2;
            btn.y = y;

            if (unlocked) {
                btn.on('pointerdown', () => {
                    this.game.startGame(i);
                    this.hide();
                });
            }

            this.selectContainer.addChild(btn);
            this._levelButtons.push(btn);
        });

        // Reset progress button
        const resetBtn = new PIXI.Text('重置进度', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 12,
            fill: 0x666666,
        });
        resetBtn.eventMode = 'static';
        resetBtn.cursor = 'pointer';
        resetBtn.x = w - 80;
        resetBtn.y = h - 30;
        resetBtn.on('pointerdown', () => {
            SaveSystem.reset();
            this.showLevelSelect(); // refresh
        });
        this.selectContainer.addChild(resetBtn);

        this.container.addChild(this.selectContainer);
    }

    // ──── Result Screen ────

    _buildResultScreen() {
        this.resultContainer = new PIXI.Container();
        this.resultContainer.visible = false;

        const w = CONFIG.GAME_WIDTH;
        const h = CONFIG.GAME_HEIGHT;
        const pw = 360;
        const ph = 300;
        const px = (w - pw) / 2;
        const py = (h - ph) / 2;

        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.7);
        bg.drawRect(0, 0, w, h);
        bg.endFill();
        this.resultContainer.addChild(bg);

        const panel = new PIXI.Graphics();
        panel.beginFill(0x222244, 0.95);
        panel.lineStyle(2, 0x6688cc, 0.8);
        panel.drawRoundedRect(px, py, pw, ph, 12);
        panel.endFill();
        this.resultContainer.addChild(panel);

        this.resultTitle = new PIXI.Text('', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 32,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        this.resultTitle.anchor = { x: 0.5, y: 0.5 };
        this.resultTitle.x = w / 2;
        this.resultTitle.y = py + 50;
        this.resultContainer.addChild(this.resultTitle);

        this.starsText = new PIXI.Text('', {
            fontFamily: 'sans-serif',
            fontSize: 40,
            fill: 0xffdd44,
        });
        this.starsText.anchor = { x: 0.5, y: 0.5 };
        this.starsText.x = w / 2;
        this.starsText.y = py + 110;
        this.resultContainer.addChild(this.starsText);

        this.resultStats = new PIXI.Text('', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 14,
            fill: 0xaaaaaa,
        });
        this.resultStats.anchor = { x: 0.5, y: 0.5 };
        this.resultStats.x = w / 2;
        this.resultStats.y = py + 165;
        this.resultContainer.addChild(this.resultStats);

        // Buttons
        const btnW = 130;
        const btnH = 40;

        const restartBtn = new PIXI.Container();
        restartBtn.eventMode = 'static';
        restartBtn.cursor = 'pointer';
        const restartBg = new PIXI.Graphics();
        restartBg.beginFill(0x227722, 0.9);
        restartBg.drawRoundedRect(0, 0, btnW, btnH, 8);
        restartBg.endFill();
        restartBtn.addChild(restartBg);
        const restartText = new PIXI.Text('重新开始', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 16,
            fill: 0xffffff,
        });
        restartText.anchor = { x: 0.5, y: 0.5 };
        restartText.x = btnW / 2;
        restartText.y = btnH / 2;
        restartBtn.addChild(restartText);
        restartBtn.x = w / 2 - btnW - 10;
        restartBtn.y = py + ph - 80;
        restartBtn.on('pointerdown', () => {
            this.game.startGame(this.game.currentLevel);
            this.hide();
        });
        this.resultContainer.addChild(restartBtn);
        this.restartBtn = restartBtn;

        const menuBtn = new PIXI.Container();
        menuBtn.eventMode = 'static';
        menuBtn.cursor = 'pointer';
        const menuBg = new PIXI.Graphics();
        menuBg.beginFill(0x444466, 0.9);
        menuBg.drawRoundedRect(0, 0, btnW, btnH, 8);
        menuBg.endFill();
        menuBtn.addChild(menuBg);
        const menuText = new PIXI.Text('返回菜单', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 16,
            fill: 0xffffff,
        });
        menuText.anchor = { x: 0.5, y: 0.5 };
        menuText.x = btnW / 2;
        menuText.y = btnH / 2;
        menuBtn.addChild(menuText);
        menuBtn.x = w / 2 + 10;
        menuBtn.y = py + ph - 80;
        menuBtn.on('pointerdown', () => {
            this.showLevelSelect();
        });
        this.resultContainer.addChild(menuBtn);
        this.menuBtn = menuBtn;

        // Keyboard hint
        const hintText = new PIXI.Text('按 R 重新开始', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: 11,
            fill: 0x666666,
        });
        hintText.anchor = { x: 0.5, y: 0.5 };
        hintText.x = w / 2;
        hintText.y = py + ph - 20;
        this.resultContainer.addChild(hintText);

        this.container.addChild(this.resultContainer);
    }

    // ──── Public Methods ────

    showLevelSelect() {
        this._refreshStars();
        this.selectContainer.visible = true;
        this.resultContainer.visible = false;
        this.container.visible = true;
    }

    /** Refresh star display on level buttons */
    _refreshStars() {
        if (!this._levelButtons) return;
        // Remove old star texts and add updated ones
        const containers = this.selectContainer.children;
        // Level buttons start at index 1 (after bg) through level count
        const levels = LEVELS;
        for (let i = 0; i < levels.length; i++) {
            const btn = this._levelButtons[i];
            if (!btn) continue;
            const stars = SaveSystem.getStars(i);
            // Remove old star text (child at index -1 or last child after name+info)
            // Reuse or recreate: remove last child if it starts with ★ or ☆
            const lastChild = btn.children[btn.children.length - 1];
            if (lastChild && lastChild instanceof PIXI.Text &&
                (lastChild.text.includes('★') || lastChild.text.includes('☆'))) {
                btn.removeChild(lastChild);
                lastChild.destroy();
            }
            if (stars > 0) {
                const starText = new PIXI.Text(
                    '★'.repeat(stars) + '☆'.repeat(3 - stars),
                    { fontFamily: 'sans-serif', fontSize: 18, fill: 0xffdd44 }
                );
                starText.x = 220 - 80;
                starText.y = 12;
                btn.addChild(starText);
            }
        }
    }

    showResult(won, levelIndex, lives, gold, wave) {
        this.selectContainer.visible = false;
        this.resultContainer.visible = true;
        this.container.visible = true;

        let stars = 0;
        if (won) {
            this.resultTitle.text = '胜利!';
            this.resultTitle.style.fill = 0x44ff44;
            const maxLives = CONFIG.START_LIVES;
            if (lives > maxLives * 0.6) stars = 3;
            else if (lives > maxLives * 0.3) stars = 2;
            else stars = 1;
        } else {
            this.resultTitle.text = '失败';
            this.resultTitle.style.fill = 0xff4444;
            stars = 0;
        }

        this.starsText.text = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        this.resultStats.text = '剩余生命: ' + lives + '  金币: ' + gold;

        this.restartBtn.visible = true;

        // Save progress
        if (won || stars > 0) {
            SaveSystem.save(levelIndex, stars, won);
        }
    }

    hide() {
        this.container.visible = false;
    }

    isVisible() {
        return this.container.visible;
    }
}
