var events = require('events'),
    newId = require('node-uuid').v4,
    Serializer = require('./serializer'),
    util = require('util');

function PubSubQueue (options) {
  this.bus = options.bus;
  this.connection = options.connection;
  this.correlator = options.correlator;
  this.errorQueueName = options.queueName + '.error';
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = options.queueName;
  this.rejected = {};
  this.exchangeName = this.connection.options.exchangeName;
  this.exchangeOptions = {
    type: this.connection.options.exchangeOptions.type || 'topic',
    durable: this.connection.options.exchangeOptions.durable === false ? false : true,
    autoDelete: this.connection.options.exchangeOptions.autoDelete || false
  };
  var self = this;
  this.connection.exchange(this.exchangeName, this.exchangeOptions, function (exchange) {
    self.exchange = exchange;
    self.connection.emit('readyToPublish');
  });
};

PubSubQueue.prototype.publish = function publish (event, options) {
  var self = this;
  if ( ! this.exchange) {
    this.connection.setMaxListeners(Infinity);
    this.connection.once('readyToPublish', function () {
      options = {
        contentType: options.contentType || 'application/json',
        deliveryMode: options.deliveryMode || 2,
        replyTo: options.replyTo || null
      };
      self.publish(event, options);
    });
  } else {
    this.log('publishing to exchange ' + self.exchange.name + ' ' + self.queueName + ' event ' + util.inspect(event));
    setImmediate(function () {
      if ( ! options.replyTo) {
        delete options.replyTo;
      }
      self.exchange.publish(self.queueName, event, options);
    });
  }
};

PubSubQueue.prototype.subscribe = function subscribe (options, callback) {
  var self = this,
      uniqueName,
      queueOptions = options.queueOptions || {};
  
  this.log('queue options: ', queueOptions);

  if (options && options.ack) {
    queueOptions.durable = true;
    queueOptions.autoDelete = false;
    self.connection.queue(self.errorQueueName, queueOptions, function (q) {
      q.bind(self.exchange, self.errorQueueName);
      q.on('queueBindOk', function() {
        self.log('bound to ' + self.errorQueueName);  
      });
    });
  }

  var queue;
  function _unsubscribe (options) {
    queue.destroy(options);
  }
  this.correlator.queueName(options, function (err, uniqueName) {
    if (err) throw err;
    self.connection.queue(uniqueName, queueOptions, function (q) {
      queue = q;
      q.bind(self.exchange, self.queueName);
      q.on('queueBindOk', function() {
        self.log('subscribing to pubsub queue ' + uniqueName + 'on exchange' + self.exchange.name);
        q.subscribe(options, function (message, headers, deliveryInfo, messageHandle) {
          self.bus.handleIncoming(message, headers, deliveryInfo, messageHandle, options, function (message, headers, deliveryInfo, messageHandle, options) {
             callback(message, headers, deliveryInfo, messageHandle, options);
          });
        });
      });
    });
  });

  return {
    unsubscribe: _unsubscribe
  }
};

module.exports = PubSubQueue;
