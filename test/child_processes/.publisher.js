var noop = function () {};
var bus = require('../bus-shim').bus;

setTimeout(function () {
  bus.publish('event.21', { event: 1 });
}, 1000);