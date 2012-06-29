var noop = function () {};
var log = { debug: noop, info: noop, warn: noop, error: noop };
var bus = require('../../bus/bus').bus({ log: log });

setTimeout(function () {
  bus.publish('event.21', { event: 1 });
}, 100);