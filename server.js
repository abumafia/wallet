const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;
// MongoDB Connection
mongoose.connect('mongodb+srv://apl:apl00@gamepaymentbot.ffcsj5v.mongodb.net/haq1?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});
// User Schema
const userSchema = new mongoose.Schema({
  avatar: { type: String, default: '' },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  bio: { type: String, default: '' },
  socialLinks: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' }
  },
  password: { type: String, required: true },
  walletNumber: { type: String, unique: true },
  balance: { type: Number, default: 0 },
  isFrozen: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
// Transaction Schema (kengaytirildi: paymentMethod va externalDetails qo'shildi)
const transactionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['transfer', 'deposit', 'withdrawal'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  screenshot: { type: String, default: '' },
  description: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['card', 'payeer', 'paypal', 'btc', 'eth', 'usdt', 'uzcard'], default: 'card' }, // To'lov usullari
  externalDetails: { type: String, default: '' }, // Foydalanuvchi hisobi (email, wallet address)
  createdAt: { type: Date, default: Date.now }
});
// HAQ Value Schema (o'zgarmadi)
const haqValueSchema = new mongoose.Schema({
  value: { type: Number, required: true },
  change: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});
// Conversion Rates Schema (yangi: HAQ konvertatsiyasi)
const conversionRateSchema = new mongoose.Schema({
  currency: { type: String, required: true, unique: true }, // 'UZS', 'USD', 'EUR' va h.k.
  rate: { type: Number, required: true }, // 1 HAQ = rate (masalan, 1200 UZS)
  updatedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const HaqValue = mongoose.model('HaqValue', haqValueSchema);
const ConversionRate = mongoose.model('ConversionRate', conversionRateSchema);
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'online-bank-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });
// Generate unique wallet number
function generateWalletNumber() {
  const prefix = 'HAQ';
  const numbers = '0123456789';
  let result = prefix;
  for (let i = 0; i < 13; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return result;
}
// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
// Routes
// Register (o'zgarmadi)
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username, password, bio, avatar } = req.body;
   
    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }
   
    const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
   
    let walletNumber;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    while (!isUnique && attempts < maxAttempts) {
      walletNumber = generateWalletNumber();
      const existingWallet = await User.findOne({ walletNumber });
      if (!existingWallet) isUnique = true;
      attempts++;
    }
    if (!isUnique) {
      return res.status(400).json({ error: 'Unable to generate unique wallet number. Please try again.' });
    }
   
    const hashedPassword = await bcrypt.hash(password, 10);
   
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;
   
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      bio: bio ? bio.trim() : '',
      avatar: avatar ? avatar.trim() : '',
      walletNumber,
      balance: 0,
      isAdmin: isFirstUser
    });
   
    await user.save();
   
    req.session.userId = user._id;
   
    res.json({
      success: true,
      message: isFirstUser ? 'Registration successful! You are now the admin.' : 'Registration successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        walletNumber: user.walletNumber,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === 'username') {
        return res.status(400).json({ error: 'Username already exists' });
      } else if (field === 'walletNumber') {
        return res.status(400).json({ error: 'Wallet number conflict. Please try again.' });
      } else {
        return res.status(400).json({ error: 'Duplicate field error' });
      }
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation failed: ' + Object.values(error.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});
// Login (o'zgarmadi)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
   
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
   
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
   
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
   
    req.session.userId = user._id;
   
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        walletNumber: user.walletNumber,
        balance: user.balance,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
// Logout (o'zgarmadi)
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout successful' });
});
// Get current user (o'zgarmadi)
app.get('/api/user', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user data' });
  }
});
// Update user profile (o'zgarmadi)
app.put('/api/user', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, bio, avatar, socialLinks } = req.body;
   
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (bio !== undefined) updateData.bio = bio ? bio.trim() : '';
    if (avatar !== undefined) updateData.avatar = avatar ? avatar.trim() : '';
    if (socialLinks) updateData.socialLinks = socialLinks;
   
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      updateData,
      { new: true }
    ).select('-password');
   
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Update failed due to duplicate value' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
// Get user by wallet number (o'zgarmadi)
app.get('/api/user/wallet/:walletNumber', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ walletNumber: req.params.walletNumber })
      .select('firstName lastName avatar walletNumber');
   
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
   
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});
// Create transaction (transfer) (o'zgarmadi)
app.post('/api/transaction', requireAuth, async (req, res) => {
  try {
    const { toWallet, amount, description } = req.body;
   
    if (!toWallet || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid transaction details' });
    }
   
    const fromUser = await User.findById(req.session.userId);
    if (fromUser.isFrozen) {
      return res.status(400).json({ error: 'Your account is frozen' });
    }
   
    if (fromUser.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
   
    const toUser = await User.findOne({ walletNumber: toWallet });
    if (!toUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
   
    if (toUser._id.toString() === fromUser._id.toString()) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }
   
    const transaction = new Transaction({
      fromUser: fromUser._id,
      toUser: toUser._id,
      amount,
      type: 'transfer',
      description: description ? description.trim() : '',
      status: 'pending'
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Transaction created successfully', transaction });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});
// Create deposit request (kengaytirildi: paymentMethod va externalDetails qo'shildi)
app.post('/api/deposit', requireAuth, upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, paymentMethod, externalDetails } = req.body;
   
    if (!amount || amount <= 0 || !paymentMethod || !externalDetails) {
      return res.status(400).json({ error: 'Amount, payment method, and account details are required' });
    }
   
    const screenshot = req.file ? `/uploads/${req.file.filename}` : '';
   
    const transaction = new Transaction({
      fromUser: null,
      toUser: req.session.userId,
      amount: parseFloat(amount),
      type: 'deposit',
      paymentMethod,
      externalDetails: externalDetails.trim(),
      screenshot,
      status: 'pending'
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Deposit request submitted', transaction });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Deposit request failed' });
  }
});
// Create withdrawal request (yangi: withdrawal uchun)
app.post('/api/withdrawal', requireAuth, upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, paymentMethod, externalDetails } = req.body;
   
    if (!amount || amount <= 0 || !paymentMethod || !externalDetails) {
      return res.status(400).json({ error: 'Amount, payment method, and account details are required' });
    }
   
    const user = await User.findById(req.session.userId);
    if (user.isFrozen) {
      return res.status(400).json({ error: 'Your account is frozen' });
    }
   
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
   
    const screenshot = req.file ? `/uploads/${req.file.filename}` : '';
   
    const transaction = new Transaction({
      fromUser: req.session.userId,
      toUser: null,
      amount: parseFloat(amount),
      type: 'withdrawal',
      paymentMethod,
      externalDetails: externalDetails.trim(),
      screenshot,
      status: 'pending'
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Withdrawal request submitted', transaction });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Withdrawal request failed' });
  }
});
// Get user transactions (o'zgarmadi, populate ga paymentMethod qo'shish mumkin, lekin hozircha o'zgarmadi)
app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { fromUser: req.session.userId },
        { toUser: req.session.userId }
      ]
    })
    .populate('fromUser', 'firstName lastName walletNumber')
    .populate('toUser', 'firstName lastName walletNumber')
    .sort({ createdAt: -1 });
   
    res.json(transactions);
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});
// Get HAQ value (o'zgarmadi)
app.get('/api/haq-value', async (req, res) => {
  try {
    const haqValue = await HaqValue.findOne().sort({ updatedAt: -1 });
    res.json(haqValue || { value: 1, change: 0 });
  } catch (error) {
    console.error('HAQ value error:', error);
    res.status(500).json({ error: 'Failed to get HAQ value' });
  }
});
// Get conversion rates (yangi)
app.get('/api/conversions', async (req, res) => {
  try {
    const rates = await ConversionRate.find().sort({ currency: 1 });
    res.json(rates);
  } catch (error) {
    console.error('Conversion rates error:', error);
    res.status(500).json({ error: 'Failed to get conversion rates' });
  }
});
// Update HAQ value (admin only) (o'zgarmadi)
app.put('/api/haq-value', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { value, change } = req.body;
   
    if (!value || value < 0) {
      return res.status(400).json({ error: 'Invalid HAQ value' });
    }
   
    const haqValue = new HaqValue({
      value,
      change: change || 0
    });
   
    await haqValue.save();
   
    res.json({ success: true, haqValue });
  } catch (error) {
    console.error('HAQ update error:', error);
    res.status(500).json({ error: 'Failed to update HAQ value' });
  }
});
// Update or add conversion rate (admin only, yangi)
app.post('/api/admin/conversions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { currency, rate } = req.body;
   
    if (!currency || rate === undefined || rate < 0) {
      return res.status(400).json({ error: 'Currency and valid rate are required' });
    }
   
    let conversion = await ConversionRate.findOne({ currency: currency.toUpperCase() });
    if (conversion) {
      conversion.rate = rate;
      conversion.updatedAt = new Date();
      await conversion.save();
    } else {
      conversion = new ConversionRate({
        currency: currency.toUpperCase(),
        rate
      });
      await conversion.save();
    }
   
    res.json({ success: true, conversion });
  } catch (error) {
    console.error('Conversion update error:', error);
    res.status(500).json({ error: 'Failed to update conversion rate' });
  }
});
// Admin routes (o'zgarmadi, lekin transaction populate ga paymentMethod qo'shish mumkin)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});
app.get('/api/admin/transactions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('fromUser', 'firstName lastName username walletNumber')
      .populate('toUser', 'firstName lastName username walletNumber')
      .sort({ createdAt: -1 });
   
    res.json(transactions);
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});
// Mavjud `/api/admin/transaction/:id` ni yangilang (faqat if qo'shing)
app.put('/api/admin/transaction/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
   
    const transaction = await Transaction.findById(req.params.id)
      .populate('fromUser', 'firstName lastName username walletNumber')
      .populate('toUser', 'firstName lastName username walletNumber');
   
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
   
    const wasPending = transaction.status === 'pending';
    transaction.status = status;
    await transaction.save();
   
    if (status === 'approved' && wasPending) {
      if (transaction.type === 'deposit') {
        await User.findByIdAndUpdate(transaction.toUser, {
          $inc: { balance: transaction.amount }
        });
      } else if (transaction.type === 'withdrawal') {
        await User.findByIdAndUpdate(transaction.fromUser, {
          $inc: { balance: -transaction.amount }
        });
      } else if (transaction.type === 'transfer') {
        // Yangi: Agar NewEra transfer bo'lsa
        if (transaction.description && transaction.description.includes('newera')) {
          const neweraUsername = transaction.description.split('newera:')[1]?.trim(); // Description da saqlangan username
          if (neweraUsername) {
            try {
              // NewEra ga API call
              const response = await fetch(`http://localhost:5000/api/user/${neweraUsername}/add-balance`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer wallet-api-key' // Token
                },
                body: JSON.stringify({
                  amount: transaction.amount,
                  fromWalletUser: {
                    username: transaction.fromUser.username,
                    walletNumber: transaction.fromUser.walletNumber
                  }
                })
              });
              if (!response.ok) {
                throw new Error('NewEra API error');
              }
              const neweraData = await response.json();
              console.log('NewEra transfer successful:', neweraData);
            } catch (apiError) {
              console.error('NewEra integration error:', apiError);
              // Rollback: Balansni qaytarish
              await User.findByIdAndUpdate(transaction.fromUser, { $inc: { balance: transaction.amount } });
              return res.status(500).json({ error: 'Transfer to NewEra failed, rolled back' });
            }
          }
        } else {
          // Oddiy transfer
          await User.findByIdAndUpdate(transaction.fromUser, {
            $inc: { balance: -transaction.amount }
          });
          await User.findByIdAndUpdate(transaction.toUser, {
            $inc: { balance: transaction.amount }
          });
        }
      }
    }
   
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Transaction update error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Yangi: Transfer endpointida NewEra ni qo'llab-quvvatlash (mavjud /api/transaction ni yangilang)
app.post('/api/transaction', requireAuth, async (req, res) => {
  try {
    let { toWallet, amount, description, neweraUsername } = req.body; // Yangi: neweraUsername qo'shildi
   
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
   
    const fromUser = await User.findById(req.session.userId);
    if (fromUser.isFrozen) {
      return res.status(400).json({ error: 'Your account is frozen' });
    }
   
    if (fromUser.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
   
    let type = 'transfer';
    let toUser = null;
   
    if (neweraUsername) {
      // NewEra transfer
      if (!neweraUsername) {
        return res.status(400).json({ error: 'NewEra username required' });
      }
      // Profilni tekshirish (optional, frontend da qilingan)
      type = 'transfer'; // Pending qoladi
      description = `newera:${neweraUsername} ${description || ''}`; // Username ni description da saqlash
    } else {
      // Oddiy transfer
      if (!toWallet) {
        return res.status(400).json({ error: 'Recipient wallet required' });
      }
      toUser = await User.findOne({ walletNumber: toWallet });
      if (!toUser) {
        return res.status(404).json({ error: 'Recipient not found' });
      }
      if (toUser._id.toString() === fromUser._id.toString()) {
        return res.status(400).json({ error: 'Cannot transfer to yourself' });
      }
    }
   
    const transaction = new Transaction({
      fromUser: fromUser._id,
      toUser: toUser?._id,
      amount,
      type,
      description: description ? description.trim() : '',
      status: 'pending'
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Transaction created successfully', transaction });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});
app.put('/api/admin/user/:id/balance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { balance } = req.body;
    if (balance === undefined || balance < 0) {
      return res.status(400).json({ error: 'Invalid balance' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { balance },
      { new: true }
    ).select('-password');
   
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
   
    res.json({ success: true, user });
  } catch (error) {
    console.error('Balance update error:', error);
    res.status(500).json({ error: 'Failed to update user balance' });
  }
});
app.put('/api/admin/user/:id/freeze', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
   
    user.isFrozen = !user.isFrozen;
    await user.save();
   
    res.json({ success: true, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error('Freeze update error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});
app.get('/api/admin/statistics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'weekly';
   
    let startDate;
    const endDate = new Date();
   
    switch (period) {
      case 'weekly':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
    }
   
    // Kengaytirilgan statistika: har xil turlarni ajratish
    const [deposits, withdrawals, transfers] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'transfer', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ])
    ]);

    const depositCount = deposits[0] ? deposits[0].count : 0;
    const depositAmount = deposits[0] ? deposits[0].amount : 0;
    const withdrawalCount = withdrawals[0] ? withdrawals[0].count : 0;
    const withdrawalAmount = withdrawals[0] ? withdrawals[0].amount : 0;
    const transferCount = transfers[0] ? transfers[0].count : 0;
    const transferAmount = transfers[0] ? transfers[0].amount : 0;
   
    const totalAmount = depositAmount + transferAmount - withdrawalAmount; // Net amount
    const transactionCount = depositCount + withdrawalCount + transferCount;
   
    const topUsers = await User.find()
      .sort({ balance: -1 })
      .limit(3)
      .select('firstName lastName walletNumber balance');
   
    const totalBalanceResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    const totalBalance = totalBalanceResult.length > 0 ? totalBalanceResult[0].total : 0;
   
    const totalUsers = await User.countDocuments();
   
    res.json({
      period,
      totalAmount,
      transactionCount,
      depositCount,
      depositAmount,
      withdrawalCount,
      withdrawalAmount,
      transferCount,
      transferAmount,
      topUsers,
      totalBalance,
      totalUsers
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});
// Create admin user (o'zgarmadi)
async function createAdminUser() {
  try {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      let walletNumber;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      while (!isUnique && attempts < maxAttempts) {
        walletNumber = generateWalletNumber();
        const existingWallet = await User.findOne({ walletNumber });
        if (!existingWallet) isUnique = true;
        attempts++;
      }
      if (!isUnique) {
        console.error('Failed to generate unique wallet for admin');
        return;
      }
     
      const adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin',
        password: hashedPassword,
        walletNumber,
        balance: 0,
        isAdmin: true
      });
     
      await adminUser.save();
      console.log('Admin user created: username=admin, password=admin123');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}
// Initialize HAQ value va default conversion rates (yangi: default rates qo'shildi)
async function initializeHaqValue() {
  try {
    const haqValueExists = await HaqValue.findOne();
    if (!haqValueExists) {
      const haqValue = new HaqValue({
        value: 1,
        change: 0
      });
     
      await haqValue.save();
      console.log('Initial HAQ value set to 1');
    }
  } catch (error) {
    console.error('Error initializing HAQ value:', error);
  }
 
  // Default conversion rates (agar yo'q bo'lsa)
  const defaultRates = [
    { currency: 'UZS', rate: 1200 },
    { currency: 'USD', rate: 0.1 },
    { currency: 'EUR', rate: 0.09 }
  ];
 
  for (const rate of defaultRates) {
    const existing = await ConversionRate.findOne({ currency: rate.currency });
    if (!existing) {
      const conversion = new ConversionRate(rate);
      await conversion.save();
      console.log(`Default conversion rate set: 1 HAQ = ${rate.rate} ${rate.currency}`);
    }
  }
}
// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await createAdminUser();
  await initializeHaqValue();
});