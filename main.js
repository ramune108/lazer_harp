import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ==========================================
// 1. 変数・設定の準備
// ==========================================
let scene, camera, renderer, composer, pointer;
const lasers = [];
const laserStates = new Array(8).fill(false);
const notes = ["A2", "C3", "D3", "E3", "G3", "A3", "C4", "D4"]; // ヨナ抜き音階

// ==========================================
// 2. 音源 (Tone.js) の設定
// ==========================================
const synth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: "sawtooth" }, // 平沢サウンドの核：ノコギリ波
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1.2 }
}).toDestination();

// エコー効果
const delay = new Tone.FeedbackDelay("8n", 0.4).toDestination();
synth.connect(delay);

// ==========================================
// 3. 3D空間 (Three.js) の構築
// ==========================================
function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 6);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 光らせる演出 (Bloom)
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    // 扇状レーザーの生成
    const laserGeo = new THREE.CylinderGeometry(0.015, 0.015, 10, 8);
    for (let i = 0; i < 8; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 });
        const laser = new THREE.Mesh(laserGeo, mat);
        
        // 角度を計算して扇状に配置
        const angle = (i - 3.5) * 0.25; 
        laser.rotation.z = angle;
        laser.position.x = Math.sin(angle) * 5;
        laser.position.y = Math.cos(angle) * 5 - 2;
        
        scene.add(laser);
        lasers.push(laser);
    }

    // 指先代わりの球体
    pointer = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(pointer);
}

// ==========================================
// 4. 当たり判定 (数学的な計算)
// ==========================================
function checkCollision(x, y) {
    // 座標から角度(angle)を割り出す
    const angle = Math.atan2(x, y + 2);

    lasers.forEach((laser, i) => {
        const targetAngle = (i - 3.5) * 0.25;
        const diff = Math.abs(angle - targetAngle);

        if (diff < 0.06) { // 指がレーザーの角度に重なったら
            if (!laserStates[i]) {
                playNote(i); // 鳴らす
                laserStates[i] = true;
            }
        } else {
            laserStates[i] = false; // 離れたらリセット
        }
    });
}

function playNote(i) {
    synth.triggerAttackRelease(notes[i], "8n");
    // ビジュアルの反応
    lasers[i].scale.x = 4;
    setTimeout(() => lasers[i].scale.x = 1, 100);
}

// ==========================================
// 5. AI (MediaPipe) のハンドトラッキング
// ==========================================
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
    }
});

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const finger = results.multiHandLandmarks[0][8]; // 人差し指
        const x = (1 - finger.x - 0.5) * 12; // 画面幅に合わせ変換
        const y = (-(finger.y) + 0.5) * 10;
        
        pointer.position.set(x, y, 0);
        checkCollision(x, y);
    }
});

// ==========================================
// 6. 実行ループ
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    composer.render();
}

// 開始ボタンのクリックで全てが動く
document.getElementById('start-btn').addEventListener('click', async () => {
    await Tone.start();
    const videoElement = document.getElementById('input_video');
    const cameraFeed = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 1280, height: 720
    });
    cameraFeed.start();
    document.getElementById('overlay').style.display = 'none';
});

initScene();
animate();
