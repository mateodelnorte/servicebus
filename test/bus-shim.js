require('longjohn')

if ( ! process.env.RABBITMQ_URL)
  throw new Error('Tests require a RABBITMQ_URL environment variable to be set, pointing to the RabbiqMQ instance you wish to use.');

var busUrl = process.env.RABBITMQ_URL

var bus = require('../').bus({ url: busUrl });

bus.use(bus.package());
bus.use(bus.correlate());
bus.use(bus.log());
bus.use(bus.retry());

module.exports.bus = bus;