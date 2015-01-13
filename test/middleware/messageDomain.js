var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('../bus-shim').bus;

// the following code is being use in the above shim
// var domain = require('../../bus/middleware/domain');

// bus.use(domain());

describe('messageDomain', function() {

  it('should process incoming message in new domain', function (done) {
    bus.listen('my.message.domain.1', function (message) {
      process.should.have.property('domain');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.domain.1', { my: 'message' });
    }, 1000);
  });

  it('should cause a provided correlationId property to be added to current domain', function (done) {
    bus.listen('my.message.domain.2', function (message) {
      process.domain.should.have.property('correlationId', 'test-value');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.domain.2', { my: 'message' }, { correlationId: 'test-value' });
    }, 1000);
  });

});