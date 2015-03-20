var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('./bus-shim').bus;
var util = require('util');

describe('servicebus', function(){

  describe('#send & #listen', function() {

    it('should cause message to be received by listen', function (done){
      bus.listen('my.event.1', function (event) {
        done();
      });
      setTimeout(function () {
        bus.send('my.event.1', { my: 'event' });
      }, 10);
    });

    it('should distribute out to subsequent listeners when multiple listening', function (done){
      var count = 0;
      function tryDone(){
        count++;
        if (count === 4) {
          done();
        }
      }
      bus.listen('my.event.2', function (event) {
        tryDone();
      });
      bus.listen('my.event.2', function (event) {
        tryDone();
      });
      bus.listen('my.event.2', function (event) {
        tryDone();
      });
      bus.listen('my.event.2', function (event) {
        tryDone();
      });
      setTimeout(function () {
        bus.send('my.event.2', { my: 'event' });
        bus.send('my.event.2', { my: 'event' });
        bus.send('my.event.2', { my: 'event' });
        bus.send('my.event.2', { my: 'event' });
      }, 10);
    });

    it('can handle high event throughput', function (done){
      this.timeout(30000);
      var count = 0, endCount = 15000;
      function tryDone(){
        count++;
        if (count > endCount) {
          done();
        }
      }
      var i = 0;
      bus.listen('my.event.3', function (event) {
        tryDone();
      });
      setTimeout(function () {
        for(var i = 0; i <= endCount; ++i) {
          bus.send('my.event.3', { my: 'event' });
        };
      }, 100);
    });

    it('sends subsequent messages only after previous messages are acknowledged', function (done){
      var count = 0;
      var interval = setInterval(function checkDone () {
        if (count === 4) {
          clearInterval(interval);
          bus.destroyListener('my.event.4').on('success', function () {
            done();
          });
        } 
      }, 10);
      bus.listen('my.event.4', { ack: true }, function (event) {
        count++;
        event.handle.ack();
      });
      setTimeout(function () {
        bus.send('my.event.4', { my: Math.random() }, { ack: true });
        bus.send('my.event.4', { my: Math.random() }, { ack: true });
        bus.send('my.event.4', { my: Math.random() }, { ack: true });
        bus.send('my.event.4', { my: Math.random() }, { ack: true });
      }, 10);
    });

  //   it('allows routing based on routingKey, on same named queue', function (done){
  //     var count = 0;
  //     var interval = setInterval(function checkDone () {
  //       if (count === 4) {
  //         clearInterval(interval);
  //         bus.destroyListener('my.event.routingKey').on('success', function () {
  //           done();
  //         });
  //       } 
  //     }, 10);
  //     bus.listen('my.event.routingKey.1', { ack: true }, function (event) {
  //       count++;
  //       event.handle.ack();
  //     });
  //     bus.listen('my.event.routingKey.2', { ack: true }, function (event) {
  //       count++;
  //       event.handle.ack();
  //     });
  //     bus.listen('my.event.routingKey.3', { ack: true }, function (event) {
  //       count++;
  //       event.handle.ack();
  //     });
  //     bus.listen('my.event.routingKey.4', { ack: true }, function (event) {
  //       count++;
  //       event.handle.ack();
  //     });
  //     setTimeout(function () {
  //       bus.send({ queueName: 'my.event.routingKey', routingKey: 'my.event.routingKey.1' }, { my: 'event1' });
  //       bus.send({ queueName: 'my.event.routingKey', routingKey: 'my.event.routingKey.2' }, { my: 'event2' });
  //       bus.send({ queueName: 'my.event.routingKey', routingKey: 'my.event.routingKey.3' }, { my: 'event3' });
  //       bus.send({ queueName: 'my.event.routingKey', routingKey: 'my.event.routingKey.4' }, { my: 'event4' });
  //     }, 10);
  //   });
    
  });

  describe('#unlisten', function() {

    it('should cause message to not be received by listen', function (done){
      bus.listen('my.event.17', function (event) { 
        done(new Error('should not receive events after unlisten'));
      });
      setTimeout(function () {
        bus.unlisten('my.event.17').on('success', function () {
          bus.send('my.event.17', { test: 'data'});
          setTimeout(function () {
            done();
          }, 100);
        });
      }, 1500);
    });

  });

  describe('#destroyListener', function() {

    it('should cause message to not be received by listen', function (done){
      bus.listen('my.event.18', { ack: true }, function (event) { 
        event.handle.ack();
        // commence ugliest hack ever to get around rabbitmq queue consumer rules
        setTimeout(function () {
          done(new Error('should not receive events after destroy'));
        }, 500);
      });
      setTimeout(function () {
        bus.destroyListener('my.event.18').on('success', function () {
          bus.send('my.event.18', { test: 'data'}, { ack: true, expiration: 100 });
          setTimeout(done, 100);
        });
      }, 1500);
    });

  });

})