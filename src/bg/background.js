// Followr Background.js


// -----------------------
// Google analytics
// -----------------------
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://ssl.google-analytics.com/analytics.js','ga');

ga('create', 'UA-48998506-2', 'ztratar.github.io');
ga('send', 'pageview', '/background');


// -----------------------
// Backend Logic
// -----------------------

var backend = {},
	loggedIn = true,
	tabOnlineCheck = false;

// Launch Twitter function
backend.launchTwitterInBackground = function() {
	if (!loggedIn) {
		return;
	}

	var createTabFunc = function() {
		ga('send', 'event', 'backend', 'run', 'success');
		chrome.tabs.create({
			url: 'http://twitter.com/',
			active: false
		}, function(tab) {
			tabId = tab.id;
		});

		setTimeout(function() {
			chrome.tabs.executeScript(tabId, {
				code: 'window.runFollowr()'
			});
		}, 5000);

		// Clase tab if the code never ran
		setTimeout(function() {
			if (!tabOnlineCheck) {
				chrome.tabs.remove(tabId);
			}
		}, 15000);
	};

	// Only run if queries exist
	backend.getSearchQueries(function(searchQueries) {
		var tabId;

		if (!searchQueries || !searchQueries.length) {
			ga('send', 'event', 'backend', 'run', 'failed', 'no search queries');
			return;
		}
		// Store run time in milliseconds
		chrome.storage.local.set({
			'lastRun': (new Date()).getTime()
		});
		backend.incrementRunCount();

		tabOnlineCheck = false;
		chrome.windows.getCurrent({}, function(currentWindow) {
			if (!currentWindow) {
				chrome.windows.create({}, function() {
					createTabFunc();
				});
			} else {
				createTabFunc();
			}
		});
	});
};

backend.findAndSetUsersInfo = function(data) {
	if (!data || !data.user || !data.user.username || data.user.username.length < 1) {
		chrome.tabs.create({
			url: 'http://twitter.com/',
			active: false
		}, function(tab) {
			chrome.tabs.executeScript(tab.id, {
				code: 'window.followrSendUserInfo({ closeWindow: true })'
			});
		});
	}
};

backend.removeOldTweetData = function() {
	var removeKeys = [];

	chrome.storage.local.get(undefined, function(data) {
		for (var dataKey in data) {
			if (data[dataKey] && dataKey.indexOf('tweet-') !== -1) {
				removeKeys.push(dataKey);
			}
		}
		chrome.storage.local.remove(removeKeys);
	});
};

backend.setUserInfo = function(data) {
	data = _.extend({
		img: '',
		name: '',
		username: ''
	}, data);
	chrome.storage.local.set({
		user: data
	});

	return true;
};

backend.runningStatus = function() {
	tabOnlineCheck = true;

	return true;
};

backend.incrementRunCount = function(cb) {
	chrome.storage.local.get('runCount', function(data) {
		chrome.storage.local.set({
			runCount: (typeof data.runCount === 'number') ? (data.runCount + 1) : 0
		}, cb);
	});
};

backend.getUserInfo = function(cb) {
	chrome.storage.local.get('user', function(data) {
		var userData = data;
		chrome.storage.local.get('numFollowersGained', function(data) {
			cb(_.extend(userData, data));
		});
	});

	return true;
};

// Backend task to get time last run
backend.getLastRunTime = function(cb) {
	chrome.storage.local.get('lastRun', function(data) {
		cb(data.lastRun);
	});
};

// Backend task to return time left before next run
backend.getTimeLeftBeforeRun = function(cb) {
	backend.getLastRunTime(function(lastRunTime) {
		var currentTime = (new Date()).getTime(),
			millisecondsDiff = currentTime - lastRunTime,
			minutesDiff = Math.floor(millsecondsDiff / (1000 * 60));
		cb(minutesDiff);
	});

	return true;
};

backend.getTweetHistory = function(cb) {
	var returnTweets = [];
	chrome.storage.local.get(undefined, function(data) {
		for (var dataKey in data) {
			if (dataKey.indexOf('tweet-') !== -1) {
				returnTweets.push(data[dataKey]);
			}
		}

		returnTweets = _.sortBy(returnTweets, function(tweet) {
			return -1 * (tweet.timeFavorited ? tweet.timeFavorited : 1000);
		});

		cb(returnTweets);
	});

	return true;
};

backend.getAndClearOldTweets = function(cb) {
	var tweets = [],
		tweetKeys = [];

	chrome.storage.local.get(undefined, function(data) {
		for (var dataKey in data) {
			if (dataKey.indexOf('tweet-') !== -1) {
				tweets.push(data[dataKey]);
			}
		}

		tweets = _.filter(tweets, function(tweet) {
			// Only unfavorate and remove tweets that are 5 days old or longer
			return (tweet.timeFavorited < (new Date()).getTime() - 1000 * 60 * 60 * 24 * 5);
		});

		if (tweets.length) {
			tweetKeys = _.map(_.pluck(tweets, 'id'), function(tweetId) {
				return 'tweet-' + tweetId;
			});
			chrome.storage.local.remove(tweetKeys);
			ga('send', 'event', 'backend', 'clear', 'tweets', tweetKeys.length);
		}

		cb(tweets);
	});

	return true;
};

backend.getNewTweets = function(data, cb) {
	var i = 0,
		returnTweetBuckets = [],
		currentUser = {},
		trimBuckets = function(tweetBuckets) {
			backend.getMaxQueries(function(maxQueries) {
				backend.getActionsAndReset(function(numActions) {
					maxQueries += numActions;
					var numTweets = _.reduce(_.map(tweetBuckets, function(tweetBucket) {
							return tweetBucket.items.length;
						}), function(memo, num) {
							return memo + num;
						}),
						bucket;
					maxQueries = Math.min(numTweets, maxQueries);

					maxIndices = [];
					for (var i = 0; i < maxQueries; i++) {
						bucket = i % tweetBuckets.length;
						if (typeof maxIndices[bucket] === 'number') {
							maxIndices[bucket]++;
						} else {
							maxIndices[bucket] = 1;
						}
					}

					_.each(tweetBuckets, function(tweetBucket, tbIndex) {
						tweetBuckets[tbIndex].items = tweetBucket.items.slice(0, maxIndices[tbIndex]);
					});

					ga('send', 'event', 'backend', 'favorite', 'tweets', tweetBuckets.length);
					cb(tweetBuckets);
				});
			});
		},
		getNewTweetRecur = function(tweetIter, queryIndex) {
			if (queryIndex >= data.tweetBuckets.length) {
				trimBuckets(returnTweetBuckets);
			} else {
				(function() {
					var tweet = data.tweetBuckets[queryIndex].items[tweetIter];

					if (tweet) {
						chrome.storage.local.get('tweet-' + tweet.id, function(tweetInDb) {
							if (Object.keys(tweetInDb).length === 0
									&& data.tweetBuckets[queryIndex].items[tweetIter].user.username !== currentUser.username) {
								returnTweetBuckets[queryIndex].items.push(data.tweetBuckets[queryIndex].items[tweetIter]);
							}

							if (tweetIter >= data.tweetBuckets[queryIndex].items.length-1) {
								getNewTweetRecur(0, queryIndex+1);
							} else {
								getNewTweetRecur(tweetIter + 1, queryIndex);
							}
						});
					} else {
						getNewTweetRecur(0, queryIndex+1);
					}
				})();
			}
		};

	for (i = 0; i < data.tweetBuckets.length; i++) {
		returnTweetBuckets.push({
			query: data.tweetBuckets[i].query,
			items: []
		});
	}

	if (!data.tweetBuckets || !data.tweetBuckets.length) {
		ga('send', 'event', 'backend', 'favorite', 'tweets', 0);
		cb([]);
	}
	backend.getUserInfo(function(cUser) {
		currentUser = cUser.user;
	});
	getNewTweetRecur(0,0);

	return true;
};

backend.getSearchQueries = function(cb) {
	chrome.storage.local.get('searchQueries', function(data) {
		cb(data.searchQueries);
	});

	return true;
};

backend.getMaxQueries = function(cb) {
	chrome.storage.local.get('maxQueries', function(data) {
		cb(data.maxQueries || 12);
	});

	return true;
};

backend.getLoggedInStatus = function(cb) {
	cb(loggedIn);

	return true;
};

backend.setFollowersAndConversions = function(followers, cb) {
	chrome.storage.local.get(undefined, function(data) {
		var storageObj = {};

		// Go through followers
		_.each(followers, function(follower) {
			var followerKey = 'followed-by-' + follower,
				searchQueryKey;

			// Check if new follower
			if (!data[followerKey]) {
				storageObj[followerKey] = true;

				// Find last tweet favorited by user, get query used
				for (var dataKey in data) {
					if (dataKey.indexOf('tweet-') !== -1 &&
						data[dataKey].query &&
						data[dataKey].user &&
						data[dataKey].user.id === follower) {
							// Store conversion
							searchQueryKey = 'searchQuery-'+data[dataKey].query.replace(' ','_');
							if (data[searchQueryKey]) {
								if (!storageObj[searchQueryKey]) {
									storageObj[searchQueryKey] = data[searchQueryKey];
								}
								storageObj[searchQueryKey].numConversions++;
								storageObj.numFollowersGained = (typeof data.numFollowersGained === 'number') ? data.numFollowersGained+1 : 1;
							}

							storageObj[dataKey] = data[dataKey];
							storageObj[dataKey].converted = true;
							ga('send', 'event', 'backend', 'follower gained');
							break;
					}
				}
			}
		});
		chrome.storage.local.set(storageObj, function(resp) {
			cb(resp);
		});
	});

	return true;
};

backend.setFavorited = function(tweetData, cb) {
	var storageObj = {},
		searchQueryKey = 'searchQuery-'+tweetData.query.replace(' ','_');

	chrome.storage.local.get(searchQueryKey, function(data) {
		if (data[searchQueryKey]) {
			storageObj[searchQueryKey] = data[searchQueryKey];
			storageObj[searchQueryKey].numFavorited++;
		} else {
			storageObj[searchQueryKey] = {
				numFavorited: 1,
				numConversions: 0
			};
		}
		storageObj['tweet-' + tweetData.id] = tweetData;
		chrome.storage.local.set(storageObj);
	});

	return true;
};

backend.setSearchQueries = function(queries, cb) {
	ga('send', 'event', 'backend', 'set', 'queries', queries.join(', '));
	queries = queries || [];
	// TODO: Put an interface to this function
	chrome.storage.local.set({
		searchQueries: queries
	}, cb);

	return true;
};

// Currently hardcoded until more intellgent
// features create the 'tasteful' aspects
// of followr.
backend.setMaxQueries = function(data, cb) {
	chrome.storage.local.set({
		maxQueries: data
	}, cb);

	return true;
};

backend.setOptions = function(data, cb) {
	chrome.storage.local.set({
		blacklist: data.blacklisted || []
	});
	backend.setSearchQueries(data.queries, function() {
		cb(true);
	});

	return true;
};

backend.setLoggedInStatus = function(data, cb) {
	loggedIn = data;

	return true;
};

backend.getBlacklist = function(cb) {
	chrome.storage.local.get('blacklist', function(data) {
		cb(data.blacklist || []);
	});

	return true;
};

backend.getActionsAndReset = function(cb) {
	chrome.storage.local.get('numActions', function(data) {
		data.numActions = (typeof data.numActions === 'number') ? data.numActions : 0;
		chrome.storage.local.set({
			'numActions': 0
		});
		cb(data.numActions);
	});

	return true;
};

backend.isTweetActedOn = function(data, cb) {
	chrome.storage.local.get('tweetAction-'+data.id, function(data) {
		if (data && data['tweetAction-'+data.id]) {
			cb(true);
		} else {
			cb(false);
		}
	});

	return true;
};

backend.setTweetWithAction = function(data, cb) {
	var storageObj = {};

	backend.isTweetActedOn(data, function(isTweetActedOn) {
		if (isTweetActedOn) return false;
		storageObj['tweetAction-'+data.id] = true;
		chrome.storage.local.set(storageObj, cb);
		chrome.storage.local.get('numActions', function(data) {
			if (typeof data.numActions !== 'number') data.numActions = 0;
			// Give 2 extra favorites for every reply or retween
			data.numActions += 3;
			chrome.storage.local.set({
				'numActions': data.numActions
			});
		});
	});

	return true;
};

// -----------------------
// Run
// -----------------------

// Capture calls from the injection script
chrome.runtime.onMessage.addListener(
	function(data, sender, sendResponse) {
		switch(data.message) {
			case 'getUserInfo':
				return backend.getUserInfo(sendResponse);
			case 'getTimeLeftBeforeRun':
				return backend.getTimeLeftBeforeRun(sendResponse);
			case 'getSearchQueries':
				return backend.getSearchQueries(sendResponse);
			case 'getNewTweets':
				return backend.getNewTweets(data.data, sendResponse);
			case 'getMaxQueries':
				return backend.getMaxQueries(sendResponse);
			case 'getLoggedInStatus':
				return backend.getLoggedInStatus(sendResponse);
			case 'getBlacklist':
				return backend.getBlacklist(sendResponse);
			case 'getActionsAndReset':
				return backend.getActionsAndReset(sendResponse);
			case 'getTweetHistory':
				return backend.getTweetHistory(sendResponse);
			case 'getAndClearOldTweets':
				return backend.getAndClearOldTweets(sendResponse);
			case 'setFavorited':
				return backend.setFavorited(data.data, sendResponse);
			case 'setSearchQueries':
				return backend.setSearchQueries(data.data, sendResponse);
			case 'setMaxQueries':
				return backend.setMaxQueries(data.data, sendResponse);
			case 'setOptions':
				return backend.setOptions(data.data, sendResponse);
			case 'setLoggedInStatus':
				return backend.setLoggedInStatus(data.data, sendResponse);
			case 'setTweetWithAction':
				return backend.setTweetWithAction(data.data, sendResponse);
			case 'setFollowersAndConversions':
				return backend.setFollowersAndConversions(data.data, sendResponse);
			case 'setUserInfo':
				return backend.setUserInfo(data.data);
			case 'forceRun':
				backend.launchTwitterInBackground();
				return true;
			case 'runningStatus':
				backend.runningStatus();
				return true;
			default:
				return false;
		}
	}
);

// First time run
chrome.storage.local.get(undefined, function(data) {
	var optionsUrl;

	backend.findAndSetUsersInfo(data);

	if (!data || data.hasSetup !== 'v1') {
		backend.removeOldTweetData();
		optionsUrl = chrome.extension.getURL('src/tutorial/tutorial.html');
		chrome.tabs.query({ url: optionsUrl }, function(tabs) {
			if (tabs.length) {
				chrome.tabs.update(tabs[0].id, { active: true });
			} else {
				chrome.tabs.create({ url: optionsUrl });
			}
		});
	} else {
		backend.launchTwitterInBackground();
	}

	chrome.storage.local.set({
		hasSetup: 'v1'
	});
});

// Favorite query every 30 minutes with
// randomness.
setInterval(function() {
	setTimeout(backend.launchTwitterInBackground, (1000 * 60 * 15 * Math.random()));
}, (1000 * 60 * 30));
