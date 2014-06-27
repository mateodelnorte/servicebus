var debug = require('debug'),
    util = require('util');

module.exports = function (label, fnIncoming, fnOutgoing) {
  label = label || 'servicebus';
  fnIncoming = fnIncoming || function (channel, message, options, next) {
    log('received %j via routingKey %s', message.content, message.fields.routingKey);
  };
  fnOutgoing = fnOutgoing || function (message, queueName) {
    log('sending %j to %s', message, queueName);
  };

  var log = debug(label);

  function logIncoming (channel, message, options, next) {
    fnIncoming(channel, message, options);
    var args = Array.prototype.slice.call(arguments);
    var next = args.pop();
    args.unshift(null);
    next.apply(this, args);
  }

  function logOutgoing (queueName, message, next) {    
    fnOutgoing(message, queueName);
    next(null, queueName, message);
  }

  return {
    handleIncoming: logIncoming,
    handleOutgoing: logOutgoing
  };
} 