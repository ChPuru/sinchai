// app.js - uses both custom modules and displays the result.
// plot.js holds the plot (the input); today's weather is fetched LIVE from Open-Meteo, so nothing here is typed in.
const plot = require('./plot');
const water = require('./waterBalance');

// the plot's location (latitude / longitude of Karad) -> today's and tomorrow's real weather and ET0
const LATITUDE = 17.29;
const LONGITUDE = 74.18;
const url =
  'https://api.open-meteo.com/v1/forecast?latitude=' + LATITUDE + '&longitude=' + LONGITUDE +
  '&daily=temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration&forecast_days=2&timezone=Asia%2FKolkata';

fetch(url)
  .then(function (res) {
    if (!res.ok) throw new Error('Open-Meteo answered ' + res.status);
    return res.json();
  })
  .then(function (data) {
    const d = data.daily;
    const weather = { et0: d.et0_fao_evapotranspiration[0], rainToday: d.precipitation_sum[0], rainTomorrow: d.precipitation_sum[1], tmax: d.temperature_2m_max[0] };
    const crop = water.etc(weather.et0, plot.cropStage);
    const advice = water.advisory(plot, weather);

    console.log('===== Irrigation Advisory for ' + d.time[0] + ' =====');
    console.log('Plot            :', plot.name, '(' + plot.village + ')');
    console.log('Soil / Stage    :', plot.soilType, '/', plot.cropStage);
    console.log('Area / Pump     :', plot.areaAcres, 'acres /', plot.pumpLph, 'L/hr');
    console.log('Tmax today      :', weather.tmax, 'C');
    console.log('ET0 (live)      :', weather.et0, 'mm/day');
    console.log('Rain today / tmr:', weather.rainToday, '/', weather.rainTomorrow, 'mm');
    console.log('ETc (ET0 x Kc)  :', crop, 'mm/day');
    console.log('TAW (root zone) :', water.taw(plot.soilType), 'mm');
    console.log('RAW (threshold) :', water.raw(plot.soilType), 'mm');
    console.log('Depletion today :', advice.depletion.toFixed(1), 'mm');
    console.log('Advice          :', advice.type.toUpperCase(), '-', advice.hours, 'hours of pumping');
  })
  .catch(function (err) {
    // no weather means no advice: the program never substitutes made-up numbers
    console.log('Could not fetch live weather (' + err.message + '). No advisory can be given without it.');
    process.exitCode = 1;
  });
