// Program 1.2 : Basic routing using an HTML file and a JSON file
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer(function (req, res) {
  // look at the path only, so "/plots?village=Karad" still matches the "/plots" route
  const route = new URL(req.url, 'http://localhost').pathname;
  console.log('Request received for: ' + req.url);

  if (route === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<h1>SinchAI Farm Portal - Home</h1>' +
        "<p><a href='/register'>Register a Plot</a> | " +
        "<a href='/plots'>Plot List (JSON)</a></p>"
    );
  } else if (route === '/register') {
    fs.readFile(path.join(__dirname, 'register.html'), function (err, data) {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error loading page');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (route === '/plots') {
    fs.readFile(path.join(__dirname, 'plots.json'), function (err, data) {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error loading data');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Page Not Found</h1>');
  }
});

server.listen(PORT, function () {
  console.log('Server running at http://localhost:' + PORT + '/');
});
