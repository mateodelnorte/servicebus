var noop = function () {};
var bus = require('../../').bus();

setTimeout(function () {
  bus.publish('event.21', { event: 1 });
}, 1000);