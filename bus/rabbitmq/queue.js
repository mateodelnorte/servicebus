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
    self.connection.queue(self.queueName + '.error', queueOptions, function(eq) {
      eq.bind(self.errorQueueName);
      eq.on('queueBindOk', function() {
        self.log('bound to ' + self.errorQueueName);  
      });
    });
  }
  
  var q = this.connection.queue(this.queueName, queueOptions, function() {
    q.bind(self.queueName);
    q.on('queueBindOk', function() {
      self.log('listening to queue ' + self.queueName + ' with options ' + util.inspect(options));
      q.subscribe(options, function (message, headers, deliveryInfo, messageHandle) {
        self.bus.handleIncoming(message, headers, deliveryInfo, messageHandle, options, function (message, headers, deliveryInfo, messageHandle, options) {
           callback(message, headers, deliveryInfo, messageHandle, options);
        });
      });
      self.initialized = true;
    });
  });
};

Queue.prototype.send = function send (event) {
  var self = this;
  process.nextTick(function () {
    self.connection.publish(self.queueName, event, { contentType: 'application/json', deliveryMode: 2 });
  });
};

module.exports = Queue;