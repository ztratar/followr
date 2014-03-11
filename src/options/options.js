$(function() {
	var $followrForm = $("#followr-options"),
		$queries = $followrForm.find('textarea[name="queries"]'),
		$saveButton = $followrForm.find('input[type="submit"]');

	chrome.runtime.sendMessage({
		message: 'getSearchQueries'	
	}, function(data) {
		if (data.length) {
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
				window.close();
			}, 840);
		});

		return false;
	});

	$queries.focus();
});
