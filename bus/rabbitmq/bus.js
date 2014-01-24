var amqp = require('amqp'),
    Bus = require('../bus'),
    log = require('debug')('servicebus'),
    events = require('events'),
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
  });

  this.initialized = new Promise(function (resolve, reject) {
    
    self.connection.on('error', reject);

    self.connection.on('ready', function () {
      self.log("rabbitmq connected to " + self.connection.serverProperties.product);
      resolve();
    });

  }).catch(Promise.CancellationError, function (err) {
    self.log('Error connecting to rabbitmq at '  + options.url + ' error: ' + err.toString());
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

RabbitMQBus.prototype.send = function send (queueName, message) {
  var self = this;

  this.initialized.done(function() {

    if (self.queues[queueName] === undefined) {
      self.queues[queueName] = new Queue({ bus: self, connection: self.connection, queueName: queueName, log: self.log });
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
  
  this.initialized.done(function() {

    if (self.pubsubqueues[queueName] === undefined) {
      self.pubsubqueues[queueName] = new PubSubQueue({ bus: self, connection: self.connection, queueName: queueName, log: self.log });
    }
    self.pubsubqueues[queueName].subscribe(callback, options);

  });

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
