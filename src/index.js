import Phaser, { Scale } from "phaser";
import MainScene from "./scenes/MainScene";

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth, 
    height: window.innerHeight,
    parent: "game",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH, 
    },
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
