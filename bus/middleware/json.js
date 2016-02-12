module.exports = function (options) {

  return {

    handleIncoming: function json (channel, message, options, next) {
      try {
        message.content = JSON.parse(message.content.toString());
      } catch (err) {
        return next(err);
      }

      next(null, channel, message, options);
    },

    handleOutgoing: function json (queueName, message, options, next) {
      if (typeof options === 'function') {
        next = options;
        options = null;
      }

      next(null, queueName, message, options);
    }

  };
};