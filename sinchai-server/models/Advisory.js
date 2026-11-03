// Exp 5 - Schema + Model for the stored daily advisory of a plot; supervisor alerts and their acknowledgement live here
const mongoose = require('mongoose');

const advisorySchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    type: { type: String, enum: ['irrigate', 'heat', 'skip', 'wait'], required: true },
    etc: { type: Number, required: true },
    depletion: { type: Number, required: true },
    taw: { type: Number, required: true },
    hours: { type: Number, default: 0 },
    daysLeft: { type: Number },
    // set when a field supervisor clicks "Acknowledge" on the alert
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

// exactly one advisory per plot per day
advisorySchema.index({ plot: 1, date: 1 }, { unique: true });
advisorySchema.index({ date: 1, type: 1 });

module.exports = mongoose.model('Advisory', advisorySchema);
