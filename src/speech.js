const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

// Coqui TTS-only speech handler for Fox Assistant
export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.synthesis = window.speechSynthesis;
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.textInputCreated = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.tempDir = path.join(os.tmpdir(), 'fox-assistant');

    // OpenAI API key for Whisper (speech-to-text only)
    this.apiKey = process.env.OPENAI_API_KEY;
    this.audioElement = new Audio();

    // Coqui TTS Configuration - Primary and only TTS method
    this.coquiServerUrl = 'http://localhost:5002';
    this.selectedVoice = 'cloned_voice';
    this.coquiModelPath = path.join(os.homedir(), 'coqui-models');
    this.speakerWavPath = path.join(this.coquiModelPath, 'speaker.wav');
    this.voiceLanguage = 'en';
    this.modelName = 'tts_models/multilingual/multi-dataset/xtts_v2';
    this.serverProcess = null;
    this.isServerStarting = false;

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Create coqui models directory if it doesn't exist
    if (!fs.existsSync(this.coquiModelPath)) {
      fs.mkdirSync(this.coquiModelPath, { recursive: true });
    }

    console.log('🦊 Coqui TTS Speech Handler initialized');
    console.log(`📁 Coqui models path: ${this.coquiModelPath}`);
    console.log(`🎤 Speaker WAV path: ${this.speakerWavPath}`);
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
    if (this.textInputCreated) return;
    this.textInputCreated = true;

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
    if (this.isListening) {
      console.log('Already listening, not starting again');
      return;
    }

    if (!this.setupAudioRecording()) {
      return;
    }

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
          try {
            await this.processAudioWithWhisper();
          } catch (error) {
            console.error('Error processing audio with Whisper:', error);
            this.onSpeechEnd();
          }
          stream.getTracks().forEach(track => track.stop());
        };

        this.mediaRecorder.start();
        console.log('🎤 Recording started');
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
      console.log('🛑 Recording stopped');
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
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const audioFilePath = path.join(this.tempDir, 'recording.webm');
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(audioFilePath, buffer);

      console.log('🎵 Audio saved to temporary file:', audioFilePath);

      if (this.apiKey) {
        const transcript = await this.sendToWhisperAPI(audioFilePath);
        if (transcript) {
          this.onSpeechEnd();
          this.onResult(transcript);
        } else {
          throw new Error('No transcript received from Whisper API');
        }
      } else {
        const transcript = await this.useBrowserSpeechRecognition(audioFilePath);
        if (transcript) {
          this.onSpeechEnd();
          this.onResult(transcript);
        } else {
          throw new Error('Speech recognition failed');
        }
      }

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
      console.error('OpenAI API key not found for Whisper STT');
      return null;
    }

    try {
      const formData = new FormData();
      const audioFile = fs.readFileSync(audioFilePath);
      const audioBlob = new Blob([audioFile], { type: 'audio/webm' });

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

      console.log('📝 Whisper API response:', response.data);

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
        resolve(null);
      };

      audio.onplay = () => {
        recognition.start();
      };

      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        resolve(null);
      });
    });
  }

  // Main speak method - Coqui TTS ONLY
  async speak(text) {
    console.log('🗣️ Speaking with Coqui TTS:', text.substring(0, 50) + '...');

    try {
      // Ensure Coqui server is running
      const isServerRunning = await this.checkCoquiServer();
      if (!isServerRunning) {
        console.log('🚀 Coqui TTS server not running, attempting to start...');
        await this.startCoquiServer();

        // Wait a bit for server to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check again
        const isNowRunning = await this.checkCoquiServer();
        if (!isNowRunning) {
          throw new Error('Failed to start Coqui TTS server');
        }
      }

      // Generate speech using Coqui TTS
      const audioData = await this.generateCoquiSpeech(text);

      if (audioData) {
        await this.saveAudioLocally(audioData, 'out.wav');
        await this.playAudioData(audioData);
        console.log('✅ Coqui TTS speech completed successfully');
      } else {
        throw new Error('Failed to generate speech with Coqui TTS');
      }
    } catch (error) {
      console.error('❌ Coqui TTS error:', error);
      // Fallback to text display since we're Coqui-only
      await this.displayText(text);
    }
  }

  // New method to save audio data locally
  async saveAudioLocally(audioData, filename = 'out.wav') {
    try {
      const fs = require('fs');
      const path = require('path');

      // Determine save location - you can modify this path as needed
      const saveDirectory = process.cwd(); // Current working directory
      const filePath = path.join(saveDirectory, filename);

      // Convert ArrayBuffer to Buffer if needed
      let buffer;
      if (audioData instanceof ArrayBuffer) {
        buffer = Buffer.from(audioData);
      } else if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
      } else {
        // Handle Uint8Array or similar
        buffer = Buffer.from(audioData);
      }

      // Write the audio data to file
      fs.writeFileSync(filePath, buffer);

      console.log(`💾 Audio saved locally as: ${filePath}`);
      console.log(`📁 File size: ${(buffer.length / 1024).toFixed(2)} KB`);

      return filePath;
    } catch (error) {
      console.error('❌ Error saving audio locally:', error);
      throw error;
    }
  }

  // Method to save to a specific directory
  async saveAudioToDirectory(audioData, directory, filename = 'out.wav') {
    try {
      const fs = require('fs');
      const path = require('path');

      // Ensure directory exists
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`📁 Created directory: ${directory}`);
      }

      const filePath = path.join(directory, filename);

      // Convert ArrayBuffer to Buffer if needed
      let buffer;
      if (audioData instanceof ArrayBuffer) {
        buffer = Buffer.from(audioData);
      } else if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
      } else {
        buffer = Buffer.from(audioData);
      }

      // Write the audio data to file
      fs.writeFileSync(filePath, buffer);

      console.log(`💾 Audio saved to: ${filePath}`);
      console.log(`📁 File size: ${(buffer.length / 1024).toFixed(2)} KB`);

      return filePath;
    } catch (error) {
      console.error('❌ Error saving audio to directory:', error);
      throw error;
    }
  }

  // Check if Coqui TTS server is running
  async checkCoquiServer() {
    const endpoints = [
      `${this.coquiServerUrl}/`,  // Try root endpoint
      `${this.coquiServerUrl}/health`,  // Try health endpoint
      `${this.coquiServerUrl}/api/docs`,  // Try docs endpoint
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Checking Coqui server at: ${endpoint}`);
        const response = await axios.get(endpoint, {
          timeout: 3000,
          validateStatus: (status) => status < 500  // Accept 200, 404, etc but not 500+
        });

        console.log(`✅ Server responded with status ${response.status} at ${endpoint}`);

        // If we get any response (even 404), the server is running
        if (response.status < 500) {
          return true;
        }
      } catch (error) {
        console.log(`❌ Failed to connect to ${endpoint}:`, error.message);
        continue;
      }
    }

    return false;
  }

  // Start Coqui TTS server
  async startCoquiServer() {
    if (this.isServerStarting) {
      console.log('⏳ Server already starting, please wait...');
      return;
    }

    this.isServerStarting = true;

    return new Promise((resolve, reject) => {
      console.log('🚀 Starting Coqui TTS server...');

      // Check if speaker wav file exists
      if (!fs.existsSync(this.speakerWavPath)) {
        console.warn(`⚠️ Speaker WAV file not found: ${this.speakerWavPath}`);
        console.log('💡 Please add a speaker.wav file to the coqui-models directory');
      }

      // Command to start Coqui TTS server
      const serverArgs = [
        '--model_name', this.modelName,
        '--server',
        '--port', '5002',
        '--host', '127.0.0.1'
      ];

      try {
        this.serverProcess = spawn('tts-server', serverArgs, {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let serverOutput = '';

        this.serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          serverOutput += output;
          console.log('📋 Coqui server:', output.trim());

          // Check if server is ready
          if (output.includes('Running on') || output.includes('Serving on')) {
            console.log('✅ Coqui TTS server started successfully');
            this.isServerStarting = false;
            resolve();
          }
        });

        this.serverProcess.stderr.on('data', (data) => {
          const output = data.toString();
          console.warn('⚠️ Coqui server error:', output.trim());
        });

        this.serverProcess.on('close', (code) => {
          console.log(`🔚 Coqui TTS server process exited with code ${code}`);
          this.isServerStarting = false;
          this.serverProcess = null;
        });

        this.serverProcess.on('error', (error) => {
          console.error('❌ Error starting Coqui TTS server:', error);
          this.isServerStarting = false;
          reject(error);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.isServerStarting) {
            console.log('✅ Coqui server timeout reached, assuming ready');
            this.isServerStarting = false;
            resolve();
          }
        }, 30000);

      } catch (error) {
        console.error('❌ Failed to spawn Coqui TTS server:', error);
        this.isServerStarting = false;
        reject(error);
      }
    });
  }

  async generateCoquiSpeech(text) {
    try {
      console.log('🎯 Sending request to Coqui TTS API...');

      // Create FormData for the multi-speaker XTTS model
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', this.voiceLanguage || 'en');
      formData.append('speaker_idx', '0');

      // Debug: Log what we're sending
      console.log('🔍 FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
      }

      console.log('📤 Sending request with text:', text.substring(0, 50) + '...');

      const response = await axios.post('http://localhost:5002/api/tts', formData, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      console.log('📥 Received audio data from Coqui TTS');
      return response.data;

    } catch (error) {
      console.error('❌ Error calling Coqui TTS API:', error);

      if (error.response) {
        console.error('📋 API response status:', error.response.status);
        console.error('📋 API response data:', new TextDecoder().decode(error.response.data));
      }

      // Fallback to CLI method
      console.log('🔄 Trying CLI method as fallback...');
      return await this.generateCoquiSpeechCLI(text);
    }
  }

  // Try different speaker indices to find one that works
  async tryDifferentSpeakers(text) {
    const speakerIndices = ['0', '1', '2', 'female', 'male'];

    for (const speakerIdx of speakerIndices) {
      try {
        console.log(`🎤 Trying speaker index: ${speakerIdx}`);

        const formData = new FormData();
        formData.append('text', text);
        formData.append('language', this.voiceLanguage || 'en');
        formData.append('speaker_idx', speakerIdx);

        const response = await axios.post(`${this.coquiServerUrl}/api/tts`, formData, {
          responseType: 'arraybuffer',
          timeout: 15000
        });

        console.log(`✅ Success with speaker index: ${speakerIdx}`);
        return response.data;

      } catch (error) {
        console.log(`❌ Speaker index ${speakerIdx} failed`);
        continue;
      }
    }

    throw new Error('All speaker indices failed');
  }

  // Also update the CLI method to handle missing speaker WAV
  async generateCoquiSpeechCLI(text) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `speech_${Date.now()}.wav`);

      const coquiArgs = [
        '--text', text,
        '--model_name', this.modelName,
        '--out_path', outputPath,
        '--language', this.voiceLanguage
      ];

      // Only add speaker_wav if file exists
      if (this.speakerWavPath && fs.existsSync(this.speakerWavPath)) {
        coquiArgs.push('--speaker_wav', this.speakerWavPath);
        console.log('🎤 Using speaker WAV file for CLI generation');
      } else {
        console.log('📢 Using default voice for CLI generation');
      }

      console.log('🔧 Running Coqui TTS CLI:', 'tts', coquiArgs.join(' '));

      const ttsProcess = spawn('tts', coquiArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      let stdout = '';

      ttsProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ttsProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ttsProcess.on('close', (code) => {
        console.log('📋 TTS CLI output:', stdout);
        if (stderr) console.warn('⚠️ TTS CLI errors:', stderr);

        if (code === 0 && fs.existsSync(outputPath)) {
          // Read the generated audio file
          const audioData = fs.readFileSync(outputPath);

          // Clean up the temporary file
          fs.unlinkSync(outputPath);

          console.log('✅ Coqui TTS CLI generation completed');
          resolve(audioData);
        } else {
          console.error('❌ Coqui TTS CLI process failed with code:', code);
          reject(new Error(`TTS CLI process failed with code ${code}: ${stderr}`));
        }
      });

      ttsProcess.on('error', (error) => {
        console.error('❌ Error spawning Coqui TTS CLI process:', error);
        reject(error);
      });
    });
  }

  // Alternative JSON format method
  async generateCoquiSpeechJSON(text) {
    try {
      console.log('🎯 Trying JSON format for Coqui TTS API...');

      // Try with simple JSON payload
      const requestData = {
        text: text,
        language: this.voiceLanguage,
        stream: false
      };

      // Only add speaker_wav path if it exists
      if (this.speakerWavPath && fs.existsSync(this.speakerWavPath)) {
        requestData.speaker_wav = this.speakerWavPath;
      }

      console.log('📤 JSON Request data:', requestData);

      const response = await axios.post(`${this.coquiServerUrl}/api/tts`, requestData, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      console.log('📥 Received audio data from Coqui TTS (JSON)');
      return response.data;

    } catch (error) {
      console.error('❌ JSON format also failed:', error);

      // Final fallback to CLI method
      console.log('🔄 Falling back to CLI method...');
      return await this.generateCoquiSpeechCLI(text);
    }
  }

  // Play audio data
  async playAudioData(audioData) {
    return new Promise((resolve, reject) => {
      console.log('🔊 Playing generated audio...');

      const blob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);

      this.audioElement.src = audioUrl;
      this.audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        console.log('✅ Audio playback completed');
        resolve();
      };
      this.audioElement.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        reject(error);
      };

      this.audioElement.play().catch(error => {
        console.error('❌ Audio play error:', error);
        URL.revokeObjectURL(audioUrl);
        reject(error);
      });
    });
  }

  // Get available Coqui voices (cloned voices from WAV files)
  getAvailableVoices() {
    console.log('🎤 Loading available Coqui TTS voices...');

    const voices = [];

    // Add default cloned voice
    if (fs.existsSync(this.speakerWavPath)) {
      voices.push({
        name: 'Default Cloned Voice',
        path: this.speakerWavPath,
        lang: this.voiceLanguage,
        type: 'coqui-cloned'
      });
    }

    // Scan coqui-models directory for additional WAV files
    try {
      if (fs.existsSync(this.coquiModelPath)) {
        const files = fs.readdirSync(this.coquiModelPath);

        files.forEach(file => {
          if (file.endsWith('.wav') && file !== 'speaker.wav') {
            const voiceName = file.replace('.wav', '').replace(/[_-]/g, ' ');
            const capitalizedName = voiceName.charAt(0).toUpperCase() + voiceName.slice(1);

            voices.push({
              name: capitalizedName,
              path: path.join(this.coquiModelPath, file),
              lang: this.voiceLanguage,
              type: 'coqui-cloned'
            });
          }
        });
      }
    } catch (error) {
      console.error('Error scanning coqui-models directory:', error);
    }

    // If no voices found, add a placeholder
    if (voices.length === 0) {
      voices.push({
        name: 'No Cloned Voice (Please add speaker.wav)',
        path: this.speakerWavPath,
        lang: this.voiceLanguage,
        type: 'coqui-placeholder'
      });
    }

    console.log('🎯 Available Coqui voices:', voices.map(v => v.name));
    return Promise.resolve(voices);
  }

  // Set the selected voice (speaker WAV file)
  setVoice(voicePath) {
    this.speakerWavPath = voicePath;
    console.log('🎤 Selected Coqui voice:', voicePath);
  }

  // Set Coqui TTS server URL
  setCoquiServerUrl(url) {
    // Handle IPv6 conversion
    if (url.includes('localhost')) {
      this.coquiServerUrl = url;
    } else if (url.includes('[::1]')) {
      // Convert IPv6 to localhost
      this.coquiServerUrl = url.replace('[::1]', 'localhost');
    } else {
      this.coquiServerUrl = url;
    }
    console.log('🌐 Coqui TTS server URL set to:', this.coquiServerUrl);
  }


  // Set speaker WAV file path
  setSpeakerWav(filePath) {
    this.speakerWavPath = filePath;
    console.log('🎤 Speaker WAV file set to:', filePath);
  }

  // Set voice language
  setVoiceLanguage(language) {
    this.voiceLanguage = language;
    console.log('🌍 Voice language set to:', language);
  }

  // Set Coqui model name
  setModelName(modelName) {
    this.modelName = modelName;
    console.log('🤖 Coqui model set to:', modelName);
  }

  // Legacy method for compatibility (does nothing since we're Coqui-only)
  setCoquiTTS(enabled) {
    console.log('🦊 Fox Assistant is Coqui TTS exclusive - ignoring setCoquiTTS call');
  }

  // Stop Coqui server
  stopCoquiServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping Coqui TTS server...');
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
  }

  // Get server status
  async getServerStatus() {
    const isRunning = await this.checkCoquiServer();
    return {
      running: isRunning,
      url: this.coquiServerUrl,
      modelName: this.modelName,
      speakerWav: this.speakerWavPath,
      language: this.voiceLanguage
    };
  }

  // Test Coqui TTS with a sample phrase
  async testCoquiTTS() {
    const testPhrases = [
      "Hello! I am Nicolas, your cloned fox assistant.",
      "This is a test of the Coqui text-to-speech system.",
      "My voice has been cloned using advanced AI technology.",
      "I can speak in multiple languages with natural intonation."
    ];

    const randomPhrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
    console.log('🧪 Testing Coqui TTS with phrase:', randomPhrase);

    try {
      await this.speak(randomPhrase);
      return true;
    } catch (error) {
      console.error('❌ Coqui TTS test failed:', error);
      return false;
    }
  }

  // Check if all required files exist
  validateSetup() {
    const issues = [];

    // Check if coqui-models directory exists
    if (!fs.existsSync(this.coquiModelPath)) {
      issues.push(`Coqui models directory missing: ${this.coquiModelPath}`);
    }

    // Check if speaker WAV file exists
    if (!fs.existsSync(this.speakerWavPath)) {
      issues.push(`Speaker WAV file missing: ${this.speakerWavPath}`);
    }

    // Check if temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      issues.push(`Temp directory missing: ${this.tempDir}`);
    }

    if (issues.length === 0) {
      console.log('✅ Coqui TTS setup validation passed');
      return { valid: true, issues: [] };
    } else {
      console.warn('⚠️ Coqui TTS setup validation issues:', issues);
      return { valid: false, issues };
    }
  }

  // Create default speaker WAV file if missing
  async createDefaultSpeakerWav() {
    if (fs.existsSync(this.speakerWavPath)) {
      console.log('✅ Speaker WAV file already exists');
      return;
    }

    console.log('📝 Creating instructions for speaker WAV file...');

    const instructionsPath = path.join(this.coquiModelPath, 'README.txt');
    const instructions = `
Fox Assistant - Coqui TTS Voice Cloning Setup
=============================================

To use voice cloning with your Fox Assistant, you need to provide a speaker audio sample.

Required File: speaker.wav
Location: ${this.speakerWavPath}

Instructions:
1. Record a clear audio sample of the voice you want to clone
2. Duration: 10-30 seconds of natural speech
3. Quality: Clean audio, minimal background noise
4. Format: WAV file, 22kHz sample rate recommended
5. Content: Natural conversation, varied intonation

Example recording script:
"Hello, I am Nicolas, your digital fox assistant. I'm here to help you with whatever you need. 
I can answer questions, have conversations, and assist with various tasks. 
My voice has been cloned using advanced artificial intelligence technology."

Once you have your recording:
1. Save it as "speaker.wav" in this directory
2. Restart Fox Assistant
3. Test the voice using the "Test Voice" button in settings

For best results:
- Use a high-quality microphone
- Record in a quiet environment
- Speak clearly and naturally
- Include varied emotions and tones

Supported audio formats for input: WAV, MP3, M4A, FLAC
(Will be automatically converted to WAV format)
`;

    fs.writeFileSync(instructionsPath, instructions);
    console.log('📋 Created setup instructions at:', instructionsPath);
  }

  // Fallback text display when TTS fails
  async displayText(text) {
    return new Promise((resolve) => {
      console.log('💬 Displaying text fallback:', text);

      const speechBubble = document.createElement('div');
      speechBubble.textContent = text;
      speechBubble.style.position = 'fixed';
      speechBubble.style.top = '20px';
      speechBubble.style.left = '50%';
      speechBubble.style.transform = 'translateX(-50%)';
      speechBubble.style.maxWidth = '80%';
      speechBubble.style.padding = '15px';
      speechBubble.style.backgroundColor = 'rgba(0, 255, 157, 0.2)';
      speechBubble.style.color = '#00ff9d';
      speechBubble.style.border = '1px solid rgba(0, 255, 157, 0.5)';
      speechBubble.style.borderRadius = '10px';
      speechBubble.style.zIndex = '1000';
      speechBubble.style.boxShadow = '0 0 20px rgba(0, 255, 157, 0.4)';
      speechBubble.style.fontFamily = 'Rajdhani, sans-serif';
      speechBubble.style.fontSize = '14px';
      speechBubble.style.textShadow = '0 0 5px rgba(0, 255, 157, 0.8)';

      document.body.appendChild(speechBubble);

      // Auto-hide based on text length
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

  // Cleanup method
  cleanup() {
    console.log('🧹 Cleaning up Coqui TTS Speech Handler...');

    // Stop any ongoing audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }

    // Stop recording if active
    if (this.isListening) {
      this.stopListening();
    }

    // Stop server if we started it
    this.stopCoquiServer();

    // Clean up temp files
    try {
      if (fs.existsSync(this.tempDir)) {
        const tempFiles = fs.readdirSync(this.tempDir);
        tempFiles.forEach(file => {
          if (file.startsWith('speech_') || file.startsWith('recording')) {
            fs.unlinkSync(path.join(this.tempDir, file));
          }
        });
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }

    console.log('✅ Cleanup completed');
  }
}

// Initialize Coqui TTS on module load
console.log('🦊 Coqui TTS Speech Handler module loaded');
