'use strict';
var log = require('debug')('servicebus:test')
var bus = require('./bus-shim').bus;
var confirmBus = require('./bus-confirm-shim').bus;
var should = require('should');
var sinon = require('sinon');

describe('servicebus', function () {
  // wait until bus is fully initialized
  before(function (done) {
    if (!bus.initialized) {
      bus.on('ready', done);
    } else {
      done();
    }
  });

  describe('#subscribe & #unsubscribe', function () {
    describe('on temporary queues', function () {
      it('should complete subscribe/unsubscribe cycle', function (done) {
        const subscription = bus.subscribe('test.subunsub.1', function (event) {});

        subscription
          .should.be.a.Object()
          .and.have.ownProperty('unsubscribe');

        subscription.unsubscribe
          .should.be.a.Function();

        subscription.unsubscribe(function () {
          done();
        });
      });

      it('should not receive events after unsubscribe', function (done) {
        const subscription = bus.subscribe('test.subunsub.2', function (event) {
          throw new Error('unexpected event');
        });
        subscription.unsubscribe(function () {
          bus.publish('test.subunsub.2', {test: 2});
          setTimeout(function () {
            done();
          }, 100);
        });
      });

      it('should not receive events after multiple subscribes/unsubscribes', function (done) {
        var receivedEvents = 0;
        const subscription1 = bus.subscribe('test.subunsub.3', function (event) {
          receivedEvents += 1;
        });
        const subscription2 = bus.subscribe('test.subunsub.3', function (event) {
          receivedEvents += 1;
        });

        var subscriptions = 2;
        const onUnsubscribed = function () {
          subscriptions -= 1;
          if (subscriptions == 0) {
            bus.publish('test.subunsub.3', {test: 2});
            setTimeout(function () {
              receivedEvents.should.be.equal(0);
              done();
            }, 100);
          }
        };

        subscription1.unsubscribe(onUnsubscribed());
        subscription2.unsubscribe(onUnsubscribed());
      });
    });

    describe('on persistent queues', function () {
      const testQueue = 'test.subunsub.persistent';
      function _subscribe(eventHandler) {
        return bus.subscribe(testQueue, {ack: true}, eventHandler);
      }

      afterEach(function (done) {
        // drain queue
        var drainedEvents = 0;
        const subscription = _subscribe(function (event) {
          drainedEvents += 1;
          event.handle.ack();
        });
        setTimeout(function () {
          subscription.unsubscribe();
          done();
        }, 200);
      });

      it('should not receive events after unsubscribe', function (done) {
        const ts = Date.now();
        var receivedEvents = 0;
        const subscription = _subscribe(function (event) {
          console.log(ts, event);
          receivedEvents += 1;
          event.handle.ack();
        });
        setTimeout(function () {
          subscription.unsubscribe(function () {
            bus.publish(testQueue, {test: 3, ts: ts}, {ack: true});
            setTimeout(function () {
              receivedEvents.should.be.equal(0);
              done();
            }, 100);
          });
        }, 100);
      });

      it('should not receive events after multiple subscribes/unsubscribes', function (done) {
        var receivedEvents = 0;
        const subscription1 = _subscribe(function (event) {
          receivedEvents += 1;
          event.handle.ack();
        });
        const subscription2 = _subscribe(function (event) {
          receivedEvents += 1;
          event.handle.ack();
        });

        var subscriptions = 2;
        const onUnsubscribed = function () {
          subscriptions -= 1;
          if (subscriptions == 0) {
            bus.publish(testQueue, {test: 4}, {ack: true});
            setTimeout(function () {
              receivedEvents.should.be.equal(0);
              done();
            }, 250);
          }
        };

        setTimeout(function () {
          subscription1.unsubscribe(onUnsubscribed);
          subscription2.unsubscribe(onUnsubscribed);
        }, 100);
      });
    });
  });
});

