'use strict';

const app = require('./src/app');

if (require.main === module) {
  const { HOST, PORT } = require('./src/config/env');
  app.listen(PORT, HOST, () => {
    console.log(`SENA EXECUTIVA em http://${HOST}:${PORT}`);
  });
}

module.exports = app;
