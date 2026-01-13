\class GameLogic {
    constructor() {
        this.rows = 7;
        this.cols = 7;
        this.types = ['ICE', 'FIRE', 'THUNDER', 'POISON']; 
        this.board = [];
        
        // --- 1. 貨幣與物資系統 (新增，解決 MainMenu 報錯) ---
        this.currency = {
            coins: 0,
            diamonds: 0
        };
        this.inventory = {
            materials: {}, 
            ownedCharacters: ['Adventurer'] // 初始角色
        };

        // --- 2. 核心戰鬥數據 ---
        this.currentLevel = 1;      
        this.playerLevel = 1;        
        this.playerEXP = 0;          
        this.expToNextLevel = 100;   
        
        this.playerHP = 100;        
        this.playerMaxHP = 100;
        this.baseAttackPower = 10;   
        
        this.monsterMaxHP = 1000;    
        this.monsterHP = 1000;      
        
        // --- 3. 怪物狀態追蹤 ---
        this.monsterStatus = {
            frozen: false,
            burning: 0,
            damageMultiplier: 1.0,
            defenseDown: 0,
            isParalyzed: false // 雷方塊機率觸發的麻痺
        };

        this.initBoard();
    }

    // --- 經驗與等級邏輯 ---
    gainEXP(amount) {
        this.playerEXP += amount;
        let leveledUp = false;
        while (this.playerEXP >= this.expToNextLevel) {
            this.playerEXP -= this.expToNextLevel;
            this.playerLevel++;
            leveledUp = true;
            this.playerMaxHP += 20;
            this.baseAttackPower += 2;
            this.expToNextLevel = Math.floor(this.expToNextLevel * 1.2);
        }
        return leveledUp;
    }

    nextLevel() {
        // 獎勵金幣與經驗
        let expGained = 50 + (this.currentLevel * 10);
        let coinGained = 20 + (this.currentLevel * 5);
        
        let leveledUp = this.gainEXP(expGained);
        this.currency.coins += coinGained;

        this.currentLevel++;
        this.monsterMaxHP += 500;
        this.monsterHP = this.monsterMaxHP;

        // 恢復生命 (全滿)
        this.playerHP = this.playerMaxHP;

        // 狀態重置
        this.monsterStatus.frozen = false;
        this.monsterStatus.burning = 0;
        this.monsterStatus.defenseDown = 0;
        this.monsterStatus.damageMultiplier = 1.0;
        this.monsterStatus.isParalyzed = false;

        this.initBoard();
        return { expGained, coinGained, leveledUp };
    }

    // --- 棋盤邏輯 ---
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

    // --- 戰鬥效果計算 ---
    calculateEffect(matches) {
        let stats = { ice: 0, fire: 0, thunder: 0, poison: 0 };
        matches.forEach(m => {
            if (m.type === 0) stats.ice++;
            if (m.type === 1) stats.fire++;
            if (m.type === 2) stats.thunder++;
            if (m.type === 3) stats.poison++;
        });

        // 火：五連大爆炸技能 (LV5 開啟)
        let explosionBonus = 0;
        if (this.playerLevel >= 5 && stats.fire >= 5) {
            explosionBonus = this.baseAttackPower * 5;
        }

        // 雷：增加倍率 + 機率麻痺
        if (stats.thunder > 0) {
            this.monsterStatus.damageMultiplier += (0.05 * stats.thunder);
            if (Math.random() < 0.2) this.monsterStatus.isParalyzed = true; // 20% 麻痺
        }

        // 毒：累積破防
        if (stats.poison > 0) {
            this.monsterStatus.defenseDown += (stats.poison * 2);
        }

        let baseDamage = matches.length * this.baseAttackPower;
        let finalDamage = (baseDamage + this.monsterStatus.defenseDown + explosionBonus) * this.monsterStatus.damageMultiplier;

        if (stats.fire > 0) this.monsterStatus.burning = 1; 
        if (stats.ice > 0) this.monsterStatus.frozen = true;

        let damageDone = Math.floor(finalDamage);
        this.monsterHP -= damageDone;

        return {
            damageDealt: damageDone,
            hasFrozen: this.monsterStatus.frozen,
            hasBurning: this.monsterStatus.burning > 0,
            isParalyzed: this.monsterStatus.isParalyzed,
            currentMultiplier: this.monsterStatus.damageMultiplier
        };
    }

    monsterAttack() {
        if (this.monsterStatus.isParalyzed) {
            this.monsterStatus.isParalyzed = false;
            return 0; // 麻痺不造成傷害
        }
        let baseAttack = 15 + (this.currentLevel - 1) * 5; 
        if (this.monsterStatus.frozen) baseAttack = Math.floor(baseAttack * 0.5);
        this.playerHP -= baseAttack;
        if (this.playerHP < 0) this.playerHP = 0;
        return baseAttack;
    }

    endTurn() {
        this.monsterStatus.frozen = false;
        if (this.monsterStatus.burning > 0) this.monsterStatus.burning--;
    }

    revivePlayer() {
        this.playerHP = Math.floor(this.playerMaxHP * 0.5);
    }
}
