// Runs every console program of Experiment 4.1 one after another, each from its own folder, and prints its output.
// (The three web servers keep running until Ctrl + C, so they are exercised by check-servers.js instead.)
//   npm run exp4.1
const { spawnSync } = require('child_process');
const path = require('path');

const PROGRAMS = [
  ['1_basic_routing', 'callback.js'],
  ['2_file_operations', 'fileops.js'],
  ['2_file_operations', 'irrigation_records.js'],
  ['2_file_operations', 'buffer.js'],
  ['2_file_operations', 'stream.js'],
  ['3_custom_modules', 'app.js'],
  ['4_blocking_nonblocking', 'blocking.js'],
  ['4_blocking_nonblocking', 'nonblocking.js'],
];

let failed = 0;
for (const [folder, file] of PROGRAMS) {
  console.log('\n================ ' + folder + '/' + file + ' ================');
  const res = spawnSync(process.execPath, [file], { cwd: path.join(__dirname, folder), encoding: 'utf8' });
  process.stdout.write(res.stdout);
  if (res.status !== 0) {
    failed += 1;
    process.stdout.write(res.stderr);
  }
}
console.log('\n' + (failed ? failed + ' program(s) failed' : 'All ' + PROGRAMS.length + ' programs ran successfully.'));
process.exit(failed ? 1 : 0);
