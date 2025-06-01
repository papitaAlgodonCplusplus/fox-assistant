import * as THREE from 'three';
import { Fox } from './fox';
import { SpeechHandler } from './speech.js';
import { ChatGPTHandler } from './chatgpt.js';

// Initialize Three.js scene
const scene = new THREE.Scene();
scene.background = null;

// Camera setup
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  premultipliedAlpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Initialize Fox
const fox = new Fox(scene);

// Initialize Speech Handler
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
    
    // Set fox to thinking
    fox.setState('thinking');
    document.getElementById('status').textContent = 'Processing...';
    
    try {
      // Send to ChatGPT
      const response = await chatGPT.sendMessage(transcript);
      
      // Show response
      document.getElementById('ai-response').textContent = response;
      
      // Speak response
      fox.setState('speaking');
      document.getElementById('status').textContent = 'Speaking...';
      
      await speechHandler.speak(response);
      
      // Back to idle
      fox.setState('idle');
      document.getElementById('status').textContent = 'Ready';
    } catch (error) {
      console.error('Error in conversation flow:', error);
      document.getElementById('ai-response').textContent = 'Sorry, I encountered an error.';
      fox.setState('idle');
      document.getElementById('status').textContent = 'Ready';
    }
  }
);

// Initialize ChatGPT handler
const chatGPT = new ChatGPTHandler();

// Setup Circular Menu
function setupCircularMenu() {
  const circularMenu = document.getElementById('circular-menu');
  const buttons = circularMenu.querySelectorAll('.menu-button');
  const numButtons = buttons.length;
  
  const radius = 80;
  const startAngle = -Math.PI / 2;
  
  buttons.forEach((button, index) => {
    const angle = startAngle + (2 * Math.PI * index / numButtons);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    
    button.style.left = `calc(50% + ${x}px - 22.5px)`;
    button.style.top = `calc(50% + ${y}px - 22.5px)`;
    
    // Tooltip functionality
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

// Setup fox clickable area
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
      document.getElementById('ui-container').classList.add('hidden');
    }
  });
}

// Setup dragging
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function setupDraggable() {
  const foxClickableArea = document.getElementById('fox-clickable-area');
  
  foxClickableArea.addEventListener('mousedown', (e) => {
    if (e.target === foxClickableArea) {
      isDragging = true;
      dragOffset.x = e.clientX;
      dragOffset.y = e.clientY;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging && window.electron) {
      window.electron.ipcRenderer.send('window-move', {
        mouseX: e.clientX - dragOffset.x,
        mouseY: e.clientY - dragOffset.y
      });
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// Setup settings panel
function setupSettings() {
  const settingsPanel = document.getElementById('settings');
  const apiKeyInput = document.getElementById('api-key-input');
  const voiceSelect = document.getElementById('voice-select');
  
  // Load API key
  if (window.electron && window.electron.getApiKey) {
    window.electron.getApiKey().then(key => {
      if (key) apiKeyInput.value = key;
    });
  }
  
  // Save API key on change
  apiKeyInput.addEventListener('change', (e) => {
    if (window.electron && window.electron.saveApiKey) {
      window.electron.saveApiKey(e.target.value);
    }
  });
  
  // Voice selection
  const voices = [
    { name: 'Default Voice', path: './coqui-models/speaker.wav' },
    { name: 'Nicolas Voice', path: './coqui-models/nicolas.wav' }
  ];
  
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.path;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });
  
  voiceSelect.addEventListener('change', (e) => {
    speechHandler.setSpeakerWav(e.target.value);
  });
}

// DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('🦊 Fox Assistant Loading...');
  
  setupCircularMenu();
  setupFoxClickable();
  setupDraggable();
  setupSettings();
  
  // Menu button handlers
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
  
  // Text mode
  textModeBtn.addEventListener('click', () => {
    uiContainer.classList.remove('hidden');
    textInputContainer.style.display = 'flex';
    voiceInputContainer.style.display = 'none';
    document.getElementById('status').textContent = 'Type your message';
    document.getElementById('circular-menu').classList.remove('visible');
  });
  
  // Voice mode
  voiceModeBtn.addEventListener('click', () => {
    uiContainer.classList.remove('hidden');
    textInputContainer.style.display = 'none';
    voiceInputContainer.style.display = 'flex';
    document.getElementById('status').textContent = 'Ready for voice';
    document.getElementById('circular-menu').classList.remove('visible');
  });
  
  // Settings
  settingsBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'block';
    document.getElementById('circular-menu').classList.remove('visible');
  });
  
  settingsClose.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
  });
  
  // Voice controls
  startVoiceBtn.addEventListener('click', () => {
    speechHandler.startListening();
    startVoiceBtn.classList.add('active-button');
    stopVoiceBtn.classList.remove('active-button');
  });
  
  stopVoiceBtn.addEventListener('click', () => {
    speechHandler.stopListening();
    startVoiceBtn.classList.remove('active-button');
    stopVoiceBtn.classList.add('active-button');
  });
  
  // Text input
  function sendTextMessage() {
    const text = textInput.value.trim();
    if (text) {
      document.getElementById('user-input').textContent = text;
      textInput.value = '';
      
      // Process through speech handler
      speechHandler.onSpeechStart();
      setTimeout(() => {
        speechHandler.onSpeechEnd();
        speechHandler.onResult(text);
      }, 500);
    }
  }
  
  sendTextBtn.addEventListener('click', sendTextMessage);
  
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendTextMessage();
    }
  });
  
  // Add test voice button
  const testVoiceBtn = document.createElement('button');
  testVoiceBtn.id = 'test-voice-btn';
  testVoiceBtn.textContent = '🎤 Test Voice';
  testVoiceBtn.style.cssText = `
    width: 100%;
    margin-top: 10px;
    padding: 10px;
    background-color: rgba(255, 0, 204, 0.2);
    color: #ff00cc;
    border: 1px solid rgba(255, 0, 204, 0.5);
    border-radius: 6px;
    cursor: pointer;
    font-family: Rajdhani, sans-serif;
    font-size: 12px;
    text-shadow: 0 0 5px rgba(255, 0, 204, 0.8);
    box-shadow: 0 0 12px rgba(255, 0, 204, 0.4);
  `;
  
  testVoiceBtn.addEventListener('click', async () => {
    testVoiceBtn.disabled = true;
    testVoiceBtn.textContent = '🎤 Testing...';
    
    try {
      await speechHandler.testVoice();
      testVoiceBtn.textContent = '✅ Test Complete';
    } catch (error) {
      testVoiceBtn.textContent = '❌ Test Failed';
      console.error('Voice test failed:', error);
    }
    
    setTimeout(() => {
      testVoiceBtn.textContent = '🎤 Test Voice';
      testVoiceBtn.disabled = false;
    }, 3000);
  });
  
  // Add test button to settings
  const apiKeyContainer = document.getElementById('api-key-container');
  if (apiKeyContainer) {
    apiKeyContainer.appendChild(testVoiceBtn);
  }
  
  console.log('✅ Fox Assistant Ready!');
  console.log('📌 Make sure TTS server is running on port 5002');
  console.log('📌 Run: tts-server --model_name tts_models/multilingual/multi-dataset/xtts_v2');
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  // Update fox
  fox.update(delta);
  
  // Render scene
  renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Export for debugging
window.foxAssistant = {
  speechHandler,
  chatGPT,
  fox,
  testVoice: () => speechHandler.testVoice(),
  checkServer: () => speechHandler.checkTTSServer()
};

console.log('🦊 Debug tools available at window.foxAssistant');