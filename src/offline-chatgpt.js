// offline-chatgpt.js
export class ChatGPTHandler {
  constructor() {
    this.responses = [
      "Hello! I'm your friendly fox assistant. How can I help you today?",
      "I'm just a simulated fox for now, but I'll be smarter soon!",
      "What a lovely day to be a digital fox! How are you feeling?",
      "I'm listening carefully to everything you say. What else would you like to talk about?",
      "If I were a real fox, I'd probably be sniffing around for mice right now. But as your assistant, I'm here to help!",
      "Did you know foxes make 40 different sounds? As your digital fox, I can help with many different tasks!",
      "I'm still learning, but I'm excited to chat with you!",
      "Fox fact: Foxes have whiskers on their legs that help them navigate. I'm here to help you navigate your questions!",
      "I'm a simulated fox assistant running in Electron and Three.js. Pretty cool, right?",
      "I'm all ears... well, digital ears anyway! What can I do for you?"
    ];
    
    // Add some contextual responses
    this.keywordResponses = {
      "hello": "Hello there! How can I help you today?",
      "hi": "Hi! I'm your friendly fox assistant. What can I do for you?",
      "how are you": "I'm doing great, thanks for asking! How about you?",
      "help": "I'd be happy to help! I can chat with you, answer questions, or just keep you company.",
      "fox": "As a digital fox, I'm quite different from my wild counterparts. But I still have a bushy tail... in spirit!",
      "name": "You can call me Foxy! I'm your friendly digital assistant.",
      "weather": "I don't have real-time weather data in this offline mode, but I hope it's sunny where you are!",
      "time": `The current time is ${new Date().toLocaleTimeString()}.`,
      "date": `Today is ${new Date().toLocaleDateString()}.`,
      "thanks": "You're very welcome! Anything else I can help with?",
      "thank you": "You're very welcome! Anything else I can help with?",
      "bye": "Goodbye! Come back soon to chat more!",
      "goodbye": "Goodbye! Come back soon to chat more!"
    };
  }

  async sendMessage(message) {
    console.log('User message (offline mode):', message);
    
    // Wait a bit to simulate thinking
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for keyword matches
    const lowerMessage = message.toLowerCase();
    for (const [keyword, response] of Object.entries(this.keywordResponses)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }
    
    // Fall back to random responses
    return this.responses[Math.floor(Math.random() * this.responses.length)];
  }
}