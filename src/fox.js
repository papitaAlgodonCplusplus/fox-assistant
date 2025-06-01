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
      speaking: null,
      // New animations for actions
      patting: null,
      kissing: null,
      dancing: null
    };
    this.currentState = 'idle';
    this.addLights();
    this.loadModel();
  }

  addLights() {
    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light for shadows and highlights
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 5, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    this.scene.add(dirLight);

    // Optional: Add a point light for a glowing effect near the fox
    const pointLight = new THREE.PointLight(0xffa500, 0.5, 3);
    pointLight.position.set(0, 1, 1);
    this.scene.add(pointLight);
  }

  loadModel() {
    // Create a texture loader
    const textureLoader = new THREE.TextureLoader();

    // Load the texture first
    textureLoader.load('assets/textures/taidum.png', (texture) => {
      console.log('Texture loaded successfully');

      // Once texture is loaded, load the model
      const loader = new FBXLoader();
      loader.load('assets/models/taidum.fbx', (fbx) => {
        this.model = fbx;
        this.model.scale.set(0.01, 0.01, 0.01);
        this.model.position.set(0, -5, 0);

        // Apply texture to the model
        this.model.traverse((child) => {
          if (child.isMesh) {
            const material = child.material.clone();
            material.map = texture;
            material.needsUpdate = true;
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.scene.add(this.model);

        // Setup animations
        this.mixer = new THREE.AnimationMixer(this.model);

        // Load all animations
        this.loadAnimation('idle', 'assets/animations/idle.fbx');
        this.loadAnimation('listening', 'assets/animations/listening.fbx');
        this.loadAnimation('thinking', 'assets/animations/thinking.fbx');
        this.loadAnimation('speaking', 'assets/animations/speaking.fbx');
        
        // Load new action animations
        this.loadAnimation('patting', 'assets/animations/patting.fbx');
        this.loadAnimation('kissing', 'assets/animations/kissing.fbx');
        this.loadAnimation('dancing', 'assets/animations/dancing.fbx');
      });
    },
      (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% texture loaded');
      },
      (error) => {
        console.error('Error loading texture:', error);
      });
  }

  loadAnimation(name, url) {
    const loader = new FBXLoader();
    loader.load(url, (fbx) => {
      const animation = fbx.animations[0];
      if (animation) {
        this.animations[name] = this.mixer.clipAction(animation);

        // Configure animation settings
        if (name === 'patting' || name === 'kissing') {
          // These are one-time actions
          this.animations[name].setLoop(THREE.LoopOnce);
          this.animations[name].clampWhenFinished = true;
        } else if (name === 'dancing') {
          // Dancing loops
          this.animations[name].setLoop(THREE.LoopRepeat);
        }

        // Start idle animation by default
        if (name === 'idle') {
          this.animations.idle.play();
        }
      }
    }, undefined, (error) => {
      console.warn(`Could not load animation ${name}:`, error);
    });
  }

  setState(state) {
    if (this.currentState === state || !this.animations[state]) return;

    const previousState = this.currentState;

    // Handle special action animations
    if (state === 'patting' || state === 'kissing') {
      // Play one-time animation
      this.playActionAnimation(state, previousState);
      return;
    } else if (state === 'dancing') {
      // Start dancing loop
      this.playDancingAnimation(previousState);
      return;
    }

    // Regular state transitions
    this.animations[this.currentState].fadeOut(0.5);
    this.animations[state].reset().fadeIn(0.5).play();

    // Handle model rotation for speaking
    if (state === 'speaking' && this.model) {
      this.model.rotation.y = THREE.MathUtils.degToRad(-30);
    } else if (this.currentState === 'speaking' && this.model) {
      this.model.rotation.y = 0;
    }

    this.currentState = state;
  }

  playActionAnimation(action, returnState = 'idle') {
    if (!this.animations[action]) {
      console.warn(`Animation ${action} not loaded`);
      return;
    }

    // Fade out current animation
    this.animations[this.currentState].fadeOut(0.3);
    
    // Play action animation
    this.animations[action].reset().fadeIn(0.3).play();
    this.currentState = action;

    // Set up listener for when animation finishes
    const mixer = this.mixer;
    const onFinished = (e) => {
      if (e.action === this.animations[action]) {
        mixer.removeEventListener('finished', onFinished);
        this.setState(returnState);
      }
    };
    mixer.addEventListener('finished', onFinished);
  }

  playDancingAnimation(previousState) {
    if (!this.animations.dancing) {
      console.warn('Dancing animation not loaded');
      return;
    }

    this.animations[this.currentState].fadeOut(0.5);
    this.animations.dancing.reset().fadeIn(0.5).play();
    this.currentState = 'dancing';

    // Add some fun rotation while dancing
    if (this.model) {
      this.model.rotation.y = THREE.MathUtils.degToRad(15);
    }
  }

  stopDancing() {
    if (this.currentState === 'dancing') {
      this.setState('idle');
      if (this.model) {
        this.model.rotation.y = 0;
      }
    }
  }

  // Action methods for easy access
  pat() {
    this.setState('patting');
  }

  kiss() {
    this.setState('kissing');
  }

  dance() {
    this.setState('dancing');
  }

  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }
}