// Prints the access code a person needs to register as a Field Supervisor in the app.
// The code was generated randomly the first time the server started and is stored in .env (SUPERVISOR_CODE).
const config = require('../config');

if (config.supervisorCode) {
  console.log('Supervisor sign-up code: ' + config.supervisorCode);
  console.log('(stored in sinchai-server/.env - change it by editing SUPERVISOR_CODE there)');
} else {
  console.log('Supervisor sign-up is switched off (SUPERVISOR_CODE is empty).');
}
