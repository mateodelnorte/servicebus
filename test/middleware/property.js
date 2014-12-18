var noop = function () {};
var log = require('debug')('servicebus:test')
var bus = require('../bus-shim').bus;

// the following code is being used in the above shim
// var pack = require('../../bus/middleware/package');

// bus.use(pack());

describe('property', function() {

  it('should add a properties property in message if an options is passed as third argument in producers', function (done) {
    bus.listen('my.message.props', function (message) {
      message.should.have.property('properties');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.props', { my: 'message' }, { test: 'property' });
    }, 1000);
  });

});