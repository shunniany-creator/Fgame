// 1. 初始化邏輯與全域變數
let logic = new GameLogic();
let sprites = [];
let tileSize = 60;
let offset = { x: 45, y: 350 }; 
let isAnimating = false;
let firstSelect = null;

// UI 變數引用
let hpText, playerHPText, statusText, levelText, expBar, expText;

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

// --- 資源載入 ---
function preload() {
    this.load.image('type0', 'assets/ice/item.png');
    this.load.image('type1', 'assets/fire/item.png');
    this.load.image('type2', 'assets/thunder/item.png');
    this.load.image('type3', 'assets/poison/item.png');
}

// --- 初始化場景 ---
function create() {
    // 繪製背景裝飾
    this.add.rectangle(225, 160, 420, 280, 0x333333).setStrokeStyle(2, 0x555555);
    
    // UI 文字初始化
    levelText = this.add.text(225, 20, '', { fontSize: '20px', color: '#aaaaaa' }).setOrigin(0.5);
    hpText = this.add.text(50, 40, '', { fontSize: '28px', color: '#ff4444', fontStyle: 'bold' });
    playerHPText = this.add.text(50, 80, '', { fontSize: '24px', color: '#44ff44', fontStyle: 'bold' });
    
    // 經驗條
    this.add.graphics().fillStyle(0x000000, 0.5).fillRect(50, 135, 350, 8);
    expBar = this.add.graphics();
    expText = this.add.text(50, 115, '', { fontSize: '14px', color: '#ffff00' });

    statusText = this.add.text(50, 150, '', { fontSize: '16px', color: '#ffffff' });

    updateUI();
    createBoard(this);
}

// --- 更新 UI 文字與進度條 ---
function updateUI() {
    hpText.setText(`BOSS HP: ${Math.max(0, logic.monsterHP)}`);
    playerHPText.setText(`PLAYER HP: ${logic.playerHP} / ${logic.playerMaxHP}`);
    levelText.setText(`LV.${logic.currentLevel} | 玩家等級: ${logic.playerLevel}`);
    expText.setText(`EXP: ${logic.playerEXP} / ${logic.expToNextLevel}`);
    
    expBar.clear();
    expBar.fillStyle(0xffff00, 1);
    let ratio = Math.min(1, logic.playerEXP / logic.expToNextLevel);
    expBar.fillRect(50, 135, 350 * ratio, 8);
    
    statusText.setText(`攻擊力: ${logic.baseAttackPower} | 倍率: x${logic.monsterStatus.damageMultiplier.toFixed(2)}`);
}

// --- 建立棋盤 ---
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
    sprite.setData('pos', { r, c });
    sprite.on('pointerdown', () => handleSelect(scene, sprite));
    sprites[r][c] = sprite;
    return sprite;
}

// --- 選擇邏輯 ---
function handleSelect(scene, sprite) {
    if (isAnimating) return;
    if (!firstSelect) {
        firstSelect = sprite;
        sprite.setAlpha(0.6).setScale(1.2);
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

// --- 交換動畫 ---
async function swapTiles(scene, p1, p2) {
    isAnimating = true;
    let temp = logic.board[p1.r][p1.c];
    logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
    logic.board[p2.r][p2.c] = temp;

    await performSwapAnimation(scene, p1, p2);
    let matches = logic.checkMatches();

    if (matches.length > 0) {
        await processMatches(scene, matches);
    } else {
        let undo = logic.board[p1.r][p1.c];
        logic.board[p1.r][p1.c] = logic.board[p2.r][p2.c];
        logic.board[p2.r][p2.c] = undo;
        await performSwapAnimation(scene, p1, p2);
    }
    isAnimating = false;
}

function performSwapAnimation(scene, p1, p2) {
    return new Promise(resolve => {
        let s1 = sprites[p1.r][p1.c];
        let s2 = sprites[p2.r][p2.c];
        scene.tweens.add({ targets: s1, x: offset.x + p2.c * tileSize, y: offset.y + p2.r * tileSize, duration: 200 });
        scene.tweens.add({
            targets: s2, x: offset.x + p1.c * tileSize, y: offset.y + p1.r * tileSize, duration: 200,
            onComplete: () => {
                sprites[p1.r][p1.c] = s2;
                sprites[p2.r][p2.c] = s1;
                s1.setData('pos', { r: p2.r, c: p2.c });
                s2.setData('pos', { r: p1.r, c: p1.c });
                resolve();
            }
        });
    });
}

// --- 消除與掉落邏輯 ---
async function processMatches(scene, matches) {
    logic.calculateEffect(matches);
    updateUI();

    // 1. 消除動畫
    let promises = matches.map(m => {
        let s = sprites[m.r][m.c];
        logic.board[m.r][m.c] = null;
        return new Promise(res => {
            scene.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 200, onComplete: () => { s.destroy(); res(); } });
        });
    });
    await Promise.all(promises);
    
    // 2. 掉落填充
    await dropAndFill(scene);

    // 3. 遞迴檢查新連線 (Combo)
    let nextMatches = logic.checkMatches();
    if (nextMatches.length > 0) {
        await processMatches(scene, nextMatches);
    } else {
        // 4. 回合結束
        if (logic.monsterHP <= 0) {
            handleVictory(scene);
        } else {
            logic.monsterAttack();
            logic.endTurn();
            updateUI();
            checkGameOver(scene);
        }
    }
}

async function dropAndFill(scene) {
    let dropTweens = [];
    for (let c = 0; c < logic.cols; c++) {
        let emptySpots = 0;
        // 由下往上掃描
        for (let r = logic.rows - 1; r >= 0; r--) {
            if (logic.board[r][c] === null) {
                emptySpots++;
            } else if (emptySpots > 0) {
                // 現有方塊掉落
                logic.board[r + emptySpots][c] = logic.board[r][c];
                logic.board[r][c] = null;
                let sprite = sprites[r][c];
                sprites[r + emptySpots][c] = sprite;
                sprites[r][c] = null;
                sprite.setData('pos', { r: r + emptySpots, c: c });
                dropTweens.push(new Promise(res => {
                    scene.tweens.add({ targets: sprite, y: offset.y + (r + emptySpots) * tileSize, duration: 300, ease: 'Bounce.easeOut', onComplete: res });
                }));
            }
        }
        // 填充新方塊
        for (let i = 0; i < emptySpots; i++) {
            let r = i;
            let type = Math.floor(Math.random() * 4);
            logic.board[r][c] = type;
            let sprite = renderTile(scene, r, c);
            sprite.y = offset.y - (i + 1) * tileSize; // 從上方掉入
            dropTweens.push(new Promise(res => {
                scene.tweens.add({ targets: sprite, y: offset.y + r * tileSize, duration: 300, ease: 'Bounce.easeOut', onComplete: res });
            }));
        }
    }
    await Promise.all(dropTweens);
}

function handleVictory(scene) {
    const result = logic.nextLevel();
    alert(`戰鬥勝利！獲得 ${result.expGained} EXP 與 ${result.coinGained} 金幣`);
    scene.scene.restart();
}

function checkGameOver(scene) {
    if (logic.playerHP <= 0) {
        alert("你戰敗了！遊戲重置");
        location.reload();
    }
}

function update() {}
