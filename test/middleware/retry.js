var noop = function () {};
var log = require('debug')('servicebus:test')
var bus = require('../bus-shim').bus;

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
        if (count === 4) {
          bus.destroyListener('my.event.5').on('success', function () {
            done();
          });
        }
      });
      setTimeout(function () {
        bus.send('my.event.5', { my: 'event' });
      }, 100);
    });

  });

  describe('publish & subscribe', function () {

    it('rejected messages should retry until max retries', function (done){
      var count = 0;
      bus.subscribe('my.event.15', { ack: true }, function (event) {
        count++;
        log('received my.event.15 ' + count + ' times');
        event.handle.reject();
        if (count === 11) {
          done();
        } 
      });
      setTimeout(function () {
        bus.publish('my.event.15', { my: 'event' });
      }, 100);
    });

  });

});