$(function() {
  chrome.runtime.sendMessage({
    message: 'setLoggedInStatus',
    data: $('.StaticLoggedOutHomePage').length === 0
  });

  if ($('.StaticLoggedOutHomePage').length === 0) {
    setTimeout(function() {
      // Logged in
      chrome.runtime.sendMessage({
        message: 'getSearchQueries'
      }, function(queries) {
        const imageUrl = chrome.extension.getURL('/icons/icon48.png');
        if (!queries || queries.length === 0) {
          var $followrAddQueriesNotif = $('<div class="followr-add-queries-notif"><img src="'+imageUrl+'">Add topics in followr to gain followers!</div>');
          $followrAddQueriesNotif.appendTo($('body'));
          setTimeout(function() {
            $followrAddQueriesNotif.addClass('active');
          }, 200);
          chrome.runtime.sendMessage({
            message: 'sendAnalyticsEvent',
            data: {
              eventCategory: 'backend',
              eventAction: 'show add queries notification'
            }
          });
          setTimeout(function() {
            $followrAddQueriesNotif.removeClass('active');
          }, 6000);
        }
      });
    }, 5000);
  }
});
