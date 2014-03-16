// Followr Background.js

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

	// Only run if queries exist
	backend.getSearchQueries(function(searchQueries) {
		var tabId;

		if (!searchQueries || !searchQueries.length) {
			return;
		}
		// Store run time in milliseconds
		chrome.storage.local.set({
			'lastRun': (new Date()).getTime()
		});
		backend.incrementRunCount();

		tabOnlineCheck = false;
		chrome.tabs.create({
			url: 'http://twitter.com/?followr=true',
			active: false
		}, function(tab) {
			tabId = tab.id;	
		});

		// Clase tab if the code never ran
		setTimeout(function() {
			if (!tabOnlineCheck) {
				chrome.tabs.remove(tabId);
			}	
		}, 15000);
	});
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

backend.getNewTweets = function(data, cb) {
	var i = 0,
		returnTweetBuckets = [],
		getNewTweetRecur = function(tweetIter, queryIndex) {
			var tweet;

			if (queryIndex >= data.tweetBuckets.length) {
				cb(returnTweetBuckets);
			} else {
				tweet = data.tweetBuckets[queryIndex].items[tweetIter];

				(function() {
					var tweetId = tweet;

					chrome.storage.local.get('tweet-' + tweetId, function(tweetInDb) {
						// Gross... TODO: fix this
						if (Object.keys(tweetInDb).length === 0) {
							returnTweetBuckets[queryIndex].items.push(data.tweetBuckets[queryIndex].items[tweetIter]);
						}

						if (tweetIter >= data.tweetBuckets[queryIndex].items.length-1) {
							getNewTweetRecur(0, queryIndex+1);	
						} else {
							getNewTweetRecur(tweetIter + 1, queryIndex);	
						}
					});
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
		cb([]);
	}
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

backend.setFavorited = function(data, cb) {
	var storageObj = {};
	storageObj['tweet-' + data.id] = true;
	chrome.storage.local.set(storageObj);

	return true;
};

backend.setSearchQueries = function(queries, cb) {
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
	backend.setSearchQueries(data.queries, function() {
		cb(true);
	});	

	return true;
};

backend.setLoggedInStatus = function(data, cb) {
	loggedIn = data;

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
			case 'getActionsAndReset':
				return backend.getActionsAndReset(sendResponse);
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

	if (data.hasSetup !== true) {
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
		hasSetup: true
	});
});

// Favorite query every 30 minutes
setInterval(backend.launchTwitterInBackground, 1000 * 60 * 30);
