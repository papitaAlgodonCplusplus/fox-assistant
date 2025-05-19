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
    this.addLights(); // Add this line to initialize lights
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
        this.model.scale.set(0.01, 0.01, 0.01); // Adjust scale for floating assistant

        // Center the model in the window
        this.model.position.set(0, -5, 0);

        // Apply texture to the model
        this.model.traverse((child) => {
          // Check if this child is a mesh
          if (child.isMesh) {
            // Clone the existing material
            const material = child.material.clone();

            // Apply the texture to the material
            material.map = texture;
            material.needsUpdate = true;

            // Assign the new material back to the mesh
            child.material = material;

            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.scene.add(this.model);

        // Setup animations
        this.mixer = new THREE.AnimationMixer(this.model);

        // Load animations
        this.loadAnimation('idle', 'assets/animations/idle.fbx');
        this.loadAnimation('listening', 'assets/animations/listening.fbx');
        this.loadAnimation('thinking', 'assets/animations/thinking.fbx');
        this.loadAnimation('speaking', 'assets/animations/speaking.fbx');
      });
    },
      // Progress callback
      (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% texture loaded');
      },
      // Error callback
      (error) => {
        console.error('Error loading texture:', error);
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

    // Rotate the fox when speaking, reset otherwise
    if (state === 'speaking' && this.model) {
      this.model.rotation.y = THREE.MathUtils.degToRad(-30);
    } else if (this.currentState === 'speaking' && this.model) {
      this.model.rotation.y = 0;
    }

    this.currentState = state;
  }


  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }
}