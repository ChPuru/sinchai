// Exp 5 - Schema + Model for a SinchAI account (farmer or field supervisor)
const mongoose = require('mongoose');
const { NAME_RE, EMAIL_RE, MOBILE_RE } = require('../utils/validators');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      match: [NAME_RE, 'Name must be at least 3 letters, alphabets only'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      unique: true, // a repeated email -> MongoDB error 11000 -> 409 Conflict
      match: [EMAIL_RE, 'Enter a valid email address'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      match: [MOBILE_RE, 'Enter a valid 10 digit mobile number starting with 6-9'],
    },
    village: { type: String, required: [true, 'Village is required'], trim: true },
    role: { type: String, enum: { values: ['farmer', 'supervisor'], message: 'Role must be farmer or supervisor' }, default: 'farmer' },
    language: { type: String, enum: { values: ['en', 'hi', 'mr'], message: 'Language must be en, hi or mr' }, default: 'en' },
    // select: false -> the hash is never returned unless a query asks for it with .select('+passwordHash')
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
    toJSON: {
      transform: (doc, ret) => ({
        id: String(ret._id),
        name: ret.name,
        email: ret.email,
        mobile: ret.mobile,
        village: ret.village,
        role: ret.role,
        language: ret.language,
        createdAt: ret.createdAt,
      }),
    },
  }
);

module.exports = mongoose.model('User', userSchema);
