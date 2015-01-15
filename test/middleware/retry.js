var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('../bus-shim').bus;

var should = require('should');

// the following code is being use in the above shim
// var retry = require('../../bus/middleware/retry');
// bus.use(retry());

describe('retry', function() {

  describe('send & listen', function () {

    it('rejected messages should retry until max retries', function (done) {
      var count = 0;
      bus.listen('my.event.5', { ack: true }, function (event) {
        count++;
        event.handle.reject();
      });
      bus.listen('my.event.5.error', { ack: true }, function (event) {
        count.should.equal(6); // one send and five retries
        event.handle.ack();
        bus.destroyListener('my.event.5').on('success', function () {
          bus.destroyListener('my.event.5.error').on('success', function () {
            done();
          });
        });
      });
      setTimeout(function () {
        bus.send('my.event.5', { my: 'event' });
      }, 100);
    });

  });

  describe('publish & subscribe', function () {

    it('rejected messages should retry until max retries', function (done){
      var count = 0;
      var subscription = bus.subscribe('my.event.15', { ack: true }, function (event) {
        count++;
        event.handle.reject();
      });
      bus.listen('my.event.15.error', { ack: true }, function (event) {
        count.should.equal(6); // one send and five retries
        event.handle.ack();
        // subscription.unsubscribe(function () {
          bus.destroyListener('my.event.15.error').on('success', function () {
            done();
          });
        // });
      });
      setTimeout(function () {
        bus.publish('my.event.15', { data: Math.random() }, { ack: true });
      }, 1000);
    });

  });

});