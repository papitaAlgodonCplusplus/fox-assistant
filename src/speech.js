const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.tempDir = path.join(os.tmpdir(), 'fox-assistant');
    
    // OpenAI API key for Whisper STT
    this.apiKey = process.env.OPENAI_API_KEY;
    this.audioElement = new Audio();
    
    // TTS Configuration
    this.ttsServerUrl = 'http://localhost:5002';
    this.speakerWavPath = path.join(process.cwd(), 'coqui-models', 'speaker.wav');
    this.outputPath = path.join(process.cwd(), 'output.wav');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log('🦊 Speech Handler initialized');
    console.log(`🎤 Speaker WAV: ${this.speakerWavPath}`);
    console.log(`🌐 TTS Server: ${this.ttsServerUrl}`);
  }

  // Start listening for voice input
  startListening() {
    if (this.isListening) return;
    
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.isListening = true;
        this.onSpeechStart();
        
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        
        this.mediaRecorder.onstop = async () => {
          await this.processAudioWithWhisper();
          stream.getTracks().forEach(track => track.stop());
        };
        
        this.mediaRecorder.start();
        console.log('🎤 Recording started');
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        this.isListening = false;
      });
  }

  // Stop listening
  stopListening() {
    if (!this.isListening || !this.mediaRecorder) return;
    
    this.mediaRecorder.stop();
    this.isListening = false;
    console.log('🛑 Recording stopped');
  }

  // Process recorded audio with Whisper API
  async processAudioWithWhisper() {
    if (this.audioChunks.length === 0) {
      this.onSpeechEnd();
      return;
    }

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const audioFilePath = path.join(this.tempDir, 'recording.webm');
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(audioFilePath, buffer);

      const formData = new FormData();
      const audioFile = fs.readFileSync(audioFilePath);
      const audioBlob2 = new Blob([audioFile], { type: 'audio/webm' });
      
      formData.append('file', audioBlob2, 'audio.webm');
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

      if (response.data && response.data.text) {
        this.onSpeechEnd();
        this.onResult(response.data.text);
      }

      // Cleanup
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      this.onSpeechEnd();
    }
  }

  // Main speak method using TTS server
  async speak(text) {
    console.log('🗣️ Speaking:', text.substring(0, 50) + '...');
    
    try {
      // Check if server is running
      const isServerRunning = await this.checkTTSServer();
      if (!isServerRunning) {
        throw new Error('TTS server not running on port 5002');
      }
      
      // Generate speech using Python command
      await this.generateSpeech(text);
      
      // Play the generated audio
      await this.playGeneratedAudio();
      
    } catch (error) {
      console.error('❌ TTS Error:', error);
      // Fallback to display text
      await this.displayText(text);
    }
  }

  // Check if TTS server is running
  async checkTTSServer() {
    try {
      const response = await axios.get(this.ttsServerUrl, { timeout: 2000 });
      return true;
    } catch (error) {
      console.log('⚠️ TTS server not reachable at', this.ttsServerUrl);
      return false;
    }
  }

  // Generate speech using Python TTS command
  async generateSpeech(text) {
    return new Promise((resolve, reject) => {
      // Escape quotes in text
      const safeText = text.replace(/"/g, '\\"');
      
      // Build the Python command
      const command = `tts --text "${safeText}" --model_name "tts_models/multilingual/multi-dataset/xtts_v2" --speaker_wav "${this.speakerWavPath}" --language_idx "en" --out_path "${this.outputPath}"`;
      
      console.log('🐍 Running TTS command...');
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('TTS generation failed:', stderr);
          reject(error);
          return;
        }
        
        console.log('✅ TTS generation completed');
        resolve();
      });
    });
  }

  // Play the generated audio file
  async playGeneratedAudio() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.outputPath)) {
        reject(new Error('Generated audio file not found'));
        return;
      }
      
      const audioData = fs.readFileSync(this.outputPath);
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      
      this.audioElement.src = audioUrl;
      this.audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        console.log('✅ Audio playback completed');
        resolve();
      };
      
      this.audioElement.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(error);
      };
      
      this.audioElement.play().catch(reject);
    });
  }

  // Test the TTS system
  async testVoice() {
    const testText = "Hello! I am Nicolas, your fox assistant. This is a test of my voice.";
    await this.speak(testText);
  }

  // Fallback text display
  async displayText(text) {
    return new Promise((resolve) => {
      const speechBubble = document.createElement('div');
      speechBubble.textContent = text;
      speechBubble.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 80%;
        padding: 15px;
        background-color: rgba(0, 255, 157, 0.2);
        color: #00ff9d;
        border: 1px solid rgba(0, 255, 157, 0.5);
        border-radius: 10px;
        z-index: 1000;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.4);
        font-family: Rajdhani, sans-serif;
        font-size: 14px;
        text-shadow: 0 0 5px rgba(0, 255, 157, 0.8);
      `;
      
      document.body.appendChild(speechBubble);
      
      const displayTime = Math.max(3000, text.length * 60);
      
      setTimeout(() => {
        speechBubble.style.opacity = '0';
        speechBubble.style.transition = 'opacity 0.5s';
        
        setTimeout(() => {
          if (speechBubble.parentNode) {
            document.body.removeChild(speechBubble);
          }
          resolve();
        }, 500);
      }, displayTime);
    });
  }
  
  // Set speaker WAV path
  setSpeakerWav(path) {
    this.speakerWavPath = path;
    console.log('🎤 Speaker WAV updated:', path);
  }
}