// Program 2.1 : Check permissions and existence of a file / directory
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'irrigation_log.txt');
const dir = path.join(__dirname, 'records');
const missing = path.join(__dirname, 'pump_service.txt');

// create sample file and directory if not present
if (!fs.existsSync(file)) fs.writeFileSync(file, 'Date,Plot,Hours\n');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

// ---- Checking if a file or a directory exists ----
console.log('--- Existence Check ---');
[file, dir, missing].forEach(function (p) {
  const name = path.basename(p);
  if (fs.existsSync(p)) {
    const type = fs.statSync(p).isDirectory() ? 'Directory' : 'File';
    console.log(name + ' -> exists (' + type + ')');
  } else {
    console.log(name + ' -> does NOT exist');
  }
});

// ---- Checking permissions ----
console.log('--- Permission Check for ' + path.basename(file) + ' ---');
const modes = { Read: fs.constants.R_OK, Write: fs.constants.W_OK, Execute: fs.constants.X_OK };
Object.keys(modes).forEach(function (name) {
  try {
    fs.accessSync(file, modes[name]);
    console.log(name + ' permission : Allowed');
  } catch (e) {
    console.log(name + ' permission : Not allowed');
  }
});

// the asynchronous form: the result arrives in a callback
fs.access(dir, fs.constants.R_OK | fs.constants.W_OK, function (err) {
  console.log('Directory "' + path.basename(dir) + '" is ' + (err ? 'NOT readable/writable' : 'readable and writable'));
});
