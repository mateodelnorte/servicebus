var domain = require('domain');

module.exports = function messageDomain (opts) {

  opts = opts || {};

  return {

    handleIncoming: function json (channel, message, options, next) {
      
      var d = domain.create();
      
      if (opts.onError) {
        d.on('error', function (err) {
          if (opts.onError) {
            opts.onError(err, message, channel, d);
          } else {
            throw err;
          }
        });
      }

      d.run(function() {

        if (message.properties.correlationId) {
          d.correlationId = message.properties.correlationId;
        }

        next.bind(this, null, channel, message, options)();
        
      });

    },

  };
};