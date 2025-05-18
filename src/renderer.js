import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Fox } from './fox';
import { SpeechHandler } from './offline-speech.js';
import { ChatGPTHandler } from './offline-chatgpt.js';

// Initialize Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Camera
const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 1, 5);

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
      document.getElementById('status').textContent = 'Click to talk';
    } catch (error) {
      console.error('Error in conversation flow:', error);
      document.getElementById('ai-response').textContent = 'Sorry, I encountered an error. Please try again.';
      fox.setState('idle');
      document.getElementById('status').textContent = 'Click to talk';
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
      option.textContent = `${voice.name} (${voice.culture})`;
      voiceSelect.appendChild(option);
    });

    // Set default voice (Microsoft Zira is a common Windows voice)
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

// Call this after initializing speechHandler
populateVoiceDropdown();

// Initialize ChatGPT handler
const chatGPT = new ChatGPTHandler();

// Listen for clicks to start voice recognition
document.addEventListener('click', () => {
  if (!speechHandler.isListening) {
    speechHandler.startListening();
  }
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
