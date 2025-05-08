import Phaser from "phaser";

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
    };

    preload() {
        //assets to load here
    };

    create() {
        this.add.text(400, 300, "Space Clash 2", {
            font: "32px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);
    };

    update() {
        //game logic here
    };
};

export default MainScene;