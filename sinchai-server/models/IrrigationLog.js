// Exp 5 - Schema + Model for one irrigation event (the "history" screen and the water-saving analytics read these)
const mongoose = require('mongoose');
const { DATE_RE } = require('../utils/validators');

const logSchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: [true, 'Date is required'], match: [DATE_RE, 'Date must look like 2026-09-02'] },
    hours: { type: Number, required: [true, 'Hours are required'], min: [0.1, 'Hours must be between 0.1 and 24'], max: [24, 'Hours must be between 0.1 and 24'] },
    // hours * the plot's pump capacity, worked out by the server so a client cannot invent a figure
    litres: { type: Number, required: true, min: 0 },
    // how many mm of that water the root zone could actually take up (the rest drains away). Kept so that
    // editing or deleting the log puts back exactly what it removed from the plot's depletion. Never sent to the client.
    absorbedMm: { type: Number, default: 0, min: 0 },
    // true when the farmer followed the SinchAI advisory, false for a manual / habit irrigation
    advised: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: [300, 'Note can be at most 300 characters'], default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => ({
        id: String(ret._id),
        plotId: String(ret.plot),
        date: ret.date,
        hours: ret.hours,
        litres: ret.litres,
        advised: ret.advised,
        note: ret.note,
      }),
    },
  }
);

logSchema.index({ owner: 1, date: -1 });

module.exports = mongoose.model('IrrigationLog', logSchema);
