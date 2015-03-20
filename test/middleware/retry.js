var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('../bus-shim').bus;

var retry = require('../../bus/middleware/retry');

var should = require('should');

// the following code is being use in the above shim
// var retry = require('../../bus/middleware/retry');
// bus.use(retry());

describe('retry', function() {

  describe('middleware', function () {
    it('should throw if ack called more than once on message', function () {
        var channel = {
        ack: function () {},
        publish: function () {}
      };
      var message = {
        content: {},
        fields: {},
        properties: {
          headers: {}
        }
      };
      var middleware = retry().handleIncoming;
      middleware(channel, message, { ack: true }, function (err, channel, message, options, next) {
        message.content.handle.ack();
        (function () {
          message.content.handle.ack();
        }).should.throw(Error);
      });
    });
    it('should throw if reject called more than max on message', function () {
        var channel = {
        reject: function () {},
        publish: function () {}
      };
      var message = {
        content: {},
        fields: {},
        properties: {
          headers: {}
        }
      };
      var middleware = retry().handleIncoming;
      middleware(channel, message, { ack: true, maxRetries: 3 }, function (err, channel, message, options, next) {
        message.content.handle.reject();
        message.content.handle.reject();
        message.content.handle.reject();
        (function () {
          message.content.handle.reject();
        }).should.throw(Error);
      });
    });
  });

  describe('send & listen', function () {

    it('rejected messages should retry until max retries', function (done) {
      var count = 0;
      bus.listen('my.event.5', { ack: true }, function (event) {
        count++;
        event.handle.reject();
      });
      bus.listen('my.event.5.error', { ack: true }, function (event) {
        count.should.equal(4); // one send and three retries
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
        count.should.equal(4); // one send and three retries
        event.handle.ack();
        // subscription.unsubscribe(function () {
          bus.destroyListener('my.event.15.error').on('success', function () {
            done();
          });
        // });
      });
      setTimeout(function () {
        bus.publish('my.event.15', { data: Math.random() });
      }, 1000);
    });

  });

});
