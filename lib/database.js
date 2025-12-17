// lib/database.js - Database functions
const mysql = require('mysql2/promise');
const config = require('../config');

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(config.db);
  }
  return pool;
}

async function query(sql, params) {
  const connection = await getPool();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

// User State Management
async function saveUserState(chatId, state, data = {}) {
  const jsonData = JSON.stringify(data);
  const sql = `
    INSERT INTO user_states (chat_id, state, data, error_count, created_at, updated_at) 
    VALUES (?, ?, ?, 0, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
      state = VALUES(state), 
      data = VALUES(data), 
      error_count = 0, 
      updated_at = NOW()
  `;
  return query(sql, [chatId, state, jsonData]);
}

async function getUserState(chatId) {
  const sql = 'SELECT state, data, error_count FROM user_states WHERE chat_id = ?';
  const results = await query(sql, [chatId]);
  
  if (results.length > 0) {
    return {
      state: results[0].state,
      data: JSON.parse(results[0].data),
      errorCount: results[0].error_count
    };
  }
  return null;
}

async function clearUserState(chatId) {
  const sql = 'DELETE FROM user_states WHERE chat_id = ?';
  return query(sql, [chatId]);
}

// User Points
async function getUserPoints(chatId) {
  const sql = 'SELECT points FROM user_points WHERE chat_id = ?';
  const results = await query(sql, [chatId]);
  
  if (results.length > 0) {
    return results[0].points;
  }
  
  // Create record if not exists
  await query(
    'INSERT INTO user_points (chat_id, points, created_at, updated_at) VALUES (?, 0, NOW(), NOW())',
    [chatId]
  );
  return 0;
}

async function addUserPoints(chatId, points, reason = '') {
  // Update points
  await query(
    `INSERT INTO user_points (chat_id, points, created_at, updated_at) 
     VALUES (?, ?, NOW(), NOW()) 
     ON DUPLICATE KEY UPDATE points = points + ?, updated_at = NOW()`,
    [chatId, points, points]
  );
  
  // Log transaction
  if (reason) {
    await query(
      'INSERT INTO point_transactions (chat_id, points, type, reason, created_at) VALUES (?, ?, "earn", ?, NOW())',
      [chatId, points, reason]
    );
  }
  return true;
}

async function redeemUserPoints(chatId, points, reason = '') {
  // Check if user has enough points
  const currentPoints = await getUserPoints(chatId);
  if (currentPoints < points) {
    console.log(`Insufficient points - Chat: ${chatId}, Current: ${currentPoints}, Needed: ${points}`);
    return false;
  }
  
  // Deduct points
  const result = await query(
    'UPDATE user_points SET points = points - ?, updated_at = NOW() WHERE chat_id = ?',
    [points, chatId]
  );
  
  if (result.affectedRows > 0 && reason) {
    await query(
      'INSERT INTO point_transactions (chat_id, points, type, reason, created_at) VALUES (?, ?, "redeem", ?, NOW())',
      [chatId, points, reason]
    );
  }
  
  return result.affectedRows > 0;
}

// Username Check
async function isUsernameExists(username, table = null) {
  if (table) {
    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE username = ?`;
    const results = await query(sql, [username]);
    return results[0].count > 0;
  } else {
    // Check both tables
    const [ffResults, ffmaxResults] = await Promise.all([
      query('SELECT COUNT(*) as count FROM freefire WHERE username = ?', [username]),
      query('SELECT COUNT(*) as count FROM ffmax WHERE username = ?', [username])
    ]);
    
    return (ffResults[0].count + ffmaxResults[0].count) > 0;
  }
}

// Get User by Credentials
async function getUserByUsernameAndPassword(username, password, gameType = null) {
  if (gameType === 'ff') {
    const sql = 'SELECT *, "ff" as game_type FROM freefire WHERE username = ? AND password = ?';
    const results = await query(sql, [username, password]);
    return results.length > 0 ? results[0] : null;
  } else if (gameType === 'ffmax') {
    const sql = 'SELECT *, "ffmax" as game_type FROM ffmax WHERE username = ? AND password = ?';
    const results = await query(sql, [username, password]);
    return results.length > 0 ? results[0] : null;
  } else {
    // Check both tables
    const sql = `
      SELECT *, 'ff' as game_type FROM freefire WHERE username = ? AND password = ?
      UNION ALL
      SELECT *, 'ffmax' as game_type FROM ffmax WHERE username = ? AND password = ?
      LIMIT 1
    `;
    const results = await query(sql, [username, password, username, password]);
    return results.length > 0 ? results[0] : null;
  }
}

// Save License
async function saveLicenseToDatabase(table, username, password, duration, reference) {
  // Check if username exists
  if (await isUsernameExists(username, table)) {
    console.log(`Username already exists in table ${table}: ${username}`);
    return false;
  }
  
  const expDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  const expDateStr = expDate.toISOString().slice(0, 19).replace('T', ' ');
  const uuid = '';
  const status = '2';
  
  const sql = `
    INSERT INTO ${table} (username, password, uuid, expDate, status, reference, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;
  
  try {
    const result = await query(sql, [username, password, uuid, expDateStr, status, reference]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error saving license:', error.message);
    return false;
  }
}

// Extend License
async function extendUserLicense(username, password, duration, gameType) {
  const table = gameType === 'ff' ? 'freefire' : 'ffmax';
  
  // Get current expiration
  const sqlSelect = `SELECT expDate FROM ${table} WHERE username = ? AND password = ?`;
  const results = await query(sqlSelect, [username, password]);
  
  if (results.length === 0) {
    return false;
  }
  
  const currentExpDate = results[0].expDate;
  const currentTime = new Date();
  
  let newExpDate;
  if (new Date(currentExpDate) < currentTime) {
    // Account expired, start from now
    newExpDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  } else {
    // Add to current expiration
    newExpDate = new Date(new Date(currentExpDate).getTime() + duration * 24 * 60 * 60 * 1000);
  }
  
  const newExpDateStr = newExpDate.toISOString().slice(0, 19).replace('T', ' ');
  
  const sqlUpdate = `UPDATE ${table} SET expDate = ? WHERE username = ? AND password = ?`;
  const result = await query(sqlUpdate, [newExpDateStr, username, password]);
  
  return result.affectedRows > 0;
}

// Pending Orders
async function savePendingOrder(orderId, chatId, gameType, duration, amount, depositCode, keyType, manualUsername = '', manualPassword = '') {
  const sql = `
    INSERT INTO pending_orders (order_id, chat_id, game_type, duration, amount, deposit_code, key_type, manual_username, manual_password, status, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
  `;
  
  return query(sql, [orderId, chatId, gameType, duration, amount, depositCode, keyType, manualUsername, manualPassword]);
}

async function getPendingOrder(chatId) {
  const sql = 'SELECT * FROM pending_orders WHERE chat_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1';
  const results = await query(sql, [chatId]);
  return results.length > 0 ? results[0] : null;
}

async function updateOrderStatus(depositCode, status) {
  const sql = 'UPDATE pending_orders SET status = ?, updated_at = NOW() WHERE deposit_code = ?';
  return query(sql, [status, depositCode]);
}

// Cleanup expired orders
async function cleanupExpiredOrders() {
  const expiredTime = new Date(Date.now() - config.time.orderTimeout * 1000);
  const expiredTimeStr = expiredTime.toISOString().slice(0, 19).replace('T', ' ');
  
  const sql = 'DELETE FROM pending_orders WHERE status = "pending" AND created_at < ?';
  const result = await query(sql, [expiredTimeStr]);
  
  if (result.affectedRows > 0) {
    console.log(`Cleaned up ${result.affectedRows} expired orders`);
  }
  
  return result.affectedRows;
}

module.exports = {
  query,
  saveUserState,
  getUserState,
  clearUserState,
  getUserPoints,
  addUserPoints,
  redeemUserPoints,
  isUsernameExists,
  getUserByUsernameAndPassword,
  saveLicenseToDatabase,
  extendUserLicense,
  savePendingOrder,
  getPendingOrder,
  updateOrderStatus,
  cleanupExpiredOrders
};
