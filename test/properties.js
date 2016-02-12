var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('./bus-shim').bus;

// the following code is being used in the above shim
// var pack = require('../../bus/middleware/package');

// bus.use(pack());

describe('properties', function() {

  it('should add a properties property in message if an options is passed as third argument in producers', function (done) {
    bus.listen('my.message.props.1', function (msg, message) {
      message.should.have.property('properties');
      message.properties.should.have.property('correlationId', 'test-value');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.props.1', { my: 'message' }, { correlationId: 'test-value' });
    }, 1000);
  });

  it('should add a headers property in message if an options is passed as third argument in producers', function (done) {
    bus.listen('my.message.props.2', function (msg, message) {
      message.should.have.property('properties');
      message.properties.should.have.property('headers');
      message.properties.headers.should.have.property('audit', 'value');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.props.2', { my: 'message' }, { headers: { audit: 'value', sub: { doc: 'ument' } } });
    }, 1000);
  });

  it('should have access to properties and headers in middleware', function (done) {

    if ( ! process.env.RABBITMQ_URL)
    throw new Error('Tests require a RABBITMQ_URL environment variable to be set, pointing to the RabbiqMQ instance you wish to use. Example url: "amqp://localhost:5672"');

    var busUrl = process.env.RABBITMQ_URL;

    var bus = require('../').bus({
      prefetch: 5,
      url: busUrl
    });

    bus.use({
      handleOutgoing: function (queueName, event, options) {
        options.should.have.property('headers');
        options.headers.should.have.property('audit', 'value');
        done();
      }
    });

    setTimeout(function () {
      bus.send('my.message.props.3', { my: 'message' }, { headers: { audit: 'value', sub: { doc: 'ument' } } });
    }, 1000);

  });

});