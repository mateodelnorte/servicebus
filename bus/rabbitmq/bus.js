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

function RabbitMQBus (options, implOpts) {
  var self = this;

  options = options || {};
  options.url = options.url || process.env.RABBITMQ_URL || 'amqp://localhost';
  options.vhost = options.vhost || process.env.RABBITMQ_VHOST;
  options.exchangeName = options.exchangeName || 'amq.topic';
  options.exchangeOptions = options.exchangeOptions || {};

  this.assertQueuesOnFirstSend = (options.assertQueuesOnFirstSend === undefined) ? true : options.assertQueuesOnFirstSend;
  this.channels = [];
  this.correlator = options.correlator || new Correlator(options);
  this.delayOnStartup = options.delayOnStartup || 10;
  this.exchangeName = options.exchangeName;
  this.formatter = json;
  this.initialized = false;
  this.log = options.log || log;
  this.prefetch = options.prefetch;
  this.pubsubqueues = {};
  this.queues = {};
  this.queuesFile = options.queuesFile;

  var vhost = options.vhost && util.format('/%s', querystring.escape(options.vhost));
  var url = vhost ? util.format('%s%s', options.url, vhost) : options.url;

  self.log('connecting to rabbitmq on %s', url);

  amqp.connect(url, implOpts).then(function (conn) {

    self.connection = conn;

    function channelError (err) {
      self.log('channel error with connection %s error: %s', options.url, err.toString());
      self.emit('error', err);
    }

    conn.on('close', self.emit.bind(self, 'connection.close'));
    conn.on('error', self.emit.bind(self, 'connection.error'));

    function done () {
      if (self.channels.length === (options.enableConfirms ? 3 : 2)) {
        self.initialized = true;
        self.log('connected to rabbitmq on %s', url);
        self.emit('ready');
      }
    }

    self.connection.createChannel().then(function (channel) {
      channel.on('error', channelError);
      channel.on('close', self.emit.bind(self, 'channel.close'));
      self.sendChannel = channel;
      if (options.prefetch) {
        self.sendChannel.prefetch(options.prefetch);
      }
      self.channels.push(channel);
      done();
    });

    self.connection.createChannel().then(function (channel) {
      channel.on('error', channelError);
      channel.on('close', self.emit.bind(self, 'channel.close'));
      self.listenChannel = channel;
      if (options.prefetch) {
        self.listenChannel.prefetch(options.prefetch);
      }
      self.channels.push(channel);
      done();
    });

    if (options.enableConfirms) {
      self.connection.createConfirmChannel().then(function (channel) {
        channel.on('error', channelError);
        channel.on('close', self.emit.bind(self, 'channel.close'));
        self.confirmChannel = channel;
        if (options.prefetch) {
          self.confirmChannel.prefetch(options.prefetch);
        }
        self.channels.push(channel);
        done();
      });
    }

  }).catch(function (err) {
    self.log('error connecting to rabbitmq: %s', err);
    self.emit('error', err);
  });

  Bus.call(this);
}

util.inherits(RabbitMQBus, Bus);

RabbitMQBus.prototype.listen = function listen (queueName, options, callback) {

  var self = this;

  this.log('listen on queue %j', queueName);

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
    var queue = new Queue(options);
    queue.on('listening', function () {
      self.emit('listening', queue);
    });
    this.queues[options.queueName] = queue;
  }

  this.queues[options.queueName].listen(callback, options);

};

RabbitMQBus.prototype.unlisten = function unlisten (queueName, options) {
  if (this.queues[queueName] === undefined) {
    throw new Error(util.format('no queue currently listening at %s', queueName));
  } else {
    var result = this.queues[queueName].unlisten(options);
    delete this.queues[queueName];
    return result;
  }
};

RabbitMQBus.prototype.destroyListener = function removeListener (queueName, options) {
  options = options || {};
  if ( ! options.force && this.queues[queueName] === undefined) {
    throw new Error(util.format('no queue currently listening at %s', queueName));
  } else {
    var q = this.queues[queueName];
    if (! q && options.force) {
      var em = new events.EventEmitter();
      this.listenChannel.deleteQueue(queueName, { ifEmpty: false })
        .then(function (ok) {
          em.emit('success');
        });
      return em;
    }
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
    confirmChannel: this.confirmChannel,
    correlator: this.correlator,
    formatter: this.formatter,
    listenChannel: this.listenChannel,
    log: this.log,
    queuesFile: this.queuesFile,
    sendChannel: this.sendChannel
  });
};

RabbitMQBus.prototype.send = function send (queueName, message, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  options = options || {};

  if ( ! this.initialized) {
    return this.on('ready', send.bind(this, queueName, message, options, cb));
  }

  if (cb && ! this.confirmChannel) return cb(new Error('callbacks only supported when created with bus({ enableConfirms:true })'))

  this.setOptions(queueName, options);

  var key = this.confirmChannel && cb ? options.queueName + '.confirm' : options.queueName;

  if (this.queues[key] === undefined) {
    this.queues[key] = new Queue(options);
  }

  this.handleOutgoing(options.queueName, message, options, function (queueName, message, options) {
    this.queues[key].send(message, options, cb);
  }.bind(this));

};

RabbitMQBus.prototype.subscribe = function subscribe (queueName, options, callback) {
  var self = this;

  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  this.log('subscribe on queue %j', queueName);

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
    var pubSubQueue = new PubSubQueue(options);
    pubSubQueue.on('subscribed', function () {
      self.emit('subscribed', pubSubQueue);
    });
    this.pubsubqueues[options.queueName] = pubSubQueue;
  }

  handle = this.pubsubqueues[options.queueName].subscribe(options, callback);

  return {
    unsubscribe: _unsubscribe
  };

};

RabbitMQBus.prototype.publish = function publish (queueName, message, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  options = options || {};

  if ( ! this.initialized) {
    return this.on('ready', publish.bind(this, queueName, message, options, cb));
  }

  if (cb && ! this.confirmChannel) return cb(new Error('callbacks only supported when created with bus({ enableConfirms:true })'))

  this.setOptions(queueName, options);

  var key = this.confirmChannel && cb  ? options.queueName + '.confirm' : options.queueName;

  if (this.pubsubqueues[key] === undefined) {
    this.pubsubqueues[key] = new PubSubQueue(options);
  }

  this.handleOutgoing(options.queueName, message, options, function (queueName, message, options) {
    this.pubsubqueues[key].publish(message, options, cb);
  }.bind(this));

};

RabbitMQBus.prototype.close = function close () {

  this.log('closing channels and connection');
  this.channels.forEach(function (channel) {
    channel.close();
  });
  this.connection.close();

};

module.exports.Bus = RabbitMQBus;
