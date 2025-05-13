import Phaser from "phaser";

import shipImg from "../assets/images/player-ship.png";
import bulletImg from "../assets/images/bullet.png";
import alienImg from "../assets/images/alien.png";

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
        this.player = null;
        this.bullets = null;
        this.aliens = null;
        this.lastFired = 0;
        this.lastEnemySpawn = 0;
        this.deadAlienCount = 0;
        this.healthText = null;
        this.cursors = null;
        this.playerDirection = "up";

        //player health variables
        this.playerHealth = 3;
        this.invulnerable = false;
        this.invulnerabilityTime = 1000;
        this.healthText = null;
    }

    preload() {
        this.load.image("ship", shipImg);
        this.load.image("bullet", bulletImg);
        this.load.image("alien", alienImg);
    }

    create() {
        //create player ship
        this.player = this.physics.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, "ship");
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.15)

        //create bullet group
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: "bullet",
            maxSize: 30,
            createCallback: (bullet) => {
                bullet.setScale(0.02)
            }
        });

        //create aliens group
        this.aliens = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            defaultKey: "alien",
            createCallback: (alien) => {
                alien.setScale(0.1);
            }
        });

        //set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        //set up collision between bullets and aliens
        this.physics.add.collider(this.bullets, this.aliens, this.bulletHitAlien, null, this);

        //set up collision between alien and player
        this.physics.add.collider(this.player, this.aliens, this.alienHitPlayer, null, this);

        //display health text
        this.healthText = this.add.text(20, 20, `Health: ${this.playerHealth}`, {
            fontSize: "24px",
            fill: "#ffffff"
        });

        //display number of aliens killed
        this.deadAlienCountText = this.add.text(20, 60, `Aliens killed: ${this.deadAlienCount}`, {
            fontSize: "24px",
            fill: "#ffffff"
        })
    }

    update(time) {
        //handle player movement
        this.player.setVelocity(0);

        //tracks if any arrow key is pressed
        let movementKeyPressed = false;

        //angle to change ship's direction initially set to ship's angle
        let targetAngle = this.player.angle;

        //left right movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
            this.playerDirection = "left"
            targetAngle = -90
            movementKeyPressed = true;
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
            this.playerDirection = "right"
            targetAngle = 90
            movementKeyPressed = true;
        }

        //up down movement
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-300);
            this.playerDirection = "up"
            targetAngle = 0;
            movementKeyPressed = true;
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(300);
            this.playerDirection = "down"
            targetAngle = 180;
            movementKeyPressed = true;
        }

        //smooth ship rotation mechanism
        if (movementKeyPressed) {
            let angleDiff = targetAngle - this.player.angle;

            // Normalize the angle difference to be between -180 and 180 degrees
            if (angleDiff > 180) angleDiff -= 360;
            if (angleDiff < -180) angleDiff += 360;

            this.player.angle += angleDiff / 5;
        }

        //handling shooting
        if (this.fireKey.isDown && time > this.lastFired) {
            const bullet = this.bullets.get();
            const speed = 600;

            if (bullet) {
                bullet.setActive(true);
                bullet.setVisible(true);
                
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

        //Deactivating off screen bullets
        this.bullets.children.each((bullet) => {
            if (bullet.active && (bullet.y < 0 || bullet.y > window.innerHeight || bullet.x < 0 || bullet.x > window.innerWidth)) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
            return true;
        });

        //Spawn enemies at intervals
        if (time > this.lastEnemySpawn) {
            this.spawnEnemy();
            //Spawn every 1-3 seconds
            this.lastEnemySpawn = time + Phaser.Math.Between(1000, 3000);
        }

        //Update enemy movement - OPTIMIZED VERSION
        this.aliens.children.each((alien) => {
            if (alien.active) {
                //Check if alien is off screen
                if (alien.x < -50 || alien.x > this.cameras.main.width + 50 || 
                    alien.y < -50 || alien.y > this.cameras.main.height + 50) {
                    alien.setActive(false);
                    alien.setVisible(false);
                    alien.destroy();
                    return true;
                }
                
                // Initialize timestamps if needed
                alien.timeSinceRetarget = alien.timeSinceRetarget || 0;
                alien.timeSinceRetarget += this.game.loop.delta;
                
                // Only perform expensive calculations when it's time to retarget
                // This significantly reduces per-frame computational load
                if (alien.timeSinceRetarget > 1000) { // Update target and movement vector every second
                    // Store player position
                    alien.targetX = this.player.x;
                    alien.targetY = this.player.y;
                    
                    // Calculate and cache direction vector toward player
                    let dx = this.player.x - alien.x;
                    let dy = this.player.y - alien.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Normalize direction
                    if (distance > 0) {
                        dx = dx / distance;
                        dy = dy / distance;
                        
                        // Add curve influence (perpendicular vector)
                        const perpX = -dy * alien.curveStrength;
                        const perpY = dx * alien.curveStrength;
                        
                        // Apply curve based on alien's curve direction
                        dx += perpX * alien.curveDir;
                        dy += perpY * alien.curveDir;
                        
                        // Normalize again after adding curve
                        const newDist = Math.sqrt(dx * dx + dy * dy);
                        if (newDist > 0) {
                            dx = dx / newDist;
                            dy = dy / newDist;
                        }
                        
                        // Cache the calculated direction
                        alien.dirX = dx;
                        alien.dirY = dy;
                        
                        // Update rotation to face direction of travel
                        alien.rotation = Math.atan2(dy, dx) + Math.PI/2;
                    }
                    
                    alien.timeSinceRetarget = 0;
                }
                
                // Use the cached direction vector for movement every frame
                // This avoids expensive calculations on every frame
                if (alien.dirX !== undefined && alien.dirY !== undefined) {
                    alien.setVelocity(alien.dirX * alien.speed, alien.dirY * alien.speed);
                }
            }
            return true;
        });
    }

    spawnEnemy() {
        //Choose a random side to spawn from (0: top, 1: right, 2: bottom, 3: left)
        const side = Phaser.Math.Between(0, 3);
        
        let x, y;
        
        //Determine spawn position based on side
        switch (side) {
            case 0: //top
                x = Phaser.Math.Between(0, this.cameras.main.width);
                y = -30;
                break;
            case 1: //right
                x = this.cameras.main.width + 30;
                y = Phaser.Math.Between(0, this.cameras.main.height);
                break;
            case 2: //bottom
                x = Phaser.Math.Between(0, this.cameras.main.width);
                y = this.cameras.main.height + 30;
                break;
            case 3: //left
                x = -30;
                y = Phaser.Math.Between(0, this.cameras.main.height);
                break;
        }
        
        //Create alien
        const alien = this.aliens.create(x, y, 'alien');
        
        alien.setActive(true);
        alien.setVisible(true);
        
        // Set movement properties
        alien.speed = Phaser.Math.Between(80, 120);
        alien.curveDir = Math.random() > 0.5 ? 1 : -1; 
        alien.curveStrength = Phaser.Math.FloatBetween(0.3, 0.7);
        
        // Initialize with random retarget time offset to prevent all aliens
        // from updating vectors in the same frame
        alien.timeSinceRetarget = Phaser.Math.Between(0, 800);
        
        // Force initial target calculation on first update
        alien.targetX = this.player.x;
        alien.targetY = this.player.y;
        
        // Calculate initial direction immediately to avoid undefined movement
        let dx = this.player.x - alien.x;
        let dy = this.player.y - alien.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            alien.dirX = dx / distance;
            alien.dirY = dy / distance;
            alien.rotation = Math.atan2(alien.dirY, alien.dirX) + Math.PI/2;
        } else {
            // Fallback to a default direction if spawned exactly on player
            alien.dirX = 0;
            alien.dirY = -1;
        }
    }

    bulletHitAlien(bullet, alien) {
        bullet.setActive(false);
        bullet.setVisible(false);
        
        alien.setActive(false);
        alien.setVisible(false);
        alien.destroy();

        this.deadAlienCount += 1;
        this.deadAlienCountText.setText(`Aliens killed: ${this.deadAlienCount}`);
    }

    alienHitPlayer(player, alien) {
        if (!this.invulnerable) {
            //decrement the health score by 1
            this.playerHealth--;

            //update health text
            this.healthText.setText(`Health: ${this.playerHealth}`);

            //make player briefly flash to indicate damage
            this.tweens.add({
                targets: player,
                alpha: 0.5,
                yoyo: true,
                repeat: 5,
                duration: 100,
                onComplete: () => {
                    player.alpha = 1;
                }
            })

            //make player invulnerable briefly(1 second)
            this.invulnerable = true;
            this.time.delayedCall(this.invulnerabilityTime, () => {
                this.invulnerable = false;
            });

            //destroy the enemy that hit you
            alien.setActive(false);
            alien.setVisible(false);
            alien.destroy();
        }
    }
}

export default MainScene;