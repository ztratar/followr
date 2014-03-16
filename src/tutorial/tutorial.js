$(function() {
	$('.next-button').click(function() {
		var optionsUrl = chrome.extension.getURL('options.html');
		chrome.tabs.update({ url: optionsUrl });
		return false;	
	});
});
