import * as THREE from "../../lib/three/build/three.module.js";
import * as Utils from "../../js/Utils.js";

// Three.js classes
import {EffectComposer} from '../../lib/three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from '../../lib/three/examples/jsm/postprocessing/RenderPass.js';
import {GlitchPass} from '../../js/CustomGlitchPass.js';

// my classes
import Hero from "../../js/classes/Hero.js";
import Building from "../../js/classes/Building.js";
import Gun from "../../js/classes/Gun.js";
import Enemy from "../../js/classes/Enemy.js";
import Flipper from "../../js/classes/powerups/Flipper.js";

class Level {
    constructor(levelNumber, rendererThree, sounds) {
        this.rendererThree = rendererThree;
        this.sounds = sounds;
        let arenaSize = 20 + 4 * (levelNumber - 1); // 20, 24, 28, etc.
        let scene = null;
        let camera = null;
        let composer = null;
        let glitchPass = null;
        let hero = null;
        let bullets = [];
        let buildings = [];
        let enemies = [];
        let powerUps = [];
        let gun = null;
        let padsRemaining = 0;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 50);
        scene.background = new THREE.Color(0x000000);
        // scene.background = new THREE.Color(0xefd1b5);
        scene.fog = new THREE.FogExp2(0xFF00FF, 0.05);
        scene.color = 0x00DD00;

        rendererThree.setSize(window.innerWidth, window.innerHeight);

        composer = new EffectComposer(rendererThree);

        //hero = new Hero(scene, camera, -55, 0);
        hero = new Hero(scene, camera, 10, 0);
        // add buildings
        let halfArena = arenaSize / 2;
        for (let gridX = 0; gridX < arenaSize; gridX++) {
            for (let gridY = 0; gridY < arenaSize; gridY++) {
                if (gridY === halfArena) continue;
                // if (gridY % 3 === 0 || gridX % 3 === 0) continue;
                // if (!(gridY % 4 === 0 || gridY % 4 === 1 || gridX % 4 === 0 || gridX % 4 === 1)) {
                if (Utils.randomInt(40) === 0) {
                    let boxHeight = Utils.randomInt(10) + 1;
                    let building = new Building(gridX, gridY - halfArena, boxHeight, scene, true);
                    buildings.push(building);
                } else if (Utils.randomInt(40) === 0) {
                    let enemy = new Enemy(gridX, gridY - halfArena, scene, 1);
                    enemies.push(enemy);
                } else if (Utils.randomInt(160) === 0) {
                    let powerUp = new Flipper(gridX, gridY - halfArena, scene);
                    powerUps.push(powerUp);
                    padsRemaining += 1;
                }
            }
        }

        // add fence around the buildings
        for (let gridX = -1; gridX <= arenaSize; gridX++) {
            for (let gridY = -1; gridY <= arenaSize; gridY++) {
                // leaving a gap
                if (gridY === halfArena && gridX === -1) continue;
                // only filling in edges
                if (gridX === -1 || gridY === -1 || gridX === arenaSize || gridY === arenaSize) {
                    let boxHeight = 1;
                    // if (gridY % 2 === 0 || gridX % 2 === 0) boxHeight = 2;
                    if (gridX !== arenaSize && (gridY === halfArena - 1 || gridY === halfArena + 1)) boxHeight = 20;
                    let building = new Building(gridX, gridY - arenaSize / 2, boxHeight, scene, false);
                    buildings.push(building);
                }
            }
        }

        gun = new Gun(scene, bullets, hero, this.sounds.pew);
        hero.setGun(gun);

        // floor
        let floorTexture = new THREE.TextureLoader().load('assets/img/floor-tile.png');
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(1000, 1000);
        let floorMaterial = new THREE.MeshBasicMaterial({map: floorTexture, side: THREE.FrontSide});
        let floorGeometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
        let plane = new THREE.Mesh(floorGeometry, floorMaterial);
        plane.position.z = 0;
        scene.add(plane);

        // light
        let dirLight;
        dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(-2, 5, 3).normalize();
        scene.add(dirLight);

        // post processing
        let renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        glitchPass = new GlitchPass();
        composer.addPass(glitchPass);

        // adding objects
        this.scene = scene;
        this.camera = camera;
        this.composer = composer;
        this.glitchPass = glitchPass;
        this.hero = hero;
        this.bullets = bullets;
        this.buildings = buildings;
        this.enemies = enemies;
        this.powerUps = powerUps;
        this.gun = gun;
        this.padsRemaining = padsRemaining;

        // "synth blast" title
        this.addTitleImage();
    }

    //https://codepen.io/duhaime/pen/jaYdLg
    addTitleImage() {
        let loader = new THREE.TextureLoader();
        let material = new THREE.MeshLambertMaterial({
            map: loader.load('assets/img/synthblast.png'),
            fog: false
        });
        // preserve ratio
        let geometry = new THREE.PlaneGeometry(5 * 358 / 32, 5);
        let mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(-10, 0, 20);
        mesh.rotation.y = -Math.PI / 2;
        mesh.rotation.x = Math.PI / 2;
        this.scene.add(mesh);
    }

    render(fpsAdjustment) {
        // update our objects
        this.bullets.forEach(bullet => bullet.update());
        this.buildings.forEach(building => building.update(fpsAdjustment));
        this.enemies.forEach(enemy => enemy.update(this.hero, fpsAdjustment));
        this.powerUps.forEach(powerUp => powerUp.update(fpsAdjustment));
        this.hero.update(fpsAdjustment);

        // bullets hitting things
        this.bullets.forEach(bullet => {
            if (bullet.isActive()) {
                this.buildings.forEach(building => {
                    if (
                        building.isActive()
                        && Math.abs(building.getX() - bullet.getX()) < 0.5
                        && Math.abs(building.getY() - bullet.getY()) < 0.5
                    ) {
                        let buildingHitPoints = building.getHitPoints();
                        building.hit(bullet.getHitPoints());
                        bullet.hit(buildingHitPoints);
                        this.sounds.impact.currentTime = 0;
                        this.sounds.impact.play();

                    }
                });
                this.enemies.forEach(enemy => {
                    if (
                        enemy.isAlive()
                        && Math.abs(enemy.getX() - bullet.getX()) < 0.5
                        && Math.abs(enemy.getY() - bullet.getY()) < 0.5
                    ) {
                        let enemyHitPoints = enemy.getHitPoints();
                        enemy.hit(bullet.getHitPoints(), fpsAdjustment);
                        bullet.hit(enemyHitPoints);
                        if (!enemy.isAlive()) {
                            this.sounds.explosion.currentTime = 0;
                            this.sounds.explosion.play();
                        } else {
                            this.sounds.impact.currentTime = 0;
                            this.sounds.impact.play();
                        }
                    }
                });

            }
        });

        // can't go through buildings
        this.buildings.forEach(building => {
            if (building.isActive()) {
                if (
                    Math.abs(building.getX() - this.hero.getX()) < 0.6
                    && Math.abs(building.getY() - this.hero.getY()) < 0.6
                ) {
                    // getting them out of the building
                    this.hero.unMove();
                }
                this.enemies.forEach(
                    enemy => {
                        if (
                            enemy.isAlive()
                            && Math.abs(enemy.getX() - building.getX()) < 0.6
                            && Math.abs(enemy.getY() - building.getY()) < 0.6
                        ) {
                            enemy.unMove();
                        }
                    });
            }
        });

        if (this.hero.isAlive()) {
            let heroR = 0.4;
            if (this.hero.hasShield()) heroR = 1.5;
            this.enemies.forEach(
                enemy => {
                    if (
                        enemy.isAlive()
                        && Math.abs(enemy.getX() - this.hero.getX()) < heroR
                        && Math.abs(enemy.getY() - this.hero.getY()) < heroR
                    ) {

                        let heroHitPoints = this.hero.getHitPoints();
                        let damage = this.hero.hit(enemy.getHitPoints());
                        enemy.hit(heroHitPoints, fpsAdjustment);
                        // hero.reset();
                        if (damage > 0) {
                            this.glitchPass.trigger();
                        }
                        if (enemy.isAlive()) {
                            this.sounds.hit.currentTime = 0;
                            this.sounds.hit.play();
                        } else {
                            this.sounds.explosion.currentTime = 0;
                            this.sounds.explosion.play();
                        }
                    }
                });

            this.powerUps.forEach(pad => {
                if (
                    !pad.isUsed
                    && Math.abs(pad.getX() - this.hero.getX()) < 0.7
                    && Math.abs(pad.getY() - this.hero.getY()) < 0.7
                ) {
                    pad.hit();
                    this.padsRemaining -= 1;
                    this.sounds.point.currentTime = 0;
                    this.sounds.point.play();
                }
            });
        }

        this.composer.render();
    }

    hasWon() {
        return this.padsRemaining === 0;
    }

    hasDied() {
        return this.hero.hitPoints <= 0;
    }

}

export default Level;