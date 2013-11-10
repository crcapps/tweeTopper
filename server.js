var fs = require('fs'),
	http = require('http'),
	server = http.createServer(handler),
	io = require('socket.io').listen(server);
// Use MongoClient.  It's official now, and the old way is deprecated and slated for removal.
// http://blog.mongodb.org/post/36666163412/introducing-mongoclient
var MongoClient = require('mongodb').MongoClient;

/*
   Library: ntwitter

   Purpose: Twitter client

   Rationale: Short Timeframe. 2 Days.  Not writing my own Twitter client. Working within scope of project limitations. Glue- right, Brett?
   If I didn't know how to construct an HTTP POST and attach some auth headers I got after an OAuth session,
   then stuck the API call payload into the request body and then read the response status code, handling an error it if >200, then the response body,
   would we even be talking?  Probably not: I wouldn't have gotten this far in life if that wer the case.
   I totally just pseudocoded it anyway, c.f. two sentences prior.

   Limitations:
   Doesn't necessarily play by Twitter's rules regarding reconnecting and such.  Beware getting throttled.
   Handles all HTTP statuses > 200 the same way, by discarding it and throwing a generic error.
*/
var twitter = require('ntwitter'); 

var twit = new twitter({
	  consumer_key: '',
	  consumer_secret: '',
	  access_token_key: '',
	  access_token_secret: ''
	});

var port = 3000;

server.listen(port);

function packetize(data) {
	
	return packet;
}

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}


MongoClient.connect('mongodb://localhost/tweeTopper', function (err, db) {
	if (!err){
		var collection = db.collection('tweets');
		io.sockets.on('connection', function(socket) {
			console.log('Client connected.');
			socket.on('filter', function(aFilter) {
				var theFilter = JSON.stringify(aFilter);
				console.log('Filter received: ' + theFilter);
				// An md5 hash of the filter should serve nicely as an index.
				var filterKey = require('crypto').createHash('md5').update(theFilter.toString()).digest("hex");
				console.log('Filter hash: ' + filterKey);
				var existingData = collection.find({filterid:filterKey.toString()}).sort({retweets: -1}).limit(10);
				existingData.toArray(function (err, array) {
					if (err) {
						console.log('Error: ' + err);
						}
					if (array.length > 0) {
						console.log('Filter found: ' + theFilter[0] + ' (md5 hash: ' + filterKey + '). Retreiving Data');
						var packet = [];
						console.log('Building first packet from existing data.');
						for (var i = 0; i < array.length; i++) {
							if (array[i] != null) {
								packet[i] = {
									id: array[i].id,
									text: array[i].text,
									author: array[i].author,
									handle: array[i].handle,
									retweets: array[i].retweets,
									rank:i + 1
									};
								}
							}
							socket.emit('retweets', packet);
							console.log('Existing data packet sent.');
						} else {
							console.log('Filter NOT found: ' + theFilter +' (md5 hash: ' + filterKey + '). Starting from Scratch.');
						}
						console.log('Starting the stream.');
						twit.stream('statuses/filter', aFilter, function(stream) {
							stream.on('data', function(data) {
								console.log('Got some data.');
								// Do nothing unless tweet is a retweet.  Discard this data.
								if (Object.prototype.hasOwnProperty.call(data, "retweeted_status")) {
									console.log('Pushing retweet.');
									var rt = data["retweeted_status"];
									var dataToPush = {
										filterid: filterKey,
										id : rt.id,
										text : rt.text,
										author : rt.user.id,
										handle : rt.user.screen_name,
										retweets : rt.retweet_count
										};
									// Good enough for a data model.
									// We don't want to have multiple entries of the same tweet with different retweets.
									collection.update({id: rt.id}, dataToPush, { upsert: true }, function(err) {
										if (err) {
											console.log('Error: ' + err);
											}
											newData = collection.find({filterid:filterKey.toString()}).sort({retweets: -1}).limit(10);
											var packet = [];
											newData.toArray(function (err, array) {
												if (err) {
												console.log('Error: ' + err);
												}
												for (var i = 0; i < array.length; i++) {
												if (array[i] != null) {
												packet[i] = {
												id: array[i].id,
												text: array[i].text,
												author: array[i].author,
												handle: array[i].handle,
												retweets: array[i].retweets,
												rank:i + 1
												};
												}
												}										
												if (array.length > 9) { // We just buffer until the client has a top 10.
												socket.emit('retweets', packet);
												console.log('New data packet sent.');
												}
										
											});
										});
									}
							});
						});
					});
				});
			});
	}
});