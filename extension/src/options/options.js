$(function() {
	var $followrForm = $("#followr-options"),
		$tweetNum = $followrForm.find('input[name="numTweets"]'),
		$queries = $followrForm.find('textarea[name="queries"]'),
		$saveButton = $followrForm.find('input[type="submit"]');

	chrome.runtime.sendMessage({
		message: 'getSearchQueries'	
	}, function(data) {
		$queries.val(data.join(', '));	
	});

	chrome.runtime.sendMessage({
		message: 'getMaxQueries'
	}, function(data) {
		if (typeof data === 'number') {
			$tweetNum.val(data);
		}
	});

	$tweetNum.on('change', function() {
		var val = parseInt($(this).val(), 10);
		if (val > 100) {
			$tweetNum.val(100);
		}
	});

	$followrForm.submit(function(e) {
		e.preventDefault();

		var numTweets = parseInt($tweetNum.val(), 10),
			queries = $queries.val(),
			parsedQueries = [],
			i;

		numTweets = numTweets || 20;

		if (numTweets > 100) numTweets = 100;

		queries = queries.split(',');
		for (i = 0; i < queries.length; i++) {
			trimmed = $.trim(queries[i]);
			if (trimmed !== '') {
				parsedQueries.push(trimmed);
			}
		}

		if (typeof numTweets !== 'number' ||
				parsedQueries.length < 1) {
			return false;
		}

		chrome.runtime.sendMessage({
			message: 'setOptions',
			data: {
				queries: parsedQueries,
				numTweets: numTweets	
			}
		}, function(data) {
			$('.saved').addClass('show');
			setTimeout(function() {
				chrome.runtime.sendMessage({
					message: 'forceRun'
				});
				window.close();
			}, 840);
		});

		return false;
	});

	$queries.focus();
});
