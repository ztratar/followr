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

		twitter.getTweets = function(query, cb, options) {
			var url,
				formattedQuery = encodeURIComponent(query);

			options = options || {};
			url = 'https://twitter.com/i/search/timeline?q=' + formattedQuery + '&src=typd&include_available_features=1&include_entities=1&last_note_ts=0';

			if (options && options.lastTweetId && options.firstTweetId) {
				url += '&scroll_cursor=TWEET-'+options.lastTweetId+'-'+options.firstTweetId;
			}

			$.ajax({
				url: url,
				dataType: 'json',
				success: function(data, d) {
					var itemHTML = data.inner ? data.inner.items_html : undefined,
						items = itemHTML ? itemHTML.match(/data-item-id="([0-9]{18})/g) : [],
						numNewItems = 0;

					// Parsed html doesn't map propertly, but this is an
					// easy hack.
					//
					// TODO: make the regexp more accurate.
					items = $.map(items, function(item, j) {
						item = item.replace('data-item-id="', '');
						return ((j % 2) === 0) ? item : undefined;	
					});
					items.pop();

					numNewItems = items.length;
					if (options.existingItems) {
						items = options.existingItems.concat(items);
					}

					// Ensure we have enough tweets to run through em and filter
					// the used, even when frequency raises.
					// Pretty hacky, but this should work for all good uses
					// of this extension. We could add more rigid functionality,
					// but that would easily open spam.
					if (items.length < 50 && numNewItems > 10) {
						twitter.getTweets(query, cb, {
							firstTweetId: items[0],
							lastTweetId: items[items.length-1],
							existingItems: items	
						});
					} else {
						cb(items);
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
			// Figure out how many items to go through for each query
			//
			// Get that many new items to favorite
			$.each(searchQueries, function(queryIndex, searchQuery) {
				// Get results of twitter call
				twitter.getTweets(searchQuery, function(unfilteredTweets) {
					// Filter through results to make sure favorites not
					// already called.
					
					chrome.runtime.sendMessage({
						message: 'getNewTweets',
						data: {
							tweets: unfilteredTweets
						}
					}, function(tweets) {
						var favoriteTweetIter = function(tweetNum, totalTweetNum) {
								var tweetId = tweets[tweetNum];

								chrome.runtime.sendMessage({
									'message': 'setFavorited',
									data: {
										id: tweetId
									}
								});

								twitter.favoriteTweet(tweetId, function(data) {
									if (totalTweetNum === maxQueries) {
										window.close();
									}
								});
							};

						if (!tweets.length) {
							return false;
						}

						// Slowly favorite tweets over time and with randomness.
						for (i = 0; i < tweets.length; i++) {
							(function() {
								var j = i,
									queryTweetMax = Math.floor(maxQueries / searchQueries.length),
									tweetInMilliseconds = queryIndex * (queryTweetMax * 1000 + 200) + j * 1000 + Math.random() * 200;
								if (j < queryTweetMax) {
									setTimeout(function() {
										var numTweet = 1 + j + queryIndex*queryTweetMax,
											statusString = numTweet + '/' + maxQueries;
										$state.html(searchQuery + ': ' + statusString);
										document.title = '(' + statusString + ') Followr - Running...';
										favoriteTweetIter(j, numTweet);	
									}, tweetInMilliseconds);
								}
							})();
						}
					});
				});
			});
		});
	}
});
