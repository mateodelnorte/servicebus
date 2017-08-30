var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('../bus-shim').bus;
var uuid = require('node-uuid');

// the following code is being used in the above shim
// var pack = require('../../bus/middleware/package');

// bus.use(pack());

describe('package', function() {

  it('should repackage message into data property and provide a datetime and type property equal to the queue name', function (done) {
    bus.listen('my.message.package', function (message) {
      message.should.have.property('data');
      message.should.have.property('datetime');
      message.should.have.property('type', 'my.message.package');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.package', { my: 'message' });
    }, 1000);
  });

  it('should honor message correlation id when packaging', function (done) {
    bus.listen('my.message.package.1', function (message) {
      message.should.have.property('cid');
      message.should.have.property('data');
      message.should.have.property('datetime');
      message.should.have.property('type', 'my.message.package.1');
      done();
    });
    setTimeout(function () {
      bus.send('my.message.package.1', { cid: uuid(), my: 'message' });
    }, 1000);
  });

});
