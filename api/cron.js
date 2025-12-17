// api/cron.js - For scheduled tasks on Vercel
const db = require('../lib/database');
const scheduler = require('../lib/scheduler');

module.exports = async (req, res) => {
  // This endpoint can be called by Vercel Cron Jobs
  // or external cron service
  
  try {
    // Process scheduled tasks
    await scheduler.processAutoDelete();
    await scheduler.processRealTimePaymentChecks();
    
    // Cleanup expired orders
    await db.cleanupExpiredOrders();
    
    res.status(200).json({ 
      success: true, 
      message: 'Scheduled tasks executed successfully' 
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    res.status(500).json({ error: error.message });
  }
};
