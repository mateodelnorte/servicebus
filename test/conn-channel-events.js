var log = require('debug')('servicebus:test');
var sinon = require('sinon');
var util = require('util');

describe('servicebus', function(){

  describe('#close', function() {

    var bus;

    beforeEach(function(done) {
      bus = require('../').bus({ prefetch: 5, url: process.env.RABBITMQ_URL });

      if (!bus.initialized) {
        bus.on('ready', done);
      } else {
        done();
      }
    });

    it('should emit connection.close event', function (done){

      bus.on('connection.close', function (event) {
        done();
      });

      bus.listen('my.event.50', function (event) {
        bus.close();
      });

      setTimeout(function () {
        bus.send('my.event.50', { my: 'event' });
      }, 10);
    });

    it('should emit channel.close event', function (done){

      bus.once('channel.close', function (event) {
        done();
      });

      bus.listen('my.event.51', function (event) {
        bus.close();
      });

      setTimeout(function () {
        bus.send('my.event.51', { my: 'event' });
      }, 10);
    });

  });
});
