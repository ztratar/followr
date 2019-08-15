$(function() {
  $('.next-button').click(function() {
    $('.step-1').addClass('hide');
    $('.step-2').addClass('show');
    return false;
  });
});
