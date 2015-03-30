var amqp = require('amqplib'),
    Bus = require('../bus'),
    Correlator = require('./correlator'),
    log = require('debug')('servicebus'),
    events = require('events'),
    extend = require('extend'),
    json = require('../formatters/json'),
    newId = require('node-uuid'),
    PubSubQueue = require('./pubsubqueue'),
    Promise = require('bluebird'),
    querystring = require('querystring'),
    Queue = require('./queue'),
    util = require('util');

function RabbitMQBus (options) {
  var self = this;

  options = options || {};
  options.exchangeName = options.exchangeName || 'amq.topic';
  options.exchangeOptions = options.exchangeOptions || {};
  options.url = options.url || process.env.RABBITMQ_URL || 'amqp://localhost';
  options.vhost = options.vhost || process.env.RABBITMQ_VHOST || '/';

  this.channels = [];
  this.correlator = new Correlator(options);  
  this.delayOnStartup = options.delayOnStartup || 10;
  this.formatter = json;
  this.log = options.log || log;
  this.pubsubqueues = {};
  this.queues = {};
  this.queuesFile = options.queuesFile;

  var vhost = util.format('/%s', querystring.escape(options.vhost));
  var url = util.format('%s%s', options.url, vhost);

  this.initialized = new Promise(function (resolve, reject) {

    self.log('connecting to rabbitmq on ' + url);

    amqp.connect(url).then(function (conn) {
      
      process.once('SIGINT', function() { 
        self.log('closing channels and connection');
        self.channels.forEach(function (channel) {
          channel.close();
        });
        conn.close(); 
      });

      self.connection = conn;

      function channelError (err) {
        self.log('channel error with connection '  + options.url + ' error: ' + err.toString());
        reject();
        self.emit('error', err);
      }

      function done () {
        if (self.channels.length === 2) {
          resolve();
        }
      }

      self.connection.createChannel().then(function (channel) {
        if (options.concurrency !== undefined) {
          channel.prefetch(options.concurrency);
        }
        channel.on('error', channelError);
        self.sendChannel = channel;
        self.channels.push(channel);
        done();
      });

      self.connection.createChannel().then(function (channel) {
        if (options.concurrency !== undefined) {
          channel.prefetch(options.concurrency);
        }
        channel.on('error', channelError);
        self.listenChannel = channel;
        self.channels.push(channel);
        done();
      });

    }).then(function () {
      self.log('connected to rabbitmq on ' + url);
      self.emit('ready');
    }, function (err) {
      reject(err);
      self.log('error connecting to rabbitmq: ' + err);
      self.emit('error', err);
    });

  });

  Bus.call(this);
}

util.inherits(RabbitMQBus, Bus);

RabbitMQBus.prototype.listen = function listen (queueName, options, callback) {
  var self = this;
  
  self.log('listen on queue ' + queueName);
  
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  this.initialized.done(function() {

    self.setOptions(queueName, options);

    if (self.queues[options.queueName] === undefined) {
      self.log('creating queue ' + options.queueName);
      self.queues[options.queueName] = new Queue(options);
    }

    self.queues[options.queueName].listen(callback, options);
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
    var q = this.queues[queueName];
    delete this.queues[queueName];
    return q.destroy();
  }
};

RabbitMQBus.prototype.setOptions = function (queueName, options) {
  if (typeof queueName === 'object') {
    options.queueName = queueName.queueName;
    options.routingKey = queueName.routingKey;
    queueName = queueName.queueName;
  } else {
    options.queueName = queueName;
  }

  extend(options, { 
    bus: this, 
    correlator: this.correlator,
    formatter: this.formatter,
    listenChannel: this.listenChannel, 
    log: this.log, 
    queuesFile: this.queuesFile,
    sendChannel: this.sendChannel
  });
} 

RabbitMQBus.prototype.send = function send (queueName, message, options) {
  var self = this;
  options = options || {};

  function _send (queueName, message, options) {
    self.setOptions(queueName, options);
    if (self.queues[options.queueName] === undefined) {
      self.queues[options.queueName] = new Queue(options);
    }
    self.handleOutgoing(options.queueName, message, function (queueName, message) {
      self.queues[queueName].send(message, options);
    });
  }

  if ( ! this.initialized.isFulfilled()) {
    self.initialized.done(function() {
      _send(queueName, message, options);
    });
  } else {
    _send(queueName, message, options);
  }

  
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

    self.setOptions(queueName, options);
    if (self.pubsubqueues[options.queueName] === undefined) {
      self.pubsubqueues[options.queueName] = new PubSubQueue(options);
    }
    handle = self.pubsubqueues[options.queueName].subscribe(options, callback);
  });

  return {
    unsubscribe: _unsubscribe
  };

};

RabbitMQBus.prototype.publish = function publish (queueName, message, options) {
  var self = this;
  options = options || {};

  function _publish (queueName, message, options) {
    self.setOptions(queueName, options);
    if (self.pubsubqueues[options.queueName] === undefined) {
      self.log('creating pubsub queue ' + options.queueName);
      self.pubsubqueues[options.queueName] = new PubSubQueue(options);
    }
    self.handleOutgoing(options.queueName, message, function (queueName, message) {
      self.log('publishing ' + queueName + ' event ' + util.inspect(message));
      self.pubsubqueues[queueName].publish(message, options);
    });
  }

  if ( ! this.initialized.isFulfilled()) {
    this.initialized.done(function() {
      _publish(queueName, message, options);
    });
  } else {
    _publish(queueName, message, options);
  }
};

module.exports.Bus = RabbitMQBus;
