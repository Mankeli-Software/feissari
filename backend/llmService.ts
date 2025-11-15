import { GoogleGenAI } from '@google/genai';
import { Feissari, LLMResponse, ChatHistory } from './types';

const model = 'gemini-2.5-flash';

/**
 * Service for interacting with Google Gemini LLM
 */
export class LLMService {
  private genAI: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.genAI = new GoogleGenAI({apiKey: apiKey});
  }

  /**
   * Build the system prompt for the LLM
   */
  private buildPrompt(
    feissari: Feissari,
    currentBalance: number,
    chatHistory: ChatHistory[],
    userMessage: string | null
  ): string {
    // Format chat history
    const historyText = chatHistory.length > 0
      ? '\n\nPrevious conversation with this customer:\n' +
        chatHistory
          .map((chat) => {
            const userMsg = chat.userMessage ? `Customer: ${chat.userMessage}` : '';
            const aiMsg = `You: ${chat.aiMessage}`;
            return userMsg ? `${userMsg}\n${aiMsg}` : aiMsg;
          })
          .join('\n\n')
      : '';

    // Format emotes
    const emotesText = feissari.emotes
      .map((e) => `- ${e.identifier}: ${e.description}`)
      .join('\n');

    // Build the prompt
    const isFirstInteraction = userMessage === null;
    const currentMessageText = isFirstInteraction
      ? '\n\nThis is the first interaction. Start the conversation as your character would approach someone.'
      : `\n\nCustomer's latest message: "${userMessage}"`;

    return `You are playing the role of a face-to-face salesperson (feissari), but you should always respond in English named ${feissari.name}. You should always respond with no more than 2-3 sentences.

${feissari.roleInstruction}

IMPORTANT: You can sell products/services to the user, which will deduct money from their balance.
Current customer balance: ${currentBalance}€

Available emotes and when to use them:
${emotesText}

You must respond in valid JSON format:
{
  "message": "your response to the user",
  "balance": number (current balance minus any purchase, or unchanged),
  "emote": "identifier" (must be one of the available emotes),
  "goToNext": boolean (true if conversation ends - either sale made or you give up)
}

RULES:
1. Respond ONLY with valid JSON, no additional text
2. The "emote" field must exactly match one of: ${feissari.emotes.map(e => e.identifier).join(', ')}
3. Only deduct from balance if you successfully convince the customer to make a purchase
4. Set "goToNext" to true when the conversation should end (sale made or you give up). So if you deduct balance from the user, you should mark the interaction as completed.
5. Keep your message conversational and in character${historyText}${currentMessageText}

Respond with JSON only:`;
  }

  /**
   * Get a response from the LLM
   */
  async getResponse(
    feissari: Feissari,
    currentBalance: number,
    chatHistory: ChatHistory[],
    userMessage: string | null
  ): Promise<LLMResponse> {
    const prompt = this.buildPrompt(feissari, currentBalance, chatHistory, userMessage);

    try {
      const result = await this.genAI.models.generateContent({
        model: model,
        contents: prompt,
      });
      const text = result.text!;

      // Try to extract JSON from the response
      let jsonText = text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.substring(3);
      }
      
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }
      
      jsonText = jsonText.trim();

      // Parse the JSON response
      const llmResponse = JSON.parse(jsonText) as LLMResponse;

      // Validate the response
      this.validateResponse(llmResponse, feissari, currentBalance);

      return llmResponse;
    } catch (error) {
      console.error('LLM API error:', error);
      
      // Provide a fallback response
      return {
        message: 'Something went wrong',
        balance: currentBalance,
        emote: feissari.emotes[0]?.identifier || 'neutral',
        goToNext: true
      };
    }
  }

  /**
   * Validate the LLM response
   */
  private validateResponse(response: LLMResponse, feissari: Feissari, currentBalance: number): void {
    // Check required fields
    if (typeof response.message !== 'string' || !response.message) {
      throw new Error('Invalid response: message is required and must be a non-empty string');
    }

    if (typeof response.balance !== 'number') {
      throw new Error('Invalid response: balance must be a number');
    }

    if (typeof response.emote !== 'string' || !response.emote) {
      throw new Error('Invalid response: emote is required and must be a string');
    }

    if (typeof response.goToNext !== 'boolean') {
      throw new Error('Invalid response: goToNext must be a boolean');
    }

    // Validate balance (can't be negative or increase)
    if (response.balance < 0) {
      console.warn('LLM returned negative balance, setting to 0');
      response.balance = 0;
    }

    if (response.balance > currentBalance) {
      console.warn('LLM tried to increase balance, keeping current balance');
      response.balance = currentBalance;
    }

    // Validate emote identifier
    const validEmotes = feissari.emotes.map(e => e.identifier);
    if (!validEmotes.includes(response.emote)) {
      console.warn(`Invalid emote "${response.emote}", using first available emote`);
      response.emote = validEmotes[0] || 'neutral';
    }
  }
}
