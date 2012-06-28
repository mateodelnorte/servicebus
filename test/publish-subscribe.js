var noop = function () {};
var log = { debug: noop, info: noop, warn: noop, error: noop };
var bus = require('../bus/bus').bus({ log: log });

describe('servicebus', function(){

  describe('#publish & #subscribe', function(){

    it('should cause message to be received by subscribe', function(done){
      bus.subscribe('my.event.11', function (event) {
        done();
      });
      setTimeout(function () {
        bus.publish('my.event.11', { my: 'event' });
      }, 10);
    });

    it('should fan out to when multiple listening', function(done){
      var count = 0;
      function tryDone(){
        count++;
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
      }, 10);
    });

    it('can handle high event throughput', function(done){
      var count = 0, endCount = 10000;
      function tryDone(){
        count++;
        if (count > endCount) {
          done();
        }
      }
      bus.subscribe('my.event.13', function (event) {
        tryDone();
      });
      setTimeout(function () {
        for(var i = 0; i <= endCount; ++i){
          bus.publish('my.event.13', { my: 'event' });
        };
      }, 10);
    });

    it('sends subsequent messages only after previous messages are acknowledged', function(done){
      var count = 0;
      var interval = setInterval(function checkDone () {
        if (count === 4) {
          done();
          clearInterval(interval);
        } else {
          console.log('not done yet!');
        }
      }, 10);
      bus.subscribe('my.event.14', { ack: true }, function (event, handle) {
        count++;
        handle.ack();
      });
      setTimeout(function () {
        bus.publish('my.event.14', { my: 'event' });
        bus.publish('my.event.14', { my: 'event' });
        bus.publish('my.event.14', { my: 'event' });
        bus.publish('my.event.14', { my: 'event' });
      }, 10);
    });
  
    it('rejected messages should retry until max retries', function(done){
      var count = 0;
      var interval = setInterval(function checkDone () {
        if (count === 4) {
          done();
          clearInterval(interval);
        } else {
          console.log('not done yet!');
        }
      }, 10);
      bus.subscribe('my.event.15', { ack: true }, function (event, handle) {
        count++;
        handle.reject();
      });
      setTimeout(function () {
        bus.publish('my.event.15', { my: 'event' });
      }, 10);
    });
  
	});
});