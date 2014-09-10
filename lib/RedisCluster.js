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

								serverString getNode(key);
								serverString addServer(server);

*/
function RedisCluster(serversConfig, redisFactory, keyMapper) {
	this.keyMapper = keyMapper;
	this.servers = {};
	this.redisFactory = redisFactory;

	for (var i = 0; i < serversConfig.length; i++) {
		this.add(serversConfig[i].host, serversConfig[i].port);		
	}
}

RedisCluster.prototype.add = function(host, port) {
    return this.addServer(host, port);
};

RedisCluster.prototype.addServer = function(host, port) {
	port = port || 6379;
	var serverEntry = host + ':' + port;
        if (this.keyMapper.add) {
            this.keyMapper.add(serverEntry);
        } else {
            this.keyMapper.addServer(serverEntry);		
        }
	var client = this.redisFactory.createClient(port, host);
	client.on('error', RedisCluster.reportError);		
	this.servers[serverEntry] = client;
	return client;
}

RedisCluster.create = function(serversConfig) {
	return new RedisCluster(serversConfig, redis, new hashring());
};

RedisCluster.prototype.getRedis = function(key) {
	var serverEntry = this.keyMapper.getNode(key);	
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
			redis.send_command(command, params[0], function(err, reply) {
				if (!err) {
					results[params[0][0]] = reply;
					callback(reply);
				} else {
					callback(err, null);
				}
			});

		} else {
			var multi = redis.multi();

			for (var i = 0; i < params.length; i++) {
				multi[command](params[i], commandCallback(results, params[i][0]));
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

		var serverEntry = this.keyMapper.getNode(params[i][0]);				
		
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
