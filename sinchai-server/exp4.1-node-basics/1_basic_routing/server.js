// Program 1.1 : First server application using the http module (SinchAI Farm Portal)
const http = require('http');

const PORT = process.env.PORT || 3000;

// the callback receives the request (req) and the response (res) objects
const server = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write('<h1>Welcome to the SinchAI Farm Portal</h1>');
  res.write('<p>This is my first Node.js server built using the http module.</p>');
  res.end();
});

server.listen(PORT, function () {
  console.log('Server running at http://localhost:' + PORT + '/');
});
