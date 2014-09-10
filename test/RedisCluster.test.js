var vows = require('vows');
var assert = require('assert');
var RedisCluster = require('../lib/RedisCluster');
var events = require('events');
var $u = require('util');
 
var mockServers = [
	{ port: 1234, host: '127.0.0.1' },
	{ port: 1234, host: '127.0.0.2' }
];

function MockKeyMapper() {
	this.servers = [];
}

MockKeyMapper.prototype.add = function(server) {
	this.servers.push(server);
};

MockKeyMapper.prototype.get = function(key) {

	if (key === 'a' || key === 'b' || key === 'c' ) {				
		return this.servers[0];
	} else {		
		return this.servers[1];
	}
};

/*
	this mock combines both redis and multi object interface, in reality redis doesn't have an exec method
*/
function MockRedis () {
	events.EventEmitter.call(this);
}

$u.inherits(MockRedis, events.EventEmitter);

MockRedis.prototype.multi = function() {
	return new MockRedis();
};

MockRedis.prototype.send_command = function(command, args, callback) {
	callback(null, '1');
};

MockRedis.prototype.get = function(args, callback) {
	callback(null, '1');
};

function MockMulti() {

}

MockMulti.prototype.exec = function(callback) {
	callback(null, '1');
};   

function MockRedisFactory() {
	this.requests = [];
}

MockRedisFactory.prototype.createClient = function (port, host) {
	this.requests.push([port, host]);

	return new MockRedis();
};


var suite = vows.describe('RedisCluster');
 
suite.addBatch({
	'RedisCluster initialization': {
		topic: function() {

			var factory = new MockRedisFactory();

			return new RedisCluster(mockServers, factory, new MockKeyMapper());
		},
		'cluster should have 2 servers': function(topic) {
			assert.instanceOf(topic, RedisCluster);
			assert.lengthOf(topic.keyMapper.servers, 2);			
		},
		'a b and c keys should map to one server, the rest to the other': function(topic) {			
			var server1 = topic.getRedis('a');
			var server2 = topic.getRedis('b');
			var server3 = topic.getRedis('c');
			var server4 = topic.getRedis('d');

			assert.strictEqual(server1, server2);
			assert.strictEqual(server1, server3);
			assert.isFalse(server1 === server4);
		}
	}
});

suite.addBatch({
	'RedisCluster.exec': {
		topic: function () {
			var rcluster = new RedisCluster(mockServers, new MockRedisFactory(), new MockKeyMapper());

			rcluster.exec('get', ['a'], this.callback);	
		},	
		'callback': function (err, reply) {
			
			assert.isNull(err);
			assert.strictEqual('1', reply);
		}
	}
	//TODO:
	/*
	'RedisCluster.execMany': {
		topic: function () {
			var rcluster = new RedisCluster(mockServers, new MockRedisFactory(), new MockKeyMapper());

			rcluster.execMany('get', ['a', 'b', 'c', 'd'], this.callback);	
			
		},	
		'callback': function (err, reply) {
			
			assert.isNull(err);
			assert.strictEqual('1', reply);
		}
	}*/
});

suite.export(module); 
