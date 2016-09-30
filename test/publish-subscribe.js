var noop = function () {};
var log = require('debug')('servicebus:test')
var bus = require('./bus-shim').bus;
var confirmBus = require('./bus-confirm-shim').bus;
var should = require('should');
var sinon = require('sinon');

describe('servicebus', function(){

  before(function (done) {
    // wait until bus is fully initialized
    if (!bus.initialized) {
      bus.on('ready', done);
    } else {
      done();
    }
  });

  describe('#publish & #subscribe', function(){

    it('should cause message to be received by subscribe', function (done){
      bus.subscribe('my.event.11', function (event) {
        done();
      });
      setTimeout(function () {
        bus.publish('my.event.11', { my: 'event' });
      }, 100);
    });

    it('should fan out to when multiple listening', function (done){
      var count = 0;
      var oneDone, twoDone, threeDone, fourDone;
      function tryDone(){
        count++;
        log('received my.event.12 ' + count + ' times');
        if (count === 4 && oneDone && twoDone && threeDone && fourDone) {
          done();
        }
      }
      bus.subscribe('my.event.12', function (event) {
        oneDone = true;
        tryDone();
      });
      bus.subscribe('my.event.12', function (event) {
        twoDone = true;
        tryDone();
      });
      bus.subscribe('my.event.12', function (event) {
        threeDone = true;
        tryDone();
      });
      bus.subscribe('my.event.12', function (event) {
        fourDone = true;
        tryDone();
      });
      setTimeout(function () {
        bus.publish('my.event.12', { my: 'event' });
        bus.publish('my.event.12', { my: 'event' });
        bus.publish('my.event.12', { my: 'event' });
        bus.publish('my.event.12', { my: 'event' });
      }, 100);
    });

    it('can handle high event throughput', function (done){
      this.timeout(30000);
      var count = 0, endCount = 5000;
      function tryDone(){
        count++;
        if (count > endCount) {
          done();
        }
      }
      bus.subscribe('my.event.13', function (event) {
        log('received my.event.13 ' + count + ' times');
        tryDone();
      });
      setTimeout(function () {
        for(var i = 0; i <= endCount; ++i){
          bus.publish('my.event.13', { my: 'event' });
        };
      }, 100);
    });

    it('sends subsequent messages only after previous messages are acknowledged', function (done){
      var count = 0, subscriptions = [];
      var interval = setInterval(function checkDone () {
        if (count === 4) {
          done();
          clearInterval(interval);
          subscriptions.forEach(function (subscription) {
            subscription.unsubscribe();
          });
        }
      }, 100);
      var subscription = bus.subscribe('my.event.14', { ack: true }, function (event) {
        count++;
        log('received my.event.14 ' + count + ' times');
        event.handle.ack();
      });
      subscriptions.push(subscription);
      setTimeout(function () {
        bus.publish('my.event.14', { my: 'event' });
        bus.publish('my.event.14', { my: 'event' });
        bus.publish('my.event.14', { my: 'event' });
        bus.publish('my.event.14', { my: 'event' });
      }, 100);
    });

    it('should use callback in confirm mode', function (done) {
      confirmBus.publish('my.event.15', { my: 'event' }, function (err, ok) {
        done(err);
      });
    });

    it('should use callback in confirm mode with options supplied', function (done) {
      confirmBus.publish('my.event.15', { my: 'event' }, {}, function (err, ok) {
        done(err);
      });
    });

    it('should throw error when using callback and not confirmsEnabled', function (done) {
      bus.publish('my.event.15', { my: 'event' }, function (err, ok) {
        err.should.not.eql(null);
        err.message.should.eql('callbacks only supported when created with bus({ enableConfirms:true })');
        done();
      });
    });

    it('should allow ack:true and autodelete:true for publishes', function (done) {
      var expectation = sinon.mock();
      var subscription = bus.subscribe('my.event.30', { ack: true, autoDelete: true }, function () {
        expectation();
      });
      setTimeout(function () {
        bus.publish('my.event.30', {});
        setTimeout(function () {
          subscription.unsubscribe();
          setTimeout(function () {
            expectation.callCount.should.eql(1);
            bus.destroyListener('my.event.30', { force: true }).on('success', function () {
              done();
            });
          }, 100);
        }, 100);
      }, 100);
    });

    // it('should allow for a mixture of ack:true and ack:false subscriptions', function () {

    // });

    it('should not receive events after successful unsubscribe', function (done) {
      var subscribed = false;
      var subscription = null;

      const unsubscribe = function () {
        subscription.unsubscribe(function () {
          subscribed = false;
          bus.publish('my.event.17', { my: 'event' });
          setTimeout(done, 500);
        });
      };

      const handler = function (event) {
        if (subscribed) {
          unsubscribe();
        } else {
          throw new Error('unexpected invocation');
        }
      };

      subscription = bus.subscribe('my.event.17', handler);
      setTimeout(function () {
        subscribed = true;
        bus.publish('my.event.17', { my: 'event' });
      }, 100);
    });
	});
});
