class GameLogic {
    constructor() {
        this.rows = 7;
        this.cols = 7;
        // 類型對應：0:ICE(冰), 1:FIRE(火), 2:THUNDER(雷), 3:POISON(毒)
        this.types = ['ICE', 'FIRE', 'THUNDER', 'POISON']; 
        this.board = [];
        
        // --- 核心戰鬥數據 ---
        this.currentLevel = 1;      // 當前關卡
        this.playerLevel = 1;       // 玩家等級 (新增)
        this.playerEXP = 0;         // 當前經驗值 (新增)
        this.expToNextLevel = 100;  // 升級所需經驗值 (新增)
        
        this.playerHP = 100;       // 玩家生命值
        this.playerMaxHP = 100;
        this.baseAttackPower = 10;  // 基礎攻擊力 (新增)
        
        this.monsterMaxHP = 1000;   // 怪物最大生命值
        this.monsterHP = 1000;     // 怪物初始生命值
        
        // --- 怪物狀態追蹤 ---
        this.monsterStatus = {
            frozen: false,          // 冰：消除後觸發，使怪物下次攻擊減傷
            burning: 0,             // 火：燃燒傷害剩餘回合
            damageMultiplier: 1.0,  // 雷：提升玩家的傷害倍率 (過關後會重置)
            defenseDown: 0          // 毒：降低怪物防禦（增加基礎傷害）
        };

        this.initBoard();
    }

    /**
     * 處理經驗值與等級邏輯 (新增)
     */
    gainEXP(amount) {
        this.playerEXP += amount;
        let leveledUp = false;
        
        while (this.playerEXP >= this.expToNextLevel) {
            this.playerEXP -= this.expToNextLevel;
            this.playerLevel++;
            leveledUp = true;
            
            // 升級效果預設 (在 nextLevel 正式生效)
            this.playerMaxHP += 20;    // 每級增加 20 血量上限
            this.baseAttackPower += 2; // 每級增加 2 點基礎攻擊力
            this.expToNextLevel = Math.floor(this.expToNextLevel * 1.2);
        }
        return leveledUp;
    }

    /**
     * 進入下一關的數據處理
     */
    nextLevel() {
        // 1. 結算經驗值：基礎 50 + (關卡 * 10)
        let expGained = 50 + (this.currentLevel * 10);
        let leveledUp = this.gainEXP(expGained);

        this.currentLevel++;
        
        // 2. 難度提升：每關怪物血量增加 500
        this.monsterMaxHP += 500;
        this.monsterHP = this.monsterMaxHP;

        // 3. 玩家獎勵與成長生效
        if (leveledUp) {
            // 升級效果在此生效：血量補滿至新的上限
            this.playerHP = this.playerMaxHP;
        } else {
            // 未升級則執行原有的過關回血：恢復 30% 生命值，但不超過上限
            this.playerHP = Math.min(this.playerMaxHP, this.playerHP + Math.floor(this.playerMaxHP * 0.3));
        }

        // 4. 狀態重置
        this.monsterStatus.frozen = false;
        this.monsterStatus.burning = 0;
        this.monsterStatus.defenseDown = 0;
        this.monsterStatus.damageMultiplier = 1.0; // 雷的狀態已在此重置

        // 5. 生成新關卡的隨機盤面
        this.initBoard();

        return { expGained, leveledUp };
    }

    /**
     * 初始化 7x7 棋盤
     * 確保初始生成的棋盤不會有現成的三連
     */
    initBoard() {
        for (let r = 0; r < this.rows; r++) {
            this.board[r] = [];
            for (let c = 0; c < this.cols; c++) {
                let type;
                do {
                    type = Math.floor(Math.random() * this.types.length);
                } while (this.isPreMatch(r, c, type));
                this.board[r][c] = type;
            }
        }
    }

    /**
     * 預防生成即時消除
     */
    isPreMatch(r, c, type) {
        if (c >= 2 && this.board[r][c - 1] === type && this.board[r][c - 2] === type) return true;
        if (r >= 2 && this.board[r - 1][c] === type && this.board[r - 2][c] === type) return true;
        return false;
    }

    /**
     * 檢查全盤匹配
     * @returns {Array} 包含所有匹配座標與類型的列表
     */
    checkMatches() {
        let matchedTiles = new Set();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                let t = this.board[r][c];
                if (t !== null && t === this.board[r][c+1] && t === this.board[r][c+2]) {
                    matchedTiles.add(`${r},${c}`); matchedTiles.add(`${r},${c+1}`); matchedTiles.add(`${r},${c+2}`);
                }
            }
        }
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 2; r++) {
                let t = this.board[r][c];
                if (t !== null && t === this.board[r+1][c] && t === this.board[r+2][c]) {
                    matchedTiles.add(`${r},${c}`); matchedTiles.add(`${r+1},${c}`); matchedTiles.add(`${r+2},${c}`);
                }
            }
        }
        return Array.from(matchedTiles).map(s => {
            let [r, c] = s.split(',').map(Number);
            return { r, c, type: this.board[r][c] };
        });
    }

    /**
     * 計算玩家該次消除的總效果
     */
    calculateEffect(matches) {
        let stats = { ice: 0, fire: 0, thunder: 0, poison: 0 };
        matches.forEach(m => {
            if (m.type === 0) stats.ice++;     // 冰
            if (m.type === 1) stats.fire++;    // 火
            if (m.type === 2) stats.thunder++; // 雷
            if (m.type === 3) stats.poison++;  // 毒
        });

        // 1. 雷：永久增加當前倍率 (本關卡內)
        if (stats.thunder > 0) {
            this.monsterStatus.damageMultiplier += (0.05 * stats.thunder);
        }

        // 2. 毒：累積破防值
        if (stats.poison > 0) {
            this.monsterStatus.defenseDown += (stats.poison * 2);
        }

        // 3. 基礎傷害 (消除個數越多基礎越高，並隨玩家基礎攻擊力成長)
        let baseDamage = matches.length * this.baseAttackPower;
        
        // 4. 計算總傷害
        let finalDamage = (baseDamage + this.monsterStatus.defenseDown) * this.monsterStatus.damageMultiplier;

        // 5. 觸發冰火狀態
        if (stats.fire > 0) this.monsterStatus.burning = 1; 
        if (stats.ice > 0) this.monsterStatus.frozen = true;

        // 更新怪物血量
        let damageDone = Math.floor(finalDamage);
        this.monsterHP -= damageDone;

        return {
            damageDealt: damageDone,
            hasFrozen: this.monsterStatus.frozen,
            hasBurning: this.monsterStatus.burning > 0,
            currentMultiplier: this.monsterStatus.damageMultiplier
        };
    }

    /**
     * 執行怪物反擊邏輯 (通常在玩家回合結束/消除結束後調用)
     * @returns {number} 怪物對玩家造成的最終傷害
     */
    monsterAttack() {
        // 隨關卡提升怪物基礎傷害
        let baseAttack = 15 + (this.currentLevel - 1) * 5; 
        
        // 如果怪物處於「冰凍」狀態，傷害減半
        if (this.monsterStatus.frozen) {
            baseAttack = Math.floor(baseAttack * 0.5);
        }

        this.playerHP -= baseAttack;
        if (this.playerHP < 0) this.playerHP = 0;

        return baseAttack;
    }

    /**
     * 回合結尾清算
     * 處理狀態失效或持續傷害
     */
    endTurn() {
        // 冰凍僅持續一個動作回合
        this.monsterStatus.frozen = false;
        
        // 火：燃燒回合遞減 (若要做多回合燃燒可在這處理額外扣血)
        if (this.monsterStatus.burning > 0) {
            this.monsterStatus.burning--;
        }
    }

    /**
     * 玩家復活 (用於廣告觀看後的回調)
     */
    revivePlayer() {
        this.playerHP = Math.floor(this.playerMaxHP * 0.5);
    }
}
