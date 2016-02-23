require('longjohn');

if ( ! process.env.RABBITMQ_URL)
  throw new Error('Tests require a RABBITMQ_URL environment variable to be set, pointing to the RabbiqMQ instance you wish to use. Example url: "amqp://localhost:5672"');

var busUrl = process.env.RABBITMQ_URL;
var retry = require('servicebus-retry');

var bus = require('../').bus({
  prefetch: 5,
  url: busUrl
});

bus.use(bus.messageDomain());
bus.use(bus.package());
bus.use(bus.correlate());
bus.use(bus.logger());
bus.use(retry({
  store: retry.MemoryStore()
}))

module.exports.bus = bus;