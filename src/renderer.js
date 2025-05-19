import * as THREE from 'three';
import { Fox } from './fox';
import { SpeechHandler } from './speech.js';
import { ChatGPTHandler } from './chatgpt.js';
import { ipcRenderer } from 'electron';

// Initialize Three.js scene
const scene = new THREE.Scene();
scene.background = null; // Transparent background

// Camera
const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.1, 1000
);
// Position camera more conservatively - similar to original working settings
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

// Renderer with alpha (transparency)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,  // Enable transparency
  premultipliedAlpha: false // Fix transparency issues
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // Transparent background
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
document.body.appendChild(renderer.domElement);

// Futuristic lighting setup
const setupLighting = () => {
  // Clear existing lights
  scene.children.forEach(child => {
    if (child.isLight) scene.remove(child);
  });

  // Ambient light - softer base light
  const ambientLight = new THREE.AmbientLight(0x111122, 0.4);
  scene.add(ambientLight);

  // Main directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  // Neon spot lights for futuristic effect
  const createSpotlight = (color, intensity, position, angle = Math.PI/6) => {
    const spotlight = new THREE.SpotLight(color, intensity);
    spotlight.position.set(...position);
    spotlight.angle = angle;
    spotlight.penumbra = 0.2;
    spotlight.decay = 1.5;
    spotlight.distance = 100;
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 512;
    spotlight.shadow.mapSize.height = 512;
    scene.add(spotlight);
    
    // Add subtle flicker animation
    return spotlight;
  };

  const spotlights = [
    createSpotlight(0x00f0ff, 2.5, [-3.5, 5, 3.5]),   // Cyan
    createSpotlight(0xff00cc, 2.5, [3.5, 4, 1.5]),    // Pink
    createSpotlight(0x00ff9d, 2.5, [1.5, 5, -2.5]),   // Green
    createSpotlight(0xffee00, 1.5, [-1.5, 2.5, 5])    // Yellow
  ];

  // Add subtle animation for the spotlights
  spotlights.forEach(light => {
    // Store original values for animation
    light.userData = {
      originalIntensity: light.intensity,
      originalPosition: light.position.clone(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5
    };
  });

  return spotlights;
};

// Add fog for atmosphere
scene.fog = new THREE.FogExp2(0x000020, 0.0025);

// Create neon glowing ground plane
const createGlowingGround = () => {
  const planeGeometry = new THREE.PlaneGeometry(80, 80, 32, 32);
  const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0x101030,
    metalness: 0.8,
    roughness: 0.5,
    emissive: 0x101020,
    emissiveIntensity: 0.2
  });
  
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -5;
  plane.receiveShadow = true;
  scene.add(plane);

  // Add grid lines for futuristic effect
  const gridHelper = new THREE.GridHelper(80, 40, 0x00ffff, 0x00ffff);
  gridHelper.position.y = -4.9;
  gridHelper.material.opacity = 0.15;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  return { plane, gridHelper };
};

// Add particle system for atmosphere
const createParticles = () => {
  const particleCount = 1000;
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  
  const colorOptions = [
    new THREE.Color(0x00f0ff), // Cyan
    new THREE.Color(0xff00cc), // Pink
    new THREE.Color(0x00ff9d), // Green
    new THREE.Color(0xffee00)  // Yellow
  ];

  for (let i = 0; i < particleCount; i++) {
    // Position
    const x = (Math.random() - 0.5) * 100;
    const y = Math.random() * 50;
    const z = (Math.random() - 0.5) * 100;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    // Color
    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  });
  
  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);
  
  return particleSystem;
};

// Create background elements for neon scenery
const createBackgroundElements = () => {
  // Add some floating neon cubes in the background
  const cubes = [];
  
  const createNeonCube = (size, position, color) => {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.9,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7
    });
    
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(...position);
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // Add subtle glow effect
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    
    const glowMesh = new THREE.Mesh(new THREE.BoxGeometry(size * 1.2, size * 1.2, size * 1.2), glowMaterial);
    cube.add(glowMesh);
    
    scene.add(cube);
    
    // Store animation data
    cube.userData = {
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.01,
        y: (Math.random() - 0.5) * 0.01,
        z: (Math.random() - 0.5) * 0.01
      },
      floatSpeed: 0.3 + Math.random() * 0.5,
      floatHeight: Math.random() * 0.5,
      startY: position[1],
      phase: Math.random() * Math.PI * 2
    };
    
    return cube;
  };
  
  // Add several neon cubes at different positions
  cubes.push(createNeonCube(3, [-20, 10, -25], 0x00f0ff)); // Cyan
  cubes.push(createNeonCube(2, [25, 8, -15], 0xff00cc));   // Pink
  cubes.push(createNeonCube(4, [-15, 15, -40], 0x00ff9d)); // Green
  cubes.push(createNeonCube(2.5, [30, 12, -30], 0xffee00)); // Yellow
  
  return cubes;
};

// Create futuristic background elements
const ground = createGlowingGround();
const particles = createParticles();
const spotlights = setupLighting();
const backgroundElements = createBackgroundElements();

// Initialize fox
console.log('Initializing fox...');
const fox = new Fox(scene);

// Debug info - print all scene objects to help troubleshoot
console.log('Scene contents:');
scene.traverse(object => {
  console.log(object.type, object.name, object.position);
});

// Initialize speech handler
const speechHandler = new SpeechHandler(
  // On speech start
  () => {
    fox.setState('listening');
    document.getElementById('status').textContent = 'Listening...';
  },
  // On speech end
  () => {
    fox.setState('thinking');
    document.getElementById('status').textContent = 'Processing...';
  },
  // On result
  async (transcript) => {
    document.getElementById('user-input').textContent = transcript;

    // Set fox to thinking animation
    fox.setState('thinking');
    document.getElementById('status').textContent = 'Processing...';

    try {
      // Send to ChatGPT
      const response = await chatGPT.sendMessage(transcript);

      // Show response
      document.getElementById('ai-response').textContent = response;

      // Switch to speaking animation and read response
      fox.setState('speaking');
      document.getElementById('status').textContent = 'Speaking...';

      await speechHandler.speak(response);

      // Back to idle
      fox.setState('idle');
      document.getElementById('status').textContent = 'Ready';
    } catch (error) {
      console.error('Error in conversation flow:', error);
      document.getElementById('ai-response').textContent = 'Sorry, I encountered an error. Please try again.';
      fox.setState('idle');
      document.getElementById('status').textContent = 'Ready';
    }
  }
);

// Populate voice dropdown
async function populateVoiceDropdown() {
  try {
    const voices = await speechHandler.getAvailableVoices();
    const voiceSelect = document.getElementById('voice-select');

    // Clear any existing options
    voiceSelect.innerHTML = '';

    // Add each voice as an option
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });

    // Set default voice to 'ash'
    const defaultVoice = voices.find(v => v.name === 'ash') || voices[0];
    if (defaultVoice) {
      voiceSelect.value = defaultVoice.name;
      speechHandler.setVoice(defaultVoice.name);
    }

    // Add event listener for voice change
    voiceSelect.addEventListener('change', (e) => {
      speechHandler.setVoice(e.target.value);
    });
  } catch (error) {
    console.error('Error loading voices:', error);
  }
}

// Initialize ChatGPT handler
const chatGPT = new ChatGPTHandler();

// Setup Circular Menu
function setupCircularMenu() {
  const circularMenu = document.getElementById('circular-menu');
  const buttons = circularMenu.querySelectorAll('.menu-button');
  const numButtons = buttons.length;

  // Position buttons in a circle
  const radius = 80; // Radius of the circle
  const startAngle = -Math.PI / 2; // Start from the top

  buttons.forEach((button, index) => {
    // Calculate angle for this button
    const angle = startAngle + (2 * Math.PI * index / numButtons);

    // Calculate position
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    // Position the button
    button.style.left = `calc(50% + ${x}px - 22.5px)`;
    button.style.top = `calc(50% + ${y}px - 22.5px)`;

    // Add tooltip functionality
    const tooltip = document.getElementById('tooltip');

    button.addEventListener('mouseenter', (e) => {
      const tooltipText = button.getAttribute('data-tooltip');
      tooltip.textContent = tooltipText;
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY + 10}px`;
      tooltip.style.opacity = '1';
    });

    button.addEventListener('mousemove', (e) => {
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY + 10}px`;
    });

    button.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });
}

// Make fox clickable
function setupFoxClickable() {
  const foxClickableArea = document.getElementById('fox-clickable-area');
  const circularMenu = document.getElementById('circular-menu');
  let menuVisible = false;

  foxClickableArea.addEventListener('click', () => {
    menuVisible = !menuVisible;

    if (menuVisible) {
      circularMenu.classList.add('visible');
    } else {
      circularMenu.classList.remove('visible');
      // Hide the UI as well when closing the menu
      document.getElementById('ui-container').classList.add('hidden');
    }
  });
}

// Draggable functionality
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function setupDraggable() {
  const foxClickableArea = document.getElementById('fox-clickable-area');

  foxClickableArea.addEventListener('mousedown', (e) => {
    // Only start dragging if not clicking a menu button
    if (e.target === foxClickableArea) {
      isDragging = true;
      dragOffset.x = e.clientX;
      dragOffset.y = e.clientY;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      ipcRenderer.send('window-move', {
        mouseX: e.clientX - dragOffset.x,
        mouseY: e.clientY - dragOffset.y
      });
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// Add Google font for futuristic look
function addFuturisticFont() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

// UI Event Handlers when DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
  // Add futuristic font
  addFuturisticFont();
  
  // Setup circular menu
  setupCircularMenu();

  // Setup fox clickable area
  setupFoxClickable();

  // Setup draggable window
  setupDraggable();

  // Setup menu button listeners
  const textModeBtn = document.getElementById('text-mode-btn');
  const voiceModeBtn = document.getElementById('voice-mode-btn');
  const settingsBtn = document.getElementById('settings-btn');

  const textInputContainer = document.getElementById('text-input-container');
  const voiceInputContainer = document.getElementById('voice-input-container');
  const startVoiceBtn = document.getElementById('start-voice-btn');
  const stopVoiceBtn = document.getElementById('stop-voice-btn');
  const textInput = document.getElementById('text-input');
  const sendTextBtn = document.getElementById('send-text-btn');
  const uiContainer = document.getElementById('ui-container');
  const settingsPanel = document.getElementById('settings');
  const settingsClose = document.getElementById('settings-close');

  // Text mode button
  textModeBtn.addEventListener('click', () => {
    // Show UI container
    uiContainer.classList.remove('hidden');

    // Setup for text mode
    textInputContainer.style.display = 'flex';
    voiceInputContainer.style.display = 'none';
    document.getElementById('status').textContent = 'Type your message';

    // Hide circular menu
    document.getElementById('circular-menu').classList.remove('visible');
  });

  // Voice mode button
  voiceModeBtn.addEventListener('click', () => {
    // Show UI container
    uiContainer.classList.remove('hidden');

    // Setup for voice mode
    textInputContainer.style.display = 'none';
    voiceInputContainer.style.display = 'flex';
    document.getElementById('status').textContent = 'Ready for voice';

    // Hide circular menu
    document.getElementById('circular-menu').classList.remove('visible');
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'block';

    // Hide circular menu
    document.getElementById('circular-menu').classList.remove('visible');
  });

  // Settings close button
  settingsClose.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
  });

  // Start voice input
  startVoiceBtn.addEventListener('click', () => {
    speechHandler.startListening();
    startVoiceBtn.classList.add('active-button');
    stopVoiceBtn.classList.remove('active-button');
  });

  // Stop voice input
  stopVoiceBtn.addEventListener('click', () => {
    speechHandler.stopListening();
    startVoiceBtn.classList.remove('active-button');
    stopVoiceBtn.classList.add('active-button');
  });

  // Send text message
  sendTextBtn.addEventListener('click', sendTextMessage);

  // Send text message on Enter
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendTextMessage();
    }
  });

  // Text input handler
  function sendTextMessage() {
    const text = textInput.value.trim();
    if (text) {
      // Show user input in conversation
      document.getElementById('user-input').textContent = text;

      // Clear input field
      textInput.value = '';

      // Process input through main conversation flow (reusing the result handler)
      speechHandler.onSpeechStart();
      setTimeout(() => {
        speechHandler.onSpeechEnd();
        // Call the same result handler used for voice
        speechHandler.onResult(text);
      }, 500);
    }
  }

  // Handle API key updates
  const apiKeyInput = document.getElementById('api-key-input');
  if (apiKeyInput) {
    // Load saved API key
    try {
      const savedApiKey = await window.electron.getApiKey();
      if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }

    // Save API key when changed
    apiKeyInput.addEventListener('change', () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        window.electron.saveApiKey(apiKey);
      }
    });
  }
  // Populate voice dropdown
  populateVoiceDropdown();
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();
  
  // Update fox model
  fox.update(delta);
  
  // Animate neon lighting effects
  if (spotlights) {
    spotlights.forEach(light => {
      const userData = light.userData;
      // Subtle intensity flicker
      light.intensity = userData.originalIntensity * (0.9 + 0.2 * Math.sin(elapsedTime * userData.speed + userData.phase));
      
      // Subtle position movement
      const posX = userData.originalPosition.x + Math.sin(elapsedTime * 0.5 + userData.phase) * 2;
      const posY = userData.originalPosition.y + Math.sin(elapsedTime * 0.3 + userData.phase) * 1;
      const posZ = userData.originalPosition.z + Math.cos(elapsedTime * 0.4 + userData.phase) * 2;
      
      light.position.set(posX, posY, posZ);
    });
  }
  
  // Animate particle system
  if (particles) {
    particles.rotation.y = elapsedTime * 0.05;
    
    // Make particles twinkle
    if (particles.material.opacity > 0.4 && particles.material.opacity < 0.8) {
      particles.material.opacity = 0.4 + Math.sin(elapsedTime * 0.5) * 0.2;
    }
  }
  
  // Animate grid lines with wave effect
  if (ground && ground.gridHelper) {
    ground.gridHelper.position.y = -4.9 + Math.sin(elapsedTime * 0.5) * 0.1;
  }
  
  // Animate background cubes
  if (backgroundElements) {
    backgroundElements.forEach(cube => {
      const userData = cube.userData;
      
      // Rotation
      cube.rotation.x += userData.rotationSpeed.x;
      cube.rotation.y += userData.rotationSpeed.y;
      cube.rotation.z += userData.rotationSpeed.z;
      
      // Floating effect
      cube.position.y = userData.startY + Math.sin(elapsedTime * userData.floatSpeed + userData.phase) * userData.floatHeight;
      
      // Pulsing glow effect on the child glow mesh
      if (cube.children[0]) {
        cube.children[0].material.opacity = 0.1 + Math.sin(elapsedTime * 2 + userData.phase) * 0.05;
        cube.children[0].scale.setScalar(1.2 + Math.sin(elapsedTime * 1.5 + userData.phase) * 0.05);
      }
    });
  }
  
  renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});