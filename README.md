RedisCluster
============

An alpha redis cluster. This lib should probably be called consistent redis cluster, since its designed
to only work with a consistent key distribution among nodes.

### default: hash ring based redis cluster
```
var RedisCluster = require('redis-cluster');

var rcluster = RedisCluster.create([
	{ port: 6379, host: '10.0.0.1' },
	{ port: 6379, host: '10.0.0.2' },
	{ port: 6379, host: '10.0.0.3' },
]);

var redis1 = rcluster.getRedis('someKey');
var redis2 = rcluster.getRedis('someKey');

// redis1 === redis2 

rcluster.exec('get', ['somekey'], function(err, reply) {
	//reply is the value of somekey
});

rcluster.execMany('get', ['somekey1', 'somekey2', 'somekey3', 'somekey4'], function(err, results) {
	// results is { somekey1: 'somevalue', somekey2: 'somevalue', somekey3: 'somevalue', somekey4: 'somevalue' }
});

```

### customizing cluster behaviour
```

var redis = require('redis');
var RedisCluster = require('redis-cluster');

var servers = [
	{ port: 6379, host: '10.0.0.1' },
	{ port: 6379, host: '10.0.0.2' },
	{ port: 6379, host: '10.0.0.3' },
];


function RedisFactory() {
	
}

RedisFactory.prototype.createClient(port, host) {
	sendEmailToAdmin(host + ':' + port + ' was added to redis cluster');	
	return redis.createClient(port, host /* possibly apply any node-redis options */);
};

function CustomKeyMapper() {
	this.servers = [];	
};

CustomKeyMapper.prototype.addServer = function(serverKey) {
	this.server.push(serverKey);
};

CustomKeyMapper.prototype.getNode = function(key) {
	if (this.servers.length < 2)
		throw new Error('not enough servers added');

	if (key === 'a') return this.servers[0];
	else return this.servers[1];
};

var customCluster = new RedisCluster(servers, new RedisFactory(), new CustomKeyMapper());

```