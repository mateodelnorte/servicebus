var noop = function () {};
var log = require('debug')('servicebus:test')
var bus = require('../bus-shim').bus;

// the following code is being use in the above shim
// var correlate = require('../../bus/middleware/correlate');

// bus.use(correlate());

describe('correlate', function() {

  it('should cause a unique cid property to be added to an outgoing message', function (done) {
    bus.listen('my.message.11', function (message) {
      message.should.have.property('cid'); // message.data will have it since we're using both correlate and package in our tests
      done();
    });
    setTimeout(function () {
      bus.send('my.message.11', { my: 'message' });
    }, 1000);
  });

});