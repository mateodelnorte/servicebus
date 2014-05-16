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
      var count = 0, endCount = 5000;
      function tryDone(){
        count++;
        if (count > endCount) {
          done();
        }
      }
      bus.listen('my.event.3', function (event) {
        tryDone();
      });
      setTimeout(function () {
        for(var i = 0; i <= endCount; ++i){
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
        //process.nextTick(function () {
          bus.send('my.event.4', { my: 'event' });
          bus.send('my.event.4', { my: 'event' });
          bus.send('my.event.4', { my: 'event' });
          bus.send('my.event.4', { my: 'event' });
        //});
      }, 10);
    });
    
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
        done(new Error('should not receive events after destroy'));
      });
      setTimeout(function () {
        bus.destroyListener('my.event.18').on('success', function () {
          bus.send('my.event.18', { test: 'data'});
          setTimeout(done, 100);
        });
      }, 1500);
    });

  });

})