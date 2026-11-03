// Program 2.3 : Store a farmer name / plot ID using a Buffer
const farmerName = 'Ramesh Patil';

// 1. Convert the farmer name into a Buffer
const buf = Buffer.from(farmerName, 'utf8');

// 2. Display the Buffer
console.log('Original String :', farmerName);
console.log('Buffer          :', buf);
console.log('Buffer length   :', buf.length, 'bytes');

// 3. Convert the Buffer back into a string
console.log('Back to String  :', buf.toString('utf8'));

// A Buffer holds raw bytes, so the same bytes can be shown in other encodings
console.log('As hex          :', buf.toString('hex'));
console.log('As base64       :', buf.toString('base64'));

// A Marathi name needs more bytes than characters: each Devanagari letter takes 3 bytes in UTF-8
const marathi = 'रमेश';
console.log('\n"' + marathi + '" has', marathi.length, 'characters but', Buffer.byteLength(marathi, 'utf8'), 'bytes');
