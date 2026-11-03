// Program 2.4 : Read a large file using a stream (chunk by chunk)
// The file is a real one that already exists in this project - the API's package-lock.json - so nothing is generated.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'package-lock.json');
console.log('File: ' + path.basename(file) + ' (' + fs.statSync(file).size + ' bytes)');

// a small highWaterMark makes the chunks clearly visible; only one chunk is held in memory at a time
const stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 16384 });
let chunkNo = 0;
let characters = 0;

stream.on('data', function (chunk) {
  chunkNo++;
  characters += chunk.length;
  console.log('\n----- Chunk ' + chunkNo + ' (' + chunk.length + ' characters) -----');
  console.log(chunk.substring(0, 90).replace(/\s+/g, ' ') + ' ...');
});

stream.on('end', function () {
  console.log('\nFile read completely in ' + chunkNo + ' chunks (' + characters + ' characters).');
});

stream.on('error', function (err) {
  console.log('Error:', err.message);
});
