import Phaser, { Physics } from "phaser";
import MainScene from "./scenes/MainScene";

const config = {
    type: Phaser.AUTO,
    width: 800, 
    height: 600,
    parent: "game",
    physics: {
        default: "arcade",
        arcade: {
            gravity: {y: 0},
            debug: false
        }
    },
    scene: [MainScene]
};

const game = new Phaser.Game(config);
