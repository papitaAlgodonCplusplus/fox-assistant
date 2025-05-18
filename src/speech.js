const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

// Simplified speech.js without requiring compilation
export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.synthesis = window.speechSynthesis;
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.textInputCreated = false; // Flag to track if we've created the text input
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.tempDir = path.join(os.tmpdir(), 'fox-assistant');
    this.apiKey = process.env.OPENAI_API_KEY;
    this.audioElement = new Audio();
    this.selectedVoice = 'ballad'; // Default to alloy voice

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  setupAudioRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Media devices API not supported');
      this.useFallbackMode();
      return false;
    }

    return true;
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
    // Check if already listening
    if (this.isListening) {
      console.log('Already listening, not starting again');
      return;
    }

    // Setup audio recording if not done already
    if (!this.setupAudioRecording()) {
      return;
    }

    // Get user media
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.isListening = true;
        this.onSpeechStart();

        // Setup media recorder
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          // Process the recorded audio with Whisper API
          try {
            await this.processAudioWithWhisper();
          } catch (error) {
            console.error('Error processing audio with Whisper:', error);
            this.onSpeechEnd();
          }

          // Close the stream tracks
          stream.getTracks().forEach(track => track.stop());
        };

        // Start recording
        this.mediaRecorder.start();
        console.log('Recording started');
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        this.isListening = false;
        this.useFallbackMode();
      });
  }

  stopListening() {
    if (!this.isListening || !this.mediaRecorder) return;

    try {
      this.mediaRecorder.stop();
      this.isListening = false;
      console.log('Recording stopped');
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  async processAudioWithWhisper() {
    if (this.audioChunks.length === 0) {
      console.error('No audio data recorded');
      this.onSpeechEnd();
      return;
    }

    try {
      // Create a blob from the audio chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

      // Save the blob to a temporary file
      const audioFilePath = path.join(this.tempDir, 'recording.webm');

      // Convert Blob to Buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write to file
      fs.writeFileSync(audioFilePath, buffer);

      console.log('Audio saved to temporary file:', audioFilePath);

      // Since compilation is an issue, let's use the OpenAI API
      if (this.apiKey) {
        const transcript = await this.sendToWhisperAPI(audioFilePath);
        if (transcript) {
          this.onSpeechEnd();
          this.onResult(transcript);
        } else {
          throw new Error('No transcript received from Whisper API');
        }
      } else {
        // If no API key, use browser's Speech Recognition as fallback
        const transcript = await this.useBrowserSpeechRecognition(audioFilePath);
        if (transcript) {
          this.onSpeechEnd();
          this.onResult(transcript);
        } else {
          throw new Error('Speech recognition failed');
        }
      }

      // Clean up temp file
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      this.onSpeechEnd();
    }
  }

  async sendToWhisperAPI(audioFilePath) {
    if (!this.apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return null;
    }

    try {
      const formData = new FormData();
      const audioFile = fs.readFileSync(audioFilePath);

      // Create a Blob from the file data
      const audioBlob = new Blob([audioFile], { type: 'audio/webm' });

      // Append the file to formData
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('Whisper API response:', response.data);

      if (response.data && response.data.text) {
        return response.data.text;
      } else {
        console.error('Unexpected response format from Whisper API');
        return null;
      }
    } catch (error) {
      console.error('Error calling Whisper API:', error);
      if (error.response) {
        console.error('API response error:', error.response.data);
      }
      return null;
    }
  }

  // Fallback to browser's speech recognition if API is not available
  async useBrowserSpeechRecognition(audioFilePath) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(new Blob([fs.readFileSync(audioFilePath)]));

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported in this browser.');
        resolve(null);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        resolve(null);
      };

      recognition.onend = () => {
        // If no result was received, resolve with null
        resolve(null);
      };

      // Play the audio and start recognition
      audio.onplay = () => {
        recognition.start();
      };

      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        resolve(null);
      });
    });
  }

  async speak(text) {
    try {
      // Check if OpenAI API key is available
      if (!this.apiKey && typeof process !== 'undefined' && process.env) {
        this.apiKey = process.env.OPENAI_API_KEY;
      }

      if (!this.apiKey) {
        console.error('OpenAI API key is missing. Using fallback text display.');
        return this.displayText(text);
      }

      // Prepare the API request
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: "gpt-4o-mini-tts",
          voice: this.selectedVoice,
          input: text,
          response_format: "mp3"
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // Convert the response to a blob and create a URL
      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      // Use the Audio API to play the speech
      return new Promise((resolve) => {
        this.audioElement.src = audioUrl;
        this.audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl); // Clean up
          resolve();
        };
        this.audioElement.onerror = (error) => {
          console.error('Audio playback error:', error);
          URL.revokeObjectURL(audioUrl);
          this.displayText(text).then(resolve);
        };
        this.audioElement.play().catch(error => {
          console.error('Audio play error:', error);
          this.displayText(text).then(resolve);
        });
      });
    } catch (error) {
      console.error('OpenAI TTS API error:', error);
      return this.displayText(text);
    }
  }

  // Get available OpenAI TTS voices
  getAvailableVoices() {
    // OpenAI voices according to the documentation
    const voices = [
      { name: 'alloy', lang: 'en-US' },
      { name: 'ash', lang: 'en-US' },
      { name: 'ballad', lang: 'en-US' },
      { name: 'coral', lang: 'en-US' },
      { name: 'echo', lang: 'en-US' },
      { name: 'fable', lang: 'en-US' },
      { name: 'nova', lang: 'en-US' },
      { name: 'onyx', lang: 'en-US' },
      { name: 'sage', lang: 'en-US' },
      { name: 'shimmer', lang: 'en-US' }
    ];

    return Promise.resolve(voices);
  }

  // Set the selected voice
  setVoice(voiceName) {
    this.selectedVoice = voiceName;
    console.log('Selected OpenAI TTS voice:', voiceName);
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