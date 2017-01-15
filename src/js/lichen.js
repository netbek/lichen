(function () {
  var $menu = jQuery('.lichen-region-header .sf-menu');

  jQuery('a[href="#"]', $menu).on('click', function (e) {
    e.preventDefault();
  });

  $menu.superfish({
    delay: 100,
    speed: 100,
    speedOut: 100
  });
})();
