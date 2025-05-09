import Phaser from "phaser";

import shipImg from "../assets/images/player-ship.png";
import bulletImg from "../assets/images/bullet.png";

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
        this.player = null;
        this.bullets = null;
        this.lastFired = 0;
        this.cursors = null;
        this.playerDirection = "up";
    }

    preload() {
        this.load.image("ship", shipImg);
        this.load.image("bullet", bulletImg);
    }

    create() {
        //create player ship
        this.player = this.physics.add.sprite(400, 500, "ship");
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.15)

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

        this.player.setVelocity(0);

        //left right movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
            this.playerDirection = "left"
            this.player.setAngle(-90);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
            this.playerDirection = "right"
            this.player.setAngle(90);
        }

        //up down movement
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-300);
            this.playerDirection = "up"
            this.player.setAngle(0);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(300);
            this.playerDirection = "down"
            this.player.setAngle(180);
        }

        //handle diagonal movement
        if (this.cursors.up.isDown && this.cursors.left.isDown) {
            this.player.setAngle(-45);
            this.playerDirection = "upleft";
        } else if (this.cursors.up.isDown && this.cursors.right.isDown) {
            this.player.setAngle(45);
            this.playerDirection = "upright";
        } else if (this.cursors.down.isDown && this.cursors.left.isDown) {
            this.player.setAngle(-135);
            this.playerDirection = "downleft";
        } else if (this.cursors.down.isDown && this.cursors.right.isDown) {
            this.player.setAngle(135);
            this.playerDirection = "downright";
        }

        //handling shooting
        if (this.fireKey.isDown && time > this.lastFired) {
            const bullet = this.bullets.get();
            const speed = 600;

            if (bullet) {
                bullet.setVelocityY(-1000);
                bullet.setActive(true);
                bullet.setVisible(true);

                bullet.setScale(0.02);
                
                if (this.playerDirection === "up") {
                    bullet.setPosition(this.player.x, this.player.y - 20);
                    bullet.setVelocity(0, -speed);
                    bullet.setAngle(90);
                } else if (this.playerDirection === "down") {
                    bullet.setPosition(this.player.x, this.player.y + 20);
                    bullet.setVelocity(0, speed);
                    bullet.setAngle(270);
                } else if (this.playerDirection === "left") {
                    bullet.setPosition(this.player.x - 20, this.player.y)
                    bullet.setVelocity(-speed, 0)
                    bullet.setAngle(180);
                } else if (this.playerDirection === "right") {
                    bullet.setPosition(this.player.x + 20, this.player.y)
                    bullet.setVelocity(speed, 0);
                    bullet.setAngle(0);
                }

                this.lastFired = time + 200;
            }
        }

        //Deativating off screen bullets
        this.bullets.children.each((bullet) => {
            if (bullet.active && (bullet.y < 0 || bullet.y > 600 || bullet.x < 0 || bullet.x > 800)) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
            return true;
        });
    }
}

export default MainScene;