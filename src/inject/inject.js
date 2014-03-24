/// Followr Inject.js

window.followrSendUserInfo = function() {
	document.title = 'Followr - Finding Avatar';
	$(function() {
		chrome.runtime.sendMessage({
			message: 'setUserInfo',
			data: {
				img: $(".account-summary img.avatar").first().attr('src'),
				name: $('b.fullname').html(),
				username: $('span.screen-name').html().slice(1)
			}
		});
		window.close();
	});
};

$(function() {
	var maxQueries = 12, // default queries
		timeInbetweenTweets = 1500,
		bindScoreToRealUserAction,
		addToScore,
		favoriteTweetIter,
		getNumTweets,
		runFollowr,
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

	addToScore = function(tweetId) {
		chrome.runtime.sendMessage({
			'message': 'setTweetWithAction',
			data: {
				id: tweetId
			}
		});
	};

	bindScoreToRealUserAction = function() {
		var bindScoreFunc = function() {
			var $this = $(this),
				tweetReply = $(this).closest('div.inline-reply-tweetbox'),
				tweetElem = tweetReply.length ? tweetReply.prev() : $this.closest('div.tweet'),
				tweetId = tweetElem.attr('data-tweet-id');

			addToScore(tweetId);
		};

		$('body').on('submit', '.tweet-form', bindScoreFunc);
		$('body').on('mouseup', '.tweet-form button.tweet-btn', bindScoreFunc);
		$('body').on('mousedown', '.retweet', bindScoreFunc);
	};
	bindScoreToRealUserAction();

	runFollowr = window.runFollowr = function() {
		chrome.runtime.sendMessage({
			'message': 'runningStatus'
		});

		// Set Up Twitter API Calls
		twitter.authenticity_token = $('input[name="authenticity_token"]').val();

		if (twitter.authenticity_token && $('body').hasClass('logged-in')) {
			// Set up the status interface
			var $followr = $('<div class="followr"></div>'),
				$followrWrap = $('<div class="followr-wrap"></div>'),
				$state = $('<span id="followr-state"></span>'),
				$buckets = $('<table class="buckets"></table>'),
				$description = $('<p class="state-descript"><img src="'+chrome.extension.getURL('/img/loader.gif')+'"> Loading tweets...</p>');

			$followr.appendTo($('body'));
			$followrWrap.appendTo($followr);
			$description.appendTo($followrWrap);
			$state.appendTo($followrWrap);
			$state.append($buckets);

			document.title = 'Followr - Running...';
		} else {
			window.close();
		}

		twitter.getTweets = function(currentQueryIndex, queries, cb, options) {
			var url,
				query = queries[currentQueryIndex];

			options = options || {};

			url = 'https://twitter.com/i/search/timeline?q=' + encodeURIComponent('"' + query.query + '"') + '&src=typd&include_available_features=1&include_entities=1&last_note_ts=0';
			if (options && options.lastTweetId && options.firstTweetId) {
				url += '&scroll_cursor=TWEET-'+options.lastTweetId+'-'+options.firstTweetId;
			}

			$.ajax({
				url: url,
				dataType: 'json',
				success: function(data, d) {
					var itemHTML = data.inner ? data.inner.items_html : undefined,
						items = [], //itemHTML ? itemHTML.match(/data-item-id="([0-9]{18})/g) : [],
						numNewItems = 0,
						totalItems = [],
						i,
						parseRegexp = /data-tweet-id="([0-9]{18})"[\s\S]*?data-screen-name="([a-zA-Z0-9]+)"[\s\S]*?data-name="([a-zA-Z0-9\s]+)"[\s\S]*?data-user-id="([0-9]+)"[\s\S]*?<p class="js-tweet-text tweet-text">([\s\S]*?)<\/p>/g,
						parsedItem;

					do {
						parsedItem = parseRegexp.exec(itemHTML);
						if (parsedItem && parsedItem.length === 6) {
							items.push({
								id: parsedItem[1],
								converted: false,
								user: {
									id: parsedItem[4],
									username: parsedItem[2],
									name: parsedItem[3]
								},
								text: $('<div>'+parsedItem[5]+'</div>').text()
							});
						}
					} while (parsedItem);

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
					if (cb) cb(data);
				}
			});
		};
		twitter.getNewFollowers = function(cb) {
			$.ajax({
				url: 'https://twitter.com/i/notifications',
				type: 'GET',
				dataType: 'html',
				success: function(resp) {
					var parsedResponse = resp ? $($.parseHTML(resp)) : undefined,
						followerElems = parsedResponse ? parsedResponse.find('.stream-item-follow li.supplement a'): undefined,
						followerIds = followerElems ? _.map(followerElems, function(followerElem) {
							return $(followerElem).attr('data-user-id');	
						}) : [];

					if (cb) cb(followerIds);
				}
			});
		};

		favoriteTweetIter = function(options) {
			var progressCounter = (1 + options.bucketIndex) + options.itemIndex * options.tweetBuckets.length,
				tweetInMilliseconds = timeInbetweenTweets * progressCounter,
				statusString = progressCounter + '/' + options.numTweets;

			setTimeout(function() {
				var tweet = options.tweetBuckets[options.bucketIndex].items[options.itemIndex],
					$statusNum = options.templates[options.bucketIndex].find('td.statusNum');	

				options.templates[options.bucketIndex].find('span.status span').css({
					width: Math.floor(200 * ((options.itemIndex+1)/options.tweetBuckets[options.bucketIndex].items.length))
				});
				$statusNum.html((options.itemIndex+1)+'/'+options.tweetBuckets[options.bucketIndex].items.length);

				document.title = '(' + statusString + ') Followr - Running...';

				chrome.runtime.sendMessage({
					'message': 'setFavorited',
					data: _.extend(tweet, {
						query: options.tweetBuckets[options.bucketIndex].query,
						timeFavorited: (new Date()).getTime()
					})
				});
				twitter.favoriteTweet(tweet.id);

				// Last tweet send, close the window
				if (progressCounter >= options.numTweets) {
					window.close();
				}

			}, tweetInMilliseconds + (Math.random() * timeInbetweenTweets/2));
		};

		getNumTweets = function(tweetBuckets) {
			var numTweets = 0,
				a;
			for (a = 0; a < tweetBuckets.length; a++) {
				numTweets += tweetBuckets[a].items.length;
			}
			return numTweets;
		};

		twitter.getNewFollowers(function(followers) {

			$description.html('<img src="'+chrome.extension.getURL('/img/loader.gif')+'"> Calculating followers...');

			chrome.runtime.sendMessage({
				'message': 'setFollowersAndConversions',
				data: followers
			}, function(resp) {

				$description.html('<img src="'+chrome.extension.getURL('/img/loader.gif')+'"> Finding new tweets...');

				// Figure out which search query to use
				chrome.runtime.sendMessage({
					message: 'getSearchQueries'
				}, function(searchQueries) {
					var i,
						itemTemplate,
						templates = [];

					// format queries
					for (i = 0; i < searchQueries.length; i++) {
						searchQueries[i] = {
							query: searchQueries[i],
							items: []
						};
					}

					// Show search queries
					itemTemplate = _.template('<tr><td class="query"><%- query %></td><td><span class="status"><span></span></span></td><td class="statusNum">0/0</td></tr>');
					_.each(searchQueries, function(searchQuery, queryIndex) {
						var itemElement = itemTemplate(searchQuery);
						templates[queryIndex] = $(itemElement);
						$buckets.append(templates[queryIndex]);
					});

					twitter.getTweets(0, searchQueries, function(unfilteredTweetBuckets) {
						// If no tweets are returned from twitter, however unlikely,
						// exit.
						if (getNumTweets(unfilteredTweetBuckets) < 1) window.close();

						// Filter through results to make sure favorites not
						// already called.
						chrome.runtime.sendMessage({
							message: 'getNewTweets',
							data: {
								tweetBuckets: unfilteredTweetBuckets
							}
						}, function(tweetBuckets) {
							var a,
								i,
								numTweets = getNumTweets(tweetBuckets),
								randTweetMarker = [],
								$statusNum;

							if (!tweetBuckets.length || numTweets < 1) window.close();

							$description.html('Favoriting some tweets!');

							// Slowly favorite tweets over time and with randomness.
							for (a = 0; a < tweetBuckets.length; a++) {

								templates[a].find('td.statusNum').html('0/'+tweetBuckets[a].items.length);
								templates[a].addClass('show');

								for (i = 0; i < tweetBuckets[a].items.length; i++) {
									favoriteTweetIter({
										bucketIndex: a,
										itemIndex: i,
										tweetBuckets: tweetBuckets,
										numTweets: numTweets,
										templates: templates
									});	
								}
							}
						});
					});
				});
			});
		});
	};
});
