var bus = require('../bus-shim').bus;

bus.send('reject.and.die', { test: 'test' }, { ack: true });