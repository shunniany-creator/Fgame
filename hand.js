class Hand {
    constructor(scene, logic, tileSize, offset, onSwap) {
        this.scene = scene;
        this.logic = logic;
        this.tileSize = tileSize;
        this.offset = offset;
        this.onSwap = onSwap; 
        this.isAnimating = false;

        this.setupEvents();
    }

    setupEvents() {
        // 1. 抓取方塊
        this.scene.input.on('dragstart', (pointer, gameObject) => {
            if (this.isAnimating) return;
            // 視覺回饋：變大、變亮、置頂
            gameObject.setDepth(100).setScale(1.2).setAlpha(0.8);
        });

        // 2. 拖拽移動
        this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.isAnimating) return;

            let originX = gameObject.getData('originX');
            let originY = gameObject.getData('originY');
            let dx = dragX - originX;
            let dy = dragY - originY;

            // 鎖定十字軸向：移動量大的方向為準
            if (Math.abs(dx) > Math.abs(dy)) {
                gameObject.x = originX + Phaser.Math.Clamp(dx, -this.tileSize, this.tileSize);
                gameObject.y = originY;
            } else {
                gameObject.y = originY + Phaser.Math.Clamp(dy, -this.tileSize, this.tileSize);
                gameObject.x = originX;
            }
        });

        // 3. 放開手指
        this.scene.input.on('dragend', (pointer, gameObject) => {
            if (this.isAnimating) return;

            let originX = gameObject.getData('originX');
            let originY = gameObject.getData('originY');
            let p1 = gameObject.getData('pos');
            let p2 = null;

            // 判斷位移是否超過方塊的一半
            let distThreshold = this.tileSize * 0.5;
            let diffX = gameObject.x - originX;
            let diffY = gameObject.y - originY;

            if (Math.abs(diffX) > distThreshold) {
                let targetC = (diffX > 0) ? p1.c + 1 : p1.c - 1;
                if (targetC >= 0 && targetC < this.logic.cols) p2 = { r: p1.r, c: targetC };
            } else if (Math.abs(diffY) > distThreshold) {
                let targetR = (diffY > 0) ? p1.r + 1 : p1.r - 1;
                if (targetR >= 0 && targetR < this.logic.rows) p2 = { r: p1.r + (diffY > 0 ? 1 : -1), c: p1.c };
            }

            // 視覺重置
            gameObject.setDepth(1).setScale(1).setAlpha(1);

            if (p2) {
                this.onSwap(p1, p2); 
            } else {
                // 沒拉到位，彈回原點
                this.scene.tweens.add({
                    targets: gameObject,
                    x: originX, y: originY,
                    duration: 150, ease: 'Back.easeOut'
                });
            }
        });
    }

    // 更新方塊的「家」座標 (在交換動畫結束後呼叫)
    updateOrigin(sprite, x, y) {
        sprite.setData('originX', x);
        sprite.setData('originY', y);
    }

    setAnimating(value) {
        this.isAnimating = value;
    }
}
