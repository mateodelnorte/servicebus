function Bus () {
  this.middleware = [];
}

Bus.prototype.use = function (middleware) {
  this.middleware.push(middleware);
  return this;
}

Bus.prototype.handleOutgoing = function (queueName, message, callback) {
  
  var stack = this.middleware, index = 0;

  function next (err) {

    var layer;
    var args = Array.prototype.slice.call(arguments, 1);

    queueName = (args.length > 1) ? args[0] : queueName;
    message = (args.length > 1) ? args[1] : message;

    layer = stack[index++];

    if ( ! layer) {
      return callback(queueName, message);
    }

    try {
      if (layer.handleOutgoing) {

        layer.handleOutgoing(queueName, message, next);
      } else {
        next(null, queueName, message);
      }
    } catch (e) {
      throw new Error(e);
    }

  }

  next();
}

module.exports = Bus;