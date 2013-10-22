var noop = function () {};
var log = require('debug')('servicebus:test')
var servicebus = require('../');
var sinon = require('sinon');

if ( ! process.env.RABBITMQ_URL)
  throw new Error('Tests require a RABBITMQ_URL environment variable to be set, pointing to the RabbiqMQ instance you wish to use.');

var busUrl = process.env.RABBITMQ_URL;

var bus = servicebus.namedBus('namespaced_bus', { 
  namespace: 'my.namespace:',
  url: busUrl 
});

describe('servicebus', function(){

  describe('options:namespace', function(){

    it('should cause queue name for send/listen messages to be prepended with namespace', function(done){
      var queueName = 'queue.to.namespace';
      bus.listen(queueName, function (event) {
        bus.queues.should.have.property('my.namespace:queue.to.namespace');
        done();
      });
      process.nextTick(function () {
        bus.should.have.property('namespace', 'my.namespace:');
        setTimeout(function () {
          bus.send(queueName, { test: 'object' });
        }, 100);
      });
    });

    it('should cause queue name for publish/subscribe messages to be prepended with namespace', function(done){
      var queueName = 'queue.to.namespace';
      bus.subscribe(queueName, function (event) {
        bus.queues.should.have.property('my.namespace:queue.to.namespace');
        done();
      });
      process.nextTick(function () {
        bus.should.have.property('namespace', 'my.namespace:');
        setTimeout(function () {
          bus.publish(queueName, { test: 'object' });
        }, 100); // this is required because the queue is already initialized under the name provided, because we're listening. this would not be an issue when sending between two processes. 
      });
    });

  });
});