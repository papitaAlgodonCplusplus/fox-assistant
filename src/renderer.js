import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Fox } from './fox';
import { SpeechHandler } from './web-speech.js'; 
import { ChatGPTHandler } from './chatgpt.js'; 

// Initialize Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Camera
const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 10, -100);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
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

    // Set default voice
    const defaultVoice = voices.find(v => v.name.includes('Zira')) || voices[0];
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

// UI Event Handlers when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const textModeBtn = document.getElementById('text-mode-btn');
  const voiceModeBtn = document.getElementById('voice-mode-btn');
  const textInputContainer = document.getElementById('text-input-container');
  const voiceInputContainer = document.getElementById('voice-input-container');
  const startVoiceBtn = document.getElementById('start-voice-btn');
  const stopVoiceBtn = document.getElementById('stop-voice-btn');
  const textInput = document.getElementById('text-input');
  const sendTextBtn = document.getElementById('send-text-btn');
  
  // Show text input
  textModeBtn.addEventListener('click', () => {
    textInputContainer.style.display = 'flex';
    voiceInputContainer.style.display = 'none';
    textModeBtn.classList.add('active-button');
    voiceModeBtn.classList.remove('active-button');
    document.getElementById('status').textContent = 'Type your message';
    speechHandler.setInputMode('text');
  });
  
  // Show voice input
  voiceModeBtn.addEventListener('click', () => {
    textInputContainer.style.display = 'none';
    voiceInputContainer.style.display = 'flex';
    textModeBtn.classList.remove('active-button');
    voiceModeBtn.classList.add('active-button');
    document.getElementById('status').textContent = 'Ready for voice';
    speechHandler.setInputMode('voice');
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
  
  // Set text mode as default
  textModeBtn.click();
  
  // Populate voice dropdown
  populateVoiceDropdown();
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  fox.update(delta);
  controls.update();

  renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});