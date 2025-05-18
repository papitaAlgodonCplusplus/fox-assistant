import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

export class Fox {
  constructor(scene) {
    this.scene = scene;
    this.mixer = null;
    this.model = null;
    this.animations = {
      idle: null,
      listening: null,
      thinking: null,
      speaking: null
    };
    this.currentState = 'idle';
    this.loadModel();
  }

  loadModel() {
    const loader = new FBXLoader();
    loader.load('assets/models/taidum.fbx', (fbx) => {
      this.model = fbx;
      this.model.scale.set(0.05, 0.05, 0.05); // Adjust scale as needed
      this.model.position.set(0, 0, 0);
      this.scene.add(this.model);
      
      // Setup animations
      this.mixer = new THREE.AnimationMixer(this.model);
      
      // Load animations
      this.loadAnimation('idle', 'assets/animations/idle.fbx');
      this.loadAnimation('listening', 'assets/animations/listening.fbx');
      this.loadAnimation('thinking', 'assets/animations/thinking.fbx');
      this.loadAnimation('speaking', 'assets/animations/speaking.fbx');
    });
  }

  loadAnimation(name, url) {
    const loader = new FBXLoader();
    loader.load(url, (fbx) => {
      const animation = fbx.animations[0];
      this.animations[name] = this.mixer.clipAction(animation);
      
      // Start idle animation by default
      if (name === 'idle') {
        this.animations.idle.play();
      }
    });
  }

  setState(state) {
    if (this.currentState === state || !this.animations[state]) return;
    
    // Crossfade to new animation
    this.animations[this.currentState].fadeOut(0.5);
    this.animations[state].reset().fadeIn(0.5).play();
    this.currentState = state;
  }

  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }
}