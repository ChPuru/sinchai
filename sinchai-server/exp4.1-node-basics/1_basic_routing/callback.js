// Program 1.3 : Demonstrating callbacks in Node.js
const fs = require('fs');
const path = require('path');

// user-defined function that accepts a callback (error first, result second - the Node.js convention)
function getPlot(plotId, callback) {
  console.log('Searching for plot ' + plotId + '...');
  setTimeout(function () {
    if (plotId !== 102) return callback(new Error('Plot ' + plotId + ' not found'));
    const plot = { plotId: 102, name: 'River side', village: 'Karad', soilType: 'loamy' };
    callback(null, plot); // call the callback when the work is done
  }, 1000);
}

getPlot(102, function (err, plot) {
  if (err) return console.log(err.message);
  console.log('Callback executed -> Plot found:', plot.name, '(' + plot.soilType + ' soil, ' + plot.village + ')');
});

// the same function when the plot does not exist: the callback receives the error
getPlot(999, function (err) {
  if (err) return console.log('Callback executed -> Error:', err.message);
});

// built-in callback: fs.readFile
fs.readFile(path.join(__dirname, 'plots.json'), 'utf8', function (err, data) {
  if (err) return console.log('Error:', err.message);
  console.log('File read callback -> Total plots in file:', JSON.parse(data).length);
});

console.log('This line runs before the callbacks finish.');
