$(function() {

	var query = 'gates%20out',
		xhr = $.ajax({
			url: 'https://twitter.com/i/search/timeline?q='+query+'&src=typd&include_available_features=1&include_entities=1&last_note_ts=0',
			dataType: 'json',
			success: function(data, d) {
				var $followr = $('<div class="followr"></div>'),
					$followrWrap = $('<div class="followr-wrap"></div>'),
					$state = $('<span id="followr-state"></span>'),
					$description = $('<p class="state-descript">Favoriting some tweets!</p>');
					itemHTML = data.inner ? data.inner.items_html : undefined,
					items = itemHTML ? itemHTML.match(/data-item-id="([0-9]{18})/g) : [],
					i = 0;

				$followr.appendTo($('body'));
				$followrWrap.appendTo($followr);
				$description.appendTo($followrWrap);
				$state.appendTo($followrWrap);

				items = $.map(items, function(item, j) {
					return ((j % 2) === 0) ? item : undefined;	
				});

				if (items.length) {
					$state.html('0/' + items.length);
					for (i = 0; i < items.length; i++) {
						(function(i) {
							var id = items[i].replace('data-item-id="', '');
							setTimeout(function() {
								$.ajax({
									url: 'https://twitter.com/i/tweet/favorite',
									dataType: 'json',
									type: 'POST',
									data: {
										'authenticity_token': '05a177e73229f864c161b46fc433d9e7bbe42b34',
										'id': id
									},
									success: function(data) {
										console.log('favorited', 'http://twitter.com/heyadam/status/' + id);
										$state.html((i+1)+'/'+items.length);
										if ((i+1) >= items.length) {
											$followr.remove();
										}
									}
								});
							}, i * 700 + Math.random()*300);
						})(i);
					}
				} else {
					$followrWrap.remove();
				}
			}
		});

	chrome.extension.sendMessage({}, function(response) {
		var readyStateCheckInterval = setInterval(function() {
			if (document.readyState === "complete") {
				clearInterval(readyStateCheckInterval);

				// ----------------------------------------------------------
				// This part of the script triggers when page is done loading
				console.log("Hello. This message was sent from scripts/inject.js");
				// ----------------------------------------------------------

			}
		}, 10);
	});
});
