'use strict';

const app = require('./src/app');

if (require.main === module) {
  const { HOST, PORT } = require('./src/config/env');
  const db = require('./db');
  db.connect()
    .then(() => {
      app.listen(PORT, HOST, () => {
        console.log(`SENA EXECUTIVA em http://${HOST}:${PORT}`);
      });
    })
    .catch((error) => {
      const message = String(error.message || error).replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[URL de conexão ocultada]');
      console.error('Não foi possível conectar ao PostgreSQL:', message);
      process.exitCode = 1;
    });
}

module.exports = app;
