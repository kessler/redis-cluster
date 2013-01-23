var RedisCluster = require('./RedisCluster');

var repl = require('repl');

var context = repl.start({
		prompt: "redis> "
}).context;

var rcluster = context.rcluster = new RedisCluster([]);

context.keys = function(keys) {
	context.results = [];
};




