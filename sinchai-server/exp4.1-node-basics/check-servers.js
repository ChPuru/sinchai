// Starts each of the three Experiment 4.1 web servers on its own port, requests every route and prints the result.
// This replaces clicking through the browser: node check-servers.js
const { spawn } = require('child_process');
const path = require('path');

const CHECKS = [
  {
    folder: '1_basic_routing', file: 'server.js', port: 3101,
    requests: [['/', 200, 'text/html', 'Welcome to the SinchAI Farm Portal']],
  },
  {
    folder: '1_basic_routing', file: 'routing.js', port: 3102,
    requests: [
      ['/', 200, 'text/html', 'Register a Plot'],
      ['/register', 200, 'text/html', 'Plot Registration Form'],
      ['/plots', 200, 'application/json', 'North field'],
      ['/plots?village=Karad', 200, 'application/json', 'River side'],
      ['/xyz', 404, 'text/html', '404 - Page Not Found'],
    ],
  },
  {
    folder: '2_file_operations', file: 'fileserver.js', port: 3103,
    requests: [
      ['/irrigation_log.txt', 200, 'text/plain', 'Date,Plot,Hours'],
      ['/abc.txt', 404, 'text/html', '404 - File Not Found'],
      ['/fileserver.js', 404, 'text/html', '404 - File Not Found'], // source files are not served
      ['/..%2F..%2Fconfig.js', 404, 'text/html', '404 - File Not Found'], // cannot climb out of the folder
      ['/%E0%A4%A', 400, 'text/html', '400 - Bad Request'], // malformed percent-encoding must not crash the server
      ['/', 404, 'text/html', '404 - File Not Found'],
    ],
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;

(async () => {
  // the file server needs irrigation_log.txt, which Program 2.2 creates
  require('child_process').spawnSync(process.execPath, ['irrigation_records.js'], { cwd: path.join(__dirname, '2_file_operations') });

  for (const c of CHECKS) {
    const child = spawn(process.execPath, [c.file], { cwd: path.join(__dirname, c.folder), env: { ...process.env, PORT: String(c.port) } });
    await wait(700);
    console.log('\n' + c.folder + '/' + c.file + ' on port ' + c.port);
    for (const [url, status, type, text] of c.requests) {
      try {
        const res = await fetch('http://127.0.0.1:' + c.port + url);
        const body = await res.text();
        const ok = res.status === status && (res.headers.get('content-type') || '').includes(type) && body.includes(text);
        if (!ok) bad += 1;
        console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  GET ' + url.padEnd(24) + res.status + ' ' + (res.headers.get('content-type') || ''));
      } catch (err) {
        bad += 1;
        console.log('  FAIL  GET ' + url + ' -> ' + err.message);
      }
    }
    child.kill();
    await wait(200);
  }
  console.log('\n' + (bad ? bad + ' check(s) failed' : 'All server routes behave as expected.'));
  process.exit(bad ? 1 : 0);
})();
