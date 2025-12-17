// api/bot.js - Main bot handler for Vercel
const bot = require('../lib/telegram');
const db = require('../lib/database');
const payment = require('../lib/payment');
const config = require('../config');
const scheduler = require('../lib/scheduler');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST requests for webhook
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const update = req.body;
    
    // Log incoming request
    console.log('Update received:', JSON.stringify(update, null, 2));
    
    // Process the update
    await processUpdate(update);
    
    // Process scheduled tasks
    await scheduler.processAutoDelete();
    await scheduler.processRealTimePaymentChecks();
    
    // Cleanup expired orders
    await db.cleanupExpiredOrders();
    
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error processing update:', error);
    res.status(500).json({ error: error.message });
  }
};

async function processUpdate(update) {
  // Handle callback queries
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }
  
  // Handle messages
  if (update.message && update.message.text) {
    await handleMessage(update.message);
    return;
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const firstName = message.chat.first_name || 'User';
  
  console.log(`Processing message - ChatID: ${chatId}, Text: ${text}, Name: ${firstName}`);
  
  if (text.startsWith('/start')) {
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
    await showMainMenu(chatId, "🏠 <b>Menu Utama</b>\n\nSilakan pilih menu yang diinginkan:");
  } else if (text.startsWith('/points')) {
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
    // Handle state-based messages
    const userState = await db.getUserState(chatId);
    
    if (userState && userState.state === 'waiting_manual_input') {
      await handleManualInput(chatId, text, userState);
    } else if (userState && userState.state === 'waiting_extend_credentials') {
      await handleExtendCredentials(chatId, text, userState);
    }
  }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const callbackId = callbackQuery.id;
  
  console.log(`Callback received: ${data} from ${chatId}`);
  
  // Answer callback first
  await bot.answerCallbackQuery(callbackId);
  
  // Handle different callback actions
  switch (data) {
    case 'main_menu':
      await db.clearUserState(chatId);
      await showMainMenu(chatId, null, messageId);
      break;
      
    case 'new_order':
      await handleNewOrder(chatId, messageId);
      break;
      
    case 'extend_user':
      await handleExtendUser(chatId, messageId);
      break;
      
    case 'redeem_points':
      await showRedeemPointsMenu(chatId, messageId);
      break;
      
    case 'help':
      await showHelp(chatId, messageId);
      break;
      
    default:
      if (data.startsWith('type_')) {
        await handleGameTypeSelection(chatId, messageId, data);
      } else if (data.startsWith('duration_')) {
        await handleDurationSelection(chatId, messageId, data);
      } else if (data.startsWith('keytype_')) {
        await handleKeyTypeSelection(chatId, messageId, data);
      } else if (data.startsWith('extend_type_')) {
        await handleExtendTypeSelection(chatId, messageId, data);
      } else if (data.startsWith('extend_duration_')) {
        await handleExtendDurationSelection(chatId, messageId, data);
      } else if (data.startsWith('redeem_')) {
        if (data === 'redeem_ff' || data === 'redeem_ffmax') {
          await handleRedeemGameType(chatId, messageId, data);
        } else {
          await handleRedeemDuration(chatId, messageId, data);
        }
      } else if (data === 'check_payment' || data === 'check_extend') {
        await handleCheckPayment(chatId, messageId, data);
      } else if (data === 'cancel_order') {
        await handleCancelOrder(chatId, messageId);
      }
      break;
  }
}

// Helper functions
async function showMainMenu(chatId, text = null, messageId = null) {
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
}

async function showHelp(chatId, messageId) {
  const userPoints = await db.getUserPoints(chatId);
  
  const helpMessage = `ℹ️ <b>BANTUAN</b>\n\n` +
    `💰 <b>Point Anda:</b> ${userPoints} points\n\n` +
    `📝 <b>Cara Penggunaan:</b>\n` +
    `1. Pilih 'Beli Lisensi Baru' untuk pembelian baru\n` +
    `2. Pilih 'Extend Masa Aktif' untuk memperpanjang\n` +
    `3. Pilih 'Tukar Point' untuk lisensi gratis\n` +
    `4. Ikuti instruksi yang diberikan\n\n` +
    `🔧 <b>Fitur:</b>\n` +
    `• Support Free Fire & Free Fire MAX\n` +
    `• Pembayaran QRIS otomatis\n` +
    `• Extend masa aktif\n` +
    `• Key random & manual\n` +
    `• Sistem point/reward\n\n` +
    `🎁 <b>Sistem Point:</b>\n` +
    `• Dapatkan point dari setiap pembelian\n` +
    `• 12 points = 1 hari lisensi gratis\n` +
    `• Point tidak memiliki masa kedaluwarsa\n\n` +
    `⏰ <b>Pembayaran Otomatis:</b>\n` +
    `• QR berlaku selama 10 menit\n` +
    `• Cek pembayaran otomatis setiap 20 detik\n` +
    `• QR terhapus otomatis jika tidak dibayar\n` +
    `• Pesan sukses tidak akan dihapus\n\n` +
    `❓ <b>Pertanyaan?</b>\n` +
    `Hubungi admin jika ada kendala @dimasvip1120`;
  
  await showMainMenu(chatId, helpMessage, messageId);
}

// Note: The rest of the functions (handleNewOrder, handleExtendUser, etc.) 
// would be implemented similarly to your PHP logic but in JavaScript.
// Due to space constraints, I've shown the main structure.

// This is a simplified version. You would need to implement all the other
// handler functions based on your PHP logic.
