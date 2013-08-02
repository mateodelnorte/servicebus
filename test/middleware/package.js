var noop = function () {};
var log = require('debug')('servicebus:test')
var bus = require('../bus-shim').bus;

// the following code is being used in the above shim
// var pack = require('../../bus/middleware/package');

// bus.use(pack());

describe('package', function() {

  it('should repackage message into data property and provide a datetime and type property equal to the queue name', function (done) {
    bus.listen('my.message.type', function (message) {
      message.should.have.property('data');
      message.should.have.property('datetime');
      message.should.have.property('type', 'my.message.type');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.type', { my: 'message' });
    }, 1000);
  });

});