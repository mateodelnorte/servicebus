var noop = function () {};
var bus = require('../../').bus();

setTimeout(function () {
  bus.send('event.22', { event: 1 });
}, 5000);