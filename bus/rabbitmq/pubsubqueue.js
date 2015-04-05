var events = require('events');
var extend = require('extend');
var newId = require('node-uuid').v4;
var util = require('util');

function PubSubQueue (options) {
  options = options || {};
  var exchangeOptions = options.exchangeOptions || {};
  var queueOptions = options.queueOptions || {};

  extend(queueOptions, {
    autoDelete: ! (options.ack || options.acknowledge),
    contentType: options.contentType || 'application/json',
    durable: Boolean(options.ack || options.acknowledge),
    exclusive: options.exclusive || false,
    persistent: Boolean(options.ack || options.acknowledge || options.persistent)
  });

  extend(exchangeOptions, {
    type: exchangeOptions.type || 'topic',
    durable: exchangeOptions.durable === false ? false : true,
    autoDelete: exchangeOptions.autoDelete || false
  });

  this.ack = (options.ack || options.acknowledge);
  this.bus = options.bus;
  this.correlator = options.correlator;
  this.errorQueueName = options.queueName + '.error';
  this.exchangeName = options.exchangeName || 'amq.topic';
  this.exchangeOptions = exchangeOptions;
  this.formatter = options.formatter;
  this.initialized = false;
  this.listenChannel = options.listenChannel;
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = options.queueName;
  this.queueOptions = queueOptions;
  this.rejected = {};
  this.routingKey = options.routingKey;
  this.sendChannel = options.sendChannel;

  this.log('asserting exchange %s', this.exchangeName);
  this.sendChannel.assertExchange(this.exchangeName, this.exchangeOptions.type || 'topic', this.exchangeOptions);
}

PubSubQueue.prototype.publish = function publish (event, options) {
  options = options || {};
  var self = this;

  options.contentType = options.contentType || this.contentType;
  
  self.sendChannel.publish(self.exchangeName, self.routingKey || self.queueName, new Buffer(options.formatter.serialize(event)), options);
  
};

PubSubQueue.prototype.subscribe = function subscribe (options, callback) {
  var self = this;

  function _unsubscribe (cb) {
    self.listenChannel.cancel(self.subscription.consumerTag, cb);
  }

  function _subscribe (uniqueName) {
    self.listenChannel.consume(uniqueName, function (message) {
      /*
          Note from http://www.squaremobius.net/amqp.node/doc/channel_api.html 
          & http://www.rabbitmq.com/consumer-cancel.html: 

          If the consumer is cancelled by RabbitMQ, the message callback will be invoked with null.
        */
      if (message === null) {
        return; 
      }
      // todo: map contentType to default formatters
      message.content = options.formatter.deserialize(message.content);
      options.queueType = 'pubsubqueue';
      self.bus.handleIncoming(self.listenChannel, message, options, function (channel, message, options) {
        // amqplib intercepts errors and closes connections before bubbling up
        // to domain error handlers when they occur non-asynchronously within
        // callback. Therefore, if there is a process domain, we try-catch to
        // redirect the error, assuming the domain creator's intentions.
        try {
          callback(message.content, message);
        } catch (err) {
          if (process.domain && process.domain.listeners('error')) {
            process.domain.emit('error', err);
          } else {
            self.emit('error', err);
          }
        }
      });
    }, { noAck: ! self.ack })
      .then(function (ok) {
        self.subscription = { consumerTag: ok.consumerTag };
      });
  }

  self.correlator.queueName(options, function (err, uniqueName) {
    if (err) throw err;
    self.listenChannel.assertQueue(uniqueName, self.queueOptions)
      .then(function (qok) {
        return self.listenChannel.bindQueue(uniqueName, self.exchangeName, self.routingKey || self.queueName);
      }).then(function () {
        if (self.ack) {
          self.log('asserting error queue ' + self.errorQueueName);
          self.listenChannel.assertQueue(self.errorQueueName, self.queueOptions)
          .then(function (_qok) {
            _subscribe(uniqueName);
          });
        } else {
          _subscribe(uniqueName);
        }
      });
  });

  return {
    unsubscribe: _unsubscribe
  };
};

module.exports = PubSubQueue;
