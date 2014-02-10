/// Followr Inject.js

$(function() {
	var onTwitterCalledWithFollowr = (window.location.search.indexOf('?followr=true') !== -1),
		maxQueries = 20,
		twitter = {};

	// if on Twitter page from followr
	if (onTwitterCalledWithFollowr) {

		// Set Up Twitter API Calls
		twitter.authenticity_token = $('input[name="authenticity_token"]').val();

		if (twitter.authenticity_token) {
			// Set up the status interface
			var $followr = $('<div class="followr"></div>'),
				$followrWrap = $('<div class="followr-wrap"></div>'),
				$state = $('<span id="followr-state"></span>'),
				$description = $('<p class="state-descript">Favoriting some tweets!</p>');

			$followr.appendTo($('body'));
			$followrWrap.appendTo($followr);
			$description.appendTo($followrWrap);
			$state.appendTo($followrWrap);
		} else {
			window.close();
		}

		twitter.getTweets = function(query, cb) {
			query = encodeURIComponent(query);

			$.ajax({
				url: 'https://twitter.com/i/search/timeline?q=' + query + '&src=typd&include_available_features=1&include_entities=1&last_note_ts=0',
				dataType: 'json',
				success: function(data, d) {
					var itemHTML = data.inner ? data.inner.items_html : undefined,
						items = itemHTML ? itemHTML.match(/data-item-id="([0-9]{18})/g) : [];

					// Parsed html doesn't map propertly, but this is an
					// easy hack.
					//
					// TODO: make the regexp more accurate.
					items = $.map(items, function(item, j) {
						item = item.replace('data-item-id="', '');
						return ((j % 2) === 0) ? item : undefined;	
					});
					items.pop();

					if (items.length) {
						cb(items);
					} else {
						window.remove();
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
						var favoriteTweetIter = function(tweetNum, queryTweetMax) {
								var tweetId = tweets[tweetNum];

								chrome.runtime.sendMessage({
									'message': 'setFavorited',
									data: {
										id: tweetId
									}
								});

								twitter.favoriteTweet(tweetId, function(data) {
									// Add to Already Favorited DB									
									console.log(tweetNum, '>', tweets.length, searchQuery, searchQueries[searchQueries.length-1]);

									if ((tweetNum >= tweets.length || tweetNum >= queryTweetMax) && searchQuery === searchQueries[searchQueries.length-1]) {
										window.remove();
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
									queryTweetMax = Math.floor(maxQueries / searchQueries.length);
								if (j < queryTweetMax) {
									setTimeout(function() {
										$state.html(searchQuery + ': ' + (j+1) + '/' + queryTweetMax);
										favoriteTweetIter(j, queryTweetMax);	
									}, j * 7000 + Math.random() * 4000);
								}
							})();
						}
					});
				});
			});
		});
	}
});
