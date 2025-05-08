import Phaser from "phaser";

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
        this.player = null;
        this.bullets = null;
        this.lastFired = 0;
        this.cursors = null;
    }

    preload() {
        this.load.image("ship", "assets/images/player-ship.png");
        this.load.image("bullet", "assets/images/bullet.png");
    }

    create() {
        //create player ship
        this.player = this.physics.add.sprite(400, 500, "ship");
        this.player.setCollideWorldBounds(true);

        //create bullet group
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: "bullet",
            maxSize: 30
        });

        //set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    update(time) {
        //handle player movement

        //left right movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
        } else {
            this.player.setVelocityX(0);
        }

        //up down movement
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-300);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(300);
        } else {
            this.player.setVelocityY(0);
        }

        //handling shooting
        if (this.fireKey.isDown && time > this.lastFired) {
            const bullet = this.bullets.get();

            if (bullet) {
                bullet.setPosition(this.player.x, this.player.y - 20);
                bullet.setVelocityY(-600);
                bullet.setActive(true);
                bullet.setVisible(true);

                this.lastFired = time + 200;
            }
        }

        //Deativating off screen bullets
        this.bullets.children.each((bullet) => {
            if (bullet.active && bullet.y < 0) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
            return true;
        });
    }
}

export default MainScene;