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

});