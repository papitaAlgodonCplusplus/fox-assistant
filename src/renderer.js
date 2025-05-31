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

// Initialize speech handler with Coqui TTS ONLY
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

      // Use Coqui TTS exclusively
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

// Initialize Coqui TTS settings on startup
function initializeCoquiTTS() {
  console.log('🦊 Initializing Coqui TTS for Fox Assistant...');
  
  // Force Coqui TTS mode
  speechHandler.setCoquiTTS(true);
  
  // Load saved settings or use defaults
  const settings = loadCoquiSettings();
  
  // Apply settings
  speechHandler.setCoquiServerUrl(settings.serverUrl || 'http://localhost:5002');
  speechHandler.setSpeakerWav(settings.speakerWavPath || './coqui-models/speaker.wav');
  speechHandler.setVoiceLanguage(settings.language || 'en');
  
  console.log('✅ Coqui TTS initialized with settings:', settings);
}

// Load Coqui TTS settings from localStorage
function loadCoquiSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('foxAssistantCoquiSettings') || '{}');
    return {
      serverUrl: settings.serverUrl || 'http://localhost:5002',
      speakerWavPath: settings.speakerWavPath || './coqui-models/speaker.wav',
      language: settings.language || 'en',
      autoStartServer: settings.autoStartServer || false,
      modelName: settings.modelName || 'tts_models/multilingual/multi-dataset/xtts_v2'
    };
  } catch (error) {
    console.error('Error loading Coqui settings:', error);
    return {
      serverUrl: 'http://localhost:5002',
      speakerWavPath: './coqui-models/speaker.wav',
      language: 'en',
      autoStartServer: false,
      modelName: 'tts_models/multilingual/multi-dataset/xtts_v2'
    };
  }
}

// Save Coqui TTS settings
function saveCoquiSettings(settings) {
  try {
    localStorage.setItem('foxAssistantCoquiSettings', JSON.stringify(settings));
    console.log('💾 Coqui settings saved:', settings);
  } catch (error) {
    console.error('Error saving Coqui settings:', error);
  }
}

// Get available Coqui voices (cloned voices)
async function populateVoiceDropdown() {
  try {
    console.log('🎤 Loading Coqui TTS voices...');
    
    const voiceSelect = document.getElementById('voice-select');
    if (!voiceSelect) return;

    // Clear existing options
    voiceSelect.innerHTML = '';

    // Get available cloned voices from the coqui-models directory
    const clonedVoices = await getAvailableClonedVoices();
    
    // Add each cloned voice as an option
    clonedVoices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.path;
      option.textContent = `${voice.name} (Cloned Voice)`;
      voiceSelect.appendChild(option);
    });

    // Set default voice
    const settings = loadCoquiSettings();
    if (settings.speakerWavPath) {
      voiceSelect.value = settings.speakerWavPath;
      speechHandler.setSpeakerWav(settings.speakerWavPath);
    }

    // Add event listener for voice change
    voiceSelect.addEventListener('change', (e) => {
      speechHandler.setSpeakerWav(e.target.value);
      const settings = loadCoquiSettings();
      settings.speakerWavPath = e.target.value;
      saveCoquiSettings(settings);
    });

    console.log('✅ Coqui voices loaded:', clonedVoices);
  } catch (error) {
    console.error('Error loading Coqui voices:', error);
  }
}

// Get available cloned voices from the file system
async function getAvailableClonedVoices() {
  const defaultVoices = [
    { name: 'Default Cloned Voice', path: './coqui-models/speaker.wav' },
    { name: 'Nicolas Voice', path: './coqui-models/nicolas.wav' },
    { name: 'Custom Voice 1', path: './coqui-models/voice1.wav' },
    { name: 'Custom Voice 2', path: './coqui-models/voice2.wav' }
  ];

  // In a real implementation, you would scan the coqui-models directory
  // for .wav files and return them. For now, return default options.
  return defaultVoices;
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

// Setup Coqui TTS Settings Panel
function setupCoquiSettings() {
  const settingsPanel = document.getElementById('settings');
  
  // Create Coqui TTS settings HTML
  const coquiSettingsHTML = `
    <div id="coqui-tts-settings">
      <h4>🦊 Coqui TTS Voice Configuration</h4>
      
      <!-- Server Settings -->
      <div class="setting-group">
        <label for="coqui-server-url">Server URL:</label>
        <input type="text" id="coqui-server-url" value="http://localhost:5002" placeholder="http://localhost:5002">
      </div>
      
      <!-- Speaker Voice Settings -->
      <div class="setting-group">
        <label for="speaker-wav-path">Cloned Voice File:</label>
        <div class="file-input-group">
          <input type="text" id="speaker-wav-path" placeholder="./coqui-models/speaker.wav">
          <button id="browse-speaker-wav" class="small-btn">Browse</button>
        </div>
      </div>
      
      <!-- Voice Language -->
      <div class="setting-group">
        <label for="voice-language">Language:</label>
        <select id="voice-language">
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="pl">Polish</option>
          <option value="tr">Turkish</option>
          <option value="ru">Russian</option>
          <option value="nl">Dutch</option>
          <option value="cs">Czech</option>
          <option value="ar">Arabic</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="hu">Hungarian</option>
          <option value="ko">Korean</option>
        </select>
      </div>
      
      <!-- Server Control -->
      <div class="setting-group">
        <div class="button-row">
          <button id="test-coqui-connection" class="test-btn">Test Connection</button>
          <button id="start-coqui-server" class="action-btn">Start Server</button>
        </div>
      </div>
      
      <!-- Auto-start Option -->
      <div class="setting-group">
        <label>
          <input type="checkbox" id="auto-start-server"> Auto-start Coqui server
        </label>
      </div>
      
      <!-- Quick Test -->
      <div class="setting-group">
        <button id="test-voice-quick" class="test-voice-btn">🎤 Test Voice</button>
      </div>
      
      <!-- Status Display -->
      <div id="coqui-status" class="status-display">
        Status: Not connected
      </div>
    </div>
  `;
  
  // Insert before API key container
  const apiKeyContainer = document.getElementById('api-key-container');
  if (apiKeyContainer) {
    apiKeyContainer.insertAdjacentHTML('beforebegin', coquiSettingsHTML);
  } else {
    // If no API key container, append to settings panel
    settingsPanel.insertAdjacentHTML('beforeend', coquiSettingsHTML);
  }
}

// Setup Coqui TTS event handlers
function setupCoquiEventHandlers() {
  const coquiServerUrl = document.getElementById('coqui-server-url');
  const speakerWavPath = document.getElementById('speaker-wav-path');
  const voiceLanguage = document.getElementById('voice-language');
  const testConnectionBtn = document.getElementById('test-coqui-connection');
  const startServerBtn = document.getElementById('start-coqui-server');
  const browseSpeakerWavBtn = document.getElementById('browse-speaker-wav');
  const autoStartServer = document.getElementById('auto-start-server');
  const testVoiceBtn = document.getElementById('test-voice-quick');
  const statusDisplay = document.getElementById('coqui-status');

  // Load saved settings
  const settings = loadCoquiSettings();
  
  // Apply loaded settings to UI
  if (coquiServerUrl) coquiServerUrl.value = settings.serverUrl;
  if (speakerWavPath) speakerWavPath.value = settings.speakerWavPath;
  if (voiceLanguage) voiceLanguage.value = settings.language;
  if (autoStartServer) autoStartServer.checked = settings.autoStartServer;

  // Server URL change handler
  if (coquiServerUrl) {
    coquiServerUrl.addEventListener('change', (e) => {
      speechHandler.setCoquiServerUrl(e.target.value);
      const settings = loadCoquiSettings();
      settings.serverUrl = e.target.value;
      saveCoquiSettings(settings);
    });
  }

  // Speaker WAV path change handler
  if (speakerWavPath) {
    speakerWavPath.addEventListener('change', (e) => {
      speechHandler.setSpeakerWav(e.target.value);
      const settings = loadCoquiSettings();
      settings.speakerWavPath = e.target.value;
      saveCoquiSettings(settings);
    });
  }

  // Voice language change handler
  if (voiceLanguage) {
    voiceLanguage.addEventListener('change', (e) => {
      speechHandler.setVoiceLanguage(e.target.value);
      const settings = loadCoquiSettings();
      settings.language = e.target.value;
      saveCoquiSettings(settings);
    });
  }

  // Test connection button
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      testConnectionBtn.textContent = 'Testing...';
      testConnectionBtn.disabled = true;
      
      try {
        const isConnected = await speechHandler.checkCoquiServer();
        if (isConnected) {
          testConnectionBtn.textContent = '✅ Connected';
          testConnectionBtn.className = 'test-btn success';
          if (statusDisplay) statusDisplay.textContent = 'Status: Connected';
        } else {
          testConnectionBtn.textContent = '❌ No Connection';
          testConnectionBtn.className = 'test-btn error';
          if (statusDisplay) statusDisplay.textContent = 'Status: Server not running';
        }
      } catch (error) {
        testConnectionBtn.textContent = '❌ Error';
        testConnectionBtn.className = 'test-btn error';
        if (statusDisplay) statusDisplay.textContent = 'Status: Connection error';
      }
      
      setTimeout(() => {
        testConnectionBtn.textContent = 'Test Connection';
        testConnectionBtn.disabled = false;
        testConnectionBtn.className = 'test-btn';
      }, 3000);
    });
  }

  // Start server button
  if (startServerBtn) {
    startServerBtn.addEventListener('click', async () => {
      startServerBtn.textContent = 'Starting...';
      startServerBtn.disabled = true;
      
      try {
        await speechHandler.startCoquiServer();
        startServerBtn.textContent = '✅ Server Started';
        startServerBtn.className = 'action-btn success';
        if (statusDisplay) statusDisplay.textContent = 'Status: Server starting...';
        
        // Test connection after a delay
        setTimeout(async () => {
          const isConnected = await speechHandler.checkCoquiServer();
          if (statusDisplay) {
            statusDisplay.textContent = isConnected ? 'Status: Connected' : 'Status: Start failed';
          }
        }, 3000);
        
      } catch (error) {
        startServerBtn.textContent = '❌ Start Failed';
        startServerBtn.className = 'action-btn error';
        if (statusDisplay) statusDisplay.textContent = 'Status: Failed to start';
        console.error('Failed to start Coqui server:', error);
      }
      
      setTimeout(() => {
        startServerBtn.textContent = 'Start Server';
        startServerBtn.disabled = false;
        startServerBtn.className = 'action-btn';
      }, 5000);
    });
  }

  // Browse for speaker WAV file
  if (browseSpeakerWavBtn) {
    browseSpeakerWavBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.wav,.mp3,.m4a,.flac';
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const filePath = file.path || file.webkitRelativePath || file.name;
          speakerWavPath.value = filePath;
          speechHandler.setSpeakerWav(filePath);
          const settings = loadCoquiSettings();
          settings.speakerWavPath = filePath;
          saveCoquiSettings(settings);
        }
      };
      fileInput.click();
    });
  }

  // Auto-start server checkbox
  if (autoStartServer) {
    autoStartServer.addEventListener('change', (e) => {
      const settings = loadCoquiSettings();
      settings.autoStartServer = e.target.checked;
      saveCoquiSettings(settings);
    });
  }

  // Quick voice test button
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', async () => {
      testVoiceBtn.textContent = '🎤 Testing...';
      testVoiceBtn.disabled = true;
      
      try {
        const testText = "Hello! I am Nicolas, your cloned fox assistant. This is a test of my voice.";
        await speechHandler.speak(testText);
        testVoiceBtn.textContent = '✅ Voice Test Complete';
      } catch (error) {
        testVoiceBtn.textContent = '❌ Voice Test Failed';
        console.error('Voice test failed:', error);
      }
      
      setTimeout(() => {
        testVoiceBtn.textContent = '🎤 Test Voice';
        testVoiceBtn.disabled = false;
      }, 3000);
    });
  }
}

// Auto-start Coqui server if enabled
async function autoStartCoquiServer() {
  const settings = loadCoquiSettings();
  
  if (settings.autoStartServer) {
    console.log('🚀 Auto-starting Coqui TTS server...');
    
    try {
      // Check if server is already running
      const isRunning = await speechHandler.checkCoquiServer();
      
      if (!isRunning) {
        await speechHandler.startCoquiServer();
        console.log('✅ Coqui TTS server auto-started');
      } else {
        console.log('✅ Coqui TTS server already running');
      }
    } catch (error) {
      console.error('❌ Failed to auto-start Coqui server:', error);
    }
  }
}

// UI Event Handlers when DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
  console.log('🦊 Fox Assistant - Coqui TTS Edition Loading...');
  
  // Add futuristic font
  addFuturisticFont();
  
  // Initialize Coqui TTS
  initializeCoquiTTS();
  
  // Setup circular menu
  setupCircularMenu();

  // Setup fox clickable area
  setupFoxClickable();

  // Setup draggable window
  setupDraggable();

  // Setup Coqui TTS settings
  setupCoquiSettings();
  setupCoquiEventHandlers();

  // Auto-start Coqui server if enabled
  await autoStartCoquiServer();

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

  // Populate voice dropdown with Coqui voices
  await populateVoiceDropdown();
  
  // Check Coqui server status on startup
  setTimeout(async () => {
    const statusDisplay = document.getElementById('coqui-status');
    if (statusDisplay) {
      try {
        const isConnected = await speechHandler.checkCoquiServer();
        statusDisplay.textContent = isConnected ? 'Status: Connected ✅' : 'Status: Server not running ⚠️';
        statusDisplay.className = isConnected ? 'status-display connected' : 'status-display disconnected';
      } catch (error) {
        statusDisplay.textContent = 'Status: Connection error ❌';
        statusDisplay.className = 'status-display error';
      }
    }
  }, 2000);

  console.log('✅ Fox Assistant - Coqui TTS Edition Ready!');
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

// Add keyboard shortcuts for quick actions
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + T for test voice
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    const testVoiceBtn = document.getElementById('test-voice-quick');
    if (testVoiceBtn && !testVoiceBtn.disabled) {
      testVoiceBtn.click();
    }
  }
  
  // Ctrl/Cmd + S for settings
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.click();
    }
  }
  
  // Escape to close settings
  if (e.key === 'Escape') {
    const settingsPanel = document.getElementById('settings');
    if (settingsPanel && settingsPanel.style.display === 'block') {
      settingsPanel.style.display = 'none';
    }
  }
});

// Periodic health check for Coqui server
setInterval(async () => {
  const statusDisplay = document.getElementById('coqui-status');
  if (statusDisplay) {
    try {
      const isConnected = await speechHandler.checkCoquiServer();
      if (isConnected) {
        statusDisplay.textContent = 'Status: Connected ✅';
        statusDisplay.className = 'status-display connected';
      } else {
        statusDisplay.textContent = 'Status: Server not running ⚠️';
        statusDisplay.className = 'status-display disconnected';
      }
    } catch (error) {
      statusDisplay.textContent = 'Status: Connection error ❌';
      statusDisplay.className = 'status-display error';
    }
  }
}, 30000); // Check every 30 seconds

// Export functions for debugging in console
window.foxAssistant = {
  speechHandler,
  chatGPT,
  fox,
  testVoice: () => speechHandler.speak("This is a test of the Coqui TTS voice system."),
  checkServer: () => speechHandler.checkCoquiServer(),
  startServer: () => speechHandler.startCoquiServer(),
  settings: {
    load: loadCoquiSettings,
    save: saveCoquiSettings
  }
};

console.log('🦊 Fox Assistant debugging tools available at window.foxAssistant');