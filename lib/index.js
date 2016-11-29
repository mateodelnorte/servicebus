function bus (options, implOpts) {

  if (options === undefined) options = {};

  options.type = options.type || 'rabbitmq';

  const providerType = `servicebus-${options.type}`;

  var rabbitmq;
  
  try {
    rabbitmq = require(providerType);
  } catch (error) {
    throw new Error(`failed to require ${providerType} while trying to instatiate new bus instance. do you need to 'npm install ${providerType}?'`);
  }

  return new rabbitmq.Bus(options, implOpts);
};

function namedBus(name, options, implOpts) {
  var b = namedBuses[name];
  if ( ! b) {
    b = namedBuses[name] = bus(options, implOpts);
  }
  return b;
};

var namedBuses = {};

module.exports.bus = bus;
module.exports.Bus = require('./bus');
module.exports.formatters = require('./formatters');
module.exports.namedBus = namedBus; 
