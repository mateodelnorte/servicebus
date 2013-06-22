var cp = require('child_process');
var noop = function () {};
var bus = require('../').bus();
var should = require('should');

describe('servicebus (child_processes)', function(){

  describe('#send & #listen', function(){

    it('should cause message to be received by listen', function(done){
      var count = 0;
      function tryDone(){
        count++;
        if (count === 1) {
          done();
          sender.kill();
        }
      }

      var sender = cp.fork(__dirname + '/child_processes/sender.js');

      bus.listen('event.22', function (event) {
        tryDone();
      }); 

    });

    // it('should distribute out to subsequent listeners when multiple listening', function(done){
    //   var count = 0;
    //   function tryDone(){
    //     count++;
    //     if (count === 4) {
    //       done();
    //     }
    //   }
    //   bus.listen('my.event.2', function (event) {
    //     tryDone();
    //   });
    //   bus.listen('my.event.2', function (event) {
    //     tryDone();
    //   });
    //   bus.listen('my.event.2', function (event) {
    //     tryDone();
    //   });
    //   bus.listen('my.event.2', function (event) {
    //     tryDone();
    //   });
    //   setTimeout(function () {
    //     bus.send('my.event.2', { my: 'event' });
    //     bus.send('my.event.2', { my: 'event' });
    //     bus.send('my.event.2', { my: 'event' });
    //     bus.send('my.event.2', { my: 'event' });
    //   }, 10);
    // });

    // it('can handle high event throughput', function(done){
    //   var count = 0, endCount = 10000;
    //   function tryDone(){
    //     count++;
    //     if (count > endCount) {
    //       done();
    //     }
    //   }
    //   bus.listen('my.event.3', function (event) {
    //     tryDone();
    //   });
    //   setTimeout(function () {
    //     for(var i = 0; i <= endCount; ++i){
    //       bus.send('my.event.3', { my: 'event' });
    //     };
    //   }, 10);
    // });

    // it('sends subsequent messages only after previous messages are acknowledged', function(done){
    //   var count = 0;
    //   var interval = setInterval(function checkDone () {
    //     if (count === 4) {
    //       done();
    //       clearInterval(interval);
    //     } else {
    //       console.log('not done yet!');
    //     }
    //   }, 10);
    //   bus.listen('my.event.4', { ack: true }, function (event, handle) {
    //     count++;
    //     handle.ack();
    //   });
    //   setTimeout(function () {
    //     bus.send('my.event.4', { my: 'event' });
    //     bus.send('my.event.4', { my: 'event' });
    //     bus.send('my.event.4', { my: 'event' });
    //     bus.send('my.event.4', { my: 'event' });
    //   }, 10);
    // });
  
    // it('rejected messages should retry until max retries', function(done){
    //   var count = 0;
    //   var interval = setInterval(function checkDone () {
    //     if (count === 4) {
    //       done();
    //       clearInterval(interval);
    //     } else {
    //       console.log('not done yet!');
    //     }
    //   }, 10);
    //   bus.listen('my.event.5', { ack: true }, function (event, handle) {
    //     count++;
    //     handle.reject();
    //   });
    //   setTimeout(function () {
    //     bus.send('my.event.5', { my: 'event' });
    //   }, 10);
    // });
  
  });
})