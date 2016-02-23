var noop = function () {};
var log = require('debug')('servicebus:test');
var bus = require('../bus-shim').bus;

var retry = require('../../bus/middleware/retry');

var retry = require('servicebus-retry');
var should = require('should');

// the following code is being use in the above shim
// var retry = require('../../bus/middleware/retry');
// bus.use(retry());

describe('retry', function() {

  describe('middleware', function () {
    it('should throw deprecated feature error with link to servicebus-retry', function () {

      should(function () {
        bus.use(bus.retry());
      }).throw(Error)

    });

  });

});
