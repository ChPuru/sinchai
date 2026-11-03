// Program 4.1 : Blocking (synchronous) file read - the SinchAI supervisor notification system
const fs = require('fs');
const path = require('path');

console.log('1. Supervisor Info : Field supervisor, Karad cluster');
console.log('2. Reading alert file (blocking)...');
const data = fs.readFileSync(path.join(__dirname, 'alerts.txt'), 'utf8'); // waits here until the file is read
console.log(data.trim());
console.log('3. Alerts read. Program ends.');
