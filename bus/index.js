var rabbitmq = require('./rabbitmq/bus');

module.exports.bus = function bus (options, implOpts) {
  return rabbitmq.bus(options, implOpts);
};

var namedBuses = {};

module.exports.namedBus = function namedBus(name, options, implOpts) {
  var bus = namedBuses[name];
  if ( ! bus) {
    namedBuses[name] = new rabbitmq.Bus(named, options, implOpts);
  }
  return bus;
}