const http = require('http');

async function testPort(port) {
  return new Promise((resolve) => {
    http.get('http://localhost:' + port + '/q33-java-conditional.svg', (res) => {
      console.log('Port ' + port + ': status ' + res.statusCode);
      resolve(res.statusCode === 200);
    }).on('error', (err) => {
      resolve(false);
    });
  });
}

async function main() {
  const ports = [3000, 5173, 8080];
  for (const port of ports) {
    const ok = await testPort(port);
    if (ok) {
      console.log('Found active server on port ' + port + '. Testing all 3 Java images:');
      for (const img of ['/q33-java-conditional.svg', '/q34-java-loop-method.svg', '/q35-java-oop-constructor.svg']) {
        await new Promise(r => {
          http.get('http://localhost:' + port + img, (res) => {
            console.log('  GET ' + img + ' -> HTTP ' + res.statusCode + ' (' + res.headers['content-type'] + ', ' + res.headers['content-length'] + ' bytes)');
            r();
          });
        });
      }
      return;
    }
  }
  console.log('No local server responded on tested ports (3000, 5173, 8080).');
}

main();
