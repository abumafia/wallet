const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  walletId: {
    type: String,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Wallet ID ni avtomatik yaratish
userSchema.pre('save', function(next) {
  if (this.isNew) {
    // HAQ00000000000 formatidagi wallet ID yaratish
    const prefix = 'HAQ';
    const randomNum = Math.floor(10000000000 + Math.random() * 90000000000);
    this.walletId = prefix + randomNum.toString().substring(0, 11);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);