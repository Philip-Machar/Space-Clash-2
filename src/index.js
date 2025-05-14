import Phaser from "phaser";
import MainScene from "./scenes/MainScene";

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: {y: 0},
            debug: false,
            fps: 60 
        }
    },
    render: {
        pixelArt: true,
        antialias: false  
    },
    backgroundColor: "#000000",
    scene: [MainScene]
};

const game = new Phaser.Game(config);