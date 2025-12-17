// api/bot.js - Main bot handler for Vercel
const bot = require('../lib/telegram');
const db = require('../lib/database');
const payment = require('../lib/payment');
const config = require('../config');

module.exports = async (req, res) => {
  console.log('=== REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    return res.status(200).end();
  }
  
  // Handle GET requests (for browser testing)
  if (req.method === 'GET') {
    console.log('GET request from browser');
    
    // Simple test database connection
    try {
      const testResult = await db.testConnection();
      console.log('Database test result:', testResult);
      
      return res.status(200).json({
        status: '✅ Bot Telegram is ONLINE!',
        endpoint: '/bot',
        database: testResult ? '✅ Connected' : '❌ Connection Failed',
        message: 'Bot is ready to receive Telegram webhook updates via POST method',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Database test error:', error);
      return res.status(200).json({
        status: '⚠️ Bot is running (Database Error)',
        error: error.message,
        message: 'Check database configuration in Vercel Environment Variables'
      });
    }
  }
  
  // Handle POST requests (from Telegram)
  if (req.method === 'POST') {
    console.log('POST request from Telegram');
    
    try {
      // Get the update from Telegram
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const update = JSON.parse(body);
          console.log('Telegram Update:', JSON.stringify(update, null, 2));
          
          // Process the update
          await processUpdate(update);
          
          // Send 200 OK response to Telegram
          res.status(200).json({ ok: true });
          
        } catch (parseError) {
          console.error('Error parsing request body:', parseError);
          res.status(400).json({ error: 'Invalid JSON' });
        }
      });
      
    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Method not allowed
    res.status(405).json({ error: 'Method not allowed' });
  }
};

// Process Telegram update
async function processUpdate(update) {
  console.log('Processing update...');
  
  // Handle callback queries
  if (update.callback_query) {
    console.log('Callback query received');
    await handleCallbackQuery(update.callback_query);
    return;
  }
  
  // Handle messages
  if (update.message && update.message.text) {
    console.log('Message received');
    await handleMessage(update.message);
    return;
  }
  
  console.log('Unhandled update type');
}

// Handle messages
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const firstName = message.chat.first_name || 'User';
  
  console.log(`Processing message - ChatID: ${chatId}, Text: ${text}`);
  
  try {
    if (text.startsWith('/start')) {
      console.log('Start command received');
      await db.clearUserState(chatId);
      
      const userPoints = await db.getUserPoints(chatId);
      
      const welcomeMessage = `🎮 <b>Selamat Datang, ${firstName}!</b>\n\n` +
        `✨ <b>BOT PEMBELIAN LISENSI FREE FIRE</b> ✨\n\n` +
        `💰 <b>Point Anda:</b> ${userPoints} points\n\n` +
        `🛒 <b>Fitur yang tersedia:</b>\n` +
        `• Beli lisensi baru (Random/Manual)\n` +
        `• Extend masa aktif akun\n` +
        `• Tukar point dengan lisensi gratis\n` +
        `• Support Free Fire & Free Fire MAX\n` +
        `• Pembayaran QRIS otomatis\n\n` +
        `💰 <b>Harga mulai dari Rp 15.000</b>\n` +
        `🎁 <b>Dapatkan point untuk setiap pembelian!</b>\n\n` +
        `⏰ <b>Pembayaran otomatis terdeteksi dalam 10 menit!</b>\n\n` +
        `Silakan pilih menu di bawah:`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '🛒 Beli Lisensi Baru', callback_data: 'new_order' }],
          [
            { text: '⏰ Extend Masa Aktif', callback_data: 'extend_user' },
            { text: '🎁 Tukar Point', callback_data: 'redeem_points' }
          ],
          [{ text: 'ℹ️ Bantuan', callback_data: 'help' }]
        ]
      };
      
      await bot.sendMessageWithImage(chatId, welcomeMessage, keyboard);
      
    } else if (text.startsWith('/menu')) {
      console.log('Menu command received');
      await showMainMenu(chatId, "🏠 <b>Menu Utama</b>\n\nSilakan pilih menu yang diinginkan:");
      
    } else if (text.startsWith('/points')) {
      console.log('Points command received');
      const userPoints = await db.getUserPoints(chatId);
      const message = `💰 <b>POINT ANDA</b>\n\n` +
        `Total Point: <b>${userPoints} points</b>\n\n` +
        `📊 <b>Cara mendapatkan point:</b>\n` +
        `• Beli lisensi 1 hari = 1 point\n` +
        `• Beli lisensi 3 hari = 2 point\n` +
        `• Beli lisensi 7 hari = 5 point\n` +
        `• Dan seterusnya...\n\n` +
        `🎁 <b>Tukar point dengan lisensi gratis!</b>\n` +
        `12 points = 1 hari lisensi gratis`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '🎁 Tukar Point', callback_data: 'redeem_points' }],
          [
            { text: '🛒 Beli Lisensi', callback_data: 'new_order' },
            { text: '🏠 Menu Utama', callback_data: 'main_menu' }
          ]
        ]
      };
      
      await bot.sendMessageWithImage(chatId, message, keyboard);
      
    } else {
      console.log('Regular text message');
      // Handle state-based messages
      const userState = await db.getUserState(chatId);
      console.log('User state:', userState);
      
      if (userState) {
        // You can add your state handling logic here
        await bot.sendMessage(chatId, `State: ${userState.state}\n\nSilakan gunakan menu inline untuk melanjutkan.`);
      } else {
        await bot.sendMessage(chatId, `Halo ${firstName}! Gunakan /start untuk memulai atau pilih dari menu.`);
      }
    }
    
  } catch (error) {
    console.error('Error in handleMessage:', error);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi atau gunakan /start');
  }
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const callbackId = callbackQuery.id;
  
  console.log(`Callback received: ${data} from ${chatId}`);
  
  try {
    // Answer callback first
    await bot.answerCallbackQuery(callbackId, { text: 'Memproses...' });
    
    // Handle different callback actions
    switch (data) {
      case 'main_menu':
        console.log('Main menu callback');
        await db.clearUserState(chatId);
        await showMainMenu(chatId, null, messageId);
        break;
        
      case 'new_order':
        console.log('New order callback');
        await handleNewOrder(chatId, messageId);
        break;
        
      case 'extend_user':
        console.log('Extend user callback');
        await handleExtendUser(chatId, messageId);
        break;
        
      case 'redeem_points':
        console.log('Redeem points callback');
        await showRedeemPointsMenu(chatId, messageId);
        break;
        
      case 'help':
        console.log('Help callback');
        await showHelp(chatId, messageId);
        break;
        
      default:
        console.log(`Unknown callback: ${data}`);
        await bot.sendMessage(chatId, '❌ Perintah tidak dikenali. Silakan coba lagi.');
        break;
    }
    
  } catch (error) {
    console.error('Error in handleCallbackQuery:', error);
    await bot.answerCallbackQuery(callbackId, { text: '❌ Error processing request' });
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

// Show main menu
async function showMainMenu(chatId, text = null, messageId = null) {
  try {
    const userPoints = await db.getUserPoints(chatId);
    
    const message = text || `🏠 <b>Menu Utama</b>\n\n` +
      `💰 <b>Point Anda:</b> ${userPoints} points\n\n` +
      `Silakan pilih menu yang diinginkan:`;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🛒 Beli Lisensi Baru', callback_data: 'new_order' }],
        [
          { text: '⏰ Extend Masa Aktif', callback_data: 'extend_user' },
          { text: '🎁 Tukar Point', callback_data: 'redeem_points' }
        ],
        [{ text: 'ℹ️ Bantuan', callback_data: 'help' }]
      ]
    };
    
    if (messageId) {
      await bot.editMessageSmart(chatId, messageId, message, keyboard);
    } else {
      await bot.sendMessageWithImage(chatId, message, keyboard);
    }
    
  } catch (error) {
    console.error('Error in showMainMenu:', error);
    await bot.sendMessage(chatId, '❌ Gagal menampilkan menu. Silakan coba /start lagi.');
  }
}

// Handle new order
async function handleNewOrder(chatId, messageId) {
  try {
    const message = "👋 <b>Halo!</b>\n\n" +
      "Silakan pilih jenis Free Fire yang ingin Anda beli:";
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎮 FREE FIRE', callback_data: 'type_ff' },
          { text: '⚡ FREE FIRE MAX', callback_data: 'type_ffmax' }
        ],
        [
          { text: '↩️ Kembali', callback_data: 'main_menu' }
        ]
      ]
    };
    
    if (messageId) {
      await bot.editMessageSmart(chatId, messageId, message, keyboard);
    } else {
      await bot.sendMessageWithImage(chatId, message, keyboard);
    }
    
  } catch (error) {
    console.error('Error in handleNewOrder:', error);
    await bot.sendMessage(chatId, '❌ Gagal memproses pesanan. Silakan coba lagi.');
  }
}

// Handle extend user
async function handleExtendUser(chatId, messageId) {
  try {
    const message = "🎮 <b>EXTEND MASA AKTIF</b>\n\n" +
      "Pilih jenis Free Fire yang ingin di-extend:";
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎮 FREE FIRE', callback_data: 'extend_type_ff' },
          { text: '⚡ FREE FIRE MAX', callback_data: 'extend_type_ffmax' }
        ],
        [
          { text: '↩️ Kembali', callback_data: 'main_menu' }
        ]
      ]
    };
    
    if (messageId) {
      await bot.editMessageSmart(chatId, messageId, message, keyboard);
    } else {
      await bot.sendMessageWithImage(chatId, message, keyboard);
    }
    
  } catch (error) {
    console.error('Error in handleExtendUser:', error);
    await bot.sendMessage(chatId, '❌ Gagal memproses extend. Silakan coba lagi.');
  }
}

// Show redeem points menu
async function showRedeemPointsMenu(chatId, messageId) {
  try {
    const userPoints = await db.getUserPoints(chatId);
    
    const message = "🎁 <b>TUKAR POINT</b>\n\n" +
      `💰 <b>Point Anda:</b> ${userPoints} points\n\n` +
      "📊 <b>Rate Penukaran:</b>\n" +
      "• 1 Hari = 12 points\n" +
      "• 2 Hari = 24 points\n" +
      "• 3 Hari = 36 points\n" +
      "• 7 Hari = 84 points\n\n" +
      "Pilih durasi yang ingin ditukar:";
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '1 Hari - 12 points', callback_data: 'redeem_1' },
          { text: '2 Hari - 24 points', callback_data: 'redeem_2' }
        ],
        [
          { text: '3 Hari - 36 points', callback_data: 'redeem_3' },
          { text: '7 Hari - 84 points', callback_data: 'redeem_7' }
        ],
        [
          { text: '↩️ Kembali', callback_data: 'main_menu' }
        ]
      ]
    };
    
    if (messageId) {
      await bot.editMessageSmart(chatId, messageId, message, keyboard);
    } else {
      await bot.sendMessageWithImage(chatId, message, keyboard);
    }
    
  } catch (error) {
    console.error('Error in showRedeemPointsMenu:', error);
    await bot.sendMessage(chatId, '❌ Gagal menampilkan menu penukaran. Silakan coba lagi.');
  }
}

// Show help
async function showHelp(chatId, messageId) {
  try {
    const userPoints = await db.getUserPoints(chatId);
    
    const helpMessage = "ℹ️ <b>BANTUAN</b>\n\n" +
      `💰 <b>Point Anda:</b> ${userPoints} points\n\n` +
      "📝 <b>Cara Penggunaan:</b>\n" +
      "1. Pilih 'Beli Lisensi Baru' untuk pembelian baru\n" +
      "2. Pilih 'Extend Masa Aktif' untuk memperpanjang\n" +
      "3. Pilih 'Tukar Point' untuk lisensi gratis\n" +
      "4. Ikuti instruksi yang diberikan\n\n" +
      "🔧 <b>Fitur:</b>\n" +
      "• Support Free Fire & Free Fire MAX\n" +
      "• Pembayaran QRIS otomatis\n" +
      "• Extend masa aktif\n" +
      "• Key random & manual\n" +
      "• Sistem point/reward\n\n" +
      "🎁 <b>Sistem Point:</b>\n" +
      "• Dapatkan point dari setiap pembelian\n" +
      "• 12 points = 1 hari lisensi gratis\n" +
      "• Point tidak memiliki masa kedaluwarsa\n\n" +
      "⏰ <b>Pembayaran Otomatis:</b>\n" +
      "• QR berlaku selama 10 menit\n" +
      "• Cek pembayaran otomatis setiap 20 detik\n" +
      "• QR terhapus otomatis jika tidak dibayar\n" +
      "• Pesan sukses tidak akan dihapus\n\n" +
      "❓ <b>Pertanyaan?</b>\n" +
      "Hubungi admin jika ada kendala @dimasvip1120";
    
    if (messageId) {
      await bot.editMessageSmart(chatId, messageId, helpMessage);
    } else {
      await bot.sendMessageWithImage(chatId, helpMessage);
    }
    
  } catch (error) {
    console.error('Error in showHelp:', error);
    await bot.sendMessage(chatId, '❌ Gagal menampilkan bantuan. Silakan coba lagi.');
  }
}
