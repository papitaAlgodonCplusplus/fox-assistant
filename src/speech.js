const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Updated speech.js
// Updated speech.js with better state management
export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.setupSpeechRecognition();
    this.textInputCreated = false; // Flag to track if we've created the text input
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser.');
      this.useFallbackMode();
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onSpeechStart();
      console.log('Speech recognition started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onSpeechEnd();
      console.log('Speech recognition ended');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.onResult(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.onSpeechEnd();

      if (event.error === 'network') {
        this.useFallbackMode();
      }
    };
  }

  useFallbackMode() {
    console.log('Using fallback text input mode');

    // Only create the text input once
    if (this.textInputCreated) return;
    this.textInputCreated = true;

    // Create text input UI
    const inputContainer = document.createElement('div');
    inputContainer.style.position = 'fixed';
    inputContainer.style.bottom = '80px';
    inputContainer.style.left = '0';
    inputContainer.style.width = '100%';
    inputContainer.style.textAlign = 'center';
    inputContainer.style.zIndex = '1000';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Type your message here...';
    textInput.style.width = '70%';
    textInput.style.padding = '10px';
    textInput.style.fontSize = '16px';

    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.style.padding = '10px 20px';
    sendButton.style.marginLeft = '10px';

    inputContainer.appendChild(textInput);
    inputContainer.appendChild(sendButton);
    document.body.appendChild(inputContainer);

    // Add event listeners
    sendButton.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (text) {
        this.onSpeechStart();
        setTimeout(() => {
          this.onSpeechEnd();
          this.onResult(text);
          textInput.value = '';
        }, 500);
      }
    });

    textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendButton.click();
      }
    });
  }

  startListening() {
    // Check if already listening, don't start again if so
    if (this.isListening) {
      console.log('Already listening, not starting again');
      return;
    }

    if (!this.recognition) {
      this.useFallbackMode();
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      this.useFallbackMode();
    }
  }

  stopListening() {
    if (!this.isListening || !this.recognition) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }

  speak(text) {
    return new Promise((resolve) => {
      try {
        // Check if speech synthesis is available and not busy
        if (!this.synthesis || this.synthesis.speaking) {
          console.log('Speech synthesis unavailable or busy, using text display');
          this.displayText(text, resolve);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = resolve;
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          this.displayText(text, resolve);
        };
        this.synthesis.speak(utterance);
      } catch (error) {
        console.error('Error initializing speech synthesis:', error);
        this.displayText(text, resolve);
      }
    });
  }

  // Fallback for speech synthesis
  displayText(text, callback) {
    // Create a speech bubble for the output
    const speechBubble = document.createElement('div');
    speechBubble.textContent = text;
    speechBubble.style.position = 'fixed';
    speechBubble.style.top = '20px';
    speechBubble.style.left = '50%';
    speechBubble.style.transform = 'translateX(-50%)';
    speechBubble.style.maxWidth = '80%';
    speechBubble.style.padding = '15px';
    speechBubble.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    speechBubble.style.borderRadius = '10px';
    speechBubble.style.zIndex = '1000';
    speechBubble.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

    document.body.appendChild(speechBubble);

    // Remove the speech bubble after a few seconds
    setTimeout(() => {
      speechBubble.style.opacity = '0';
      speechBubble.style.transition = 'opacity 0.5s';

      setTimeout(() => {
        document.body.removeChild(speechBubble);
        if (callback) callback();
      }, 500);
    }, Math.max(2000, text.length * 50)); // Display time based on text length
  }
}