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

  /* TODO: determine which resources are being shared between buses and fix the following to work with all tests, in addition to by itself (which it is now) */
  xit('should catch errors with domains when onError supplied', function (done) {
    var busUrl = process.env.RABBITMQ_URL;

    var domainBus = require('../../').bus({ url: busUrl });

    function onError (err, domain) {
      err.should.have.property('message', 'domain error');
      done();
    }

    domainBus.use(domainBus.messageDomain({
      onError: onError
    }));

    domainBus.listen('my.message.domain.3', function (msg) {
      throw new Error('domain error');
    });
    setTimeout(function () {
      domainBus.send('my.message.domain.3', { my: 'message' });
    });
  });

  /* TODO: determine which resources are being shared between buses and fix the following to work with all tests, in addition to by itself (which it is now) */
  xit('should send to error queue after five retries', function (done) {
    var busUrl = process.env.RABBITMQ_URL;

    var domainBus = require('../../').bus({ url: busUrl });

    function onError (err, domain) {
      err.should.have.property('message', 'domain error');
      done();
    }

    domainBus.use(domainBus.messageDomain({ onError: onError }));
    domainBus.use(domainBus.retry({ localOnly: true }));

    var count = 0;
    domainBus.listen('my.message.domain.4', { ack: true }, function (event) {
      count++;
      event.handle.reject();
    });
    domainBus.listen('my.message.domain.4.error', { ack: true }, function (event) {
      count.should.equal(6); // one send and five retries
      event.handle.ack();
      domainBus.destroyListener('my.message.domain.4').on('success', function () {
        domainBus.destroyListener('my.message.domain.4.error').on('success', function () {
          done();
        });
      });
    });
    setTimeout(function () {
      domainBus.send('my.message.domain.4', { my: 'event' });
    }, 100);
  });

});