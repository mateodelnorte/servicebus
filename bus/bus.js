var util = require('util'),
    amqp = require('amqp'),
    events = require('events'),
    PubSubQueue = require('./pubsubqueue'),
    Queue = require('./queue'),
    newId = require('node-uuid');

function Bus(options, implOpts) {
  var noop = function () {};
  options = options || {}, implOpts, self = this;
  options.url = options.url || process.env.RABBITMQ_URL || 'amqp://localhost';
  implOpts =  implOpts || { defaultExchangeName: 'amq.topic' };
  this.log = options.log || { debug: noop, info: noop, warn: noop, error: noop };
  
  this.delayOnStartup = options.delayOnStartup || 10;
  this.initialized = false;
  this.log.debug('connecting to rabbitmq on ' + options.url);
  this.connection = amqp.createConnection(options, implOpts);
  this.pubsubqueues = {};
  this.queues = {};

  var self = this;

  this.connection.on('error', function (err) {
    self.log.error('Error connecting to rabbitmq at '  + options.url + ' error: ' + err.toString());
    throw err;
  });

  this.connection.on('close', function (err) {
    self.log.debug('rabbitmq connection closed.');
  });

  this.connection.on('ready', function () {
    self.initialized = true;
    self.log.debug("rabbitmq connected to " + self.connection.serverProperties.product);
  });
}

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

Bus.prototype.listen = function listen(queueName, options, callback) {
  var self = this;
  this.log.debug('calling listen dog: ', queueName);
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  if (self.initialized) {
    if (self.queues[queueName] === undefined) {
      this.log.debug('creating queue ' + queueName);
      self.queues[queueName] = new Queue(self.connection, queueName, { log: self.log });
    }
    self.queues[queueName].listen(callback, options);
  } else {
    self.connection.on('ready', function() {
      self.log.debug('on ready');
      process.nextTick(function() {
        self.initialized = true;
        self.listen(queueName, options, callback);
      });
    });
  }
};

Bus.prototype.send = function send(queueName, message, cid) {
  var event = packageEvent(queueName, message, cid);
  this._send(queueName, event);
};

Bus.prototype._send = function send(queueName, message) {
  var self = this;
  if (self.initialized) {
    if (self.queues[queueName] === undefined) {
      self.queues[queueName] = new Queue(self.connection, queueName, { log: self.log });
    }
    self.queues[queueName].send(message);
  } else {
    var resend = function() {
      self.initialized = true;
      self._send(queueName, message);
    };
    var timeout = function(){
      self.log.debug('timout triggered');
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

Bus.prototype.subscribe = function subscribe(queueName, options, callback) {
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

Bus.prototype.publish = function publish(queueName, message, cid) {
  var event = packageEvent(queueName, message, cid);
  this._publish(queueName, event);
};

Bus.prototype._publish = function _publish(queueName, message, cid) {
  var self = this;
  if (self.initialized) {
    if (self.pubsubqueues[queueName] === undefined) {
      this.log.debug('creating pubsub queue ' + queueName);
      self.pubsubqueues[queueName] = new PubSubQueue(self.connection, queueName, { log: self.log });
    }
    self.pubsubqueues[queueName].publish(message);
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
  return new Bus(options, implOpts);
};

var namedBuses = {};

module.exports.namedBus = function namedBus(name, options, implOpts) {
  var bus = namedBuses[name];
  if ( ! bus) {
    bus = namedBuses[name] = new Bus(options, implOpts); 
  }
  return bus;
}
