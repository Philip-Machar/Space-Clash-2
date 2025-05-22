import Phaser from "phaser";

import shipImg from "../assets/images/space-ship1.png";
import bulletImg from "../assets/images/bullet.png";
import alienImg from "../assets/images/alien.png";
import thrustImg from "../assets/images/thrust.png";

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
        this.player = null;
        this.thrustFlame = null;
        this.bullets = null;
        this.aliens = null;
        this.lastFired = 0;
        this.lastEnemySpawn = 0;
        this.deadAlienCount = 0;
        this.healthText = null;
        this.cursors = null;
        this.playerDirection = "up";

        //player health variables
        this.playerHealth = 10;
        this.invulnerable = false;
        this.invulnerabilityTime = 1000;
        this.healthText = null;

        //game settings
        this.settings = {
            maxAliens: 20,
            alienUpdateInterval: 100,
            bulletFireRate: 200,
            enemySpawnRate: [1000, 3000]
        }
    }

    preload() {
        this.load.image("ship", shipImg);
        this.load.image("bullet", bulletImg);
        this.load.image("thrust", thrustImg);
        this.load.spritesheet("alien", alienImg, {
            frameWidth: 128,
            frameHeight: 128
        });
    }

    create() {
        //create player
        this.player = this.physics.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, "ship");
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.09);

        // Adjust player's physics body to better collide with the aliens
        this.player.body.setSize(this.player.width * 0.95, this.player.height * 0.95, true);

        //track player's last position
        this.lastPlayerPosition = {x: this.player.x, y: this.player.y};

        // Create the thrust flame as a simple image
        this.thrustFlame = this.add.image(this.player.x, this.player.y, "thrust");
        this.thrustFlame.setScale(0.07);
        this.thrustFlame.setOrigin(0.5, 0);
        this.thrustFlame.setVisible(false);  

        //create bullet group
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: "bullet",
            maxSize: 20,
            createCallback: (bullet) => {
                bullet.setScale(0.02)
            }
        });

        // Create animation for aliens
        this.anims.create({
            key: "alien-animate",
            frames: this.anims.generateFrameNumbers("alien", {start: 0, end: 35}),
            frameRate: 24,
            repeat: -1
        });

        //create aliens group
        this.aliens = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            defaultKey: "alien",
            maxSize: this.settings.maxAliens,
            createCallback: (alien) => {
                alien.setScale(0.5);
                alien.body.setSize(alien.width * 0.8, alien.height * 0.8, true);
                alien.play('alien-animate');
            }
        });

        //set up time for batch processing alien updates(instead of updating alien tracking and movement in every frame)
        this.time.addEvent({
            delay: this.settings.alienUpdateInterval,
            callback: this.updateAlienMovements,
            callbackScope: this,
            loop: true
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

        // Handle thrust flame visibility and position
        if (movementKeyPressed) {
            this.thrustFlame.setVisible(true);
            
            // Position and rotate the thrust flame based on player direction
            this.updateThrustPosition();
        } else {
            // Hide the thrust flame when not moving
            this.thrustFlame.setVisible(false);
        }

        //track player position change for alien targetting optimization
        if (this.player.x !== this.lastPlayerPosition.x || this.player.y !== this.lastPlayerPosition.y) {
            this.lastPlayerPosition = {x: this.player.x, y: this.player.y};
            this.playerMoved = true;
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

                this.lastFired = time + this.settings.bulletFireRate;
            }
        }

        //Deactivating off screen bullets
        this.bullets.children.each((bullet) => {
            if (bullet.active && (bullet.y < 0 || bullet.y > this.cameras.main.height || bullet.x < 0 || bullet.x > this.cameras.main.width)) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
            return true;
        });

        //Spawn enemies at intervals
        if (time > this.lastEnemySpawn && this.aliens.countActive(true) < this.settings.maxAliens) {
            this.spawnEnemy();
            //Spawn every 1-3 seconds
            this.lastEnemySpawn = time + Phaser.Math.Between(this.settings.enemySpawnRate[0], this.settings.enemySpawnRate[1]);
        }

        //check for offscreen aliens and get rid of them
        this.aliens.children.each((alien) => {
            if (alien.active) {
                if (alien.x < -100 || alien.x > this.cameras.main.width + 100 || alien.y < -100 || alien.y > this.cameras.main.height + 100) {
                    alien.setActive(false);
                    alien.setVisible(false);
                }
            }
            return true;
        });
    }

    // Update the thrust flame position based on player position and direction
    updateThrustPosition() {
        // Get the ship's current angle in radians
        const angleRad = Phaser.Math.DegToRad(this.player.angle);
        
        // Calculate offset position behind the ship based on its current rotation
        // Negative sign reverses the direction to position flames at the back of the ship
        const offset = 15; // Distance from ship center to flame position
        const offsetX = -Math.sin(angleRad) * offset; // X component of offset (reversed)
        const offsetY = Math.cos(angleRad) * offset; // Y component of offset (reversed)
        
        // Position the thrust flame behind the ship based on calculated offset
        this.thrustFlame.setPosition(
            this.player.x + offsetX,
            this.player.y + offsetY
        );
        
        // Match the flame's rotation to the ship's rotation
        this.thrustFlame.setAngle(this.player.angle);
    }

    //Update enemy movement - OPTIMIZED VERSION
    updateAlienMovements() {
        if (!this.playerMoved && this.aliens.countActive() === 0) return;
        
        this.playerMoved = false;
        
        this.aliens.children.each((alien) => {
            if (!alien.active) return true;
            
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
                
                // Set velocity 
                alien.setVelocity(alien.dirX * alien.speed, alien.dirY * alien.speed);
            }
            
            return true;
        });
    }

    spawnEnemy() {
        // Check if we've reached max aliens before spawning more
        if (this.aliens.countActive(true) >= this.settings.maxAliens) return;
        
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
        
        //Create alien using object pooling
        const alien = this.aliens.get(x, y, 'alien');
        
        if (!alien) return; // No aliens available in the pool
        
        alien.setActive(true);
        alien.setVisible(true);
        
        // Start animation on this alien
        alien.play('alien-animate');
        
        // Set movement properties
        alien.speed = Phaser.Math.Between(50, 90);
        alien.curveDir = Math.random() > 0.5 ? 1 : -1; 
        alien.curveStrength = Phaser.Math.FloatBetween(0.3, 0.7);
        
        // Calculate initial direction immediately to avoid undefined movement
        let dx = this.player.x - alien.x;
        let dy = this.player.y - alien.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            alien.dirX = dx / distance;
            alien.dirY = dy / distance;
            alien.rotation = Math.atan2(alien.dirY, alien.dirX) + Math.PI/2;
            alien.setVelocity(alien.dirX * alien.speed, alien.dirY * alien.speed);
        } else {
            // Fallback to a default direction if spawned exactly on player
            alien.dirX = 0;
            alien.dirY = -1;
            alien.setVelocity(0, -alien.speed);
        }
    }

    bulletHitAlien(bullet, alien) {
        if (!bullet.active || !alien.active) {
            return;
        }

        bullet.setActive(false);
        bullet.setVisible(false);
        
        alien.setActive(false);
        alien.setVisible(false);

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
        }
    }
}

export default MainScene;