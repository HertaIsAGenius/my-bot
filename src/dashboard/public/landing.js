(function () {
  // Navbar solid on scroll
  var nav = document.getElementById('landingNav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // Mobile menu toggle
  var burger = document.getElementById('landingBurger');
  var menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      burger.classList.toggle('open');
      menu.classList.toggle('open');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        burger.classList.remove('open');
        menu.classList.remove('open');
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        var offset = nav ? nav.offsetHeight + 16 : 80;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  // Animate stat counters
  function animateCounters() {
    document.querySelectorAll('.hero-stat-value[data-count]').forEach(function (el) {
      if (el.dataset.animated) return;
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.dataset.animated = '1';
        var target = parseInt(el.dataset.count, 10) || 0;
        var duration = 1200;
        var start = performance.now();
        function step(now) {
          var progress = Math.min((now - start) / duration, 1);
          var ease = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * ease);
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }
    });
  }

  // Fade-in on scroll
  function fadeOnScroll() {
    document.querySelectorAll('.feature-card, .dual-row, .visual-card, .hero-stat').forEach(function (el) {
      if (el.dataset.visible) return;
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 60) {
        el.dataset.visible = '1';
        el.classList.add('visible');
      }
    });
  }

  window.addEventListener('scroll', function () {
    animateCounters();
    fadeOnScroll();
  });
  animateCounters();
  fadeOnScroll();
})();
