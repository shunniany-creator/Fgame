const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    backgroundColor: '#1a1a1a',
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let logic = new GameLogic();
let hand; // 手勢操作管家 (處理拖拽細節)
let sprites = [];
let tileSize = 60;
let offset = { x: 45, y: 350 }; 

// UI 變數
let hpText, playerHPText, statusText, levelText, expText;
let expBar, expBarBg; // 經驗條組件
let isAnimating = false;

function preload() {
    this.load.image('type0', 'assets/ice/item.png');
    this.load.image('type1', 'assets/fire/item.png');
    this.load.image('type2', 'assets/thunder/item.png');
    this.load.image('type3', 'assets/poison/item.png');
    this.load.spritesheet('mainAssets', 'assets/spritesheet.png', { 
        frameWidth: 64, 
        frameHeight: 64 
    });
}

function create() {
    // --- 1. 讀取存檔數據 (加入等級與經驗) ---
    const savedData = localStorage.getItem('match3_save_data');
    if (savedData) {
        const data = JSON.parse(savedData);
        logic.board = data.board;
        logic.playerHP = data.playerHP;
        logic.playerMaxHP = data.playerMaxHP || 100;
        logic.playerLevel = data.playerLevel || 1;
        logic.playerEXP = data.playerEXP || 0;
        logic.expToNextLevel = data.expToNextLevel || 100;
        logic.baseAttackPower = data.baseAttackPower || 10;
        logic.monsterHP = data.monsterHP;
        logic.currentLevel = data.currentLevel || 1;
        logic.monsterMaxHP = data.monsterMaxHP || 1000;
    } else {
        logic.initBoard();
    }

    // --- 2. 戰鬥 UI 佈局 ---
    this.add.rectangle(225, 160, 420, 280, 0x333333).setStrokeStyle(2, 0x555555);
    
    // 關卡與等級顯示
    levelText = this.add.text(225, 20, `LEVEL: ${logic.currentLevel} | 玩家等級: ${logic.playerLevel}`, { 
        fontSize: '20px', color: '#aaaaaa' 
    }).setOrigin(0.5);

    // 怪物資訊
    hpText = this.add.text(50, 40, `BOSS HP: ${Math.max(0, logic.monsterHP)}`, { 
        fontSize: '28px', color: '#ff4444', fontStyle: 'bold' 
    });
    
    // 玩家資訊
    playerHPText = this.add.text(50, 80, `PLAYER HP: ${logic.playerHP} / ${logic.playerMaxHP}`, { 
        fontSize: '24px', color: '#44ff44', fontStyle: 'bold' 
    });

    // --- 經驗值條實作 ---
    expText = this.add.text(50, 115, `EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`, {
        fontSize: '14px', color: '#ffff00'
    });
    
    expBarBg = this.add.graphics();
    expBarBg.fillStyle(0x000000, 0.5);
    expBarBg.fillRect(50, 135, 350, 8); // 背景黑條

    expBar = this.add.graphics();
    updateExpUI(); // 初始繪製經驗條

    statusText = this.add.text(50, 150, `攻擊力: ${logic.baseAttackPower} | 倍率: x1.00`, { 
        fontSize: '16px', color: '#ffffff' 
    });

    this.add.text(225, 310, "拖拽方塊進行消除", { fontSize: '14px', color: '#888' }).setOrigin(0.5);

    // --- 3. 初始化 Hand (傳入 swapTiles 作為回調) ---
    hand = new Hand(this, logic, tileSize, offset, (p1, p2) => {
        swapTiles(this, p1, p2);
    });

    createBoard(this);
}

// 更新經驗條與文字的函式
function updateExpUI() {
    expBar.clear();
    expBar.fillStyle(0xffff00, 1); // 金黃色
    let ratio = Math.min(1, logic.playerEXP / logic.expToNextLevel);
    expBar.fillRect(50, 135, 350 * ratio, 8);
    expText.setText(`EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`);
    levelText.setText(`LEVEL: ${logic.currentLevel} | 玩家等級: ${logic.playerLevel}`);
}

function createBoard(scene) {
    for (let r = 0; r < logic.rows; r++) {
        sprites[r] = [];
        for (let c = 0; c < logic.cols; c++) {
            renderTile(scene, r, c);
        }
    }
}

function renderTile(scene, r, c) {
    let x = offset.x + c * tileSize;
    let y = offset.y + r * tileSize;
    let type = logic.board[r][c];
    
    let sprite = scene.add.sprite(x, y, 'type' + type).setInteractive();
    sprite.setDisplaySize(50, 50);
    sprite.setData('pos', {r, c});
    
    // --- 新增：紀錄原始座標供 Hand 使用 ---
    sprite.setData('originX', x);
    sprite.setData('originY', y);
    
    // 啟用拖拽功能
    scene.input.setDraggable(sprite); 
    
    sprites[r][c] = sprite;
    return sprite;
}

// 移除原本的 handleSelect，改由 swapTiles 由 hand.js 觸發
async function swapTiles(scene, p1, p2) {
    isAnimating = true;
    hand.setAnimating(true); // 鎖定操作

    let temp = logic.board[p1.r][p1.c];
    logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
    logic.board[p2.r][p2.c] = temp;

    await performSwapAnimation(scene, p1, p2);

    let matches = logic.checkMatches();
    if (matches.length > 0) {
        await processMatches(scene, matches);
    } else {
        // 回彈邏輯：沒有匹配則換回來
        let undo = logic.board[p1.r][p1.c];
        logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
        logic.board[p2.r][p2.c] = undo;
        await performSwapAnimation(scene, p1, p2);
    }

    isAnimating = false;
    hand.setAnimating(false); // 解除鎖定
}

function performSwapAnimation(scene, p1, p2) {
    return new Promise(resolve => {
        let s1 = sprites[p1.r][p1.c];
        let s2 = sprites[p2.r][p2.c];
        
        let x1 = offset.x + p1.c * tileSize;
        let y1 = offset.y + p1.r * tileSize;
        let x2 = offset.x + p2.c * tileSize;
        let y2 = offset.y + p2.r * tileSize;

        scene.tweens.add({
            targets: s1, x: x2, y: y2, duration: 200, ease: 'Power2',
            onComplete: () => hand.updateOrigin(s1, x2, y2)
        });

        scene.tweens.add({
            targets: s2, x: x1, y: y1, duration: 200, ease: 'Power2',
            onComplete: () => {
                hand.updateOrigin(s2, x1, y1);
                // 更新 sprites 陣列與數據同步
                sprites[p1.r][p1.c] = s2;
                sprites[p2.r][p2.c] = s1;
                s1.setData('pos', { r: p2.r, c: p2.c });
                s2.setData('pos', { r: p1.r, c: p1.c });
                resolve();
            }
        });
    });
}

async function processMatches(scene, matches) {
    let result = logic.calculateEffect(matches);
    hpText.setText(`BOSS HP: ${Math.max(0, logic.monsterHP)}`);
    statusText.setText(`攻擊力: ${logic.baseAttackPower} | 倍率: x${result.currentMultiplier.toFixed(2)} | 狀態: ${result.hasFrozen ? '❄️凍結' : ''} ${result.hasBurning ? '🔥燃燒' : '正常'}`);

    let promiseArray = [];
    matches.forEach(m => {
        let s = sprites[m.r][m.c];
        logic.board[m.r][m.c] = null;
        promiseArray.push(new Promise(resolve => {
            scene.tweens.add({
                targets: s,
                scale: 0, angle: 90,
                duration: 200,
                onComplete: () => { s.destroy(); resolve(); }
            });
        }));
    });
    await Promise.all(promiseArray);
    await dropAndFill(scene);
    saveGameProgress();

    let nextMatches = logic.checkMatches();
    if (nextMatches.length > 0) {
        await processMatches(scene, nextMatches);
    } else {
        if (logic.monsterHP <= 0) {
            handleVictory(scene);
        } else {
            handleMonsterTurn(scene);
        }
    }
}

function handleMonsterTurn(scene) {
    let dmg = logic.monsterAttack();
    playerHPText.setText(`PLAYER HP: ${logic.playerHP} / ${logic.playerMaxHP}`);
    scene.cameras.main.shake(250, 0.02);
    let flash = scene.add.rectangle(225, 400, 450, 800, 0xff0000, 0.3);
    scene.tweens.add({
        targets: flash, alpha: 0, duration: 300,
        onComplete: () => flash.destroy()
    });
    if (logic.playerHP <= 0) {
        isAnimating = true;
        hand.setAnimating(true);
        setTimeout(() => {
            if (confirm("你戰敗了！要觀看影片復活並恢復 50% 生命嗎？")) {
                logic.revivePlayer();
                playerHPText.setText(`PLAYER HP: ${logic.playerHP} / ${logic.playerMaxHP}`);
                saveGameProgress();
                isAnimating = false;
                hand.setAnimating(false);
            } else {
                alert("挑戰失敗！進度將重置。");
                localStorage.removeItem('match3_save_data');
                location.reload();
            }
        }, 500);
    }
    logic.endTurn();
    saveGameProgress();
}

function handleVictory(scene) {
    isAnimating = true;
    hand.setAnimating(true);
    // 呼叫邏輯層處理 EXP 並進入下一關
    const result = logic.nextLevel(); 

    let levelUpMsg = result.leveledUp ? "\n✨ LEVEL UP！屬性提升 ✨" : "";
    let vText = scene.add.text(225, 400, `戰鬥勝利！\n獲得 ${result.expGained} EXP${levelUpMsg}\n下一關：Level ${logic.currentLevel}`, {
        fontSize: '32px', color: '#ffff00', fontStyle: 'bold', align: 'center',
        backgroundColor: '#000000aa', padding: { x: 20, y: 20 }
    }).setOrigin(0.5).setDepth(100);

    scene.cameras.main.flash(500, 255, 255, 255);
    updateExpUI(); // 獲取經驗後更新 UI

    setTimeout(() => {
        saveGameProgress();
        scene.scene.restart();
        isAnimating = false;
        hand.setAnimating(false);
    }, 2500);
}

function saveGameProgress() {
    const gameState = {
        playerLevel: logic.playerLevel,
        playerEXP: logic.playerEXP,
        expToNextLevel: logic.expToNextLevel,
        playerHP: logic.playerHP,
        playerMaxHP: logic.playerMaxHP,
        baseAttackPower: logic.baseAttackPower,
        currentLevel: logic.currentLevel,
        monsterHP: logic.monsterHP,
        monsterMaxHP: logic.monsterMaxHP,
        board: logic.board
    };
    localStorage.setItem('match3_save_data', JSON.stringify(gameState));
}

async function dropAndFill(scene) {
    let dropTweens = [];
    for (let c = 0; c < logic.cols; c++) {
        let emptySpots = 0;
        for (let r = logic.rows - 1; r >= 0; r--) {
            if (logic.board[r][c] === null) {
                emptySpots++;
            } else if (emptySpots > 0) {
                logic.board[r + emptySpots][c] = logic.board[r][c];
                logic.board[r][c] = null;
                let sprite = sprites[r][c];
                sprites[r + emptySpots][c] = sprite;
                sprites[r][c] = null;
                sprite.setData('pos', { r: r + emptySpots, c: c });
                
                dropTweens.push(new Promise(res => {
                    let targetY = offset.y + (r + emptySpots) * tileSize;
                    scene.tweens.add({
                        targets: sprite,
                        y: targetY,
                        duration: 300, ease: 'Back.easeOut',
                        onComplete: () => {
                            // 同步新的原始座標
                            hand.updateOrigin(sprite, sprite.x, targetY);
                            res();
                        }
                    });
                }));
            }
        }
        for (let i = 0; i < emptySpots; i++) {
            let r = i;
            let type = Math.floor(Math.random() * 4);
            logic.board[r][c] = type;
            let sprite = renderTile(scene, r, c);
            sprite.y = offset.y - (i + 1) * tileSize;
            dropTweens.push(new Promise(res => {
                let targetY = offset.y + r * tileSize;
                scene.tweens.add({
                    targets: sprite,
                    y: targetY,
                    duration: 300, ease: 'Back.easeOut',
                    onComplete: () => {
                        hand.updateOrigin(sprite, sprite.x, targetY);
                        res();
                    }
                });
            }));
        }
    }
    await Promise.all(dropTweens);
}
function update() {}
