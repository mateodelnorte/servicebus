var debug = require('debug'),
    util = require('util');

module.exports = function (label) {
  label = label || 'servicebus';

  var log = debug(label);

  function logOutgoing (queueName, message, next) {
    log('sending %j', util.inspect(message));
    next(null, queueName, message);
  }

  function logIncoming (message, headers, deliveryInfo, messageHandle, options, next) {    
    log('received %j', util.inspect(message));
    next(null, message, headers, deliveryInfo, messageHandle, options);
  }

  return {
    handleIncoming: logIncoming,
    handleOutgoing: logOutgoing
  };
} 