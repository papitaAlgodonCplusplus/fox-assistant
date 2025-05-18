import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
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
camera.position.set(0, 35, 105);
camera.lookAt(0, 2, 0);

// Renderer with alpha (transparency)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,  // Enable transparency
  premultipliedAlpha: false // Fix transparency issues
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // Transparent background
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Initialize fox
const fox = new Fox(scene);

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

    // Set default voice to 'ballad'
    const defaultVoice = voices.find(v => v.name === 'ballad') || voices[0];
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
    button.style.left = `calc(50% + ${x}px - 20px)`;
    button.style.top = `calc(50% + ${y}px - 20px)`;

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

// UI Event Handlers when DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
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
  fox.update(delta);

  renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});