// offline-speech.js - Use this instead of speech.js
export class SpeechHandler {
  constructor(onSpeechStart, onSpeechEnd, onResult) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onResult = onResult;
    this.isListening = false;
    this.setupTextInterface();
  }

  setupTextInterface() {
    // Create a text input element
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
    // In offline mode, we don't do anything here
    // The text input is always visible
    console.log('Using offline mode - use the text input');
  }

  stopListening() {
    // No-op in offline mode
  }

  speak(text) {
    return new Promise((resolve) => {
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
          resolve();
        }, 500);
      }, Math.max(2000, text.length * 50)); // Display time based on text length
    });
  }
}