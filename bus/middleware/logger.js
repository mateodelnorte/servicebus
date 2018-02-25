var debug = require('debug'),
    util = require('util');

module.exports = function (options) {
  options = options || {};
  label = options.label || 'servicebus';
  var log = options.log || debug(label);
  // allow users to pass in leveled log libs like bunyan or pino
  // and use log.info if a leveled logger
  log = log.info || log;
  fnIncoming = options.fnIncoming || function (channel, message, options, next) {
    log(util.format('received %j via routingKey %s', message.content, message.fields.routingKey));
  };
  fnOutgoing = options.fnOutgoing || function (message, queueName) {
    log(util.format('sending %j to %s', message, queueName));
  };

  function logIncoming (channel, message, options, next) {
    fnIncoming(channel, message, options);
    var args = Array.prototype.slice.call(arguments);
    var next = args.pop();
    args.unshift(null);
    next.apply(this, args);
  }

  function logOutgoing (queueName, message, options, next) {
    if (typeof options === 'function') {
      next = options;
      options = null;
    }

    fnOutgoing(message, queueName);
    next(null, queueName, message, options);
  }

  return {
    handleIncoming: logIncoming,
    handleOutgoing: logOutgoing
  };
}