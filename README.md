RedisCluster
============

NOTICE: This project is still super alpha!

A redis cluster with pluggable redis client factory and key mapper / load balancer.

The execMany function requires that the key mapper will be consistent (i.e it should know
in which server a key resides)

### install
```
	npm install node-redis-cluster
```

### default: hash ring based redis cluster
The default cluster uses a [hash ring](http://github.com/3rd-Eden/node-hashring.git) to disribute keys
among its nodes
```
var RedisCluster = require('node-redis-cluster').RedisCluster;

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
	/* results will be
		{
			somekey1: 'somevalue',
			somekey2: 'somevalue',
			somekey3: 'somevalue',
			somekey4: 'somevalue'
		}
	*/
});

rcluster.execAll('keys', ['*'], function(err, results) {
	/* results will be
		{
			'10.0.0.1:6379': [ // keys],
			'10.0.0.2:6379': [ // keys],
			'10.0.0.3:6379': [ // keys]
		}
	*/
});

```

### customizing cluster behavior
```

var redis = require('redis');
var RedisCluster = require('node-redis-cluster').RedisCluster;

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
}

CustomKeyMapper.prototype.add = function(serverKey) {
	this.server.push(serverKey);
};

CustomKeyMapper.prototype.get = function(key) {
	if (this.servers.length < 2)
		throw new Error('not enough servers added');

	if (key === 'a') return this.servers[0];
	else return this.servers[1];
};

var customCluster = new RedisCluster(servers, new RedisFactory(), new CustomKeyMapper());

```

### command line interface
A very simple cli is provided as well, to start it:
```
var Cli = require('node-redis-cluster').Cli;

Cli.start(function(context) {
	context.rcluster.add('your.host');
	context.rcluster.add('your.host2', 6379);
});
```
or simply:
```
node lib/cluster-cli.js
```

