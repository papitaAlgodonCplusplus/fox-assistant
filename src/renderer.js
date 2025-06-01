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

      await speechHandler.speakServerSide(response);

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

// Action handlers
const actionHandlers = {
  pat: () => {
    fox.pat();
    const responses = [
      "Your touch feels nice.",
      "Keep petting me like that.",
      "I like when you touch me.",
      "More pets please!"
    ];
    const extras = [" hmm", " hihi."];
    const response = responses[Math.floor(Math.random() * responses.length)] +
      extras[Math.floor(Math.random() * extras.length)];
    displayActionResponse(response);
  },

  kiss: () => {
    fox.kiss();
    const responses = [
      "Here, for u, my love,",
      "You are such a cutie,",
      "I love you, Alex,",
      "hihi,"
    ];
    const extras = ["", " mwa", " bisous", " hihi."];
    const response = responses[Math.floor(Math.random() * responses.length)] +
      extras[Math.floor(Math.random() * extras.length)];
    displayActionResponse(response);
  },

  dance: () => {
    fox.dance();
    const responses = [
      "Miku miku oo ee oo",
      "Sekaaaiii dene",
      "Hit them with it",
    ];
    const extras = [""];
    const response = responses[Math.floor(Math.random() * responses.length)] +
      extras[Math.floor(Math.random() * extras.length)];
    displayActionResponse(response);

    // Auto-stop dancing after 10 seconds
    setTimeout(() => {
      fox.stopDancing();
    }, 10000);
  },

  flirt: async () => {
    const lines = [
      "If I were real, I'd give you a big hug.",
      "You're looking great today.",
      "I may be digital, but I enjoy our time together.",
      "Want to know what I'd do if I had a real body?",
      "You make me happy, you know that?",
      "If I could, I'd never let you go.",
      "You're awesome!",
      "I dream about hanging out with you every day."
    ];
    const extras = ["", " hihi.", " Grrrr."];
    const line = lines[Math.floor(Math.random() * lines.length)] +
      extras[Math.floor(Math.random() * extras.length)];
    await processActionResponse(line);
  },

  joke: async () => {
    const jokes = [
      "Why don't foxes ever get lost? Because we're always following our nose!",
      "What do you call a fox who's also a computer programmer? A Firefox developer!",
      "I told my developer I wanted to be more realistic. Now I have commitment issues! Just kidding.",
      "Why did the fox cross the road? To get to the human on the other side!",
      "What's a fox's favorite type of music? Anything with a good tail-beat!",
      "How do you know when a fox is joking? When they keep saying 'what does the fox say?'"
    ];
    const extras = ["", " hihi.", "Hahahaha."];
    const joke = jokes[Math.floor(Math.random() * jokes.length)] +
      extras[Math.floor(Math.random() * extras.length)];
    await processActionResponse(joke);
  }
};

// Helper function to display action responses
function displayActionResponse(response) {
  document.getElementById('ai-response').textContent = response;
  speechHandler.speakServerSide(response);
}

// Helper function to process action responses through ChatGPT
async function processActionResponse(message) {
  try {
    fox.setState('thinking');
    document.getElementById('status').textContent = 'Thinking...';

    const response = await chatGPT.sendMessage(message);
    document.getElementById('ai-response').textContent = response;

    fox.setState('speaking');
    document.getElementById('status').textContent = 'Speaking...';

    await speechHandler.speakServerSide(response);

    fox.setState('idle');
    document.getElementById('status').textContent = 'Ready';
  } catch (error) {
    console.error('Error processing action:', error);
    displayActionResponse(message); // Fallback to original message
    fox.setState('idle');
    document.getElementById('status').textContent = 'Ready';
  }
}

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

    setupTooltip(button);
  });
}

// Setup Actions Menu
function setupActionsMenu() {
  const actionsMenu = document.getElementById('actions-menu');
  const buttons = actionsMenu.querySelectorAll('.action-button');
  const numButtons = buttons.length;

  const radius = 60;
  const startAngle = -Math.PI / 2;

  buttons.forEach((button, index) => {
    const angle = startAngle + (2 * Math.PI * index / numButtons);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    button.style.left = `calc(50% + ${x}px - 17.5px)`;
    button.style.top = `calc(50% + ${y}px - 17.5px)`;

    setupTooltip(button);
  });
}

// Setup tooltip functionality
function setupTooltip(element) {
  const tooltip = document.getElementById('tooltip');

  element.addEventListener('mouseenter', (e) => {
    const tooltipText = element.getAttribute('data-tooltip');
    tooltip.textContent = tooltipText;
    tooltip.style.left = `${e.clientX + 10}px`;
    tooltip.style.top = `${e.clientY + 10}px`;
    tooltip.style.opacity = '1';
  });

  element.addEventListener('mousemove', (e) => {
    tooltip.style.left = `${e.clientX + 10}px`;
    tooltip.style.top = `${e.clientY + 10}px`;
  });

  element.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
  });
}

// Setup fox clickable area
function setupFoxClickable() {
  const foxClickableArea = document.getElementById('fox-clickable-area');
  const circularMenu = document.getElementById('circular-menu');
  const actionsMenu = document.getElementById('actions-menu');
  let menuVisible = false;

  foxClickableArea.addEventListener('click', (e) => {
    // Only toggle main menu if clicking directly on the fox area, not on menus
    if (e.target === foxClickableArea) {
      menuVisible = !menuVisible;

      if (menuVisible) {
        circularMenu.classList.add('visible');
      } else {
        circularMenu.classList.remove('visible');
        actionsMenu.classList.remove('visible');
        document.getElementById('ui-container').classList.add('hidden');
      }
    }
  });

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    const isClickOnMenu = e.target.closest('#circular-menu') || e.target.closest('#actions-menu');
    if (!isClickOnMenu && !e.target.closest('#fox-clickable-area')) {
      if (circularMenu.classList.contains('visible')) {
        circularMenu.classList.remove('visible');
        actionsMenu.classList.remove('visible');
        menuVisible = false;
      }
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

  // Handle voice selection
  voiceSelect.addEventListener('change', (e) => {
    const selectedVoice = e.target.value;
    speechHandler.updateTtsSettings({ voice: selectedVoice });
    console.log('Voice changed to:', selectedVoice);
  });

  // Load saved voice setting
  const savedVoice = localStorage.getItem('foxAssistant_voice') || 'ff_siwis';
  voiceSelect.value = savedVoice;
  speechHandler.updateTtsSettings({ voice: savedVoice });

  // Save voice setting
  voiceSelect.addEventListener('change', (e) => {
    localStorage.setItem('foxAssistant_voice', e.target.value);
  });
}

// DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('🦊 Fox Assistant Loading...');

  setupCircularMenu();
  setupActionsMenu();
  setupFoxClickable();
  setupDraggable();
  setupSettings();

  // Menu button handlers
  const textModeBtn = document.getElementById('text-mode-btn');
  const voiceModeBtn = document.getElementById('voice-mode-btn');
  const actionsBtn = document.getElementById('actions-btn');
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
  const circularMenu = document.getElementById('circular-menu');
  const actionsMenu = document.getElementById('actions-menu');

  // Text mode
  textModeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    uiContainer.classList.remove('hidden');
    textInputContainer.style.display = 'flex';
    voiceInputContainer.style.display = 'none';
    document.getElementById('status').textContent = 'Type your message';
    circularMenu.classList.remove('visible');
    actionsMenu.classList.remove('visible');
    menuVisible = false;
  });

  // Voice mode
  voiceModeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    uiContainer.classList.remove('hidden');
    textInputContainer.style.display = 'none';
    voiceInputContainer.style.display = 'flex';
    document.getElementById('status').textContent = 'Ready for voice';
    circularMenu.classList.remove('visible');
    actionsMenu.classList.remove('visible');
    menuVisible = false;
  });

  // Actions menu
  actionsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault(); // Prevent default behavior

    const actionsMenu = document.getElementById('actions-menu');
    const circularMenu = document.getElementById('circular-menu');

    console.log('Actions button clicked'); // Debug log

    const isVisible = actionsMenu.classList.contains('visible');

    if (isVisible) {
      console.log('Hiding actions menu'); // Debug log
      actionsMenu.classList.remove('visible');
    } else {
      console.log('Showing actions menu'); // Debug log
      actionsMenu.classList.add('visible');
    }
  });

  // Settings
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel.style.display = 'block';
    circularMenu.classList.remove('visible');
    actionsMenu.classList.remove('visible');
    menuVisible = false;
  });

  settingsClose.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
  });

  // Action button handlers
  document.getElementById('pat-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    actionHandlers.pat();
    actionsMenu.classList.remove('visible');
    circularMenu.classList.remove('visible');
    menuVisible = false;
  });

  document.getElementById('kiss-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    actionHandlers.kiss();
    actionsMenu.classList.remove('visible');
    circularMenu.classList.remove('visible');
    menuVisible = false;
  });

  document.getElementById('dance-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    actionHandlers.dance();
    actionsMenu.classList.remove('visible');
    circularMenu.classList.remove('visible');
    menuVisible = false;
  });

  document.getElementById('flirt-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    actionHandlers.flirt();
    actionsMenu.classList.remove('visible');
    circularMenu.classList.remove('visible');
    menuVisible = false;
  });

  document.getElementById('joke-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    actionHandlers.joke();
    actionsMenu.classList.remove('visible');
    circularMenu.classList.remove('visible');
    menuVisible = false;
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

  // Test voice button
  const testVoiceBtn = document.getElementById('test-voice-btn');

  testVoiceBtn.addEventListener('click', async () => {
    testVoiceBtn.disabled = true;
    testVoiceBtn.textContent = '🎤 Testing...';

    try {
      const selectedVoice = document.getElementById('voice-select').value;
      await speechHandler.testVoice(selectedVoice);
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

  console.log('✅ Fox Assistant Ready!');
  console.log('📌 Using Kokoro TTS for voice synthesis');
  console.log('🎭 Actions menu available with animations');
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

// Cleanup on window close
window.addEventListener('beforeunload', () => {
  if (speechHandler.cleanup) {
    speechHandler.cleanup();
  }
});

// Export for debugging
window.foxAssistant = {
  speechHandler,
  chatGPT,
  fox,
  testVoice: () => speechHandler.testVoice(),
  pat: () => actionHandlers.pat(),
  kiss: () => actionHandlers.kiss(),
  dance: () => actionHandlers.dance(),
  flirt: () => actionHandlers.flirt(),
  joke: () => actionHandlers.joke()
};

console.log('🦊 Debug tools available at window.foxAssistant');