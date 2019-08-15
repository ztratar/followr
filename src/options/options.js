// Fill in the user avatar
$(function() {
  chrome.runtime.sendMessage({
    message: 'getUserInfo'
  }, function(data) {
    if (data && data.user && data.user.username) {
      $('.user-info img').attr('src', data.user.img);
      $('.user-info h4').html('Welcome, @' + data.user.username);
      if (data.numFollowersGained) {
        $('.user-info span strong').html(data.numFollowersGained);
      }
    } else {
      $('.user-info img').hide();
      $('.user-info')
        .html('Start your first campaign!')
        .css('padding', '18px 0 0 0');
      $('.user-info span').hide();
    }
  });
});

$(function() {
  var $followrForm = $("#followr-options"),
    $queries = $followrForm.find('textarea[name="queries"]'),
    $blacklisted = $followrForm.find('input[name="blacklist"]'),
    $navSetupBtn = $('.options-nav a.setup'),
    $navHistoryBtn = $('.options-nav a.history'),
    $setupPage = $('.setup-page'),
    $historyPage = $('.history-page'),
    $historyTweetList = $('.history-page ul.tweet-list'),
    $saveButton = $followrForm.find('input[type="submit"]');

  chrome.runtime.sendMessage({
    message: 'getSearchQueries'
  }, function(data) {
    if (data && data.length) {
      $queries.val(data.join(', '));
    }
  });

  chrome.runtime.sendMessage({
    message: 'getBlacklist'
  }, function(data) {
    if (data && data.length) {
      $blacklisted.val(data.join(', '));
    }
  });

  function refreshHistory() {
    var tweetTemplate = _.template('<li><a href="http://twitter.com/<%- user.username %>/status/<%- id %>" target="_blank"><img src="http://avatars.io/twitter/<%- user.username %>"><h4><strong><%- user.name %></strong> &mdash; @<%- user.username %></h4><p><%- text %></p><span><%- query.replace("_", " ") %><span><%- timeFavorited %></span></span><% if (converted) { %><span class="converted">converted!</span><% } %></a></li>');

    $historyTweetList.html('');

    chrome.runtime.sendMessage({
      'message': 'getTweetHistory'
    }, function(tweets) {
      if (tweets.length) {
        _.each(tweets, function(tweet, tweetIndex) {
          var tweetHtml = tweetTemplate(_.extend({ converted: false }, tweet, {
            timeFavorited: moment(tweet.timeFavorited).fromNow()
          }));
          $historyTweetList.append(tweetHtml);
        });
      } else {
        $historyTweetList.append('<li class="empty"><h2>Followr hasn\'t favorited anything yet!</h2><span>Click setup, fill in some search terms, and click start.<span></li>');
      }
    });
  }

  $navSetupBtn.on('click', function() {
    $navSetupBtn.addClass('active');
    $navHistoryBtn.removeClass('active');
    $setupPage.show();
    $historyPage.hide();
  });

  $navHistoryBtn.on('click', function() {
    $navSetupBtn.removeClass('active');
    $navHistoryBtn.addClass('active');
    $setupPage.hide();
    $historyPage.show();
    refreshHistory();
  });

  $followrForm.submit(function(e) {
    e.preventDefault();

    var queries = $queries.val(),
      blacklistStr = $blacklisted.val(),
      blacklisted = blacklistStr.length > 0 ? blacklistStr.split(/\s|, |,/) : [],
      parsedQueries = [],
      i;

    queries = queries.split(',');

    for (i = 0; i < queries.length; i++) {
      trimmed = $.trim(queries[i]);
      trimmed = trimmed.replace('"', '');
      if (trimmed !== '') {
        parsedQueries.push(trimmed);
      }
    }

    if (parsedQueries.length < 1) {
      return false;
    }

    chrome.runtime.sendMessage({
      message: 'setOptions',
      data: {
        queries: parsedQueries,
        blacklisted: blacklisted
      }
    }, function(data) {
      $('.saved').addClass('show');
      setTimeout(function() {
        chrome.runtime.sendMessage({
          message: 'forceRun'
        });
        chrome.tabs.query({
          title: 'Followr Tutorial'
        }, function(tabs) {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.remove(tabs[0].id);
          }
        });
        window.close();
      }, 840);
    });

    return false;
  });

  // Default focus only applies on popup when delayed
  $queries.focus();
  setTimeout(function () { $queries.focus(); }, 300);
});

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-48998506-2']);
_gaq.push(['_trackPageview', '/options']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
