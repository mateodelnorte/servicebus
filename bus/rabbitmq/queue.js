var events = require('events'),
    util = require('util');

function Queue(options) {
  this.bus = options.bus;
  this.connection = options.connection;
  this.errorQueueName = options.queueName + '.error';
  this.initialized = false;
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = options.queueName;
  this.rejected = {};
  this.contentType = options.contentType || 'application/json';
  this.deliveryMode = (options.ack || options.acknowledge || options.persistent) ? 2 : 1; // default to non-persistent messages

  events.EventEmitter.call(this);
}

util.inherits(Queue, events.EventEmitter);

Queue.prototype.error = function error (event) {
  this.log('Message moved to error queue: ' + this.errorQueueName);
  this.connection.publish(this.errorQueueName, event, { contentType: 'application/json', deliveryMode: 2 });
};

Queue.prototype.listen = function listen (callback, options) {
  var options = options || {},
      queueOptions = options.queueOptions || {};
  
  var self = this;

  if (options && options.ack) {
    queueOptions.durable = true;
    queueOptions.autoDelete = false;
    self.errorQueue = self.connection.queue(self.queueName + '.error', queueOptions, function(eq) {
      eq.bind(self.errorQueueName);
      eq.on('queueBindOk', function() {
        self.log('bound to ' + self.errorQueueName);  
      });
    });
  }
  
  self.queue = this.connection.queue(this.queueName, queueOptions, function() {
    self.queue.bind(self.queueName);
    self.queue.on('queueBindOk', function() {
      self.log('listening to queue ' + self.queueName + ' with options ' + util.inspect(options));
      self.queue.subscribe(options, function (message, headers, deliveryInfo, messageHandle) {
        self.bus.handleIncoming(message, headers, deliveryInfo, messageHandle, options, function (message, headers, deliveryInfo, messageHandle, options) {
           callback(message, headers, deliveryInfo, messageHandle, options);
        });
      }).on('success', function (subscription) {
        self.subscription = subscription;
      });
      self.initialized = true;
    });
  });
};

Queue.prototype.destroy = function destroy (options) {
  options = options || {};
  if ( ! options.preserveErrorQueue && this.errorQueue) this.errorQueue.destroy(options);
  return this.queue.destroy(options);
}

Queue.prototype.unlisten = function unlisten () {
  if (this.subscription) {
    return this.queue.unsubscribe(this.subscription.consumerTag);
  } else {
    throw new Error('Attempted to unlisten a queue that is not yet listening.');
  }
}

Queue.prototype.send = function send (event, options) {
  var self = this;
  process.nextTick(function () {
    self.connection.publish(self.queueName, event, { 
      contentType: self.contentType, 
      deliveryMode: self.deliveryMode
    });
  });
};

module.exports = Queue;