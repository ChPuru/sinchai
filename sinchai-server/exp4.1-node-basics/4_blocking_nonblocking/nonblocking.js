// Program 4.2 : Supervisor notification system - Non-blocking (asynchronous)
const fs = require('fs');
const path = require('path');

// Task 1: Display supervisor information
console.log('1. Supervisor Info : Field supervisor, Karad cluster');

// Task 2: Read the alert file asynchronously
console.log('2. Requesting alert file (non-blocking)...');
fs.readFile(path.join(__dirname, 'alerts.txt'), 'utf8', function (err, data) {
  if (err) return console.log('Error:', err.message);
  console.log('\n--- Alerts ---\n' + data.trim());
  // Task 3: Display a message after the file is read
  console.log('3. Alert file read successfully (callback via Event Loop).');
});

// a timer with 0 ms is also queued by the Event Loop and runs after the main code has finished
setTimeout(function () {
  console.log('   [Timer] setTimeout callback executed');
}, 0);

console.log('   Main thread is free - this line prints BEFORE the alert text.');
