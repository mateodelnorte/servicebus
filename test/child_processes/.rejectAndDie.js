var bus = require('../bus-shim').bus;

bus.listen('reject.and.die', { ack: true } , function (msg) {
  msg.handle.reject();
  throw new Error('throwing');
});