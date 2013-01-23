var vows = require('vows');
var assert = require('assert');
var RedisCluster = require('../lib/RedisCluster');

var suite = vows.describe('redis cluster integration tests');

function rand(start, end) {
	var range = end - start;
    return Math.floor((Math.random() * range) + start);
}

suite.addBatch({
	'exec many': {
		topic: function () {		 
			var rcluster = this.rcluster = RedisCluster.create([
				{ port: 6379, host: '192.168.56.101'},
				{ port: 6379, host: '192.168.5.159'}
			]);

			var index = {};

			this.args = [];

			for (var u = 0; u < 1000; u++) {
				var char = String.fromCharCode(rand(65, 91));
				if (!index[char]) {
					this.args.push([char, u + '']);
					index[char] = true;
				}
			}

			var self = this;

			rcluster.execMany('set', this.args, function(err, results) {			
				self.callback(err, results);
			});
		},
		'check set results': function(err, results) {
			var count = 0;
			for (var l in results) {
				count++;

				if (results[l] !== 'OK') {
					assert.fail('expected result array for set command to contain only OK results');
				}
			}

			assert.strictEqual(this.args.length, count);
		},
		'set callback': {
			topic: function(err, results) {				
				var keys = [];

				for (var i = 0; i < this.args.length; i++)
					keys.push([this.args[i][0]]);

				this.rcluster.execMany('get', keys, this.callback);
			},
			'get callback': function(err, results) {
				var count = 0;
				for (var l in results) {
					count++;
				}

				assert.strictEqual(this.args.length, count);

				for (var x = 0; x < this.args.length; x++) {
					var key = this.args[x][0];
					assert.include(results, key);
					assert.strictEqual(results[key], this.args[x][1]);
				}
			}
		}
	}
});

suite.options.error = false;

suite.export(module);