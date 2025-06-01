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
      voice: 'af_bella',
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

  // Send text to server to generate voice with Kokoro TTS
  async speakServerSide(text) {
    if (!text) return;

    console.log('🔊 Sending to Kokoro TTS server:', text);
    try {
      const response = await fetch('http://localhost:3001/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          output_format: this.ttsSettings.format,
          preset_voice: [this.ttsSettings.voice],
          speed: this.ttsSettings.speed,
          stream: true // Always use streaming for better performance
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      // Create audio blob from the stream
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play the audio
      this.audioElement.src = audioUrl;
      await this.audioElement.play();
      console.log('✅ Voice played from server');

      // Clean up the object URL after playback
      this.audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

    } catch (error) {
      console.error('❌ TTS server error:', error);
      await this.displayText(text);
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

  async testVoice(voice = 'af_bella') {
    const testText = "Hello! I am your virtual assistant. This is a voice test.";
    this.updateTtsSettings({ voice });
    await this.speakServerSide(testText);
  }

  // Get available voices
  getAvailableVoices() {
    return [
      'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jessica',
      'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah',
      'af_sky', 'am_adam', 'am_echo', 'am_eric', 'am_fenrir',
      'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa',
      'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel',
      'bm_fable', 'bm_george', 'bm_lewis', 'ef_dora', 'em_alex',
      'em_santa', 'ff_siwis', 'hf_alpha', 'hf_beta', 'hm_omega',
      'hm_psi', 'if_sara', 'im_nicola', 'jf_alpha', 'jf_gongitsune',
      'jf_nezumi', 'jf_tebukuro', 'jm_kumo', 'pf_dora', 'pm_alex',
      'pm_santa', 'zf_xiaobei', 'zf_xiaoni', 'zf_xiaoxiao', 'zf_xiaoyi',
      'zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang'
    ];
  }
}