class Hand {
    constructor(scene, logic, tileSize, offset, sprites, onSwap) {
        this.scene = scene;
        this.logic = logic;
        this.tileSize = tileSize;
        this.offset = offset;
        this.sprites = sprites; // 傳入方塊陣列以進行鏡像位移
        this.onSwap = onSwap; 
        this.isAnimating = false;

        this.setupEvents();
    }

    setupEvents() {
        // 1. 抓取方塊
        this.scene.input.on('dragstart', (pointer, gameObject) => {
            if (this.isAnimating) return;
            // 僅提升層級，確保拖拽時在最上方
            gameObject.setDepth(100);
        });

        // 2. 拖拽移動 (包含鏡像位移邏輯)
        this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.isAnimating) return;

            let originX = gameObject.getData('originX');
            let originY = gameObject.getData('originY');
            let p1 = gameObject.getData('pos');
            
            let dx = dragX - originX;
            let dy = dragY - originY;

            // 限制主方塊只能在十字方向移動一個 tileSize 距離
            if (Math.abs(dx) > Math.abs(dy)) {
                gameObject.x = originX + Phaser.Math.Clamp(dx, -this.tileSize, this.tileSize);
                gameObject.y = originY;
            } else {
                gameObject.y = originY + Phaser.Math.Clamp(dy, -this.tileSize, this.tileSize);
                gameObject.x = originX;
            }

            // --- 鏡像位移計算 ---
            let moveX = gameObject.x - originX;
            let moveY = gameObject.y - originY;
            
            // 決定目標鄰居座標
            let targetR = p1.r;
            let targetC = p1.c;

            if (Math.abs(moveX) > 5) {
                targetC = moveX > 0 ? p1.c + 1 : p1.c - 1;
            } else if (Math.abs(moveY) > 5) {
                targetR = moveY > 0 ? p1.r + 1 : p1.r - 1;
            }

            // 先將所有鄰居歸位，避免殘留位移
            this.resetOtherSprites(gameObject);

            // 如果目標位置合法，讓鄰居 B 做鏡像移動
            if (this.isValidPos(targetR, targetC)) {
                let neighbor = this.sprites[targetR][targetC];
                if (neighbor && neighbor !== gameObject) {
                    neighbor.x = (this.offset.x + targetC * this.tileSize) - moveX;
                    neighbor.y = (this.offset.y + targetR * this.tileSize) - moveY;
                }
            }
        });

        // 3. 放開手指
        this.scene.input.on('dragend', (pointer, gameObject) => {
            gameObject.setDepth(1);

            if (this.isAnimating) return;

            let originX = gameObject.getData('originX');
            let originY = gameObject.getData('originY');
            let p1 = gameObject.getData('pos');
            let p2 = null;

            let distThreshold = this.tileSize * 0.5;
            let diffX = gameObject.x - originX;
            let diffY = gameObject.y - originY;

            if (Math.abs(diffX) > distThreshold) {
                let targetC = (diffX > 0) ? p1.c + 1 : p1.c - 1;
                if (this.isValidPos(p1.r, targetC)) p2 = { r: p1.r, c: targetC };
            } else if (Math.abs(diffY) > distThreshold) {
                let targetR = (diffY > 0) ? p1.r + 1 : p1.r - 1;
                if (this.isValidPos(targetR, p1.c)) p2 = { r: targetR, c: p1.c };
            }

            if (p2) {
                this.onSwap(p1, p2); 
            } else {
                // 交換失敗或位移不足：全部方塊彈回原位
                this.returnAllToOrigin();
            }
        });
    }

    // 檢查座標合法性
    isValidPos(r, c) {
        return r >= 0 && r < this.logic.rows && c >= 0 && c < this.logic.cols;
    }

    // 將所有方塊重置回原始座標（排除目前抓著的）
    resetOtherSprites(activeObject) {
        for (let r = 0; r < this.logic.rows; r++) {
            for (let c = 0; c < this.logic.cols; c++) {
                let s = this.sprites[r][c];
                if (s && s !== activeObject) {
                    s.x = s.getData('originX');
                    s.y = s.getData('originY');
                }
            }
        }
    }

    // 失敗時的集體回彈動畫
    returnAllToOrigin() {
        for (let r = 0; r < this.logic.rows; r++) {
            for (let c = 0; c < this.logic.cols; c++) {
                let s = this.sprites[r][c];
                if (s) {
                    this.scene.tweens.add({
                        targets: s,
                        x: s.getData('originX'),
                        y: s.getData('originY'),
                        duration: 150,
                        ease: 'Back.easeOut'
                    });
                }
            }
        }
    }

 
    // 更新方塊的「家」座標
    updateOrigin(sprite, x, y) {
        sprite.setData('originX', x);
        sprite.setData('originY', y);
        sprite.x = x;
        sprite.y = y;
        
        // --- 修正重點：使用 setDisplaySize 而非 setScale(1) ---
        // 這樣能確保不論原始圖片多大，畫面上永遠維持 50x50
        sprite.setDisplaySize(50, 50); 
        sprite.setAlpha(1);
        sprite.setAngle(0); // 確保消除動畫後的角度也被重置
    }
    
    setAnimating(value) {
        this.isAnimating = value;
    }
}
