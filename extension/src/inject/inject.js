/// Followr Inject.js

$(function() {
	var onTwitterCalledWithFollowr = (window.location.search.indexOf('?followr=true') !== -1),
		maxQueries = 20, // default queries
		twitter = {};

	// Get MaxQueries -- not too worried about the race condition
	chrome.runtime.sendMessage({
		message: 'getMaxQueries'
	}, function(mQ) {
		maxQueries = mQ;
	});

	chrome.runtime.sendMessage({
		message: 'getLoggedInStatus'
	}, function(backendThinksLoggedIn) {
		if ($('body').hasClass('logged-in')) {
			chrome.runtime.sendMessage({
				message: 'setLoggedInStatus',
				data: true
			});

			if (!backendThinksLoggedIn) {
				chrome.runtime.sendMessage({
					message: 'forceRun'
				});
			}
		} else {
			chrome.runtime.sendMessage({
				message: 'setLoggedInStatus',
				data: false
			});
		}
	});

	// if on Twitter page from followr
	if (onTwitterCalledWithFollowr) {

		// Set Up Twitter API Calls
		twitter.authenticity_token = $('input[name="authenticity_token"]').val();

		if (twitter.authenticity_token && $('body').hasClass('logged-in')) {
			// Set up the status interface
			var $followr = $('<div class="followr"></div>'),
				$followrWrap = $('<div class="followr-wrap"></div>'),
				$state = $('<span id="followr-state">Loading...</span>'),
				$description = $('<p class="state-descript">Favoriting some tweets!</p>');

			$followr.appendTo($('body'));
			$followrWrap.appendTo($followr);
			$description.appendTo($followrWrap);
			$state.appendTo($followrWrap);

			document.title = 'Followr - Running...';
		} else {
			window.close();
		}

		twitter.getTweets = function(currentQueryIndex, queries, cb, options) {
			var url,
				query = queries[currentQueryIndex];

			options = options || {};

			url = 'https://twitter.com/i/search/timeline?q=' + encodeURIComponent(query.query) + '&src=typd&include_available_features=1&include_entities=1&last_note_ts=0';
			if (options && options.lastTweetId && options.firstTweetId) {
				url += '&scroll_cursor=TWEET-'+options.lastTweetId+'-'+options.firstTweetId;
			}

			$.ajax({
				url: url,
				dataType: 'json',
				success: function(data, d) {
					var itemHTML = data.inner ? data.inner.items_html : undefined,
						items = itemHTML ? itemHTML.match(/data-item-id="([0-9]{18})/g) : [],
						numNewItems = 0,
						totalItems = [],
						i;

					// TODO: make the regexp more accurate.
					items = $.map(items, function(item, j) {
						item = item.replace('data-item-id="', '');
						return ((j % 2) === 0) ? item : undefined;	
					});
					items.pop();

					numNewItems = items.length;
					queries[currentQueryIndex].items = queries[currentQueryIndex].items.concat(items);
					items = queries[currentQueryIndex].items;

					if (items.length <= 50 && numNewItems > 10) {
						// get more items for same query
						twitter.getTweets(currentQueryIndex, queries, cb, {
							firstTweetId: items[0],
							lastTweetId: items[items.length-1]
						});
					} else {
						if (currentQueryIndex < queries.length-1) {
							// Next query
							twitter.getTweets(currentQueryIndex+1, queries, cb);
						} else {
							cb(queries);
						}
					}
				}
			});
		};
		twitter.favoriteTweet = function(id, cb) {
			$.ajax({
				url: 'https://twitter.com/i/tweet/favorite',
				dataType: 'json',
				type: 'POST',
				data: {
					'authenticity_token': twitter.authenticity_token,
					'id': id
				},
				success: function(data) {
					cb(data);
				}
			});
		};

		// Figure out which search query to use
		chrome.runtime.sendMessage({
			message: 'getSearchQueries'
		}, function(searchQueries) {
			var i;

			// format queries
			for (i = 0; i < searchQueries.length; i++) {
				searchQueries[i] = {
					query: searchQueries[i],
					items: []
				};
			}

			twitter.getTweets(0, searchQueries, function(unfilteredTweetBuckets) {
				// Filter through results to make sure favorites not
				// already called.

				chrome.runtime.sendMessage({
					message: 'getNewTweets',
					data: {
						tweetBuckets: unfilteredTweetBuckets
					}
				}, function(tweetBuckets) {
					var a,
						tweetCounter = 0,
						numTweets = 0,
						timeInbetweenTweets = 1500,
						randTweetMarker = [];

					if (!tweetBuckets.length) {
						return false;
					}

					for (a = 0; a < tweetBuckets.length; a++) {
						numTweets += tweetBuckets[a].items.length;
					}
					if (maxQueries > numTweets) {
						numTweets = maxQueries;
					}

					// Slowly favorite tweets over time and with randomness.
					for (a = 0; a < tweetBuckets.length; a++) {
						for (i = 0; i < tweetBuckets[a].items.length; i++) {

							tweetCounter++;

							(function() {
								var j = i,
									bucketIndex = a,
									itemIndex = i,
									tweetInMilliseconds = tweetCounter * 1600 + Math.random() * 900,
									progressCounter = 1 + bucketIndex + j * tweetBuckets.length;

								tweetInMilliseconds = timeInbetweenTweets * (bucketIndex + j * tweetBuckets.length);

								setTimeout(function() {
									var statusString = progressCounter + '/' + numTweets,
										tweetId = tweetBuckets[bucketIndex].items[itemIndex];

									$state.html(tweetBuckets[bucketIndex].query + ': ' + statusString);
									document.title = '(' + statusString + ') Followr - Running...';

									chrome.runtime.sendMessage({
										'message': 'setFavorited',
										data: {
											id: tweetId
										}
									});
									twitter.favoriteTweet(tweetId, function(data) {
										if (progressCounter >= numTweets) {
											window.close();
										}
									});
								}, tweetInMilliseconds);
							})();
						}
					}
				});
			});
		});
	}
});
