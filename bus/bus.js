function Bus () {
  this.middleware = [];
}

Bus.prototype.use = function (middleware) {
  this.middleware.push(middleware);
  return this;
}


Bus.prototype.handleIncoming = function (message, headers, deliveryInfo, messageHandle, options, callback) {
  var stack = this.middleware, index = this.middleware.length - 1;

  function next (err) {

    var layer;
    var args = Array.prototype.slice.call(arguments, 1);

    message = (args.length > 1) ? args[0] : message;
    headers = (args.length > 1) ? args[1] : headers;
    deliveryInfo = (args.length > 1) ? args[2] : deliveryInfo;
    messageHandle = (args.length > 1) ? args[3] : messageHandle;
    options = (args.length > 1) ? args[3] : options;

    layer = stack[index--];

    if ( ! layer) {
      return callback(message, headers, deliveryInfo, messageHandle, options);
    }

    if (layer.handleIncoming) {
      layer.handleIncoming(message, headers, deliveryInfo, messageHandle, options, next);
    } else {
      next(null, message, headers, deliveryInfo, messageHandle, options);
    }

  }

  next();
}


Bus.prototype.handleOutgoing = function (queueName, message, callback) {
  
  var stack = this.middleware, index = 0;

  function next (err) {

    var layer;
    var args = Array.prototype.slice.call(arguments, 1);

    queueName = (args.length > 1) ? args[0] : queueName;
    message = (args.length > 1) ? args[1] : message;

    layer = stack[index];

    index++;

    if ( ! layer) {
      return callback(queueName, message);
    }

    if (layer.handleOutgoing) {
      layer.handleOutgoing(queueName, message, next);
    } else {
      next(null, queueName, message);
    }
  }

  next(null, queueName, message);
}

module.exports = Bus;