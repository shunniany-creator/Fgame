class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
    }

    create() {
        // --- 1. 背景與標題 ---
        this.add.rectangle(225, 400, 450, 800, 0x1a1a1a); // 深色背景
        this.add.text(225, 80, "元素傳說：消除戰記", {
            fontSize: '32px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // --- 2. 貨幣列 (頂部) ---
        this.drawTopBar();

        // --- 3. 角色展示區 ---
        // 假設玩家目前選中的角色，這裡可以畫一個大一點的角色精靈
        this.add.rectangle(225, 250, 200, 200, 0x333333).setStrokeStyle(2, 0xffff00);
        this.add.text(225, 370, "當前出戰：炎之勇者·艾格", { fontSize: '18px', color: '#ff4444' }).setOrigin(0.5);
        this.add.text(225, 400, `等級: ${logic.playerLevel}`, { fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);

        // --- 4. 主功能按鈕 (中間到下方) ---
        
        // 開始戰鬥按鈕
        let startBtn = this.createButton(225, 500, "進入冒險 (第 " + logic.currentLevel + " 關)", 0xee7700, () => {
            this.scene.start('GameScene'); // 跳轉到戰鬥畫面
        });

        // 抽卡系統入口
        let gachaBtn = this.createButton(120, 620, "召喚 (抽卡)", 0xaa00ff, () => {
            alert("前往召喚祭壇...");
        });

        // 商店入口
        let storeBtn = this.createButton(330, 620, "商店 (購買)", 0x00aa00, () => {
            alert("前往銅錢商店...");
        });

        // 合成工房入口
        let craftBtn = this.createButton(225, 720, "煉金工房 (合成角色)", 0x555555, () => {
            alert("收集物資中：鐵礦 8/10...");
        });
    }

    drawTopBar() {
        // 銅錢顯示
        this.add.rectangle(110, 30, 180, 40, 0x000000, 0.5).setOrigin(0.5);
        this.add.text(40, 30, "🪙", { fontSize: '20px' }).setOrigin(0.5);
        this.coinText = this.add.text(110, 30, logic.currency.coins, { fontSize: '18px', color: '#ffcc00' }).setOrigin(0.5);

        // 鑽石顯示
        this.add.rectangle(340, 30, 180, 40, 0x000000, 0.5).setOrigin(0.5);
        this.add.text(270, 30, "💎", { fontSize: '20px' }).setOrigin(0.5);
        this.diamondText = this.add.text(340, 30, logic.currency.diamonds, { fontSize: '18px', color: '#00ffff' }).setOrigin(0.5);
    }

    // 通用按鈕封裝
    createButton(x, y, label, color, callback) {
        let btn = this.add.container(x, y);
        let bg = this.add.rectangle(0, 0, 180, 60, color).setInteractive();
        let txt = this.add.text(0, 0, label, { fontSize: '18px', color: '#fff' }).setOrigin(0.5);
        
        bg.on('pointerdown', () => {
            bg.setScale(0.95);
        });
        bg.on('pointerup', () => {
            bg.setScale(1);
            callback();
        });

        btn.add([bg, txt]);
        return btn;
    }
}
