// 1. 初始化邏輯層 (必須在 Scene 之前)
let logic = new GameLogic(); 

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        // 初始化類別變數
        this.sprites = [];
        this.tileSize = 60;
        this.offset = { x: 45, y: 350 };
        this.isAnimating = false;
        this.firstSelect = null;
    }

    preload() {
        this.load.image('type0', 'assets/ice/item.png');
        this.load.image('type1', 'assets/fire/item.png');
        this.load.image('type2', 'assets/thunder/item.png');
        this.load.image('type3', 'assets/poison/item.png');
    }

    create() {
        // --- A. 讀取數據 ---
        const savedData = localStorage.getItem('match3_save_data');
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.assign(logic, data);
        } else {
            logic.initBoard();
        }

        // --- B. UI 佈局 ---
        this.add.rectangle(225, 160, 420, 280, 0x333333).setStrokeStyle(2, 0x555555);
        
        this.levelText = this.add.text(225, 20, `LEVEL: ${logic.currentLevel} | 玩家等級: ${logic.playerLevel}`, { 
            fontSize: '18px', color: '#aaaaaa' 
        }).setOrigin(0.5);

        this.hpText = this.add.text(50, 40, `BOSS: ${Math.max(0, logic.monsterHP)}`, { 
            fontSize: '28px', color: '#ff4444', fontStyle: 'bold' 
        });
        
        this.playerHPText = this.add.text(50, 80, `HP: ${logic.playerHP} / ${logic.playerMaxHP}`, { 
            fontSize: '24px', color: '#44ff44', fontStyle: 'bold' 
        });

        // 經驗值條
        this.expText = this.add.text(50, 115, `EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`, {
            fontSize: '14px', color: '#ffff00'
        });
        this.add.graphics().fillStyle(0x000000, 0.5).fillRect(50, 135, 350, 8);
        this.expBar = this.add.graphics();
        
        this.statusText = this.add.text(50, 150, `攻擊力: ${logic.baseAttackPower}`, { 
            fontSize: '16px', color: '#ffffff' 
        });

        // 返回主選單按鈕
        let homeBtn = this.add.text(410, 30, "🏠", { fontSize: '30px' }).setInteractive();
        homeBtn.on('pointerdown', () => this.scene.start('MainMenu'));

        this.updateExpUI();
        this.createBoard();
    }

    // --- 核心戰鬥方法 ---

    updateExpUI() {
        this.expBar.clear();
        this.expBar.fillStyle(0xffff00, 1);
        let ratio = Math.min(1, logic.playerEXP / logic.expToNextLevel);
        this.expBar.fillRect(50, 135, 350 * ratio, 8);
        this.expText.setText(`EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`);
    }

    createBoard() {
        for (let r = 0; r < logic.rows; r++) {
            this.sprites[r] = [];
            for (let c = 0; c < logic.cols; c++) {
                this.renderTile(r, c);
            }
        }
    }

    renderTile(r, c) {
        let x = this.offset.x + c * this.tileSize;
        let y = this.offset.y + r * this.tileSize;
        let type = logic.board[r][c];
        let sprite = this.add.sprite(x, y, 'type' + type).setInteractive();
        sprite.setDisplaySize(50, 50);
        sprite.setData('pos', { r, c });
        sprite.on('pointerdown', () => this.handleSelect(sprite));
        this.sprites[r][c] = sprite;
    }

    handleSelect(sprite) {
        if (this.isAnimating) return;
        if (!this.firstSelect) {
            this.firstSelect = sprite;
            sprite.setAlpha(0.6).setScale(1.1);
        } else {
            let p1 = this.firstSelect.getData('pos');
            let p2 = sprite.getData('pos');
            if (Math.abs(p1.r - p2.r) + Math.abs(p1.c - p2.c) === 1) {
                this.swapTiles(p1, p2);
            }
            this.firstSelect.setAlpha(1).setScale(1);
            this.firstSelect = null;
        }
    }

    async swapTiles(p1, p2) {
        this.isAnimating = true;
        let temp = logic.board[p1.r][p1.c];
        logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
        logic.board[p2.r][p2.c] = temp;

        await this.performSwapAnimation(p1, p2);
        let matches = logic.checkMatches();
        
        if (matches.length > 0) {
            await this.processMatches(matches);
        } else {
            let undo = logic.board[p1.r][p1.c];
            logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
            logic.board[p2.r][p2.c] = undo;
            await this.performSwapAnimation(p1, p2);
        }
        this.isAnimating = false;
    }

    performSwapAnimation(p1, p2) {
        return new Promise(resolve => {
            let s1 = this.sprites[p1.r][p1.c];
            let s2 = this.sprites[p2.r][p2.c];
            this.tweens.add({ targets: s1, x: this.offset.x + p2.c * this.tileSize, y: this.offset.y + p2.r * this.tileSize, duration: 200 });
            this.tweens.add({
                targets: s2, x: this.offset.x + p1.c * this.tileSize, y: this.offset.y + p1.r * this.tileSize, duration: 200,
                onComplete: () => {
                    this.sprites[p1.r][p1.c] = s2;
                    this.sprites[p2.r][p2.c] = s1;
                    s1.setData('pos', { r: p2.r, c: p2.c });
                    s2.setData('pos', { r: p1.r, c: p1.c });
                    resolve();
                }
            });
        });
    }

    async processMatches(matches) {
        let result = logic.calculateEffect(matches);
        this.hpText.setText(`BOSS: ${Math.max(0, logic.monsterHP)}`);
        
        // 消除動畫
        let promises = matches.map(m => {
            let s = this.sprites[m.r][m.c];
            logic.board[m.r][m.c] = null;
            return new Promise(res => {
                this.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 200, onComplete: () => { s.destroy(); res(); } });
            });
        });
        await Promise.all(promises);
        await this.dropAndFill();
        
        if (logic.monsterHP <= 0) {
            this.handleVictory();
        } else {
            this.handleMonsterTurn();
        }
    }

    // ... 其他方法 (dropAndFill, handleMonsterTurn 等) 均比照辦理 ...
    handleVictory() {
        logic.nextLevel();
        this.add.text(225, 400, "戰鬥勝利！", { fontSize: '48px', color: '#ffff00' }).setOrigin(0.5);
        setTimeout(() => this.scene.start('MainMenu'), 2000);
    }
}

// --- 4. 最終啟動配置 (請確認順序) ---
const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    backgroundColor: '#1a1a1a',
    parent: 'game-container',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [MainMenu, GameScene] // MainMenu 先載入
};

const game = new Phaser.Game(config);
