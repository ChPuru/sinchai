// Program 2.2 : Maintain the irrigation log in a text file
// create -> add -> read -> display, then count lines and read line by line
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const file = path.join(__dirname, 'irrigation_log.txt');

// 1. Create irrigation_log.txt
fs.writeFileSync(file, 'Date,Plot,Hours\n');
console.log('1. irrigation_log.txt created');

// 2. Add irrigation entries
fs.appendFileSync(file, '2026-10-20,North field,3\n');
fs.appendFileSync(file, '2026-10-22,River side,1.5\n');
fs.appendFileSync(file, '2026-10-24,Well plot,2.5\n');
console.log('2. Irrigation entries added');

// 3 & 4. Read the file and display the contents
const data = fs.readFileSync(file, 'utf8');
console.log('3. File read successfully\n4. Contents:\n' + data);

// Determining the line count of the text file
const lines = data.split('\n').filter(function (l) { return l.trim() !== ''; });
console.log('Line count of ' + path.basename(file) + ' : ' + lines.length);

// Reading the file line by line
console.log('\nReading file line by line:');
const rl = readline.createInterface({ input: fs.createReadStream(file) });
let n = 0;
rl.on('line', function (line) {
  n++;
  console.log('Line ' + n + ': ' + line);
});
rl.on('close', function () {
  console.log('Finished reading ' + n + ' lines.');
});
