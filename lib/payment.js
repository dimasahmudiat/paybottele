// lib/payment.js - Payment functions
const axios = require('axios');
const config = require('../config');

class PaymentService {
  constructor() {
    this.apiUrl = config.urls.qrisApi;
    this.apiKey = config.api.key;
  }

  async createPayment(orderId, amount) {
    try {
      const url = `${this.apiUrl}?action=get-deposit&kode=${encodeURIComponent(orderId)}&nominal=${amount}&apikey=${this.apiKey}`;
      console.log(`Creating payment: ${url}`);
      
      const response = await axios.get(url);
      console.log('Payment response:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Error creating payment:', error.message);
      return { status: false };
    }
  }

  async checkPaymentStatus(depositCode) {
    try {
      const url = `${this.apiUrl}?action=get-mutasi&kode=${encodeURIComponent(depositCode)}&apikey=${this.apiKey}`;
      console.log(`Checking payment status: ${url}`);
      
      const response = await axios.get(url);
      console.log('Payment status response:', response.data);
      
      if (response.data && 
          response.data.status && 
          response.data.data && 
          response.data.data.status === 'Success') {
        return response.data.data;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking payment status:', error.message);
      return false;
    }
  }

  generateRandomCredentials() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    // Username: 2 letters + 2 numbers
    let username = '';
    for (let i = 0; i < 2; i++) {
      username += letters[Math.floor(Math.random() * letters.length)];
    }
    for (let i = 0; i < 2; i++) {
      username += numbers[Math.floor(Math.random() * numbers.length)];
    }
    
    // Password: 2 digit numbers
    let password = '';
    for (let i = 0; i < 2; i++) {
      password += numbers[Math.floor(Math.random() * numbers.length)];
    }
    
    return { username, password };
  }

  generateRedeemCredentials() {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    
    // Username: "redeem" + 1 number + 2 letters
    let username = 'redeem';
    username += numbers[Math.floor(Math.random() * numbers.length)];
    for (let i = 0; i < 2; i++) {
      username += letters[Math.floor(Math.random() * letters.length)];
    }
    
    // Password: 1 digit number
    const password = numbers[Math.floor(Math.random() * numbers.length)];
    
    return { username, password };
  }

  calculatePointsForDuration(duration) {
    return config.pointRules[duration] || 0;
  }

  calculatePointsNeededForDays(days) {
    return days * config.time.pointsPerDay;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date) {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).format(date);
  }
}

module.exports = new PaymentService();
