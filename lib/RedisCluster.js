var hashring = require('hashring');
var redis = require('redis');
var async = require('async');

RedisCluster.reportError = function(err) {
	console.error(err);
}

/*
	The redis cluster helps write and read redis key/values from several redis instances. 

	@param serversConfig 	- an array of redis server objects, e.g [{ port: 6379, host: '127.0.0.1' }, { port: 6379, host: '192.168.56.1' }]

	@param redisFactory 	- a factory that returns a redis client in response to calling factory.createClient(port, ip), 
							usually this will just be redis (require('redis'))

	@param keyMapper		- maps keys to redis servers, the keyMapper must respect this interface:

								serverString get(key);
								serverString add(server);

*/
function RedisCluster(serversConfig, redisFactory, keyMapper, clientOptions) {
	this.keyMapper = keyMapper;
	this.servers = {};
	this.redisFactory = redisFactory;

	for (var i = 0; i < serversConfig.length; i++) {
		this.add(serversConfig[i].host, serversConfig[i].port, clientOptions);		
	}
}

RedisCluster.prototype.add = function(host, port, clientOptions) {
	port = port || 6379;
	var serverEntry = host + ':' + port;
        this.keyMapper.add(serverEntry);
	var client = this.redisFactory.createClient(port, host, clientOptions || {});
	client.on('error', RedisCluster.reportError);		
	this.servers[serverEntry] = client;
	return client;
}

RedisCluster.create = function(serversConfig, clientOptions) {
	return new RedisCluster(serversConfig, redis, new hashring(), clientOptions);
};

RedisCluster.prototype.getRedis = function(key) {
	var serverEntry = this.keyMapper.get(key);	
	return this.servers[serverEntry];
};

function commandCallback(results, key) {

	return function(err, reply) {				

		if (!err)
			results[key] = reply;		
	};
}

function doCommand(redis, command, params, results, callback) {
	return function(callback) {
		
		if (params.length === 1) {
			redis.send_command(command, params, function(err, reply) {
				if (!err) {
					results[params[0]] = reply;
					callback(null, reply);
				} else {
					callback(err, null);
				}
			});

		} else {
			var multi = redis.multi();

			for (var i = 0; i < params.length; i++) {
				multi[command](params[i], commandCallback(results, params[i]));
			}

			multi.exec(callback);
		}
	}
}

/*
	@param command 	- the command to run across the cluster
	@param params 	- an array of arrays containing the data needed to run the command. The value in index 0 must be the redis key.
	@param callback	- a callback that will be used when all the operation finishes.
*/
RedisCluster.prototype.execMany = function(command, params, callback) {
	var paramsPerServer = {};
	var fns = [];
	var results = {};

	// match groups of keys to their respected server
	for (var i = 0; i < params.length; i++) {

		var serverEntry = this.keyMapper.get(params[i]);				
		
		if (typeof(paramsPerServer[serverEntry]) === 'undefined') {
			paramsPerServer[serverEntry] = [];
		}

		paramsPerServer[serverEntry].push(params[i]);
	}

	for (var server in paramsPerServer) {
		fns.push(doCommand(this.servers[server], command, paramsPerServer[server], results));
	}
 
	async.parallel(fns, function(err, res) {
            if (err) {
                    callback(err);
            } else {			
                callback(null, results);
            }
	});
};

function doServerCommand(redis, command, params) {
	return function(callback) {
		redis.send_command(command, params, callback);
	};
}

/*
	this will execute the same command on all the servers, disregarding key association with a certain
	server. This method is useful for commands like "keys" and others.

	the result will be a hash of servers and they respective replies
*/
RedisCluster.prototype.execAll = function(command, params, callback) {

	var fns = {};

	for (var server in this.servers) {
		fns[server] = doServerCommand(this.servers[server], command, params);
	}

	async.parallel(fns, callback);
};

RedisCluster.prototype.exec = function(command, params, callback) {
	var serverKey = this.keyMapper.getNode(params[0]);
	var redis = this.servers[serverKey];

	redis.send_command(command, params, callback);
};

RedisCluster.dummy = {
	getRedis: function() {
		var x = {
			hincrby: function () { return this;},
			hset: function() { return this;},
			multi: function() { return this; },
			exec: function() {}
		};

		return x;
	}
	
};

module.exports = RedisCluster;
