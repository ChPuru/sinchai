// Program 2.5 : Node.js File Server - see file content through the browser
// e.g. http://localhost:3000/irrigation_log.txt
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// only plain data files are served, never the .js source files that sit in the same folder
const ALLOWED = ['.txt', '.csv', '.json', '.log'];

const server = http.createServer(function (req, res) {
  let fileName;
  try {
    // path.basename() drops any folders, so "/../../config.js" cannot leave this directory
    fileName = path.basename(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    return res.end('<h1>400 - Bad Request</h1>');
  }
  const filePath = path.join(__dirname, fileName);

  // check whether the file exists (and is a type we are willing to show)
  fs.access(filePath, fs.constants.F_OK, function (err) {
    if (err || fileName === '' || !ALLOWED.includes(path.extname(fileName).toLowerCase())) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<h1>404 - File Not Found</h1>');
    }
    // send the file if it exists
    fs.readFile(filePath, 'utf8', function (err, data) {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error reading file');
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(data);
    });
  });
});

server.listen(PORT, function () {
  console.log('File server running at http://localhost:' + PORT + '/irrigation_log.txt');
});
