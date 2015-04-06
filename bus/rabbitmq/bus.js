var amqp = require('amqplib'),
    Bus = require('../bus'),
    Correlator = require('./correlator'),
    log = require('debug')('servicebus'),
    events = require('events'),
    extend = require('extend'),
    json = require('../formatters/json'),
    newId = require('node-uuid'),
    PubSubQueue = require('./pubsubqueue'),
    querystring = require('querystring'),
    Queue = require('./queue'),
    util = require('util');

function RabbitMQBus (options) {
  var self = this;

  options = options || {};
  options.url = options.url || process.env.RABBITMQ_URL || 'amqp://localhost';
  options.vhost = options.vhost || process.env.RABBITMQ_VHOST || '/';
  options.exchangeName = options.exchangeName || 'amq.topic';
  options.exchangeOptions = options.exchangeOptions || {};

  this.assertQueuesOnFirstSend = options.assertQueuesOnFirstSend || true;
  this.channels = [];
  this.correlator = new Correlator(options);  
  this.delayOnStartup = options.delayOnStartup || 10;
  this.formatter = json;
  this.initialized = false;
  this.log = options.log || log;
  this.pubsubqueues = {};
  this.queues = {};
  this.queuesFile = options.queuesFile;

  var vhost = util.format('/%s', querystring.escape(options.vhost));
  var url = util.format('%s%s', options.url, vhost);

  self.log('connecting to rabbitmq on %s', url);

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
      self.log('channel error with connection %s error: %s', options.url, err.toString());
      self.emit('error', err);
    }

    function done () {
      if (self.channels.length === 2) {
        self.initialized = true;
        self.log('connected to rabbitmq on %s', url);
        self.emit('ready');
      }
    }

    self.connection.createChannel().then(function (channel) {
      channel.on('error', channelError);
      self.sendChannel = channel;
      self.channels.push(channel);
      done();
    });

    self.connection.createChannel().then(function (channel) {
      channel.on('error', channelError);
      self.listenChannel = channel;
      self.channels.push(channel);
      done();
    });

  }, function (err) {
    self.log('error connecting to rabbitmq: %s', err);
    self.emit('error', err);
  });

  Bus.call(this);
}

util.inherits(RabbitMQBus, Bus);

RabbitMQBus.prototype.listen = function listen (queueName, options, callback) {
  
  this.log('listen on queue %s', queueName);
  
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  if ( ! this.initialized) {
    return this.on('ready', listen.bind(this, queueName, options, callback));
  }

  this.setOptions(queueName, options);

  if (this.queues[options.queueName] === undefined) {
    this.log('creating queue %s', options.queueName);
    this.queues[options.queueName] = new Queue(options);
  }

  this.queues[options.queueName].listen(callback, options);

};

RabbitMQBus.prototype.unlisten = function unlisten (queueName, options) {  
  if (this.queues[queueName] === undefined) {
    throw new Error('no queue currently listening at %s', queueName);
  } else {
    return this.queues[queueName].unlisten(options);
  }
};

RabbitMQBus.prototype.destroyListener = function removeListener (queueName) {  
  if (this.queues[queueName] === undefined) {
    throw new Error('no queue currently listening at %s', queueName);
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
    assertQueue: this.assertQueuesOnFirstSend,
    bus: this, 
    correlator: this.correlator,
    formatter: this.formatter,
    listenChannel: this.listenChannel, 
    log: this.log, 
    queuesFile: this.queuesFile,
    sendChannel: this.sendChannel
  });
};

RabbitMQBus.prototype.send = function send (queueName, message, options) {
  options = options || {};

  if ( ! this.initialized) {
    return this.on('ready', send.bind(this, queueName, message, options));
  }

  this.setOptions(queueName, options);
  if (this.queues[options.queueName] === undefined) {
    this.queues[options.queueName] = new Queue(options);
  }
  this.handleOutgoing(options.queueName, message, function (queueName, message) {
    this.queues[queueName].send(message, options);
  }.bind(this));

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

  if ( ! this.initialized) {
    return this.on('ready', subscribe.bind(this, queueName, options, callback));
  }

  this.setOptions(queueName, options);

  if (this.pubsubqueues[options.queueName] === undefined) {
    this.log('creating pusubqueue %s', options.queueName);
    this.pubsubqueues[options.queueName] = new PubSubQueue(options);
  }

  handle = this.pubsubqueues[options.queueName].subscribe(options, callback);

  return {
    unsubscribe: _unsubscribe
  };

};

RabbitMQBus.prototype.publish = function publish (queueName, message, options) {
  options = options || {};

  if ( ! this.initialized) {
    return this.on('ready', publish.bind(this, queueName, message, options));
  }

  this.setOptions(queueName, options);

  if (this.pubsubqueues[options.queueName] === undefined) {
    this.pubsubqueues[options.queueName] = new PubSubQueue(options);
  }

  this.handleOutgoing(options.queueName, message, function (queueName, message) {
    this.pubsubqueues[queueName].publish(message, options);
  }.bind(this));

};

module.exports.Bus = RabbitMQBus;