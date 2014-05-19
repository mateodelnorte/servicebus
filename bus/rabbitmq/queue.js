var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var util = require('util');

function Queue (options) {
  var options = options || {};
  var queueOptions = options.queueOptions || {};
  this.bus = options.bus;
  this.connection = options.connection;
  this.errorQueueName = options.queueName + '.error';
  this.initialized = false;
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = options.queueName;
  this.rejected = {};
  this.routingKey = options.routingKey;
  this.contentType = options.contentType || 'application/json';
  this.deliveryMode = (options.ack || options.acknowledge || options.persistent) 
    ? 2 
    : 1; // default to non-persistent messages
  this.ack = (options.ack || options.acknowledge);

  EventEmitter.call(this);

  var self = this;

  this.initialized = Promise.all([
    // we're initialized when our queues are bound
    new Promise(function (resolve, reject) {
      self.log('connecting to queue ' + self.queueName);
      self.queue = self.connection.queue(self.queueName, queueOptions, function () {
        self.log('binding to routingKey ' + self.routingKey || self.queueName);
        self.queue.bind(self.routingKey || self.queueName);
        self.queue.on('queueBindOk', function() {
          self.log('bound to queue ' + self.queueName);
          resolve();
        });
      });
    }),
    new Promise(function (resolve, reject) {
      if (self.ack) {
        queueOptions.durable = true;
        queueOptions.autoDelete = false;
        self.errorQueue = self.connection.queue(self.queueName + '.error', queueOptions, function (eq) {
          eq.bind(self.errorQueueName);
          eq.on('queueBindOk', function () {
            self.log('bound to ' + self.errorQueueName);  
            resolve();
          });
        });
      } else {
        resolve();
      }
    })
  ]).catch(function (err) {
    self.log('error connecting to queue ', options.queueName, '. error: ' + err.toString());
    self.emit('error', err);
  });

}

util.inherits(Queue, EventEmitter);

Queue.prototype.error = function error (event) {
  this.log('Message moved to error queue: ' + this.errorQueueName);
  this.connection.publish(this.errorQueueName, event, { contentType: 'application/json', deliveryMode: 2 });
};

Queue.prototype.listen = function listen (callback, options) {
  var options = options || {},
      queueOptions = options.queueOptions || {};
  
  var self = this;
  
  this.log('listening to queue ' + this.queueName + ' with options ' + util.inspect(options));

  this.initialized.done(function () {
    self.queue.subscribe(options, function (message, headers, deliveryInfo, messageHandle) {
      self.bus.handleIncoming(message, headers, deliveryInfo, messageHandle, options, function (message, headers, deliveryInfo, messageHandle, options) {
         callback(message, headers, deliveryInfo, messageHandle, options);
      });
    }).on('success', function (subscription) {
      self.subscription = subscription;
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
  this.initialized.done(function () {
    self.connection.publish(self.routingKey || self.queueName, event, { 
      contentType: self.contentType, 
      deliveryMode: self.deliveryMode
    });
  });
};

module.exports = Queue;