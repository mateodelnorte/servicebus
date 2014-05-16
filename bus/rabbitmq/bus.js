var amqp = require('amqp'),
    Bus = require('../bus'),
    log = require('debug')('servicebus'),
    events = require('events'),
    extend = require('extend'),
    newId = require('node-uuid'),
    PubSubQueue = require('./pubsubqueue'),
    Promise = require('bluebird'),
    Queue = require('./queue'),
    util = require('util');

function RabbitMQBus(options, implOpts) {
  var self = this;

  options = options || {}, implOpts, self = this;
  options.url = options.url || process.env.RABBITMQ_URL || 'amqp://localhost';
  options.vhost = options.vhost || process.env.RABBITMQ_VHOST || '/';
  
  this.delayOnStartup = options.delayOnStartup || 10;
  this.log = options.log || log;
  this.pubsubqueues = {};
  this.queues = {};

  log('connecting to rabbitmq on ' + options.url);

  implOpts =  implOpts || { defaultExchangeName: '' };
  
  this.connection = amqp.createConnection(options, implOpts);

  this.connection.on('close', function () {
    self.log('rabbitmq connection closed.');
    self.emit('close');
  });

  this.connection.on('error', function (err) {
    // if you don't want servicebus to crash on error, you'll need to listen on the 
    // bus' error event, log or do whatever you like. 
    self.emit('error', err);
  });

  this.initialized = new Promise(function (resolve, reject) {
    
    self.connection.on('error', reject);

    self.connection.on('ready', function () {
      self.log("rabbitmq connected to " + self.connection.serverProperties.product);
      self.emit('ready');
      resolve();
    });

  }).catch(Promise.CancellationError, function (err) {
    self.log('Error connecting to rabbitmq at '  + options.url + ' error: ' + err.toString());
    self.emit('error', err);
  });

  Bus.call(this);
}

util.inherits(RabbitMQBus, Bus);


RabbitMQBus.prototype.listen = function listen (queueName, options, callback) {
  var self = this;
  
  log('listen on queue ' + queueName);
  
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  this.initialized.done(function() {

    if (self.queues[queueName] === undefined) {
      log('creating queue ' + queueName);
      self.queues[queueName] = new Queue({ bus: self, connection: self.connection, queueName: queueName, log: self.log });
    }
    self.queues[queueName].listen(callback, options);
  });

};

RabbitMQBus.prototype.unlisten = function unlisten (queueName, options) {  
  if (this.queues[queueName] === undefined) {
    throw new Error('no queue currently listening at ' + queueName);
  } else {
    return this.queues[queueName].unlisten(options);
  }
};

RabbitMQBus.prototype.destroyListener = function removeListener (queueName) {  
  if (this.queues[queueName] === undefined) {
    throw new Error('no queue currently listening at ' + queueName);
  } else {
    return this.queues[queueName].destroy();
  }
};

RabbitMQBus.prototype.send = function send (queueName, message, options) {
  var self = this;
  options = options || {};

  this.initialized.done(function() {
    if (self.queues[queueName] === undefined) {
      extend(options, { bus: self, connection: self.connection, queueName: queueName, log: self.log });
      self.queues[queueName] = new Queue(options);
    }
    self.handleOutgoing(queueName, message, function (queueName, message) {
      log('sending to queue ' + queueName + ' event ' + util.inspect(message));
      self.queues[queueName].send(message);
    });

  });
};

RabbitMQBus.prototype.subscribe = function subscribe (queueName, options, callback) {
  var self = this;

  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  var handle = null;
  function _unsubscribe (options) {
    handle.unsubscribe(options);
  }

  this.initialized.done(function() {
    if (self.pubsubqueues[queueName] === undefined) {
      self.pubsubqueues[queueName] = new PubSubQueue({ bus: self, connection: self.connection, queueName: queueName, log: self.log });
    }
    handle = self.pubsubqueues[queueName].subscribe(callback, options);
  });

  return {
    unsubscribe: _unsubscribe
  }

};

RabbitMQBus.prototype.publish = function publish (queueName, message) {
  var self = this;

  this.initialized.done(function() {
    
    if (self.pubsubqueues[queueName] === undefined) {
      log('creating pubsub queue ' + queueName);
      self.pubsubqueues[queueName] = new PubSubQueue({ bus: self, connection: self.connection, queueName: queueName, log: self.log });
    }
    self.handleOutgoing(queueName, message, function (queueName, message) {
      log('sending to queue ' + queueName + ' event ' + util.inspect(message));
      self.pubsubqueues[queueName].publish(message);
    });

  });

};

module.exports.Bus = RabbitMQBus;
