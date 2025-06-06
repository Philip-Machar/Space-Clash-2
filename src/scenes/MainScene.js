import Phaser from "phaser";

import shipImg from "../assets/images/space-ship1.png";
import bulletImg from "../assets/images/bullet.png";
import alienImg from "../assets/images/alien.png";
import thrustImg from "../assets/images/thrust.png";
import spaceStationImg from "../assets/images/space-station.png";
import planetImg from "../assets/images/planet.png";
import asteroidImg from "../assets/images/asteroid.png";
import alien2Img from "../assets/images/alien2.png";
import alien3Img from "../assets/images/alien3.png";
import alien3BossImg from "../assets/images/alien3-boss.png";

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
        this.playerHealth = 20;
        this.invulnerable = false;
        this.invulnerabilityTime = 1000;
        this.healthText = null;

        // Enhanced ship physics properties
        this.shipPhysics = {
            thrust: 800,           // Higher thrust for more responsive acceleration
            maxSpeed: 300,         // Maximum velocity
            drag: 0.96,            // Less drag for smoother movement (4% drag per frame)
            rotationSpeed: 3,      // Degrees per frame for rotation smoothing
            minVelocityThreshold: 3 // Below this velocity, set to 0
        };

        // Parallax star system
        this.starLayers = [];
        this.lastPlayerPosition = {x: 0, y: 0};
        this.playerVelocity = {x: 0, y: 0};

        //game settings
        this.settings = {
            maxAliens: 20,
            alienUpdateInterval: 16.67,
            bulletFireRate: 200,
            enemySpawnRate: [1000, 3000]
        }

        // Wave system properties
        this.currentWave = 1;
        this.waveTimer = 0;
        this.waveActive = false;
        this.waveDuration = 120000; // 3 minutes in milliseconds
        this.waveMessageTimer = 0;
        this.betweenWavePause = 3000; // 3 seconds in milliseconds
        
        // Alien health tracking
        this.alienHealth = new Map();
        
        // Wave text display
        this.waveText = null;

        // Transitioning flag to prevent multiple wave transitions
        this.transitioning = false;

        // Wave progress bar elements
        this.waveProgressBar = null;
        this.waveProgressBarBg = null;
    }

    preload() {
        this.load.image("ship", shipImg);
        this.load.image("bullet", bulletImg);
        this.load.image("thrust", thrustImg);
        this.load.spritesheet("alien", alienImg, {
            frameWidth: 128,
            frameHeight: 128
        });
        this.load.image("station", spaceStationImg);
        this.load.image("planet", planetImg);
        this.load.image("asteroid", asteroidImg);
        this.load.spritesheet("alien2", alien2Img, {
            frameWidth: 128,
            frameHeight: 128
        });
        this.load.spritesheet("alien3", alien3Img, {
            frameWidth: 128,
            frameHeight: 128
        });
        this.load.spritesheet("alien3-boss", alien3BossImg, {
            frameWidth: 128,
            frameHeight: 128
        });
    }

    create() {
        // Create parallax star background first (so it renders behind everything)
        this.createStarField();

        //create player
        this.player = this.physics.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, "ship");
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.08);

        // Enhanced physics setup for more natural movement
        this.player.setDrag(0); // We'll handle drag manually for better control
        this.player.setMaxVelocity(this.shipPhysics.maxSpeed);

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
            frames: this.anims.generateFrameNumbers("alien", {start: 0, end: 34}),
            frameRate: 16,
            repeat: -1
        });

        // Create animations for other alien types
        this.anims.create({
            key: "alien2-animate",
            frames: this.anims.generateFrameNumbers("alien2", {start: 0, end: 3}),
            frameRate: 8,
            repeat: -1
        });
        
        this.anims.create({
            key: "alien3-animate",
            frames: this.anims.generateFrameNumbers("alien3", {start: 0, end: 29}),
            frameRate: 15,
            repeat: -1
        });
        
        this.anims.create({
            key: "alien3-boss-animate",
            frames: this.anims.generateFrameNumbers("alien3-boss", {start: 0, end: 29}),
            frameRate: 15,
            repeat: -1
        });

        //create aliens group
        this.aliens = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            defaultKey: "alien",
            maxSize: this.settings.maxAliens,
            createCallback: (alien) => {
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
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2
        });

        //display number of aliens killed
        this.deadAlienCountText = this.add.text(20, 60, `Aliens killed: ${this.deadAlienCount}`, {
            fontSize: "24px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2
        });
        
        // Create wave text display
        this.waveText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            '',
            {
                fontSize: '48px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(1000).setVisible(false);

        // Add wave counter text
        this.waveCounterText = this.add.text(
            20, 100,  // Position below health and kills counter
            'Wave: 1/3',
            {
                fontSize: "24px",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2
            }
        );

        // Add wave progress bar background (gray bar)
        this.waveProgressBarBg = this.add.rectangle(
            this.cameras.main.width - 220,  // Position from right
            30,                             // Position from top
            200,                           // Width
            20,                            // Height
            0x666666                       // Gray color
        );
        
        // Add wave progress bar (green bar)
        this.waveProgressBar = this.add.rectangle(
            this.waveProgressBarBg.x - this.waveProgressBarBg.width/2,  // Start from left edge
            30,
            0,                            // Start with 0 width
            20,
            0x00ff00                      // Green color
        ).setOrigin(0, 0.5);             // Set origin to left center

        // Start wave system
        this.startWave(1);
    }

    createStarField() {
        const starLayerConfigs = [
            // Furthest layer (containing space objects)
            {
                count: 150,
                size: { min: 0.5, max: 1 },
                alpha: { min: 0.3, max: 0.6 },
                parallaxFactor: 0.015,  // Increased from 0.01
                twinkle: true,
                spaceObjects: [
                    {
                        type: 'planet',
                        scale: 0.4,  // Slightly larger
                        alpha: 0.6,  // More visible
                        x: this.cameras.main.width * 0.9,  // More to the edge
                        y: this.cameras.main.height * 0.15,
                        parallaxFactor: 0 
                    },
                    {
                        type: 'station',
                        scale: 0.35,  // Slightly smaller
                        alpha: 0.5,  // More visible
                        x: this.cameras.main.width * 0.15,  // More to the edge
                        y: this.cameras.main.height * 0.8,
                        parallaxFactor: 0
                    },
                    // Add more asteroids for visual interest
                    {
                        type: 'asteroid',
                        scale: 0.12,
                        alpha: 0.6,
                        x: this.cameras.main.width * 0.75,
                        y: this.cameras.main.height * 0.3,
                        parallaxFactor: 0.025,  // Increased from 0.02
                        rotation: {
                            startAngle: Phaser.Math.Between(0, 360),
                            duration: Phaser.Math.Between(15000, 20000)
                        }
                    },
                    {
                        type: 'asteroid',
                        scale: 0.08,
                        alpha: 0.5,
                        x: this.cameras.main.width * 0.25,
                        y: this.cameras.main.height * 0.4,
                        parallaxFactor: 0.022,  // Increased from 0.018
                        rotation: {
                            startAngle: Phaser.Math.Between(0, 360),
                            duration: Phaser.Math.Between(12000, 18000)
                        }
                    }
                ]
            },
            // Middle layer
            {
                count: 100,
                size: { min: 1, max: 1.5 },
                alpha: { min: 0.5, max: 0.8 },
                parallaxFactor: 0.065,  // Increased from 0.05
                twinkle: true
            },
            // Closest layer
            {
                count: 50,
                size: { min: 1.5, max: 2.5 },
                alpha: { min: 0.7, max: 1.0 },
                parallaxFactor: 0.12,  // Increased from 0.1
                twinkle: false
            }
        ];

        starLayerConfigs.forEach((config, layerIndex) => {
            const starLayer = {
                stars: [],
                spaceObjects: [],
                parallaxFactor: config.parallaxFactor
            };

            // Create stars for this layer
            for (let i = 0; i < config.count; i++) {
                const star = this.add.circle(
                    Phaser.Math.Between(-200, this.cameras.main.width + 200),
                    Phaser.Math.Between(-200, this.cameras.main.height + 200),
                    Phaser.Math.FloatBetween(config.size.min, config.size.max),
                    0xffffff
                );

                star.setAlpha(Phaser.Math.FloatBetween(config.alpha.min, config.alpha.max));
                
                // Add twinkling effect to some star layers
                if (config.twinkle) {
                    this.tweens.add({
                        targets: star,
                        alpha: star.alpha * 0.3,
                        duration: Phaser.Math.Between(1000, 3000),
                        yoyo: true,
                        repeat: -1,
                        delay: Phaser.Math.Between(0, 2000)
                    });
                }

                // Store original position for parallax calculations
                star.originalX = star.x;
                star.originalY = star.y;
                
                starLayer.stars.push(star);
            }

            // Add space objects for this layer
            if (config.spaceObjects) {
                config.spaceObjects.forEach(objConfig => {
                    const spaceObj = this.add.image(objConfig.x, objConfig.y, objConfig.type)
                        .setScale(objConfig.scale)
                        .setAlpha(objConfig.alpha || 1)  // Apply transparency
                        .setDepth(-1);  // Make sure objects render behind everything
                    
                    // Store original position for parallax
                    spaceObj.originalX = spaceObj.x;
                    spaceObj.originalY = spaceObj.y;
                    
                    // Setup rotation for asteroid
                    if (objConfig.rotation) {
                        spaceObj.setAngle(objConfig.rotation.startAngle);
                        this.tweens.add({
                            targets: spaceObj,
                            angle: 360,
                            duration: objConfig.rotation.duration,
                            repeat: -1
                        });
                    }

                    starLayer.spaceObjects.push({
                        object: spaceObj,
                        parallaxFactor: objConfig.parallaxFactor
                    });
                });
            }

            this.starLayers.push(starLayer);
        });
    }

    updateStarField() {
        // Calculate player movement delta
        const deltaX = this.player.x - this.lastPlayerPosition.x;
        const deltaY = this.player.y - this.lastPlayerPosition.y;

        // Update each star layer with different parallax speeds
        this.starLayers.forEach(layer => {
            // Update stars
            layer.stars.forEach(star => {
                // Apply parallax movement (opposite to player movement)
                star.x = star.originalX - (this.player.x - this.cameras.main.centerX) * layer.parallaxFactor;
                star.y = star.originalY - (this.player.y - this.cameras.main.centerY) * layer.parallaxFactor;

                // Wrap stars around screen edges for infinite scrolling
                const screenBounds = {
                    left: -100,
                    right: this.cameras.main.width + 100,
                    top: -100,
                    bottom: this.cameras.main.height + 100
                };

                if (star.x < screenBounds.left) {
                    star.x = screenBounds.right;
                    star.originalX = star.x + (this.player.x - this.cameras.main.centerX) * layer.parallaxFactor;
                } else if (star.x > screenBounds.right) {
                    star.x = screenBounds.left;
                    star.originalX = star.x + (this.player.x - this.cameras.main.centerX) * layer.parallaxFactor;
                }

                if (star.y < screenBounds.top) {
                    star.y = screenBounds.bottom;
                    star.originalY = star.y + (this.player.y - this.cameras.main.centerY) * layer.parallaxFactor;
                } else if (star.y > screenBounds.bottom) {
                    star.y = screenBounds.top;
                    star.originalY = star.y + (this.player.y - this.cameras.main.centerY) * layer.parallaxFactor;
                }
            });

            // Update space objects
            layer.spaceObjects.forEach(obj => {
                obj.object.x = obj.object.originalX - (this.player.x - this.cameras.main.centerX) * obj.parallaxFactor;
                obj.object.y = obj.object.originalY - (this.player.y - this.cameras.main.centerY) * obj.parallaxFactor;
            });
        });
    }

    update(time) {
        // Enhanced ship movement with physics-based momentum
        this.handleShipMovement();

        // Update parallax star field
        this.updateStarField();

        //track player position change for alien targetting optimization
        if (this.player.x !== this.lastPlayerPosition.x || this.player.y !== this.lastPlayerPosition.y) {
            this.lastPlayerPosition = {x: this.player.x, y: this.player.y};
            this.playerMoved = true;
        }

       //handling shooting
        if (this.fireKey.isDown && time > this.lastFired) {
            const bullet = this.bullets.get();
            const speed = 800;

            if (bullet) {
                bullet.setActive(true);
                bullet.setVisible(true);
                
                if (this.playerDirection === "up") {
                    bullet.setPosition(this.player.x, this.player.y - 20);
                    bullet.setVelocity(0, -speed);
                    bullet.setAngle(90); // Point upward (flipped)
                } else if (this.playerDirection === "down") {
                    bullet.setPosition(this.player.x, this.player.y + 20);
                    bullet.setVelocity(0, speed);
                    bullet.setAngle(270); // Point downward (flipped)
                } else if (this.playerDirection === "left") {
                    bullet.setPosition(this.player.x - 20, this.player.y)
                    bullet.setVelocity(-speed, 0)
                    bullet.setAngle(0); // Point left (flipped)
                } else if (this.playerDirection === "right") {
                    bullet.setPosition(this.player.x + 20, this.player.y)
                    bullet.setVelocity(speed, 0);
                    bullet.setAngle(180); // Point right (flipped)
                } else if (this.playerDirection === "up-left") {
                    bullet.setPosition(this.player.x - 14, this.player.y - 14);
                    bullet.setVelocity(-speed * 0.707, -speed * 0.707);
                    bullet.setAngle(45); // Tilted up-left (flipped)
                } else if (this.playerDirection === "up-right") {
                    bullet.setPosition(this.player.x + 14, this.player.y - 14);
                    bullet.setVelocity(speed * 0.707, -speed * 0.707);
                    bullet.setAngle(135); // Tilted up-right (flipped)
                } else if (this.playerDirection === "down-left") {
                    bullet.setPosition(this.player.x - 14, this.player.y + 14);
                    bullet.setVelocity(-speed * 0.707, speed * 0.707);
                    bullet.setAngle(315); // Tilted down-left (flipped)
                } else if (this.playerDirection === "down-right") {
                    bullet.setPosition(this.player.x + 14, this.player.y + 14);
                    bullet.setVelocity(speed * 0.707, speed * 0.707);
                    bullet.setAngle(225); // Tilted down-right (flipped)
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

        // Update wave system
        this.updateWaveSystem(time);
    }

    handleShipMovement() {
        // Get current input state
        const left = this.cursors.left.isDown;
        const right = this.cursors.right.isDown;
        const up = this.cursors.up.isDown;
        const down = this.cursors.down.isDown;

        // Calculate thrust direction based on input combinations
        let thrustX = 0;
        let thrustY = 0;
        let movementKeyPressed = false;

        // Handle input combinations properly for diagonal movement
        if (left) thrustX -= 1;
        if (right) thrustX += 1;
        if (up) thrustY -= 1;
        if (down) thrustY += 1;

        // Check if any movement key is pressed
        movementKeyPressed = (thrustX !== 0 || thrustY !== 0);

        // Normalize diagonal movement to prevent faster diagonal speeds
        if (thrustX !== 0 && thrustY !== 0) {
            const length = Math.sqrt(thrustX * thrustX + thrustY * thrustY);
            thrustX /= length;
            thrustY /= length;
        }

        // Apply thrust as acceleration to current velocity
        if (movementKeyPressed) {
            const currentVelX = this.player.body.velocity.x;
            const currentVelY = this.player.body.velocity.y;
            
            // Calculate thrust acceleration (frame-rate independent)
            const thrustAccel = this.shipPhysics.thrust / 60; // Divide by 60 for consistent physics at 60fps
            
            // Add thrust to current velocity
            const newVelX = currentVelX + (thrustX * thrustAccel);
            const newVelY = currentVelY + (thrustY * thrustAccel);
            
            this.player.setVelocity(newVelX, newVelY);
        }

        // Apply drag/friction
        const currentVelX = this.player.body.velocity.x;
        const currentVelY = this.player.body.velocity.y;
        
        const draggedVelX = currentVelX * this.shipPhysics.drag;
        const draggedVelY = currentVelY * this.shipPhysics.drag;
        
        // Stop micro-movements
        const finalVelX = Math.abs(draggedVelX) < this.shipPhysics.minVelocityThreshold ? 0 : draggedVelX;
        const finalVelY = Math.abs(draggedVelY) < this.shipPhysics.minVelocityThreshold ? 0 : draggedVelY;
        
        this.player.setVelocity(finalVelX, finalVelY);

        // Update player direction and rotation based on VELOCITY, not input
        // This makes the ship face the direction it's actually moving
        const velX = this.player.body.velocity.x;
        const velY = this.player.body.velocity.y;
        const speed = Math.sqrt(velX * velX + velY * velY);

        if (speed > 10) { // Only rotate if moving fast enough
            // Calculate angle based on velocity direction
            const velocityAngle = Math.atan2(velX, -velY) * (180 / Math.PI);
            
            // Smooth rotation towards velocity direction
            let angleDiff = velocityAngle - this.player.angle;
            
            // Normalize angle difference
            while (angleDiff > 180) angleDiff -= 360;
            while (angleDiff < -180) angleDiff += 360;
            
            // Apply smooth rotation (faster rotation for more responsive feel)
            this.player.angle += angleDiff * 0.15; // 15% of the difference each frame
            
            // Update player direction for bullet firing based on closest cardinal/diagonal direction
            this.updatePlayerDirection(velocityAngle);
        }

        // Handle thrust flame
        if (movementKeyPressed) {
            this.thrustFlame.setVisible(true);
            this.updateThrustPosition();
        } else {
            this.thrustFlame.setVisible(false);
        }
    }

    // New method to determine player direction for bullet firing
    updatePlayerDirection(angle) {
        // Normalize angle to 0-360 range
        while (angle < 0) angle += 360;
        while (angle >= 360) angle -= 360;
        
        // Map angle to 8 directions (each 45 degree sector)
        if (angle >= 337.5 || angle < 22.5) {
            this.playerDirection = "up";
        } else if (angle >= 22.5 && angle < 67.5) {
            this.playerDirection = "up-right";
        } else if (angle >= 67.5 && angle < 112.5) {
            this.playerDirection = "right";
        } else if (angle >= 112.5 && angle < 157.5) {
            this.playerDirection = "down-right";
        } else if (angle >= 157.5 && angle < 202.5) {
            this.playerDirection = "down";
        } else if (angle >= 202.5 && angle < 247.5) {
            this.playerDirection = "down-left";
        } else if (angle >= 247.5 && angle < 292.5) {
            this.playerDirection = "left";
        } else if (angle >= 292.5 && angle < 337.5) {
            this.playerDirection = "up-left";
        }
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

    startWave(waveNumber) {
        this.currentWave = waveNumber;
        this.waveActive = true;
        this.waveTimer = this.time.now + this.waveDuration;
        
        // Reset progress bar
        this.waveProgressBar.width = this.waveProgressBarBg.width;
        this.waveProgressBar.setFillStyle(0x00ff00); // Same green color
        
        // Update wave counter text
        this.waveCounterText.setText(`Wave: ${this.currentWave}/3`);
        
        // Display wave start message
        this.showWaveMessage(`Wave ${waveNumber} Started!`, 2000);
    }

    showWaveMessage(message, duration) {
        this.waveText.setText(message);
        this.waveText.setVisible(true);
        this.time.delayedCall(duration, () => {
            this.waveText.setVisible(false);
        });
    }

    handleWaveCompletion() {
        if (this.currentWave < 3) {
            this.showWaveMessage(`Wave ${this.currentWave} Complete!`, 2000);
            
            // Store current wave number before transition
            const completedWave = this.currentWave;
            
            // Wait for 3 seconds before starting next wave
            this.time.delayedCall(this.betweenWavePause, () => {
                // Start the next wave
                this.startWave(completedWave + 1);
                this.transitioning = false;
            });
        } else {
            this.showWaveMessage('Aliens Annihilated!', 3000);
            this.transitioning = false;
        }
    }

    updateWaveSystem(time) {
        // If wave is not active
        if (!this.waveActive) {
            // Only proceed if all aliens are dead and we're not already transitioning
            if (this.aliens.countActive() === 0 && !this.transitioning) {
                this.transitioning = true;
                this.handleWaveCompletion();
            }
            return;
        }

        // Check if wave duration is over
        if (time > this.waveTimer) {
            this.waveActive = false;
        }

        // Update progress bar
        const elapsed = Math.max(0, this.waveTimer - time);
        const progress = elapsed / this.waveDuration;
        const barWidth = this.waveProgressBarBg.width * progress;
        this.waveProgressBar.width = barWidth;

        // Keep a consistent color
        this.waveProgressBar.setFillStyle(0x00ff00); // Consistent green color
    }

    spawnEnemy() {
        if (!this.waveActive || this.aliens.countActive(true) >= this.settings.maxAliens) return;
        
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
        
        //Determine alien type based on current wave
        let alienType = this.determineAlienType();
        const alien = this.aliens.get(x, y, alienType);
        
        if (!alien) return;
        
        // Set different scales based on alien type
        switch (alienType) {
            case 'alien':
                alien.setScale(0.5);  // Original size for basic alien
                break;
            case 'alien2':
                alien.setScale(0.6);  // Slightly larger for wave 2 alien
                break;
            case 'alien3':
                alien.setScale(0.6);  // Even larger for wave 3 alien
                break;
            case 'alien3-boss':
                alien.setScale(0.6);  // Largest for boss alien
                break;
            default:
                alien.setScale(0.5);  // Default size
        }
        
        // Set alien health based on type
        this.setAlienHealth(alien, alienType);
        
        alien.setActive(true);
        alien.setVisible(true);
        
        // Start animation based on alien type
        alien.play(`${alienType}-animate`);
        
        // Set movement properties with different speeds based on alien type
        switch (alienType) {
            case 'alien':
                alien.speed = Phaser.Math.Between(50, 90);  // Original speed
                break;
            case 'alien2':
                alien.speed = Phaser.Math.Between(80, 120); // Faster speed for wave 2 aliens
                break;
            case 'alien3':
                alien.speed = Phaser.Math.Between(50, 90);  // Original speed
                break;
            case 'alien3-boss':
                alien.speed = Phaser.Math.Between(40, 80);  // Slightly slower for boss
                break;
            default:
                alien.speed = Phaser.Math.Between(50, 90);  // Default speed
        }

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
        
        // Randomly assign a curved movement pattern
        if (alien.movementPattern === 'curved') {
            const curveStyles = ['orbit', 'sine', 'spiral'];
            alien.curveStyle = Phaser.Math.RND.pick(curveStyles);
            alien.curveOffset = Math.random() * Math.PI * 2;
        }
    }

    determineAlienType() {
        if (this.currentWave === 1) {
            // Wave 1: only type 1 aliens
            return 'alien';
        } else if (this.currentWave === 2) {
            // Wave 2: 50/50 mix of only type 1 and 2 aliens
            return Math.random() < 0.5 ? 'alien' : 'alien2';
        } else {
            // Wave 3: distribution of all types (70% wave 1/2, 30% wave 3)
            const rand = Math.random();
            if (rand < 0.35) return 'alien';
            if (rand < 0.7) return 'alien2';
            if (rand < 0.9) return 'alien3';
            return 'alien3-boss';
        }
    }

    setAlienHealth(alien, type) {
        let health;
        switch (type) {
            case 'alien':
                health = 1;
                break;
            case 'alien2':
                health = 2;
                break;
            case 'alien3':
                health = 4;
                break;
            case 'alien3-boss':
                health = 7;
                break;
            default:
                health = 1;
        }
        this.alienHealth.set(alien, health);
    }

    bulletHitAlien(bullet, alien) {
        if (!bullet.active || !alien.active) return;

        bullet.setActive(false);
        bullet.setVisible(false);
        
        let health = this.alienHealth.get(alien) || 1;
        health--;
        
        if (health <= 0) {
            alien.setActive(false);
            alien.setVisible(false);
            this.alienHealth.delete(alien);
            this.deadAlienCount++;
            this.deadAlienCountText.setText(`Aliens killed: ${this.deadAlienCount}`);
            
            // Check if wave is complete
            if (!this.waveActive && this.aliens.countActive() === 0) {
                this.handleWaveCompletion();
            }
        } else {
            this.alienHealth.set(alien, health);
        }
    }

    alienHitPlayer(player, alien) {
        if (!this.invulnerable) {
            // Determine damage based on alien type
            let damage = 1; // Default damage for basic alien
            
            // Check alien type and set appropriate damage
            switch (alien.texture.key) {
                case 'alien':
                    damage = 1;
                    break;
                case 'alien2':
                    damage = 2;
                    break;
                case 'alien3':
                    damage = 3;
                    break;
                case 'alien3-boss':
                    damage = 5;
                    break;
            }

            // Decrement the health score by the damage amount
            this.playerHealth -= damage;

            // Update health text
            this.healthText.setText(`Health: ${this.playerHealth}`);

            // Make player briefly flash to indicate damage
            this.tweens.add({
                targets: player,
                alpha: 0.5,
                yoyo: true,
                repeat: 5,
                duration: 100,
                onComplete: () => {
                    player.alpha = 1;
                }
            });

            // Make player invulnerable briefly (1 second)
            this.invulnerable = true;
            this.time.delayedCall(this.invulnerabilityTime, () => {
                this.invulnerable = false;
            });

            // Destroy the enemy that hit you
            alien.setActive(false);
            alien.setVisible(false);
        }
    }

    // Replace the existing moveAlienCurved with these three curved movement patterns
    moveAlienCurved(alien) {
        switch(alien.curveStyle) {
            case 'orbit':
                this.moveAlienOrbit(alien);
                break;
            case 'sine':
                this.moveAlienSineWave(alien);
                break;
            case 'spiral':
                this.moveAlienSpiral(alien);
                break;
        }
    }

    moveAlienOrbit(alien) {
        // Orbiting curved movement
        let dx = this.player.x - alien.x;
        let dy = this.player.y - alien.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            dx = dx / distance;
            dy = dy / distance;
            
            // Strong perpendicular force for orbital movement
            const perpX = -dy * 1.2;
            const perpY = dx * 1.2;
            
            dx += perpX * alien.curveDir;
            dy += perpY * alien.curveDir;
            
            const newDist = Math.sqrt(dx * dx + dy * dy);
            if (newDist > 0) {
                dx = dx / newDist;
                dy = dy / newDist;
            }
            
            alien.dirX = dx;
            alien.dirY = dy;
        }
    }

    moveAlienSineWave(alien) {
        // Sine wave curved movement
        let dx = this.player.x - alien.x;
        let dy = this.player.y - alien.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            dx = dx / distance;
            dy = dy / distance;
            
            // Add sine wave pattern
            const time = this.time.now * 0.002;
            const amplitude = 1.5;
            const wave = Math.sin(time + alien.curveOffset) * amplitude;
            
            // Apply wave perpendicular to movement direction
            const perpX = -dy * wave;
            const perpY = dx * wave;
            
            dx += perpX;
            dy += perpY;
            
            const newDist = Math.sqrt(dx * dx + dy * dy);
            if (newDist > 0) {
                dx = dx / newDist;
                dy = dy / newDist;
            }
            
            alien.dirX = dx;
            alien.dirY = dy;
        }
    }

    moveAlienSpiral(alien) {
        // Spiral curved movement
        let dx = this.player.x - alien.x;
        let dy = this.player.y - alien.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            dx = dx / distance;
            dy = dy / distance;
            
            // Add spiral pattern
            const time = this.time.now * 0.001;
            const spiralForce = Math.min(distance / 200, 1.0); // Stronger spiral when further away
            const perpX = -dy * spiralForce;
            const perpY = dx * spiralForce;
            
            dx += perpX * alien.curveDir * (1 + Math.sin(time + alien.curveOffset));
            dy += perpY * alien.curveDir * (1 + Math.cos(time + alien.curveOffset));
            
            const newDist = Math.sqrt(dx * dx + dy * dy);
            if (newDist > 0) {
                dx = dx / newDist;
                dy = dy / newDist;
            }
            
            alien.dirX = dx;
            alien.dirY = dy;
        }
    }
}

export default MainScene;