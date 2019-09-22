$(function() {
  chrome.runtime.sendMessage({
    message: 'setLoggedInStatus',
    data: $('.StaticLoggedOutHomePage').length === 0
  });
});
