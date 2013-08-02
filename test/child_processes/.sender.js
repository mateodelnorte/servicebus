var noop = function () {};
var bus = require('../bus-shim').bus;

setTimeout(function () {
  bus.send('event.22', { event: 1 });
}, 250);