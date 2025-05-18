import axios from 'axios';

export class ChatGPTHandler {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.history = [];
  }

  async sendMessage(message) {
    try {
      // Add user message to history
      this.history.push({ role: 'user', content: message });
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4', // or any preferred model
          messages: [
            { 
              role: 'system', 
              content: 'You are a friendly, helpful fox assistant. Keep your responses concise and charming. Express emotions and personality.' 
            },
            ...this.history
          ],
          max_tokens: 150
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const reply = response.data.choices[0].message.content;
      
      // Add assistant response to history
      this.history.push({ role: 'assistant', content: reply });
      
      // Keep history at a reasonable size
      if (this.history.length > 10) {
        this.history = this.history.slice(-10);
      }
      
      return reply;
    } catch (error) {
      console.error('Error calling ChatGPT API:', error);
      return 'Sorry, I had trouble understanding. Could you try again?';
    }
  }
}