var noop = function () {};
var log = require('debug')('servicebus:test')
var bus = require('./bus-shim').bus;

describe('servicebus', function(){

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
      function tryDone(){
        count++;
        log('received my.event.12 ' + count + ' times');
        if (count === 4) {
          done();
        }
      }
      bus.subscribe('my.event.12', function (event) {
        tryDone();
      });
      bus.subscribe('my.event.12', function (event) {
        tryDone();
      });
      bus.subscribe('my.event.12', function (event) {
        tryDone();
      });
      bus.subscribe('my.event.12', function (event) {
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

    // it('should allow for a mixture of ack:true and ack:false subscriptions', function () {

    // });
  
	});
});