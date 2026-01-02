// Updated wallet server.js with NFT marketplace, H-coin supply limit, Cloudinary integration, admin payment methods, auto-transfer with 1% fee
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const app = express();
const PORT = process.env.PORT || 3000;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm'],
    folder: (req, file, cb) => {
      let folderName;
      if (file.fieldname === 'avatar') {
        folderName = 'hcoin/avatars';
      } else if (file.fieldname === 'image') {
        folderName = 'hcoin/nfts';
      } else if (file.fieldname === 'screenshot') {
        folderName = 'hcoin/screenshots';
      } else {
        folderName = 'hcoin';
      }
      cb(null, folderName);
    }
  }
});
const upload = multer({ storage: storage });

// MongoDB Connection
mongoose.connect('mongodb+srv://apl:apl00@gamepaymentbot.ffcsj5v.mongodb.net/haq1?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// User Schema (paymentMethods for admin qo'shildi)
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
  hcoinBalance: { type: Number, default: 0 }, // H-coin balans
  uzsBalance: { type: Number, default: 0 }, // UZS balans (trade uchun)
  paymentMethods: { type: Object, default: {} }, // Admin uchun: { payeer: {account: ''}, paypal: {email: ''}, ... }
  isFrozen: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Transaction Schema (type ga 'buy_hcoin', 'sell_hcoin', 'nft_create', 'nft_buy', 'nft_sell' qo'shildi; pendingData qo'shildi)
const transactionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['transfer', 'deposit', 'withdrawal', 'buy_hcoin', 'sell_hcoin', 'nft_create', 'nft_buy', 'nft_sell'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  screenshot: { type: String, default: '' },
  description: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['card', 'payeer', 'paypal', 'btc', 'eth', 'usdt', 'uzcard'], default: 'card' },
  externalDetails: { type: String, default: '' },
  priceAtTime: { type: Number, default: 0 }, // Trade vaqtida narx
  fee: { type: Number, default: 0 }, // Komissiya
  nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT' }, // NFT uchun
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }, // Listing uchun
  pendingData: { type: mongoose.Schema.Types.Mixed, default: {} }, // Pending NFT creation data
  createdAt: { type: Date, default: Date.now }
});

// H-coin Value Schema
const hcoinValueSchema = new mongoose.Schema({
  value: { type: Number, required: true }, // 1 H-coin = value UZS
  change: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// Price History Schema
const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Conversion Rates Schema
const conversionRateSchema = new mongoose.Schema({
  currency: { type: String, required: true, unique: true },
  rate: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

// NFT Schema (yangi)
const nftSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Media URL (image/video)
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, default: 'general' }, // Filter uchun (art, collectible, etc.)
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' }, // Filter uchun
  createdAt: { type: Date, default: Date.now }
});

// NFT Listing Schema (yangi: sotuvga chiqarish)
const listingSchema = new mongoose.Schema({
  nft: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true }, // H-coin da
  status: { type: String, enum: ['active', 'sold', 'cancelled'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const HcoinValue = mongoose.model('HcoinValue', hcoinValueSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);
const ConversionRate = mongoose.model('ConversionRate', conversionRateSchema);
const NFT = mongoose.model('NFT', nftSchema);
const Listing = mongoose.model('Listing', listingSchema);

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

// Generate unique wallet number
function generateWalletNumber() {
  const prefix = 'H';
  const numbers = '0123456789';
  let result = prefix;
  for (let i = 0; i < 15; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return result;
}

// Get admin user (supply uchun)
async function getAdminUser() {
  return await User.findOne({ isAdmin: true });
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
    req.session.isAdmin = user.isAdmin; // Set in session
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Dynamic H-coin price update (har 15 daqiqada)
async function updateHcoinPrice() {
  const minPrice = 30;
  const maxPrice = 60;
  const newPrice = Math.random() * (maxPrice - minPrice) + minPrice;
  const latest = await HcoinValue.findOne().sort({ updatedAt: -1 });
  const change = ((newPrice - latest.value) / latest.value) * 100;
  const hcoinValue = new HcoinValue({ value: newPrice, change });
  await hcoinValue.save();
  const history = new PriceHistory({ price: newPrice });
  await history.save();
  console.log(`H-coin price updated to ${newPrice} UZS (change: ${change.toFixed(2)}%)`);
}
setInterval(updateHcoinPrice, 15000); // 15 soniya

// Routes
// Register (hcoinBalance va uzsBalance qo'shildi)
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
      hcoinBalance: 0,
      uzsBalance: 0,
      isAdmin: isFirstUser
    });
   
    await user.save();
   
    req.session.userId = user._id;
    req.session.isAdmin = user.isAdmin;
   
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

// Login (hcoinBalance ko'rsatish)
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
    req.session.isAdmin = user.isAdmin;
   
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        walletNumber: user.walletNumber,
        hcoinBalance: user.hcoinBalance,
        uzsBalance: user.uzsBalance,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout successful' });
});

// Get current user (hcoinBalance va uzsBalance)
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

// Get user by ID (for profile viewing, own or admin)
app.get('/api/user/:id', requireAuth, async (req, res) => {
  try {
    const sessionUser = await User.findById(req.session.userId).select('isAdmin');
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user._id.toString() !== req.session.userId.toString() && !sessionUser.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Get user by wallet number (transfer uchun: avatar, name, username, bio)
app.get('/api/user/wallet/:walletNumber', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ walletNumber: req.params.walletNumber })
      .select('firstName lastName avatar username bio walletNumber hcoinBalance');
   
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
   
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile (multipart for avatar upload)
app.put('/api/user', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { firstName, lastName, bio, facebook, twitter, instagram } = req.body;
   
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (bio !== undefined) updateData.bio = bio ? bio.trim() : '';
    if (req.file) updateData.avatar = req.file.path; // Cloudinary URL
    if (facebook || twitter || instagram) {
      updateData.socialLinks = {
        facebook: facebook || '',
        twitter: twitter || '',
        instagram: instagram || ''
      };
    }
   
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      updateData,
      { new: true }
    ).select('-password');
   
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get admin payment details by method (deposit uchun)
app.get('/api/admin/payment/:method', requireAuth, async (req, res) => {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    const method = req.params.method.toLowerCase();
    const details = admin.paymentMethods[method] || {};
    res.json({ method, details });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get payment details' });
  }
});

// Get admin H-coin reserve (trade.html uchun)
app.get('/api/admin/reserve', requireAdmin, async (req, res) => {
  try {
    const admin = await getAdminUser();
    res.json({ reserve: admin ? admin.hcoinBalance : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get reserve' });
  }
});

// Create NFT (pending approval, 5 H-coin fee on approval)
app.post('/api/nft/create', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, category, rarity } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image/Video required' });
    }
    const admin = await getAdminUser();
    if (!admin) {
      return res.status(500).json({ error: 'Admin not found' });
    }
    // Create pending transaction
    const transaction = new Transaction({
      fromUser: user._id,
      toUser: admin._id,
      amount: 5,
      type: 'nft_create',
      status: 'pending',
      pendingData: {
        name,
        description,
        category: category || 'general',
        rarity: rarity || 'common',
        image: req.file.path // Cloudinary URL
      },
      description: `Pending NFT creation: ${name}`,
      fee: 5
    });
    await transaction.save();
    res.json({ success: true, message: 'NFT creation request submitted for approval', transaction });
  } catch (error) {
    console.error('NFT creation error:', error);
    res.status(500).json({ error: 'Failed to submit NFT creation request' });
  }
});

// Get NFT listing by ID
app.get('/api/nft/listing/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate({
      path: 'nft',
      populate: { path: 'creator', select: 'firstName lastName username' }
    }).populate('seller', 'firstName lastName username');
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

// List NFT for sale - FIXED: Check for existing active listing; better error handling
app.post('/api/nft/list/:nftId', requireAuth, async (req, res) => {
  try {
    const { price } = req.body;
    if (!price || parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const nft = await NFT.findById(req.params.nftId).populate('owner');
    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }
    if (nft.owner._id.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'NFT not owned by you' });
    }
    
    // FIXED: Prevent multiple listings
    const existingListing = await Listing.findOne({ 
      nft: nft._id, 
      status: 'active' 
    });
    if (existingListing) {
      return res.status(400).json({ error: 'NFT is already listed for sale. Unlist first.' });
    }
    
    const listing = new Listing({
      nft: nft._id,
      seller: user._id,
      price: parseFloat(price)
    });
    await listing.save();
    
    // Set owner to null while listed
    nft.owner = null;
    await nft.save();
    
    res.json({ success: true, listing });
  } catch (error) {
    console.error('Listing error:', error);
    res.status(500).json({ error: 'Failed to list NFT: ' + error.message });
  }
});

// Buy NFT (5% fee to admin) - FIXED: Added nft_sell transaction for seller
app.post('/api/nft/buy/:listingId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const listing = await Listing.findById(req.params.listingId).populate('nft seller');
    if (!listing || listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing not available' });
    }
    
    if (user.hcoinBalance < listing.price) {
      return res.status(400).json({ error: 'Insufficient H-coin' });
    }
    
    const admin = await getAdminUser();
    if (!admin) {
      return res.status(500).json({ error: 'Admin not found' });
    }
    
    const fee = listing.price * 0.05;
    const netPrice = listing.price - fee;
    
    // Transfer H-coin: buyer pays full, seller gets net, admin gets fee
    user.hcoinBalance -= listing.price;
    listing.seller.hcoinBalance += netPrice;
    admin.hcoinBalance += fee;
    
    // Update ownership to buyer
    listing.nft.owner = user._id;
    listing.status = 'sold';
    
    // Save changes
    await Promise.all([
      user.save(),
      listing.seller.save(),
      admin.save(),
      listing.save(),
      listing.nft.save()
    ]);
    
    // FIXED: Create nft_buy for buyer and nft_sell for seller
    const buyTransaction = new Transaction({
      fromUser: user._id,
      toUser: listing.seller._id,
      amount: listing.price,
      type: 'nft_buy',
      status: 'approved',
      listingId: listing._id,
      nftId: listing.nft._id,
      fee,
      description: `Bought NFT: ${listing.nft.name} for ${listing.price} H-Coin`
    });
    
    const sellTransaction = new Transaction({
      fromUser: listing.seller._id,
      toUser: user._id,
      amount: netPrice,
      type: 'nft_sell',
      status: 'approved',
      listingId: listing._id,
      nftId: listing.nft._id,
      fee,
      description: `Sold NFT: ${listing.nft.name} for ${netPrice.toFixed(2)} H-Coin (fee: ${fee.toFixed(2)})`
    });
    
    await Promise.all([buyTransaction.save(), sellTransaction.save()]);
    
    res.json({ success: true, nft: listing.nft });
  } catch (error) {
    console.error('NFT buy error:', error);
    res.status(500).json({ error: 'Failed to buy NFT: ' + error.message });
  }
});

// Get marketplace NFTs (search, filter) - FIXED: Removed invalid 'owner: null' query; added sort and creator populate
app.get('/api/nft/marketplace', async (req, res) => {
  try {
    const { search, category, rarity, sort = 'newest', limit = 20, page = 1 } = req.query;
    let sortObj;
    if (sort === 'price_asc') {
      sortObj = { 'price': 1 };
    } else if (sort === 'price_desc') {
      sortObj = { 'price': -1 };
    } else {
      sortObj = { 'createdAt': -1 };
    }
    // No query on Listing; filter via populate if needed, but status 'active' suffices
    const listings = await Listing.find({ status: 'active' })
      .populate({
        path: 'nft',
        match: { 
          ...(search && { name: { $regex: search, $options: 'i' } }),
          ...(category && { category }),
          ...(rarity && { rarity })
        },
        populate: {
          path: 'creator',
          select: 'firstName lastName username'
        }
      })
      .populate('seller', 'firstName lastName username')
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .sort(sortObj);
    
    // Filter out listings where nft didn't match (populate match filters)
    const filteredListings = listings.filter(l => l.nft);
    
    const total = await Listing.aggregate([
      { $lookup: { from: 'nfts', localField: 'nft', foreignField: '_id', as: 'nft' } },
      { $match: { 
        status: 'active',
        ...(search && { 'nft.name': { $regex: search, $options: 'i' } }),
        ...(category && { 'nft.category': category }),
        ...(rarity && { 'nft.rarity': rarity })
      } },
      { $count: 'total' }
    ]);
    
    const totalCount = total[0] ? total[0].total : 0;
    res.json({ 
      listings: filteredListings, 
      total: totalCount, 
      pages: Math.ceil(totalCount / parseInt(limit)) 
    });
  } catch (error) {
    console.error('Marketplace error:', error);
    res.status(500).json({ error: 'Failed to load marketplace' });
  }
});

// Get user's NFTs - FIXED: Include owned and listed NFTs; added activeListing populate for each NFT
app.get('/api/nft/user/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.session.userId : req.params.userId;
    if (userId !== req.session.userId.toString() && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get active listings by user
    const activeListings = await Listing.find({ seller: userId, status: 'active' }).populate('seller', 'username');
    const listedNftIds = activeListings.map(l => l.nft.toString());

    // Get owned NFTs (not listed)
    const ownedNfts = await NFT.find({ 
      owner: userId, 
      _id: { $nin: listedNftIds } 
    }).populate('creator', 'firstName lastName username');

    // Get listed NFTs
    const listedNfts = await NFT.find({ 
      _id: { $in: listedNftIds } 
    }).populate('creator', 'firstName lastName username');

    // Combine and dedupe (no overlap)
    const allNfts = [...ownedNfts, ...listedNfts];

    // Add activeListing to each NFT
    const nftsWithListings = await Promise.all(allNfts.map(async (nft) => {
      const activeListing = activeListings.find(l => l.nft.toString() === nft._id.toString());
      return {
        ...nft.toObject(),
        activeListing: activeListing ? {
          _id: activeListing._id,
          price: activeListing.price,
          seller: activeListing.seller
        } : null
      };
    }));
    
    res.json(nftsWithListings);
  } catch (error) {
    console.error('Failed to load user NFTs:', error);
    res.status(500).json({ error: 'Failed to load NFTs' });
  }
});

// Cancel listing - FIXED: Better error handling
app.delete('/api/nft/list/:listingId', requireAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.listingId).populate('nft');
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const user = await User.findById(req.session.userId);
    if (!user || listing.seller.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Not the seller' });
    }
    
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing not active' });
    }
    
    // Cancel listing and return ownership
    listing.status = 'cancelled';
    listing.nft.owner = user._id;
    
    await Promise.all([listing.save(), listing.nft.save()]);
    
    res.json({ success: true, message: 'Listing cancelled' });
  } catch (error) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ error: 'Failed to cancel listing: ' + error.message });
  }
});

// Admin NFT endpoints (unchanged, but for completeness)
app.get('/api/admin/nfts', requireAdmin, async (req, res) => {
  try {
    const nfts = await NFT.find().populate('owner creator', 'firstName lastName username');
    res.json(nfts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load NFTs' });
  }
});

app.get('/api/admin/listings', requireAdmin, async (req, res) => {
  try {
    const listings = await Listing.find({ status: 'active' }).populate('nft seller', 'firstName lastName username');
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load listings' });
  }
});

// Create transaction (transfer: internal auto-approved with 1% fee, NewEra pending)
app.post('/api/transaction', requireAuth, async (req, res) => {
  try {
    let { toWallet, amount, description, neweraUsername } = req.body;
   
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
   
    const fromUser = await User.findById(req.session.userId);
    if (fromUser.isFrozen) {
      return res.status(400).json({ error: 'Your account is frozen' });
    }
   
    if (fromUser.hcoinBalance < amount) {
      return res.status(400).json({ error: 'Insufficient H-coin balance' });
    }
   
    let type = 'transfer';
    let toUser = null;
    let status = 'pending';
    let fee = 0;
   
    if (neweraUsername) {
      if (!neweraUsername) {
        return res.status(400).json({ error: 'NewEra username required' });
      }
      type = 'transfer';
      description = `newera:${neweraUsername} ${description || ''}`;
      status = 'pending'; // NewEra pending
    } else {
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
      // Internal transfer: auto-approve with 1% fee to admin
      const admin = await getAdminUser();
      fee = amount * 0.01;
      const netAmount = amount - fee;
      if (fromUser.hcoinBalance < amount) {
        return res.status(400).json({ error: 'Insufficient balance after fee' });
      }
      // Deduct from sender
      fromUser.hcoinBalance -= amount;
      // Add net to recipient
      toUser.hcoinBalance += netAmount;
      // Add fee to admin
      admin.hcoinBalance += fee;
      await fromUser.save();
      await toUser.save();
      await admin.save();
      status = 'approved';
    }
   
    const transaction = new Transaction({
      fromUser: fromUser._id,
      toUser: toUser?._id,
      amount: neweraUsername ? amount : netAmount, // Net for internal
      type,
      description: description ? description.trim() : '',
      status,
      fee
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Transfer successful', transaction });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

// Deposit (UZS deposit, H-coin ga konvertatsiya, admin supply dan chiqariladi)
app.post('/api/deposit', requireAuth, upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, paymentMethod, externalDetails } = req.body; // amount UZS
   
    if (!amount || amount <= 5000 || !paymentMethod || !externalDetails) {
      return res.status(400).json({ error: 'Amount, payment method, and account details are required, minimal deposit is 5.000uzs' });
    }
   
    const currentPrice = await HcoinValue.findOne().sort({ updatedAt: -1 });
    const hcoinAmount = parseFloat(amount) / currentPrice.value;
    const admin = await getAdminUser();
    if (admin.hcoinBalance < hcoinAmount) {
      return res.status(400).json({ error: 'Insufficient reserve supply' });
    }
   
    const screenshot = req.file ? req.file.path : '';
   
    const transaction = new Transaction({
      fromUser: null,
      toUser: req.session.userId,
      amount: hcoinAmount,
      type: 'deposit',
      paymentMethod,
      externalDetails: externalDetails.trim(),
      screenshot,
      priceAtTime: currentPrice.value,
      status: 'pending',
      description: `UZS ${amount} deposited, converted to ${hcoinAmount.toFixed(2)} H-coin at ${currentPrice.value} UZS/H-coin`
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Deposit request submitted', transaction });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Deposit request failed' });
  }
});

// Withdrawal (H-coin ni UZS ga konvertatsiya, admin supply ga qaytariladi)
app.post('/api/withdrawal', requireAuth, upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, paymentMethod, externalDetails } = req.body; // amount H-coin
   
    if (!amount || amount <= 30000 || !paymentMethod || !externalDetails) {
      return res.status(400).json({ error: 'Amount, payment method, and account details are required, minimal withdraw is 30.000uzs' });
    }
   
    const user = await User.findById(req.session.userId);
    if (user.isFrozen) {
      return res.status(400).json({ error: 'Your account is frozen' });
    }
   
    if (user.hcoinBalance < amount) {
      return res.status(400).json({ error: 'Insufficient H-coin balance' });
    }
   
    const currentPrice = await HcoinValue.findOne().sort({ updatedAt: -1 });
    const uzsAmount = amount * currentPrice.value;
   
    const screenshot = req.file ? req.file.path : '';
   
    const transaction = new Transaction({
      fromUser: req.session.userId,
      toUser: null,
      amount,
      type: 'withdrawal',
      paymentMethod,
      externalDetails: externalDetails.trim(),
      screenshot,
      priceAtTime: currentPrice.value,
      status: 'pending',
      description: `${amount} H-coin withdrawn, converted to ${uzsAmount.toFixed(0)} UZS at ${currentPrice.value} UZS/H-coin`
    });
   
    await transaction.save();
   
    res.json({ success: true, message: 'Withdrawal request submitted', transaction });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Withdrawal request failed' });
  }
});

// Buy H-coin (UZS bilan sotib olish, 1% fee, admin supply dan chiqariladi)
app.post('/api/trade/buy', requireAuth, async (req, res) => {
  try {
    const { uzsAmount } = req.body;
    if (!uzsAmount || uzsAmount <= 0) {
      return res.status(400).json({ error: 'Invalid UZS amount' });
    }
    const user = await User.findById(req.session.userId);
    if (user.uzsBalance < uzsAmount) {
      return res.status(400).json({ error: 'Insufficient UZS balance' });
    }
    const admin = await getAdminUser();
    const currentPrice = await HcoinValue.findOne().sort({ updatedAt: -1 });
    const fee = uzsAmount * 0.01; // 1% fee admin uchun
    const netUzs = uzsAmount - fee;
    const hcoinAmount = netUzs / currentPrice.value;
    if (admin.hcoinBalance < hcoinAmount) {
      return res.status(400).json({ error: 'Insufficient reserve supply' });
    }
    // Transfer from admin supply
    user.uzsBalance -= uzsAmount;
    admin.hcoinBalance -= hcoinAmount;
    user.hcoinBalance += hcoinAmount;
    admin.uzsBalance += fee; // Fee UZS da
    await user.save();
    await admin.save();
    const transaction = new Transaction({
      fromUser: req.session.userId,
      toUser: null,
      amount: hcoinAmount,
      type: 'buy_hcoin',
      status: 'approved',
      priceAtTime: currentPrice.value,
      fee,
      description: `Bought ${hcoinAmount.toFixed(4)} H-coin for ${uzsAmount} UZS (fee: ${fee.toFixed(2)})`
    });
    await transaction.save();
    res.json({ success: true, hcoinAmount, remainingUzs: user.uzsBalance });
  } catch (error) {
    res.status(500).json({ error: 'Buy failed' });
  }
});

// Sell H-coin (H-coin ni UZS ga sotish, 1% fee, admin supply ga qaytariladi)
app.post('/api/trade/sell', requireAuth, async (req, res) => {
  try {
    const { hcoinAmount } = req.body;
    if (!hcoinAmount || hcoinAmount <= 0) {
      return res.status(400).json({ error: 'Invalid H-coin amount' });
    }
    const user = await User.findById(req.session.userId);
    if (user.hcoinBalance < hcoinAmount) {
      return res.status(400).json({ error: 'Insufficient H-coin balance' });
    }
    const admin = await getAdminUser();
    const currentPrice = await HcoinValue.findOne().sort({ updatedAt: -1 });
    const uzsAmount = hcoinAmount * currentPrice.value;
    const fee = uzsAmount * 0.01; // 1% fee
    const netUzs = uzsAmount - fee;
    // Transfer to admin supply
    user.hcoinBalance -= hcoinAmount;
    admin.hcoinBalance += hcoinAmount;
    user.uzsBalance += netUzs;
    admin.uzsBalance += fee;
    await user.save();
    await admin.save();
    const transaction = new Transaction({
      fromUser: req.session.userId,
      toUser: null,
      amount: hcoinAmount,
      type: 'sell_hcoin',
      status: 'approved',
      priceAtTime: currentPrice.value,
      fee,
      description: `Sold ${hcoinAmount.toFixed(4)} H-coin for ${uzsAmount} UZS (fee: ${fee.toFixed(2)}, net: ${netUzs.toFixed(2)})`
    });
    await transaction.save();
    res.json({ success: true, uzsAmount: netUzs, remainingHcoin: user.hcoinBalance });
  } catch (error) {
    res.status(500).json({ error: 'Sell failed' });
  }
});

// Get user transactions (NFT types qo'shildi)
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
    .populate('nftId', 'name image')
    .populate('listingId', 'price')
    .sort({ createdAt: -1 });
   
    res.json(transactions);
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Get H-coin value
app.get('/api/hcoin-value', async (req, res) => {
  try {
    const hcoinValue = await HcoinValue.findOne().sort({ updatedAt: -1 });
    res.json(hcoinValue || { value: 1000, change: 0 }); // Default 1000 UZS
  } catch (error) {
    console.error('H-coin value error:', error);
    res.status(500).json({ error: 'Failed to get H-coin value' });
  }
});

// Get price history
app.get('/api/price-history', async (req, res) => {
  try {
    const history = await PriceHistory.find().sort({ timestamp: -1 }).limit(50);
    res.json(history.reverse()); // Eski dan yangi gacha
  } catch (error) {
    res.status(500).json({ error: 'Failed to get price history' });
  }
});

// Get conversion rates
app.get('/api/conversions', async (req, res) => {
  try {
    const rates = await ConversionRate.find().sort({ currency: 1 });
    res.json(rates);
  } catch (error) {
    console.error('Conversion rates error:', error);
    res.status(500).json({ error: 'Failed to get conversion rates' });
  }
});

// Update H-coin value (admin only)
app.put('/api/hcoin-value', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { value, change } = req.body;
   
    if (!value || value < 0) {
      return res.status(400).json({ error: 'Invalid H-coin value' });
    }
   
    const hcoinValue = new HcoinValue({
      value,
      change: change || 0
    });
   
    await hcoinValue.save();
    const history = new PriceHistory({ price: value });
    await history.save();
   
    res.json({ success: true, hcoinValue });
  } catch (error) {
    console.error('H-coin update error:', error);
    res.status(500).json({ error: 'Failed to update H-coin value' });
  }
});

// Update or add conversion rate (admin only)
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

// Admin routes
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
      .populate('nftId', 'name')
      .populate('listingId', 'price')
      .sort({ createdAt: -1 });
   
    res.json(transactions);
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Admin transaction update (NewEra integration va H-coin handling, NFT ga ham qo'llaniladi; nft_create uchun)
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
        const admin = await getAdminUser();
        if (admin.hcoinBalance < transaction.amount) {
          return res.status(400).json({ error: 'Insufficient reserve for deposit' });
        }
        admin.hcoinBalance -= transaction.amount;
        await User.findByIdAndUpdate(transaction.toUser, {
          $inc: { hcoinBalance: transaction.amount }
        });
        await admin.save();
      } else if (transaction.type === 'withdrawal') {
        await User.findByIdAndUpdate(transaction.fromUser, {
          $inc: { hcoinBalance: -transaction.amount }
        });
        const admin = await getAdminUser();
        admin.hcoinBalance += transaction.amount;
        await admin.save();
      } else if (transaction.type === 'transfer') {
        if (transaction.description && transaction.description.includes('newera')) {
          const neweraUsername = transaction.description.split('newera:')[1]?.trim();
          if (neweraUsername) {
            try {
              const response = await fetch(`http://localhost:5000/api/user/${neweraUsername}/add-balance`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer wallet-api-key'
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
              await User.findByIdAndUpdate(transaction.fromUser, { $inc: { hcoinBalance: transaction.amount } });
              return res.status(500).json({ error: 'Transfer to NewEra failed, rolled back' });
            }
          }
        } else {
          // Internal transfer already handled in POST, but for pending ones (if any)
          await User.findByIdAndUpdate(transaction.fromUser, {
            $inc: { hcoinBalance: -transaction.amount }
          });
          await User.findByIdAndUpdate(transaction.toUser, {
            $inc: { hcoinBalance: transaction.amount }
          });
        }
      } else if (transaction.type === 'nft_create') {
        const pendingData = transaction.pendingData;
        if (!pendingData) {
          return res.status(400).json({ error: 'No pending data for NFT creation' });
        }
        const creator = await User.findById(transaction.fromUser);
        const admin = await getAdminUser();
        if (creator.hcoinBalance < 5) {
          return res.status(400).json({ error: 'Insufficient balance for creation fee' });
        }
        // Deduct fee
        creator.hcoinBalance -= 5;
        admin.hcoinBalance += 5;
        await creator.save();
        await admin.save();
        // Create NFT
        const nft = new NFT({
          name: pendingData.name,
          description: pendingData.description,
          image: pendingData.image,
          owner: creator._id,
          creator: creator._id,
          category: pendingData.category,
          rarity: pendingData.rarity
        });
        await nft.save();
        transaction.nftId = nft._id;
        transaction.description = `NFT creation approved: ${pendingData.name}`;
        await transaction.save();
      }
    }
   
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Transaction update error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.put('/api/admin/user/:id/balance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hcoinBalance, uzsBalance } = req.body;
    if (hcoinBalance === undefined && uzsBalance === undefined) {
      return res.status(400).json({ error: 'Invalid balance' });
    }
    const updateData = {};
    if (hcoinBalance !== undefined) updateData.hcoinBalance = hcoinBalance;
    if (uzsBalance !== undefined) updateData.uzsBalance = uzsBalance;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
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

// Admin statistics (H-coin bilan, NFT qo'shildi)
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
   
    const [deposits, withdrawals, transfers, buys, sells, nftCreates, nftBuys, nftSells] = await Promise.all([
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
      ]),
      Transaction.aggregate([
        { $match: { type: 'buy_hcoin', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'sell_hcoin', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'nft_create', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'nft_buy', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'nft_sell', status: 'approved', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ])
    ]);

    const depositCount = deposits[0] ? deposits[0].count : 0;
    const depositAmount = deposits[0] ? deposits[0].amount : 0;
    const withdrawalCount = withdrawals[0] ? withdrawals[0].count : 0;
    const withdrawalAmount = withdrawals[0] ? withdrawals[0].amount : 0;
    const transferCount = transfers[0] ? transfers[0].count : 0;
    const transferAmount = transfers[0] ? transfers[0].amount : 0;
    const buyCount = buys[0] ? buys[0].count : 0;
    const buyAmount = buys[0] ? buys[0].amount : 0;
    const sellCount = sells[0] ? sells[0].count : 0;
    const sellAmount = sells[0] ? sells[0].amount : 0;
    const nftCreateCount = nftCreates[0] ? nftCreates[0].count : 0;
    const nftCreateAmount = nftCreates[0] ? nftCreates[0].amount : 0;
    const nftBuyCount = nftBuys[0] ? nftBuys[0].count : 0;
    const nftBuyAmount = nftBuys[0] ? nftBuys[0].amount : 0;
    const nftSellCount = nftSells[0] ? nftSells[0].count : 0;
    const nftSellAmount = nftSells[0] ? nftSells[0].amount : 0;
   
    const totalAmount = depositAmount + transferAmount + buyAmount + nftBuyAmount - withdrawalAmount - sellAmount - nftSellAmount;
    const transactionCount = depositCount + withdrawalCount + transferCount + buyCount + sellCount + nftCreateCount + nftBuyCount + nftSellCount;
   
    const topUsers = await User.find()
      .sort({ hcoinBalance: -1 })
      .limit(3)
      .select('firstName lastName walletNumber hcoinBalance');
   
    const totalHcoinResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$hcoinBalance' } } }
    ]);
    const totalHcoin = totalHcoinResult.length > 0 ? totalHcoinResult[0].total : 0;
   
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
      buyCount,
      buyAmount,
      sellCount,
      sellAmount,
      nftCreateCount,
      nftCreateAmount,
      nftBuyCount,
      nftBuyAmount,
      nftSellCount,
      nftSellAmount,
      topUsers,
      totalHcoin,
      totalUsers
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Create admin user (400mln H-coin bilan, paymentMethods qo'shildi)
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
        hcoinBalance: 400000000, // 400 million H-coin initial supply
        uzsBalance: 0,
        paymentMethods: { // Default admin payment details
          payeer: { account: 'P123456789' },
          paypal: { email: 'admin@example.com' },
          btc: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
          eth: { address: '0x742d35Cc6634C0532925a3b8D4D5e0fF2c7b8D4D' },
          usdt: { address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
          uzcard: { card: '9860 1234 5678 9012' }
        },
        isAdmin: true
      });
     
      await adminUser.save();
      console.log('Admin user created: username=admin, password=admin123, initial supply: 400M H-coin');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Initialize H-coin value va history (default 1000 UZS)
async function initializeHcoinValue() {
  try {
    const hcoinValueExists = await HcoinValue.findOne();
    if (!hcoinValueExists) {
      const hcoinValue = new HcoinValue({
        value: 1000,
        change: 0
      });
     
      await hcoinValue.save();
      const history = new PriceHistory({ price: 1000 });
      await history.save();
      console.log('Initial H-coin value set to 1000 UZS');
    }
  } catch (error) {
    console.error('Error initializing H-coin value:', error);
  }
 
  // Default conversion rates
  const defaultRates = [
    { currency: 'UZS', rate: 1 },
    { currency: 'USD', rate: 0.00006 }, // Taxminiy
    { currency: 'EUR', rate: 0.000055 }
  ];
 
  for (const rate of defaultRates) {
    const existing = await ConversionRate.findOne({ currency: rate.currency });
    if (!existing) {
      const conversion = new ConversionRate(rate);
      await conversion.save();
      console.log(`Default conversion rate set: 1 H-coin = ${rate.rate.toFixed(4)} ${rate.currency}`);
    }
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await createAdminUser();
  await initializeHcoinValue();
  updateHcoinPrice(); // Dastlabki update
});