class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
    }

    create() {
        // 背景
        this.add.rectangle(225, 400, 450, 800, 0x1a1a1a);

        // --- 頂部資源列 (不格式化數字) ---
        // 銅錢
        this.add.rectangle(110, 40, 180, 40, 0x000000, 0.6).setOrigin(0.5);
        this.add.text(40, 40, "🪙", { fontSize: '24px' }).setOrigin(0.5);
        this.coinText = this.add.text(120, 40, logic.currency.coins, {
            fontSize: '20px', color: '#ffcc00', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 鑽石
        this.add.rectangle(340, 40, 180, 40, 0x000000, 0.6).setOrigin(0.5);
        this.add.text(270, 40, "💎", { fontSize: '24px' }).setOrigin(0.5);
        this.diamondText = this.add.text(350, 40, logic.currency.diamonds, {
            fontSize: '20px', color: '#00ffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 標題
        this.add.text(225, 200, "Merge Dungeon Rush", {
            fontSize: '36px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 進入關卡按鈕
        let startBtn = this.add.rectangle(225, 500, 240, 70, 0xee7700).setInteractive();
        this.add.text(225, 500, "進入關卡", { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        
        startBtn.on('pointerdown', () => {
            this.scene.start('GameScene'); // 切換到戰鬥畫面
        });

        // 提示
        this.add.text(225, 750, "當前進度：Level " + logic.currentLevel, { fontSize: '16px', color: '#888' }).setOrigin(0.5);
    }

    update() {
        // 即時刷新數字
        this.coinText.setText(logic.currency.coins);
        this.diamondText.setText(logic.currency.diamonds);
    }
}
