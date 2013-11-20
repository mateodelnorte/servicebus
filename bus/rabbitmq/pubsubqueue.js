var Correlator = require('./correlator'),
    events = require('events'),
    newId = require('node-uuid').v4,
    Serializer = require('./serializer'),
    util = require('util');

function PubSubQueue (options) {
  this.bus = options.bus;
  this.connection = options.connection;
  this.correlator = new Correlator();
  this.errorQueueName = options.queueName + '.error';
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = options.queueName;
  this.rejected = {}; 
  var self = this;
  this.connection.exchange('amq.topic', { type: 'topic', durable: true, autoDelete: false }, function (exchange) {
    self.exchange = exchange;
    self.connection.emit('readyToPublish');
  });
};

PubSubQueue.prototype.publish = function publish (event) {
  var self = this;
  if ( ! this.exchange) {
    this.connection.once('readyToPublish', function () {
      self.publish(event);
    });
  } else {
    this.log('publishing to exchange ' + self.exchange.name + ' ' + self.queueName + ' event ' + util.inspect(event));
    process.nextTick(function () {
      self.exchange.publish(self.queueName, event, { contentType: 'application/json', deliveryMode: 2 });
    });
  }
};

PubSubQueue.prototype.subscribe = function subscribe (callback, options) {
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

  this.correlator.getUniqueId(self.queueName, options.subscriptionId, function (err, _id) {
    if (err) throw err;
    uniqueName = _id;
    self.connection.queue(uniqueName, queueOptions, function (q) {
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
};

module.exports = PubSubQueue;
