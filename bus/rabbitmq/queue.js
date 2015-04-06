var EventEmitter = require('events').EventEmitter;
var extend = require('extend');
var util = require('util');

function Queue (options) {
  options = options || {};
  var queueOptions = options.queueOptions || {};

  extend(queueOptions, {
    autoDelete: ! (options.ack || options.acknowledge),
    contentType: options.contentType || 'application/json',
    durable: Boolean(options.ack || options.acknowledge),
    exclusive: options.exclusive || false,
    persistent: Boolean(options.ack || options.acknowledge || options.persistent)
  });

  this.ack = (options.ack || options.acknowledge);
  this.assertQueue = options.assertQueue || true;
  this.bus = options.bus;
  this.errorQueueName = options.queueName + '.error';
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

  EventEmitter.call(this);

  var self = this;

  this.log('asserting queue %s', this.queueName);

  if ( ! this.assertQueue) {
    self.initialized = true;
    self.emit('ready');
  } else {
    this.listenChannel.assertQueue(this.queueName, this.queueOptions).then(function (_qok) {
      if (self.ack) {
        self.log('asserting error queue %s', self.errorQueueName);
        self.listenChannel.assertQueue(self.errorQueueName, self.queueOptions)
        .then(function (_qok) {
          self.initialized = true;
          self.emit('ready');
        });
      } else {
        self.initialized = true;
        self.emit('ready');
      }
    }).catch(function (err) {
      self.log('error connecting to queue %s. error: %s', options.queueName, err.toString());
      self.emit('error', err);
    });
  }
    
}

util.inherits(Queue, EventEmitter);

Queue.prototype.listen = function listen (callback, options) {
  options = options || {};
  queueOptions = options.queueOptions || {};
  
  var self = this;
  
  this.log('listening to queue %s', this.queueName);

  if ( ! this.initialized) {
    return this.on('ready', listen.bind(this, callback, options));
  }

  this.listenChannel.consume(this.queueName, function (message) {
    /*
        Note from http://www.squaremobius.net/amqp.node/doc/channel_api.html 
        & http://www.rabbitmq.com/consumer-cancel.html: 

        If the consumer is cancelled by RabbitMQ, the message callback will be invoked with null.
      */
    if (message === null) {
      return; 
    }
    message.content = options.formatter.deserialize(message.content);
    options.queueType = 'queue';
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

};

Queue.prototype.destroy = function destroy (options) {
  options = options || {};
  var em = new EventEmitter();
  this.log('deleting queue %s', this.queueName);
  this.listenChannel.deleteQueue(this.queueName)
    .then(function (ok) {
      em.emit('success');
    });
  if (this.errorQueueName && this.ack) {
    this.listenChannel.deleteQueue(this.errorQueueName, { ifEmpty: true });
  }
  return em;
};

Queue.prototype.unlisten = function unlisten () {
  var em = new EventEmitter();
  var self = this;

  if (this.subscription) {
    this.listenChannel.cancel(this.subscription.consumerTag)
      .then(function (err, ok) {
      delete self.subscription;
      em.emit('success');
    });
  } else {
    throw new Error('Attempted to unlisten a queue that is not yet listening.');
  }

  return em;
};

Queue.prototype.send = function send (event, options) {
  options = options || {};
  var self = this;

  if ( ! this.initialized) {
    return this.on('ready', send.bind(this, event, options));
  }

  options.contentType = options.contentType || this.contentType;
  options.persistent = Boolean(options.ack || options.acknowledge || options.persistent || self.ack);

  this.sendChannel.sendToQueue(this.routingKey || this.queueName, new Buffer(options.formatter.serialize(event)), options);
  
};

module.exports = Queue;
