var RedisCluster = require('./RedisCluster');

var repl = require('repl');

exports.start = function(callback) {
	var context = repl.start({
			prompt: "redis> "
	}).context;

	var rcluster = context.rcluster = RedisCluster.create([]);

	context.keys = function(keys) {
		context.results = [];
	};

	callback(context);
};






