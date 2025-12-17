// lib/telegram.js - Telegram API functions
const axios = require('axios');
const config = require('../config');

class TelegramBot {
  constructor() {
    this.token = config.bot.token;
    this.apiUrl = `${config.urls.telegramApi}${this.token}`;
  }

  async sendRequest(method, data) {
    try {
      const response = await axios.post(`${this.apiUrl}/${method}`, data);
      return response.data;
    } catch (error) {
      console.error(`Telegram API error (${method}):`, error.message);
      return { ok: false };
    }
  }

  async sendMessage(chatId, text, options = {}) {
    const data = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options
    };
    
    if (options.replyMarkup) {
      data.reply_markup = options.replyMarkup;
    }
    
    return this.sendRequest('sendMessage', data);
  }

  async sendPhoto(chatId, photoUrl, caption = '', options = {}) {
    const data = {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML',
      ...options
    };
    
    if (options.replyMarkup) {
      data.reply_markup = options.replyMarkup;
    }
    
    return this.sendRequest('sendPhoto', data);
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const data = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      ...options
    };
    
    if (options.replyMarkup) {
      data.reply_markup = options.replyMarkup;
    }
    
    return this.sendRequest('editMessageText', data);
  }

  async editMessageCaption(chatId, messageId, caption, options = {}) {
    const data = {
      chat_id: chatId,
      message_id: messageId,
      caption: caption,
      parse_mode: 'HTML',
      ...options
    };
    
    if (options.replyMarkup) {
      data.reply_markup = options.replyMarkup;
    }
    
    return this.sendRequest('editMessageCaption', data);
  }

  async deleteMessage(chatId, messageId) {
    return this.sendRequest('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async answerCallbackQuery(callbackQueryId, text = '') {
    const data = {
      callback_query_id: callbackQueryId
    };
    
    if (text) {
      data.text = text;
    }
    
    return this.sendRequest('answerCallbackQuery', data);
  }

  async sendMessageWithImage(chatId, text, replyMarkup = null) {
    try {
      const result = await this.sendPhoto(chatId, config.urls.welcomeImage, text, { replyMarkup });
      
      if (!result.ok) {
        // Fallback to text message
        console.log('Failed to send photo, falling back to text message');
        return this.sendMessage(chatId, text, { replyMarkup });
      }
      
      return result;
    } catch (error) {
      console.error('Error sending message with image:', error.message);
      return this.sendMessage(chatId, text, { replyMarkup });
    }
  }

  async editMessageSmart(chatId, messageId, text, replyMarkup = null) {
    // Try editing as caption first
    const captionResult = await this.editMessageCaption(chatId, messageId, text, { replyMarkup });
    
    if (captionResult.ok) {
      console.log(`Successfully edited message caption - Chat: ${chatId}, Message: ${messageId}`);
      return captionResult;
    }
    
    // If failed, try editing as text
    const textResult = await this.editMessageText(chatId, messageId, text, { replyMarkup });
    
    if (textResult.ok) {
      console.log(`Successfully edited message text - Chat: ${chatId}, Message: ${messageId}`);
      return textResult;
    }
    
    // If both methods fail, send new message
    console.log(`Both edit methods failed, sending new message - Chat: ${chatId}, Message: ${messageId}`);
    return this.sendMessageWithImage(chatId, text, replyMarkup);
  }

  async notifyAdmin(message) {
    return this.sendMessage(config.bot.adminChatId, message);
  }
}

module.exports = new TelegramBot();
