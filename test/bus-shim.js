require('longjohn')

if ( ! process.env.RABBITMQ_URL)
  throw new Error('Tests require a RABBITMQ_URL environment variable to be set, pointing to the RabbiqMQ instance you wish to use.');

var busUrl = process.env.RABBITMQ_URL

var bus = require('../').bus({ url: busUrl }),
    correlate = require('../bus/middleware/correlate'),
    pack = require('../bus/middleware/package'),
    retry = require('../bus/middleware/retry');

bus.use(pack());
bus.use(correlate());
bus.use(retry());

module.exports.bus = bus;