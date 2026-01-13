class GameLogic {
    constructor() {
        this.rows = 7;
        this.cols = 7;
        // 類型對應：0:ICE(冰), 1:FIRE(火), 2:THUNDER(雷), 3:POISON(毒)
        this.types = ['ICE', 'FIRE', 'THUNDER', 'POISON']; 
        this.board = [];
        
        // --- 核心戰鬥數據 ---
        this.currentLevel = 1;      // 當前關卡
        this.playerLevel = 1;       // 玩家等級
        this.playerEXP = 0;         // 當前經驗值
        this.expToNextLevel = 100;  // 升級所需經驗值
        
        this.playerHP = 100;        // 玩家生命值
        this.playerMaxHP = 100;
        this.baseAttackPower = 10;  // 基礎攻擊力
        
        this.monsterMaxHP = 1000;   // 怪物最大生命值
        this.monsterHP = 1000;      // 怪物初始生命值
        
        // --- 怪物狀態追蹤 ---
        this.monsterStatus = {
            frozen: false,          // 冰：怪物下次攻擊傷害減半
            burning: 0,             // 火：燃燒剩餘回合
            burnDamage: 0,          // 火：每回合造成的燃燒傷害 (原消除傷害的一半)
            damageMultiplier: 1.0,  // 雷：傷害加成倍率
            defenseDown: 0          // 毒：固定傷害加成
        };

        this.initBoard();
    }

    /**
     * 處理經驗值獲取與等級計算
     */
    gainEXP(amount) {
        this.playerEXP += amount;
        let leveledUp = false;
        
        while (this.playerEXP >= this.expToNextLevel) {
            this.playerEXP -= this.expToNextLevel;
            this.playerLevel++;
            leveledUp = true;
            
            // --- 生命成長公式：加上 (20 + 等級 * 1.5) ---
            let hpIncrease = Math.floor(20 + this.playerLevel * 1.5);
            this.playerMaxHP += hpIncrease;
            
            // 基礎攻擊力成長
            this.baseAttackPower += 2;
            
            // 補滿生命值
            this.playerHP = this.playerMaxHP;
            
            // 下一級所需經驗提升 20%
            this.expToNextLevel = Math.floor(this.expToNextLevel * 1.2);
        }
        return leveledUp;
    }

    /**
     * 進入下一關的數據處理
     */
    nextLevel() {
        // 1. 擊敗怪物獲得經驗值
        let expGained = 50 + (this.currentLevel * 10);
        let leveledUp = this.gainEXP(expGained);

        this.currentLevel++;
        
        // 2. 難度提升：每關怪物血量增加 500
        this.monsterMaxHP += 500;
        this.monsterHP = this.monsterMaxHP;

        // 3. 過關獎勵：恢復全部生命值
        this.playerHP = this.playerMaxHP;

        // 4. 狀態完全重置
        this.monsterStatus.frozen = false;
        this.monsterStatus.burning = 0;
        this.monsterStatus.burnDamage = 0;
        this.monsterStatus.defenseDown = 0;
        this.monsterStatus.damageMultiplier = 1.0;

        // 5. 生成新盤面
        this.initBoard();

        return { expGained, leveledUp };
    }

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

    isPreMatch(r, c, type) {
        if (c >= 2 && this.board[r][c - 1] === type && this.board[r][c - 2] === type) return true;
        if (r >= 2 && this.board[r - 1][c] === type && this.board[r - 2][c] === type) return true;
        return false;
    }

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
     * 計算消除效果
     */
    calculateEffect(matches) {
        let stats = { ice: 0, fire: 0, thunder: 0, poison: 0 };
        matches.forEach(m => {
            if (m.type === 0) stats.ice++;
            if (m.type === 1) stats.fire++;
            if (m.type === 2) stats.thunder++;
            if (m.type === 3) stats.poison++;
        });

        // 1. 雷：增加倍率
        if (stats.thunder > 0) {
            this.monsterStatus.damageMultiplier += (0.05 * stats.thunder);
        }

        // 2. 毒：累積破防
        if (stats.poison > 0) {
            this.monsterStatus.defenseDown += (stats.poison * 2);
        }

        // 3. 計算總傷害
        let baseDamage = matches.length * this.baseAttackPower;
        let finalDamage = (baseDamage + this.monsterStatus.defenseDown) * this.monsterStatus.damageMultiplier;
        let damageDone = Math.floor(finalDamage);
        
        this.monsterHP -= damageDone;

        // 4. 觸發狀態
        if (stats.ice > 0) this.monsterStatus.frozen = true;
        
        // 燃燒機制：3回合，每回合造成原本 1/2 傷害
        if (stats.fire > 0) {
            this.monsterStatus.burning = 3;
            this.monsterStatus.burnDamage = Math.floor(damageDone / 2);
        }

        return {
            damageDealt: damageDone,
            hasFrozen: this.monsterStatus.frozen,
            hasBurning: this.monsterStatus.burning > 0,
            currentMultiplier: this.monsterStatus.damageMultiplier
        };
    }

    /**
     * 怪物攻擊邏輯
     */
    monsterAttack() {
        let baseAttack = 15 + (this.currentLevel - 1) * 5; 
        
        if (this.monsterStatus.frozen) {
            baseAttack = Math.floor(baseAttack * 0.5);
        }

        this.playerHP -= baseAttack;
        if (this.playerHP < 0) this.playerHP = 0;

        return baseAttack;
    }

    /**
     * 回合結尾清算（包含燃燒傷害扣除）
     */
    endTurn() {
        // 處理燃燒傷害
        if (this.monsterStatus.burning > 0) {
            this.monsterHP -= this.monsterStatus.burnDamage;
            this.monsterStatus.burning--;

            if (this.monsterStatus.burning === 0) {
                this.monsterStatus.burnDamage = 0;
            }
        }

        // 冰凍僅持續一個動作
        this.monsterStatus.frozen = false;
    }

    revivePlayer() {
        this.playerHP = Math.floor(this.playerMaxHP * 0.5);
    }
}
