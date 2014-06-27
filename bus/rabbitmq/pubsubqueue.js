var events = require('events');
var extend = require('extend');
var newId = require('node-uuid').v4;
var Serializer = require('./serializer');
var util = require('util');

function PubSubQueue (options) {

  var options = options || {};
  var exchangeOptions = options.exchangeOptions || {};
  var queueOptions = options.queueOptions || {};

  extend(queueOptions, {
    autoDelete: true,//! Boolean(options.ack || options.acknowledge,
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
  this.listenChannel = options.listenChannel;
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = options.queueName;
  this.queueOptions = queueOptions;
  this.rejected = {};
  this.routingKey = options.routingKey;
  this.sendChannel = options.sendChannel;

  // set a promise in order to chain off of initilized?
  this.log('asserting exchange %s', this.exchangeName)
  this.sendChannel.assertExchange(this.exchangeName, this.exchangeOptions.type || 'topic', this.exchangeOptions);
};

PubSubQueue.prototype.publish = function publish (event, options) {
  options = options || {};
  var self = this;

  this.log('publishing to exchange ' + self.exchangeName + ' ' + self.queueName);

  extend(options, {
    contentType: this.contentType,
    formatter: this.formatter,
    persistent: Boolean(options.ack || options.acknowledge || options.persistent || self.ack)
  });
  
  setImmediate(function () {
    self.sendChannel.publish(self.exchangeName, self.routingKey || self.queueName, new Buffer(options.formatter.serialize(event)), options);
  });
};

PubSubQueue.prototype.subscribe = function subscribe (options, callback) {
  var self = this;

  function _unsubscribe (options) {
    self.listenChannel.cancel(self.subscription.consumerTag, options);
  }

  this.correlator.queueName(options, function (err, uniqueName) {
    if (err) throw err;
    self.listenChannel.assertQueue(uniqueName, self.queueOptions)
      .then(function (qok) {
        return self.listenChannel.bindQueue(uniqueName, self.exchangeName, self.routingKey || self.queueName);
      }).then(function (queue) {
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
          self.bus.handleIncoming(self.listenChannel, message, options, function (channel, message, options) {
             callback(message.content);
          });
        }, { noAck: ! self.ack })
          .then(function (ok) {
            self.subscription = { consumerTag: ok.consumerTag };
          });;
      });

  });

  return {
    unsubscribe: _unsubscribe
  }
};

module.exports = PubSubQueue;
