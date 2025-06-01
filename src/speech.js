const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const puppeteer = require('puppeteer');

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
    
    // Puppeteer browser instance
    this.browser = null;
    this.page = null;
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log('🦊 Speech Handler initialized');
    console.log('🌐 Using text-to-speech.online service');
    
    // Initialize browser in background
    this.initializeBrowser();
  }

  // Initialize Puppeteer browser
  async initializeBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--autoplay-policy=no-user-gesture-required'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Set permissions for audio
      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions('https://www.text-to-speech.online', ['autoplay']);
      
      // Navigate to TTS website
      await this.page.goto('https://www.text-to-speech.online/', {
        waitUntil: 'networkidle2'
      });
      
      console.log('✅ Browser initialized for TTS');
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
    }
  }

  // Cleanup browser on exit
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
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

  // Main speak method using web scraping
  async speak(text) {
    console.log('🗣️ Speaking:', text.substring(0, 50) + '...');
    
    try {
      // Ensure browser is initialized
      if (!this.page) {
        await this.initializeBrowser();
      }
      
      // Use web TTS service
      await this.speakUsingWebTTS(text);
      
    } catch (error) {
      console.error('❌ TTS Error:', error);
      // Fallback to display text
      await this.displayText(text);
    }
  }

  // Speak using web TTS service
  async speakUsingWebTTS(text) {
    try {
      // Navigate to page if not already there
      const currentUrl = await this.page.url();
      if (!currentUrl.includes('text-to-speech.online')) {
        await this.page.goto('https://www.text-to-speech.online/', {
          waitUntil: 'networkidle2'
        });
      }
      
      // Clear existing text and input new text
      await this.page.evaluate(() => {
        const textarea = document.querySelector('textarea.form-control.br-none');
        if (textarea) {
          textarea.value = '';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      
      // Type the new text
      await this.page.type('textarea.form-control.br-none', text, { delay: 10 });
      
      // Setup audio capture
      const audioPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio playback timeout'));
        }, 30000); // 30 second timeout
        
        // Listen for audio playback
        this.page.on('response', async (response) => {
          if (response.url().includes('.mp3') || response.url().includes('audio')) {
            clearTimeout(timeout);
            
            // Wait for audio to finish playing
            await this.page.evaluate(() => {
              return new Promise((resolve) => {
                const checkAudio = setInterval(() => {
                  const audioElements = document.querySelectorAll('audio');
                  let allFinished = true;
                  
                  audioElements.forEach(audio => {
                    if (!audio.paused && !audio.ended) {
                      allFinished = false;
                    }
                  });
                  
                  if (allFinished) {
                    clearInterval(checkAudio);
                    resolve();
                  }
                }, 100);
                
                // Fallback timeout
                setTimeout(() => {
                  clearInterval(checkAudio);
                  resolve();
                }, 20000);
              });
            });
            
            resolve();
          }
        });
      });
      
      // Click the play button
      await this.page.click('#quick-play');
      
      // Wait for audio to complete
      await audioPromise;
      
      console.log('✅ TTS playback completed');
      
    } catch (error) {
      console.error('❌ Web TTS failed:', error);
      throw error;
    }
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
  
  // Voice settings (kept for compatibility but not used)
  setSpeakerWav(path) {
    console.log('🎤 Voice settings not applicable for web TTS');
  }
}