// 1. 全域變數與邏輯層初始化
let logic = new GameLogic(); 

// 2. 定義戰鬥場景類別
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        // 將原本的全域變數移至類別屬性
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
        // --- A. 讀取存檔 ---
        this.loadProgress();

        // --- B. 戰鬥 UI 佈局 ---
        this.add.rectangle(225, 160, 420, 280, 0x333333).setStrokeStyle(2, 0x555555);
        
        this.levelText = this.add.text(225, 20, `LEVEL: ${logic.currentLevel} | 玩家等級: ${logic.playerLevel}`, { 
            fontSize: '20px', color: '#aaaaaa' 
        }).setOrigin(0.5);

        this.hpText = this.add.text(50, 40, `BOSS HP: ${Math.max(0, logic.monsterHP)}`, { 
            fontSize: '28px', color: '#ff4444', fontStyle: 'bold' 
        });
        
        this.playerHPText = this.add.text(50, 80, `PLAYER HP: ${logic.playerHP} / ${logic.playerMaxHP}`, { 
            fontSize: '24px', color: '#44ff44', fontStyle: 'bold' 
        });

        // 經驗值條
        this.expText = this.add.text(50, 115, `EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`, {
            fontSize: '14px', color: '#ffff00'
        });
        this.expBarBg = this.add.graphics().fillStyle(0x000000, 0.5).fillRect(50, 135, 350, 8);
        this.expBar = this.add.graphics();
        
        this.statusText = this.add.text(50, 150, `攻擊力: ${logic.baseAttackPower} | 倍率: x1.00`, { 
            fontSize: '16px', color: '#ffffff' 
        });

        // 返回主畫面按鈕
        let homeBtn = this.add.text(400, 30, "🏠", { fontSize: '30px' }).setInteractive();
        homeBtn.on('pointerdown', () => this.scene.start('MainMenu'));

        // --- C. 初始化棋盤 ---
        this.updateExpUI();
        this.createBoard();
    }

    // --- 核心方法 (原本的 function 改為 method) ---

    loadProgress() {
        const savedData = localStorage.getItem('match3_save_data');
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.assign(logic, data); // 快速同步數據
        } else {
            logic.initBoard();
        }
    }

    updateExpUI() {
        this.expBar.clear();
        this.expBar.fillStyle(0xffff00, 1);
        let ratio = Math.min(1, logic.playerEXP / logic.expToNextLevel);
        this.expBar.fillRect(50, 135, 350 * ratio, 8);
        this.expText.setText(`EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`);
        this.levelText.setText(`LEVEL: ${logic.currentLevel} | 玩家等級: ${logic.playerLevel}`);
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
        return sprite;
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
            // 交換回去
            let undo = logic.board[p1.r][p1.c];
            logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
            logic.board[p2.r][p2.c] = undo;
            await this.performSwapAnimation(p1, p2);
        }
        this.isAnimating = false;
    }

    // ... (其餘 processMatches, handleVictory, dropAndFill 邏輯皆移入此類別並加 this) ...
    // 注意：存檔時請呼叫 logic.saveGameProgress() 或自定義方法
}

// 3. 啟動配置 (包含 MainMenu 與 GameScene)
const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    backgroundColor: '#1a1a1a',
    parent: 'game-container',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [MainMenu, GameScene] // 第一個是啟動場景
};

const game = new Phaser.Game(config);
