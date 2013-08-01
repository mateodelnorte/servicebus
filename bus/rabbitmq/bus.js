var amqp = require('amqp'),
    Bus = require('../bus'),
    log = require('debug')('servicebus'),
    events = require('events'),
    newId = require('node-uuid'),
    PubSubQueue = require('./pubsubqueue'),
    Queue = require('./queue'),
    util = require('util');

function RabbitMQBus(options, implOpts) {
  var self = this;

  options = options || {}, implOpts, self = this;
  options.url = options.url || process.env.RABBITMQ_URL || 'amqp://localhost';
  
  implOpts =  implOpts || { defaultExchangeName: 'amq.topic' };
  
  this.log = options.log || log;
  this.delayOnStartup = options.delayOnStartup || 10;
  this.initialized = false;
  this.pubsubqueues = {};
  this.queues = {};

  log('connecting to rabbitmq on ' + options.url);
  
  this.connection = amqp.createConnection(options, implOpts);

  this.connection.on('error', function (err) {
    self.log('Error connecting to rabbitmq at '  + options.url + ' error: ' + err.toString());
    throw err;
  });

  this.connection.on('close', function () {
    self.log('rabbitmq connection closed.');
  });

  this.connection.on('ready', function () {
    self.initialized = true;
    self.log("rabbitmq connected to " + self.connection.serverProperties.product);
  });

  Bus.call(this);
}

util.inherits(RabbitMQBus, Bus);

function packageEvent(queueName, message, cid) {
  var data = message;
  var event = {
      cid: cid || message.cid || newId()
    , data: data
    , datetime: message.datetime || new Date().toUTCString()
    , type: message.type || queueName
  };
  return event;
}

RabbitMQBus.prototype.listen = function listen (queueName, options, callback) {
  var self = this;
  log('listen on queue ' + queueName);
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  if (self.initialized) {
    if (self.queues[queueName] === undefined) {
      log('creating queue ' + queueName);
      self.queues[queueName] = new Queue(self.connection, queueName, { log: self.log });
    }
    self.queues[queueName].listen(callback, options);
  } else {
    self.connection.on('ready', function() {
      self.log(queueName + ' ready');
      process.nextTick(function() {
        self.initialized = true;
        self.listen(queueName, options, callback);
      });
    });
  }
};

RabbitMQBus.prototype.send = function send (queueName, message) {
  var self = this;
  if (self.initialized) {
    if (self.queues[queueName] === undefined) {
      self.queues[queueName] = new Queue(self.connection, queueName, { log: self.log });
    }
    self.handleOutgoing(queueName, message, function (queueName, message) {
      log('sending to queue ' + queueName + ' event ' + util.inspect(message));
      self.queues[queueName].send(message);
    });
  } else {
    var resend = function() {
      self.initialized = true;
      self._send(queueName, message);
    };
    var timeout = function(){
      self.log('timout triggered');
      self.connection.removeListener('ready', resend);
      process.nextTick(resend);
    };
    var timeoutId = setTimeout(timeout, self.delayOnStartup);
    self.connection.on('ready', function() {
      clearTimeout(timeoutId);
      process.nextTick(resend);
    });
  }
};

RabbitMQBus.prototype.subscribe = function subscribe (queueName, options, callback) {
  var self = this;

  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (self.initialized) {
    if (self.pubsubqueues[queueName] === undefined) {
      self.pubsubqueues[queueName] = new PubSubQueue(self.connection, queueName, { log: self.log });
    }
    self.pubsubqueues[queueName].subscribe(callback, options); 
  } else {
    self.connection.on('ready', function() {
      process.nextTick(function() {
        self.initialized = true;
        self.subscribe(queueName, options, callback);
      });
    });
  }
};

RabbitMQBus.prototype.publish = function publish (queueName, message) {
  var self = this;
  if (self.initialized) {
    if (self.pubsubqueues[queueName] === undefined) {
      log('creating pubsub queue ' + queueName);
      self.pubsubqueues[queueName] = new PubSubQueue(self.connection, queueName, { log: self.log });
    }
    self.handleOutgoing(queueName, message, function (queueName, message) {
      self.pubsubqueues[queueName].publish(message);
    });
  } else {
    var republish = function() {
      self.initialized = true;
      self._publish(queueName, message);
    };
    self.connection.on('ready', function() {
      process.nextTick(republish);
    });
  }
};

module.exports.bus = function bus (options, implOpts) {
  return new RabbitMQBus(options, implOpts);
};

module.exports.Bus = RabbitMQBus;
