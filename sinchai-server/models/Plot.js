// Exp 5 - Schema + Model for a registered farm plot (the "Student" of this project: the main CRUD resource)
const mongoose = require('mongoose');
const { DATE_RE } = require('../utils/validators');
const { cellKey } = require('../utils/geo');

const SOIL_TYPES = ['sandy', 'loamy', 'clay'];
const CROP_STAGES = ['germination', 'tillering', 'grand-growth', 'maturity'];

const plotSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Plot name is required'], trim: true, maxlength: [60, 'Plot name is too long'] },
    village: { type: String, required: [true, 'Village is required'], trim: true, maxlength: [60, 'Village is too long'] },
    soilType: { type: String, required: [true, 'Soil type is required'], enum: { values: SOIL_TYPES, message: 'Soil type must be sandy, loamy or clay' } },
    cropStage: {
      type: String,
      required: [true, 'Crop stage is required'],
      enum: { values: CROP_STAGES, message: 'Crop stage must be germination, tillering, grand-growth or maturity' },
    },
    areaAcres: { type: Number, required: [true, 'Area is required'], min: [0.1, 'Area must be at least 0.1 acre'] },
    pumpLph: { type: Number, required: [true, 'Pump capacity is required'], min: [1000, 'Pump must deliver at least 1000 L/hr'] },
    // Two optional facts only the farmer knows. They are the baselines for the analytics, so nothing has to be assumed:
    // how many hours they usually irrigate this plot when watering by habit (-> "water saved"), and the pump's rated
    // power from its name plate (-> electricity used). While they are empty those two figures are simply not shown.
    habitHours: { type: Number, default: null, min: [0.1, 'Usual irrigation must be between 0.1 and 24 hours'], max: [24, 'Usual irrigation must be between 0.1 and 24 hours'] },
    pumpKw: { type: Number, default: null, min: [0.1, 'Pump power must be between 0.1 and 200 kW'], max: [200, 'Pump power must be between 0.1 and 200 kW'] },
    // root-zone depletion (mm) at the START of balanceDate - rolled forward one day at a time by services/balance.js
    depletion: { type: Number, default: 0, min: [0, 'Depletion cannot be negative'] },
    balanceDate: { type: String, match: DATE_RE },
    // where the farmer put the pin on the map (WGS84 degrees). The weather and ET0 are fetched for exactly this spot.
    // The bounding box is India: a typo or a pin in the ocean is refused instead of silently advising on far-away weather.
    lat: { type: Number, required: [true, 'Click the map to place the plot'], min: [6, 'The plot must be located in India'], max: [38, 'The plot must be located in India'] },
    lng: { type: Number, required: [true, 'Click the map to place the plot'], min: [68, 'The plot must be located in India'], max: [98, 'The plot must be located in India'] },
    notes: { type: String, trim: true, maxlength: [500, 'Notes can be at most 500 characters'], default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // after .populate('owner', 'name') the owner has already been through User's toJSON, so it is { id, name, ... };
        // without populate it is a bare ObjectId (which has no .name)
        const populated = ret.owner && typeof ret.owner.name === 'string';
        return {
          id: String(ret._id),
          ownerId: populated ? ret.owner.id : String(ret.owner),
          owner: populated ? ret.owner.name : undefined,
          name: ret.name,
          village: ret.village,
          // the weather cell (about 11 x 11 km) this plot belongs to; plots in the same cell share one forecast
          weatherKey: cellKey(ret.lat, ret.lng),
          soilType: ret.soilType,
          cropStage: ret.cropStage,
          areaAcres: ret.areaAcres,
          pumpLph: ret.pumpLph,
          habitHours: ret.habitHours ?? null,
          pumpKw: ret.pumpKw ?? null,
          depletion: +ret.depletion.toFixed(1),
          balanceDate: ret.balanceDate,
          lat: ret.lat,
          lng: ret.lng,
          notes: ret.notes,
          createdAt: ret.createdAt,
        };
      },
    },
  }
);

// a farmer cannot register two plots with the same name -> error 11000 -> 409 Conflict
plotSchema.index({ owner: 1, name: 1 }, { unique: true });

const Plot = mongoose.model('Plot', plotSchema);
Plot.SOIL_TYPES = SOIL_TYPES;
Plot.CROP_STAGES = CROP_STAGES;

module.exports = Plot;
