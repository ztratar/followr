$(function() {
	var $followrForm = $("#followr-options"),
		$queries = $followrForm.find('textarea[name="queries"]'),
		$saveButton = $followrForm.find('input[type="submit"]');

	chrome.runtime.sendMessage({
		message: 'getSearchQueries'	
	}, function(data) {
		if (data && data.length) {
			$queries.val(data.join(', '));	
		}
	});

	$followrForm.submit(function(e) {
		e.preventDefault();

		var queries = $queries.val(),
			parsedQueries = [],
			i;

		queries = queries.split(',');
		for (i = 0; i < queries.length; i++) {
			trimmed = $.trim(queries[i]);
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
				queries: parsedQueries
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
