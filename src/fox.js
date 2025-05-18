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
    // Create a texture loader
    const textureLoader = new THREE.TextureLoader();
    
    // Load the texture first
    textureLoader.load('assets/textures/taidum.png', (texture) => {
      console.log('Texture loaded successfully');
      
      // Once texture is loaded, load the model
      const loader = new FBXLoader();
      loader.load('assets/models/taidum.fbx', (fbx) => {
        this.model = fbx;
        this.model.scale.set(0.04, 0.04, 0.04); // Adjust scale for floating assistant
        
        // Center the model in the window
        this.model.position.set(0, 0, 0);
        
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
    this.currentState = state;
  }

  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    
    // Add slight floating animation for desktop assistant
    if (this.model) {
      // Gentle bob up and down
      const floatOffset = Math.sin(Date.now() * 0.001) * 0.05;
      this.model.position.y = floatOffset;
      
      // Slight rotation for liveliness
      this.model.rotation.y = Math.sin(Date.now() * 0.0005) * 0.2;
    }
  }
}