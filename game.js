const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    backgroundColor: '#1a1a1a',
    parent: 'game-container',
    scale: {
        // 關鍵屬性：自動調整大小以適應屏幕
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: { preload: preload, create: create, update: update }
};
const game = new Phaser.Game(config);
let logic = new GameLogic();
let sprites = [];
let tileSize = 60;
let offset = { x: 45, y: 350 }; 

// UI 變數
let hpText, playerHPText, statusText;
let isAnimating = false;

function preload() {
    // 載入屬性方塊 (0:冰, 1:火, 2:雷, 3:毒)
    this.load.image('type0', 'assets/ice/item.png');
    this.load.image('type1', 'assets/fire/item.png');
    this.load.image('type2', 'assets/thunder/item.png');
    this.load.image('type3', 'assets/poison/item.png');
    
    // 載入角色精靈圖
    this.load.spritesheet('mainAssets', 'assets/spritesheet.png', { 
        frameWidth: 64, 
        frameHeight: 64 
    });
}

function create() {
    // --- 戰鬥 UI 佈局 ---
    // 戰鬥背景區域
    this.add.rectangle(225, 160, 420, 280, 0x333333).setStrokeStyle(2, 0x555555);
    
    // 怪物資訊
    hpText = this.add.text(50, 40, `BOSS HP: ${logic.monsterHP}`, { 
        fontSize: '28px', color: '#ff4444', fontStyle: 'bold' 
    });
    
    // 玩家資訊 (生財核心)
    playerHPText = this.add.text(50, 80, `PLAYER HP: ${logic.playerHP}`, { 
        fontSize: '24px', color: '#44ff44', fontStyle: 'bold' 
    });
    
    statusText = this.add.text(50, 120, `倍率: x1.00 | 狀態: 正常`, { 
        fontSize: '18px', color: '#ffffff' 
    });

    // 提示文字
    this.add.text(225, 310, "滑動方塊進行消除", { fontSize: '14px', color: '#888' }).setOrigin(0.5);

    // 初始化棋盤
    createBoard(this);
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
    
    sprite.on('pointerdown', () => handleSelect(scene, sprite));
    sprites[r][c] = sprite;
    return sprite;
}

let firstSelect = null;

function handleSelect(scene, sprite) {
    if (isAnimating) return;

    if (!firstSelect) {
        firstSelect = sprite;
        sprite.setAlpha(0.6).setScale(1.1);
    } else {
        let p1 = firstSelect.getData('pos');
        let p2 = sprite.getData('pos');

        if (Math.abs(p1.r - p2.r) + Math.abs(p1.c - p2.c) === 1) {
            swapTiles(scene, p1, p2);
        }
        
        firstSelect.setAlpha(1).setScale(1);
        firstSelect = null;
    }
}

async function swapTiles(scene, p1, p2) {
    isAnimating = true;

    // 1. 執行邏輯交換
    let temp = logic.board[p1.r][p1.c];
    logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
    logic.board[p2.r][p2.c] = temp;

    // 2. 執行交換動畫
    await performSwapAnimation(scene, p1, p2);

    // 3. 檢查是否有匹配
    let matches = logic.checkMatches();

    if (matches.length > 0) {
        // 有消除：執行後續戰鬥與掉落
        await processMatches(scene, matches);
    } else {
        // 沒消除：邏輯換回來
        let undo = logic.board[p1.r][p1.c];
        logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
        logic.board[p2.r][p2.c] = undo;

        // 執行「換回來」的動畫
        await performSwapAnimation(scene, p1, p2);
    }

    isAnimating = false;
}

// 提取出來的動畫函式，讓程式碼乾淨不亂跳
function performSwapAnimation(scene, p1, p2) {
    return new Promise(resolve => {
        // 交換 Sprite 引用
        let s1 = sprites[p1.r][p1.c];
        let s2 = sprites[p2.r][p2.c];

        scene.tweens.add({
            targets: s1,
            x: offset.x + p2.c * tileSize,
            y: offset.y + p2.r * tileSize,
            duration: 200,
            ease: 'Power1'
        });

        scene.tweens.add({
            targets: s2,
            x: offset.x + p1.c * tileSize,
            y: offset.y + p1.r * tileSize,
            duration: 200,
            ease: 'Power1',
            onComplete: () => {
                // 交換陣列中的 Sprite 引用並更新 Data
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
    // 1. 計算玩家攻擊
    let result = logic.calculateEffect(matches);
    hpText.setText(`BOSS HP: ${Math.max(0, logic.monsterHP)}`);
    statusText.setText(`倍率: x${result.currentMultiplier.toFixed(2)} | 狀態: ${result.hasFrozen ? '❄️凍結' : ''} ${result.hasBurning ? '🔥燃燒' : '正常'}`);

    // 2. 消除動畫
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

    // 3. 掉落補位
    await dropAndFill(scene);

    // 4. 檢查連擊 (Combo)
    let nextMatches = logic.checkMatches();
    if (nextMatches.length > 0) {
        await processMatches(scene, nextMatches);
    } else {
        // --- 玩家回合結束，怪物反擊 ---
        handleMonsterTurn(scene);
    }
}

function handleMonsterTurn(scene) {
    let dmg = logic.monsterAttack();
    playerHPText.setText(`PLAYER HP: ${logic.playerHP}`);
    
    // 受傷特效：螢幕震動 + 紅光閃爍
    scene.cameras.main.shake(250, 0.02);
    let flash = scene.add.rectangle(225, 400, 450, 800, 0xff0000, 0.3);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy()
    });

    // 檢查死亡 (觸發廣告點)
    if (logic.playerHP <= 0) {
        isAnimating = true;
        setTimeout(() => {
            if (confirm("你戰敗了！要觀看影片復活並恢復 50% 生命嗎？")) {
                logic.revivePlayer();
                playerHPText.setText(`PLAYER HP: ${logic.playerHP}`);
                isAnimating = false;
            } else {
                alert("挑戰失敗！");
                location.reload();
            }
        }, 500);
    }
    
    logic.endTurn();
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
                    scene.tweens.add({
                        targets: sprite,
                        y: offset.y + (r + emptySpots) * tileSize,
                        duration: 300, ease: 'Back.easeOut',
                        onComplete: res
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
                scene.tweens.add({
                    targets: sprite,
                    y: offset.y + r * tileSize,
                    duration: 300, ease: 'Back.easeOut',
                    onComplete: res
                });
            }));
        }
    }
    await Promise.all(dropTweens);
}

function update() {}