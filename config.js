// config.js - Configuration file
const config = {
  // Database Configuration (gunakan environment variables di Vercel)
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dimc6971_Dimas1120',
    password: process.env.DB_PASSWORD || 'dimasahm12',
    database: process.env.DB_NAME || 'dimc6971_Dimas_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  // API Configuration
  api: {
    key: process.env.API_KEY || 'AjnQBMAhSZ4kJhqp',
    merchantCode: process.env.MERCHANT_CODE || 'DIMZ1945'
  },

  // Bot Configuration
  bot: {
    token: process.env.BOT_TOKEN || '8540280733:AAEjOrU2kDkLsJKrhtuPZfMOuoQdAIfYB5U',
    adminChatId: process.env.ADMIN_CHAT_ID || '6201552432'
  },

  // URLs
  urls: {
    welcomeImage: process.env.WELCOME_IMAGE || 'https://dimzmods.my.id/demobot/img/contoh1.jpg',
    qrisApi: 'https://cvqris-ariepulsa.my.id/qris/',
    telegramApi: 'https://api.telegram.org/bot'
  },

  // Time Configuration
  time: {
    orderTimeout: 600, // 10 minutes in seconds
    paymentCheckInterval: 20, // 20 seconds
    pointsPerDay: 12
  },

  // Prices
  prices: {
    '1': 15000,
    '2': 30000,
    '3': 40000,
    '4': 50000,
    '6': 70000,
    '8': 90000,
    '10': 100000,
    '15': 150000,
    '20': 180000,
    '30': 250000
  },

  // Point Rules
  pointRules: {
    '1': 1,
    '2': 1,
    '3': 2,
    '4': 3,
    '6': 4,
    '8': 5,
    '10': 6,
    '15': 8,
    '20': 10,
    '30': 15
  }
};

module.exports = config;
