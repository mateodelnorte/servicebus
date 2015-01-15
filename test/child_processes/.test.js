var domain = require('domain');

var d = domain.create();

d.on('error', function (err) {
  console.log('error occurred');
});

var handler = function (err) {
  console.log('error occurred');
};

var opts = {
  handler: handler
};

var d2 = domain.create();

if (opts.handler) {
  d.on('error', opts.handler);
}

d.run(function () {
  throw new Error(1);
});

d2.run(function () {
  throw new Error(2);
});