$(function() {
  $('.next-button').click(function() {
    $('.step-1').addClass('hide');
    $('.step-2').addClass('show');
    return false;
  });

  setTimeout(function() {
    setInterval(function() {
      chrome.runtime.sendMessage({
        message: 'getLoggedInStatus'
      }, function(loggedIn) {
        if (loggedIn) {
          $('li.log-in').addClass('active');
        } else {
          $('li.log-in').removeClass('active');
        }

        chrome.runtime.sendMessage({
          message: 'getSearchQueries'
        }, function(queries) {
          if (queries && queries.length) {
            $('li.add-topics').addClass('active');

            if (loggedIn) {
              setTimeout(function() {
                window.close();
              }, 2000);
            }
          }
        });
      });
    }, 1000);
  }, 1500);
});
