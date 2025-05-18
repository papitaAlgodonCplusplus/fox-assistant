export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.setupSpeechRecognition();
    this.voices = [];
    this.selectedVoice = null;
    this.inputMode = 'text'; // Default to text input
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US'; // Default language

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
    };
  }

  startListening() {
    if (this.isListening || !this.recognition) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
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

  async getAvailableVoices() {
    return new Promise((resolve) => {
      // Get available speech synthesis voices
      this.voices = this.synthesis.getVoices();
      
      if (this.voices.length > 0) {
        resolve(this.voices);
      } else {
        // Wait for voices to be loaded
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = this.synthesis.getVoices();
          resolve(this.voices);
        };
      }
    });
  }

  setVoice(voiceName) {
    this.selectedVoice = this.voices.find(voice => voice.name === voiceName);
    console.log('Selected voice:', voiceName);
  }

  setInputMode(mode) {
    this.inputMode = mode;
  }

  speak(text) {
    return new Promise((resolve) => {
      try {
        // Check if speech synthesis is available and not busy
        if (!this.synthesis) {
          console.log('Speech synthesis unavailable, using text display');
          this.displayText(text, resolve);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set selected voice if available
        if (this.selectedVoice) {
          utterance.voice = this.selectedVoice;
        }
        
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