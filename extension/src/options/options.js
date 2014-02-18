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

	$followrForm.submit(function(e) {
		e.preventDefault();

		var numTweets = parseInt($tweetNum.val(), 10),
			queries = $queries.val(),
			i;

		numTweets = numTweets || 10;

		queries = queries.split(',');
		for (i = 0; i < queries.length; i++) {
			queries[i] = $.trim(queries[i]);
		}

		chrome.runtime.sendMessage({
			message: 'setOptions',
			data: {
				queries: queries,
				numTweets: numTweets	
			}
		}, function(data) {
			$saveButton.val('Saved!').addClass('saved');	
			setTimeout(function() {
				chrome.runtime.sendMessage({
					message: 'forceRun'
				});
				window.close();
			}, 500);
		});

		return false;
	});

	$queries.focus();
});
