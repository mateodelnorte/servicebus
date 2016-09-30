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
    it('should complete subscribe/unsubscribe cycle', function (done) {
      const subscription = bus.subscribe('my.event.11', function (event) {});

      subscription
        .should.not.equal(bus)
        .and.be.a.Object()
        .and.have.ownProperty('unsubscribe');
      subscription.unsubscribe
        .should.be.a.Function();

      subscription.unsubscribe(function () {
        done();
      });
    });
  });
});

