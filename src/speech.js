export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioElement = new Audio();
    this.ttsSettings = {
      voice: 'ff_siwis',
      format: 'mp3',
      speed: 1.0
    };

    console.log('🦊 Speech Handler initialized (server-powered)');
  }

  // Start voice recording
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
          await this.processAudioWithBackend();
          stream.getTracks().forEach(track => track.stop());
        };

        this.mediaRecorder.start();
        console.log('🎙️ Recording started');
      })
      .catch(error => {
        console.error('🎤 Microphone access error:', error);
        this.isListening = false;
      });
  }

  // Stop recording
  stopListening() {
    if (!this.isListening || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
    this.isListening = false;
    console.log('🛑 Recording stopped');
  }

  // Send audio to backend for Whisper transcription
  async processAudioWithBackend() {
    if (this.audioChunks.length === 0) {
      this.onSpeechEnd();
      return;
    }

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('http://localhost:3001/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      this.onSpeechEnd();

      if (data.text) {
        this.onResult(data.text);
        await this.speakServerSide(data.text);
      } else {
        console.warn('No transcription result.');
      }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      this.onSpeechEnd();
    }
  }

  // Update TTS settings
  updateTtsSettings(settings) {
    this.ttsSettings = {
      ...this.ttsSettings,
      ...settings
    };
    console.log('🔊 Updated TTS settings:', this.ttsSettings);
  }

  async speakServerSide(text) {
    if (!text) return;

    console.log('🔊 Sending to Kokoro TTS server:', text);
    console.log('🎵 Using voice:', this.ttsSettings.voice);
    
    try {
      const response = await fetch('http://localhost:3001/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          output_format: this.ttsSettings.format,
          preset_voice: [this.ttsSettings.voice],
          speed: this.ttsSettings.speed,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      // Create audio blob from the stream
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Apply pitch shifting for fox voices
      if (this.ttsSettings.voice.startsWith('ff_')) {
        await this.playAudioWithPitchShift(audioUrl, -2);
      } else {
        // Default playback for other voices
        this.audioElement.src = audioUrl;
        await this.audioElement.play();
      }
    } catch (error) {
      console.error('❌ TTS server error:', error);
      await this.displayText(text);
    }
  }

  async playAudioWithPitchShift(audioUrl, semitones) {
    try {
      // Create AudioContext
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createBufferSource();

      // Fetch and decode the audio data
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create pitch shifter
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.pow(2, semitones / 12); // Convert semitones to playback rate

      // Connect to destination and play
      source.connect(audioContext.destination);
      source.start(0);

      console.log(`✅ Voice played with ${semitones} semitone pitch shift`);

      // Clean up
      source.onended = () => {
        audioContext.close();
        URL.revokeObjectURL(audioUrl);
      };

    } catch (error) {
      console.error('❌ Audio processing error:', error);
      // Fallback to normal playback
      this.audioElement.src = audioUrl;
      await this.audioElement.play();
    }
  }

  // Fallback display if TTS fails
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

  async testVoice(voice = null) {
    const testVoice = voice || this.ttsSettings.voice;
    const testTexts = {
      // Fox voices
      'ff_siwis': "Hello Alex! I'm your adorable fox assistant. How are you feeling today, darling?",
      
      // Female voices
      'af_bella': "Hi there! I'm Bella, your friendly assistant. Ready to chat?",
      'af_sarah': "Hello! Sarah here, nice to meet you. How can I help today?",
      'af_nicole': "Hey! Nicole speaking. What's on your mind?",
      'af_sky': "Hi! I'm Sky, your virtual companion. What shall we talk about?",
      'af_nova': "Hello! Nova here, ready to assist you with anything you need!",
      
      // Male voices  
      'am_adam': "Hello! Adam here, your digital assistant. How can I help you today?",
      'am_echo': "Hi there! Echo speaking. What can I do for you?",
      'am_liam': "Hey! Liam here, ready to chat whenever you are.",
      'am_onyx': "Hello! Onyx at your service. What's going on?",
      
      // British voices
      'bf_alice': "Hello! Alice here, lovely to meet you. How are you today?",
      'bf_emma': "Hi there! Emma speaking, how may I assist you today?",
      'bm_daniel': "Hello! Daniel here, pleased to make your acquaintance.",
      
      // Japanese voices
      'jf_alpha': "こんにちは! Alpha desu. Nice to meet you!",
      'jm_kumo': "Hello! Kumo here, yoroshiku onegaishimasu!"
    };
    
    const testText = testTexts[testVoice] || "Hello! This is a voice test. How do I sound?";
    
    // Temporarily update voice for test
    const originalVoice = this.ttsSettings.voice;
    this.updateTtsSettings({ voice: testVoice });
    
    try {
      await this.speakServerSide(testText);
      console.log(`✅ Voice test completed for: ${testVoice}`);
    } finally {
      // Restore original voice
      this.updateTtsSettings({ voice: originalVoice });
    }
  }

  // Get available voices with descriptions
  getAvailableVoices() {
    return [
      // American Female
      { id: 'af_alloy', name: 'Alloy (Female)', category: 'American' },
      { id: 'af_aoede', name: 'Aoede (Female)', category: 'American' },
      { id: 'af_bella', name: 'Bella (Female)', category: 'American' },
      { id: 'af_heart', name: 'Heart (Female)', category: 'American' },
      { id: 'af_jessica', name: 'Jessica (Female)', category: 'American' },
      { id: 'af_kore', name: 'Kore (Female)', category: 'American' },
      { id: 'af_nicole', name: 'Nicole (Female)', category: 'American' },
      { id: 'af_nova', name: 'Nova (Female)', category: 'American' },
      { id: 'af_river', name: 'River (Female)', category: 'American' },
      { id: 'af_sarah', name: 'Sarah (Female)', category: 'American' },
      { id: 'af_sky', name: 'Sky (Female)', category: 'American' },
      
      // American Male
      { id: 'am_adam', name: 'Adam (Male)', category: 'American' },
      { id: 'am_echo', name: 'Echo (Male)', category: 'American' },
      { id: 'am_eric', name: 'Eric (Male)', category: 'American' },
      { id: 'am_fenrir', name: 'Fenrir (Male)', category: 'American' },
      { id: 'am_liam', name: 'Liam (Male)', category: 'American' },
      { id: 'am_michael', name: 'Michael (Male)', category: 'American' },
      { id: 'am_onyx', name: 'Onyx (Male)', category: 'American' },
      { id: 'am_puck', name: 'Puck (Male)', category: 'American' },
      { id: 'am_santa', name: 'Santa (Male)', category: 'American' },
      
      // British
      { id: 'bf_alice', name: 'Alice (British Female)', category: 'British' },
      { id: 'bf_emma', name: 'Emma (British Female)', category: 'British' },
      { id: 'bf_isabella', name: 'Isabella (British Female)', category: 'British' },
      { id: 'bf_lily', name: 'Lily (British Female)', category: 'British' },
      { id: 'bm_daniel', name: 'Daniel (British Male)', category: 'British' },
      { id: 'bm_fable', name: 'Fable (British Male)', category: 'British' },
      { id: 'bm_george', name: 'George (British Male)', category: 'British' },
      { id: 'bm_lewis', name: 'Lewis (British Male)', category: 'British' },
      
      // Fox Voice (Special)
      { id: 'ff_siwis', name: 'Siwis (Fox Voice)', category: 'Special' },
      
      // Japanese
      { id: 'jf_alpha', name: 'Alpha (Japanese Female)', category: 'Japanese' },
      { id: 'jf_gongitsune', name: 'Gongitsune (Japanese Female)', category: 'Japanese' },
      { id: 'jf_nezumi', name: 'Nezumi (Japanese Female)', category: 'Japanese' },
      { id: 'jf_tebukuro', name: 'Tebukuro (Japanese Female)', category: 'Japanese' },
      { id: 'jm_kumo', name: 'Kumo (Japanese Male)', category: 'Japanese' },
      
      // Chinese
      { id: 'zf_xiaobei', name: 'Xiaobei (Chinese Female)', category: 'Chinese' },
      { id: 'zf_xiaoni', name: 'Xiaoni (Chinese Female)', category: 'Chinese' },
      { id: 'zf_xiaoxiao', name: 'Xiaoxiao (Chinese Female)', category: 'Chinese' },
      { id: 'zf_xiaoyi', name: 'Xiaoyi (Chinese Female)', category: 'Chinese' },
      { id: 'zm_yunjian', name: 'Yunjian (Chinese Male)', category: 'Chinese' },
      { id: 'zm_yunxi', name: 'Yunxi (Chinese Male)', category: 'Chinese' },
      { id: 'zm_yunxia', name: 'Yunxia (Chinese Male)', category: 'Chinese' },
      { id: 'zm_yunyang', name: 'Yunyang (Chinese Male)', category: 'Chinese' }
    ];
  }

  // Get voice category
  getVoiceCategory(voiceId) {
    const voice = this.getAvailableVoices().find(v => v.id === voiceId);
    return voice ? voice.category : 'Unknown';
  }

  // Get voice display name
  getVoiceName(voiceId) {
    const voice = this.getAvailableVoices().find(v => v.id === voiceId);
    return voice ? voice.name : voiceId;
  }
}