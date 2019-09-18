/// Followr Inject.js

window.followrSendUserInfo = function(options) {
  options = options || {};
  document.title = 'Followr - Finding Avatar';
  $(function() {
    const html = $('body').html();
    const matchRegex = /"entities":{"users":{"entities":{"(\d+)"/
    const matches = matchRegex.exec(html);
    const userId = matches ? matches[1] : null;

    if (!userId) return;

    $.ajax({
      url: 'https://api.twitter.com/1.1/users/show.json?user_id=' + userId,
      dataType: 'json',
      headers: {
        authorization: options.twitter.authorization,
        "x-csrf-token": options.twitter.xcsrfToken
      },
      success: function(data) {
        chrome.runtime.sendMessage({
          message: 'setUserInfo',
          data: {
            id: userId,
            img: data.profile_image_url_https,
            name: data.name,
            username: data.screen_name
          }
        });
        if (options && options.closeWindow) {
          window.close();
        }
      }
    });
  });
};

$(function() {
  var maxQueries = 12, // default queries
    maxTopicsPerIteration = 5,
    timeInbetweenTweets = 1500,
    bindScoreToRealUserAction,
    addToScore,
    favoriteTweetIter,
    getNumTweets,
    unfavoriteOldTweets,
    runFollowr,
    blacklist = [],
    twitter = {};

  // Get MaxQueries -- not too worried about the race condition
  chrome.runtime.sendMessage({
    message: 'getMaxQueries'
  }, function(mQ) {
    maxQueries = mQ;
  });

  chrome.runtime.sendMessage({
    message: 'getBlacklist'
  }, function(data) {
    blacklist = data || [];
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

  runFollowr = function(data = {}) {
    setTimeout(function() {
      // If after a minute passes the window hasn't closed, close it
      window.close();
    }, 1000 * 60);

    chrome.runtime.sendMessage({
      'message': 'runningStatus'
    });

    // Set Up Twitter API Calls
    twitter.authorization = data.authorization;
    twitter.xcsrfToken = data['x-csrf-token'];

    if (twitter.authorization && $('a[href="/compose/tweet"]').length > 0) {
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
      return;
    }

    window.followrSendUserInfo({ twitter: twitter });

    twitter.getTweets = function(currentQueryIndex, queries, cb, options) {
      var url,
        query = queries[currentQueryIndex];

      options = options || {};

      var q = query.query;
      if (q.split(' ').length > 1) {
        q = '"' + q + '"';
      }

      url = 'https://api.twitter.com/2/search/adaptive.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_composer_source=true&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&q=' + encodeURIComponent(q) + '&count=20&query_source=typed_query&pc=1&spelling_corrections=1&ext=mediaStats%2ChighlightedLabel%2CcameraMoment&tweet_search_mode=live';

      if (options && options.lastTweet) {
        lastTweetDate = new Date(options.lastTweet.created_at);
        year = lastTweetDate.getFullYear();
        month = lastTweetDate.getMonth();
        day = lastTweetDate.getDate();
        url += '&until=' + year + '-' + month + '-' + day;
      }

      $.ajax({
        url: url,
        dataType: 'json',
        headers: {
          authorization: twitter.authorization,
          "x-csrf-token": twitter.xcsrfToken
        },
        success: function(data, d) {
          if (!data || !data.globalObjects || !data.globalObjects.tweets) {
            window.close();
            return;
          }

          const newTweets = data.globalObjects.tweets;
          const newUsers = data.globalObjects.users;
          let items = [];

          for (let id in newTweets) {
            let item = newTweets[id];
            let user = _.findWhere(newUsers, { id: item.user_id });
            let inBlacklist = false;

            if (!user) {
              return;
            }

            for (var blacklistItem in blacklist) {
              if (item.full_text.indexOf(blacklist[blacklistItem]) !== -1
                  || user.screen_name.indexOf(blacklist[blacklistItem]) !== -1
                  || user.name.indexOf(blacklist[blacklistItem]) !== -1) {
                inBlacklist = true;
              }
            }

            if (!inBlacklist) {
              items.push({
                id: id,
                converted: false,
                user: {
                  id: item.user_id,
                  screen_name: user.screen_name,
                  name: user.name
                },
                created_at: item.created_at,
                text: item.full_text
              });
            }
          }

          numNewItems = newTweets.length;
          queries[currentQueryIndex].items = queries[currentQueryIndex].items.concat(items);
          items = queries[currentQueryIndex].items;

          if (items.length <= 50 && numNewItems > 10) {
            // get more items for same query
            twitter.getTweets(currentQueryIndex, queries, cb, {
              lastTweet: items[items.length-1]
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
        url: 'https://api.twitter.com/1.1/favorites/create.json',
        dataType: 'json',
        type: 'POST',
        headers: {
          authorization: twitter.authorization,
          "x-csrf-token": twitter.xcsrfToken
        },
        data: {
          'id': id,
          tweet_mode: 'extended'
        },
        success: function(data) {
          if (cb) cb(data);
        }
      });
    };
    twitter.unfavoriteTweet = function(id) {
      $.ajax({
        url: 'https://api.twitter.com/1.1/favorites/destroy.json',
        dataType: 'json',
        type: 'POST',
        headers: {
          authorization: twitter.authorization,
          "x-csrf-token": twitter.xcsrfToken
        },
        data: {
          'id': id
        }
      });
    };
    twitter.getNewFollowers = function(cb) {
      $.ajax({
        url: 'https://api.twitter.com/1.1/followers/list.json?user_id=36782854&count=50',
        dataType: 'json',
        type: 'GET',
        headers: {
          authorization: twitter.authorization,
          "x-csrf-token": twitter.xcsrfToken
        },
        success: function(resp) {
          const ids = (resp && resp.users) ? resp.users.map((r) => r.id) : [];
          if (cb) cb(ids);
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

    unfavoriteOldTweets = function() {
      chrome.runtime.sendMessage({
        'message': 'getAndClearOldTweets'
      }, function(tweets) {
        var i,
          unfavTweetHelper = function(id, iter) {
            _.delay(function() {
              twitter.unfavoriteTweet(id);
            }, iter * 1000);
          };

        for (i = 0; i < tweets.length; i++) {
          unfavTweetHelper(tweets[i].id, i);
        }
      });
    };

    unfavoriteOldTweets();

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

          searchQueries = _.take(_.shuffle(searchQueries), maxTopicsPerIteration);

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
            if (getNumTweets(unfilteredTweetBuckets) < 1) {
              window.close();
            }

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

              if (!tweetBuckets.length || numTweets < 1) {
                window.close();
              }

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

  chrome.runtime.sendMessage({
    message: 'getAuthHeaders'
  }, function(data) {
    runFollowr(data);
  });
});
